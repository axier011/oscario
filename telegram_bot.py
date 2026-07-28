"""
telegram_bot.py — Bot de Telegram para Oscario (acuario automático)
Requiere: python-telegram-bot==21.0

Comandos:
  /start          Bienvenida + tu Chat ID (para configurar acceso)
  /status         Estado actual de todos los dispositivos
  /on <nombre>    Encender un dispositivo  (ej: /on filtro)
  /off <nombre>   Apagar un dispositivo    (ej: /off luz)
  /dia            Activar escena Día
  /noche          Activar escena Noche
  /alimentar      Pulso del comedero (2 segundos)
  /mantenimiento  Activar escena Mantenimiento
  /ayuda          Lista de comandos

Seguridad: sólo los chat_ids listados en telegram.cfg pueden enviar órdenes.
"""
from __future__ import annotations

import asyncio
import configparser
import logging
import os
from typing import Any, Callable, Awaitable

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logger = logging.getLogger("aquapi.telegram")

# ── Estado interno ────────────────────────────────────────────────
_app: Application | None = None
_toggle_fn: Callable[..., Awaitable[dict]] | None = None
_get_db_ctx: Callable | None = None
_allowed: set[int] = set()
_last_alert: dict[str, float] = {}  # cooldown tracking para notificaciones

# ── Mapas de nombre → pin_number ──────────────────────────────────
# Acepta tanto el nombre corto como el nombre completo de la DB
PIN_ALIASES: dict[str, int] = {
    "luz":          11,
    "blanca":       11,
    "luz blanca":   11,
    "azul":         13,
    "luz azul":     13,
    "filtro":       15,
    "bomba":        16,
    "bomba agua":   16,
    "oxigenador":   18,
    "oxig":         18,
    "calentador":   22,
    "calor":        22,
    "comedero":     29,
    "feeder":       29,
    "motor":        31,
    "motor corriente": 31,
}

# ── Escenas {pin_number: estado_deseado} ──────────────────────────
SCENES: dict[str, dict[int, int]] = {
    "dia": {
        11: 1,  # Luz Blanca ON
        13: 0,  # Luz Azul OFF
        15: 1,  # Filtro ON
        18: 1,  # Oxigenador ON
        22: 1,  # Calentador ON
        29: 0,  # Comedero OFF
    },
    "noche": {
        11: 0,  # Luz Blanca OFF
        13: 0,  # Luz Azul OFF
        15: 1,  # Filtro ON
        18: 1,  # Oxigenador ON
        22: 1,  # Calentador ON
        29: 0,  # Comedero OFF
    },
    "mantenimiento": {
        11: 1,  # Luz Blanca ON
        13: 0,  # Luz Azul OFF
        15: 0,  # Filtro OFF
        16: 0,  # Bomba OFF
        18: 0,  # Oxigenador OFF
        22: 0,  # Calentador OFF
        29: 0,  # Comedero OFF
        31: 0,  # Motor OFF
    },
}

# ── Nombres de escena para respuestas ─────────────────────────────
SCENE_LABELS: dict[str, str] = {
    "dia": "🌞 Día",
    "noche": "🌙 Noche",
    "mantenimiento": "🔧 Mantenimiento",
}

# ── Iconos por dispositivo ────────────────────────────────────────
PIN_ICONS: dict[int, str] = {
    11: "💡",  # Luz Blanca
    13: "🔵",  # Luz Azul
    15: "🌀",  # Filtro
    16: "💧",  # Bomba
    18: "🫧",  # Oxigenador
    22: "🔥",  # Calentador
    29: "🍽️",  # Comedero
    31: "⚙️",  # Motor
}

# Pines que se muestran en /status (en orden)
VISIBLE_PINS = [11, 13, 15, 16, 18, 22, 29, 31]


# ── Utilidades ────────────────────────────────────────────────────

def get_alert_config() -> dict:
    """Lee la sección [alerts] de telegram.cfg."""
    import configparser as _cp
    cfg = _cp.ConfigParser()
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram.cfg")
    cfg.read(cfg_path, encoding="utf-8")

    def _float(key: str, fallback: float) -> float:
        try:
            return cfg.getfloat("alerts", key, fallback=fallback)
        except Exception:
            return fallback

    def _int(key: str, fallback: int) -> int:
        try:
            return cfg.getint("alerts", key, fallback=fallback)
        except Exception:
            return fallback

    raw_pins = cfg.get("alerts", "critical_pins", fallback="").strip()
    critical_pins = [int(p.strip()) for p in raw_pins.split(",") if p.strip().isdigit()]

    return {
        "temp_sensor":         cfg.get("alerts", "temp_sensor", fallback="temperatura").strip(),
        "temp_min":            _float("temp_min", 24.0),
        "temp_max":            _float("temp_max", 28.0),
        "critical_pins":       critical_pins,
        "alert_if_off_minutes":_int("alert_if_off_minutes", 60),
        "cooldown_minutes":    _int("cooldown_minutes", 30),
    }


def should_alert(key: str, cooldown_minutes: int) -> bool:
    """True si ha pasado suficiente tiempo desde la última alerta de este tipo."""
    import time
    now = time.time()
    if now - _last_alert.get(key, 0) >= cooldown_minutes * 60:
        _last_alert[key] = now
        return True
    return False


def reset_alert(key: str) -> None:
    """Elimina el cooldown de una alerta (p.ej. cuando el pin vuelve a ON)."""
    _last_alert.pop(key, None)


async def notify_all(message: str) -> None:
    """Envía un mensaje a todos los chat_ids autorizados."""
    if _app is None:
        return
    for chat_id in _allowed:
        try:
            await _app.bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")
        except Exception as exc:
            logger.error(f"Error enviando notificación a {chat_id}: {exc}")


def _load_config() -> tuple[str, set[int]]:
    """Lee token y allowed_chats de telegram.cfg."""
    cfg = configparser.ConfigParser()
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram.cfg")
    cfg.read(cfg_path, encoding="utf-8")
    token = cfg.get("bot", "token", fallback="").strip()
    if not token:
        token = os.getenv("TELEGRAM_TOKEN", "")
    raw = cfg.get("bot", "allowed_chats", fallback="").strip()
    allowed: set[int] = set()
    for part in raw.split(","):
        p = part.strip()
        if p.lstrip("-").isdigit():
            allowed.add(int(p))
    return token, allowed


def _is_allowed(update: Update) -> bool:
    if not _allowed:
        return True  # Sin restricción si allowed_chats está vacío
    return (update.effective_chat.id in _allowed) if update.effective_chat else False


async def _set_pin_to(pin_number: int, desired: int) -> bool:
    """Pone un pin en el estado deseado. Devuelve True si cambió."""
    async with _get_db_ctx() as db:  # type: ignore[misc]
        async with db.execute(
            "SELECT current_state FROM pin_configurations WHERE pin_number = ?",
            (pin_number,),
        ) as cur:
            row = await cur.fetchone()
    if row is None:
        return False
    if int(row["current_state"]) != desired:
        await _toggle_fn(pin_number, source="TELEGRAM")  # type: ignore[misc]
        return True
    return False


async def _get_status() -> list[dict[str, Any]]:
    """Devuelve nombre y estado de los pines visibles."""
    async with _get_db_ctx() as db:  # type: ignore[misc]
        async with db.execute(
            "SELECT pin_number, name, current_state FROM pin_configurations "
            "WHERE pin_number IN ({})".format(",".join("?" * len(VISIBLE_PINS))),
            VISIBLE_PINS,
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
    # Ordenar según VISIBLE_PINS
    order = {p: i for i, p in enumerate(VISIBLE_PINS)}
    rows.sort(key=lambda r: order.get(r["pin_number"], 99))
    return rows


# ── Handlers ──────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id if update.effective_chat else "?"
    allowed_note = (
        "✅ Tienes acceso autorizado."
        if (not _allowed or chat_id in _allowed)
        else f"⛔ Tu chat ID *{chat_id}* no está en la lista de acceso.\n"
             "Añádelo en `telegram.cfg` → `allowed_chats` y reinicia el servicio."
    )
    await update.message.reply_text(  # type: ignore[union-attr]
        f"🐠 *Bienvenido a Oscario*\n\n"
        f"Tu Chat ID es: `{chat_id}`\n"
        f"{allowed_note}\n\n"
        f"Usa /ayuda para ver los comandos disponibles.",
        parse_mode="Markdown",
    )


async def cmd_ayuda(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    text = (
        "📋 *Comandos disponibles:*\n\n"
        "/status — Estado de todos los dispositivos\n"
        "/on `<nombre>` — Encender (ej: `/on filtro`)\n"
        "/off `<nombre>` — Apagar (ej: `/off luz`)\n"
        "/dia — Escena Día 🌞\n"
        "/noche — Escena Noche 🌙\n"
        "/alimentar — Pulso del comedero 🍽️\n"
        "/mantenimiento — Escena Mantenimiento 🔧\n\n"
        "*Nombres válidos:*\n"
        "`luz` · `azul` · `filtro` · `bomba` · `oxigenador` · `calentador` · `comedero` · `motor`"
    )
    await update.message.reply_text(text, parse_mode="Markdown")  # type: ignore[union-attr]


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    rows = await _get_status()
    lines = ["🐠 *Estado del acuario:*\n"]
    for r in rows:
        icon = PIN_ICONS.get(r["pin_number"], "•")
        state = "🟢 ON" if r["current_state"] else "⚫ OFF"
        lines.append(f"{icon} {r['name']} — {state}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")  # type: ignore[union-attr]


async def cmd_on(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    args = " ".join(ctx.args or []).lower().strip()  # type: ignore[union-attr]
    pin = PIN_ALIASES.get(args)
    if pin is None:
        await update.message.reply_text(  # type: ignore[union-attr]
            f"❓ No reconozco *{args}*.\nNombres válidos: {', '.join(sorted(set(PIN_ALIASES.keys())))}",
            parse_mode="Markdown",
        )
        return
    changed = await _set_pin_to(pin, 1)
    icon = PIN_ICONS.get(pin, "•")
    msg = f"{icon} *{args.title()}* encendido ✅" if changed else f"{icon} *{args.title()}* ya estaba encendido."
    await update.message.reply_text(msg, parse_mode="Markdown")  # type: ignore[union-attr]


async def cmd_off(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    args = " ".join(ctx.args or []).lower().strip()  # type: ignore[union-attr]
    pin = PIN_ALIASES.get(args)
    if pin is None:
        await update.message.reply_text(  # type: ignore[union-attr]
            f"❓ No reconozco *{args}*.\nNombres válidos: {', '.join(sorted(set(PIN_ALIASES.keys())))}",
            parse_mode="Markdown",
        )
        return
    changed = await _set_pin_to(pin, 0)
    icon = PIN_ICONS.get(pin, "•")
    msg = f"{icon} *{args.title()}* apagado ✅" if changed else f"{icon} *{args.title()}* ya estaba apagado."
    await update.message.reply_text(msg, parse_mode="Markdown")  # type: ignore[union-attr]


async def _apply_scene(scene_key: str, update: Update) -> None:
    pins = SCENES[scene_key]
    for pin_number, desired in pins.items():
        await _set_pin_to(pin_number, desired)
    label = SCENE_LABELS.get(scene_key, scene_key)
    await update.message.reply_text(f"✅ Escena *{label}* activada.", parse_mode="Markdown")  # type: ignore[union-attr]


async def cmd_dia(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    await _apply_scene("dia", update)


async def cmd_noche(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    await _apply_scene("noche", update)


async def cmd_mantenimiento(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    await _apply_scene("mantenimiento", update)


async def cmd_alimentar(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text("⛔ No tienes acceso.")  # type: ignore[union-attr]
        return
    await update.message.reply_text("🍽️ Activando comedero…")  # type: ignore[union-attr]
    # Encender Luz Blanca (pin 11)
    await _set_pin_to(11, 1)
    await asyncio.sleep(0.5)
    # Encender comedero (pin 29)
    await _set_pin_to(29, 1)
    await asyncio.sleep(2.0)
    # Apagar comedero
    await _set_pin_to(29, 0)
    await update.message.reply_text("✅ Comedero activado y apagado.", parse_mode="Markdown")  # type: ignore[union-attr]


# ── Lifecycle ─────────────────────────────────────────────────────

async def start_telegram_bot(toggle_pin_fn: Callable, get_db_ctx: Callable) -> None:
    """
    Inicia el bot de Telegram en background.
    Llamar desde el lifespan de FastAPI pasando toggle_pin y get_db.
    """
    global _app, _toggle_fn, _get_db_ctx, _allowed

    token, _allowed = _load_config()
    if not token:
        logger.warning("⚠️  Telegram: no hay token configurado en telegram.cfg — bot desactivado.")
        return

    _toggle_fn = toggle_pin_fn
    _get_db_ctx = get_db_ctx

    _app = (
        Application.builder()
        .token(token)
        .build()
    )

    _app.add_handler(CommandHandler("start",          cmd_start))
    _app.add_handler(CommandHandler("ayuda",          cmd_ayuda))
    _app.add_handler(CommandHandler("help",           cmd_ayuda))
    _app.add_handler(CommandHandler("status",         cmd_status))
    _app.add_handler(CommandHandler("on",             cmd_on))
    _app.add_handler(CommandHandler("off",            cmd_off))
    _app.add_handler(CommandHandler("dia",            cmd_dia))
    _app.add_handler(CommandHandler("noche",          cmd_noche))
    _app.add_handler(CommandHandler("alimentar",      cmd_alimentar))
    _app.add_handler(CommandHandler("feed",           cmd_alimentar))
    _app.add_handler(CommandHandler("mantenimiento",  cmd_mantenimiento))

    await _app.initialize()
    await _app.start()
    await _app.updater.start_polling(drop_pending_updates=True)  # type: ignore[union-attr]

    mode = "sin restricción" if not _allowed else f"chats autorizados: {_allowed}"
    logger.info(f"✅ Bot de Telegram iniciado ({mode})")


async def stop_telegram_bot() -> None:
    """Para el bot de Telegram limpiamente."""
    global _app
    if _app is None:
        return
    try:
        await _app.updater.stop()  # type: ignore[union-attr]
        await _app.stop()
        await _app.shutdown()
        logger.info("🛑 Bot de Telegram detenido")
    except Exception as exc:
        logger.error(f"Error al detener bot de Telegram: {exc}")
    finally:
        _app = None
