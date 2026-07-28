"""
╔══════════════════════════════════════════════════════════════════╗
║         AquaPi Control System — Backend API v1.0                ║
║         FastAPI + SQLite (WAL) + GPIO + WebSockets              ║
╚══════════════════════════════════════════════════════════════════╝
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional

import aiosqlite
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────
# GPIO ABSTRACTION  (real RPi.GPIO o mock para desarrollo en PC)
# ─────────────────────────────────────────────────────────────────
try:
    import RPi.GPIO as GPIO  # type: ignore

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO_AVAILABLE = True
    logging.info("✅ RPi.GPIO disponible — modo HARDWARE activo")
except ImportError:
    GPIO_AVAILABLE = False
    logging.warning("⚠️  RPi.GPIO no disponible — modo SIMULACIÓN activo")

    class _MockGPIO:
        BCM = OUT = IN = HIGH = LOW = 0
        _state: dict[int, int] = {}

        def setmode(self, m: int) -> None: ...
        def setwarnings(self, w: bool) -> None: ...
        def setup(self, pin: int, direction: int, **kw) -> None:
            self._state.setdefault(pin, 0)
        def output(self, pin: int, value: int) -> None:
            self._state[pin] = value
        def input(self, pin: int) -> int:
            return self._state.get(pin, 0)
        def cleanup(self) -> None: ...

    GPIO = _MockGPIO()  # type: ignore


# ─────────────────────────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────────────────────────
DB_PATH = "database.db"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("aquapi")


# ─────────────────────────────────────────────────────────────────
# CONFIGURACIÓN POR DEFECTO DE LOS 40 PINES — Raspberry Pi 4B
# Formato: (pin_number, bcm_number, name, pin_type, is_active_low, current_state)
# pin_type: POWER_3V3 | POWER_5V | GROUND | GPIO_OUTPUT | GPIO_INPUT |
#           GPIO_SPI | GPIO_I2C | GPIO_UART | GPIO_PWM | GPIO_CLOCK | ID_EEPROM
# ─────────────────────────────────────────────────────────────────
DEFAULT_PINS: list[tuple] = [
    (1,  -1, "3V3 Power",         "POWER_3V3",   False, 1),
    (2,  -1, "5V Power",          "POWER_5V",    False, 1),
    (3,   2, "GPIO2 (I2C SDA)",   "GPIO_I2C",    False, 0),
    (4,  -1, "5V Power",          "POWER_5V",    False, 1),
    (5,   3, "GPIO3 (I2C SCL)",   "GPIO_I2C",    False, 0),
    (6,  -1, "Ground",            "GROUND",      False, 0),
    (7,   4, "GPIO4 (GPCLK0)",    "GPIO_CLOCK",  False, 0),
    (8,  14, "GPIO14 (UART TXD)", "GPIO_UART",   False, 0),
    (9,  -1, "Ground",            "GROUND",      False, 0),
    (10, 15, "GPIO15 (UART RXD)", "GPIO_UART",   False, 0),
    (11, 17, "Luz Blanca",        "GPIO_PWM",    False, 0),
    (12, 18, "GPIO18 (PCM CLK)",  "GPIO_PWM",    False, 0),
    (13, 27, "Luz Azul",          "GPIO_PWM",    False, 0),
    (14, -1, "Ground",            "GROUND",      False, 0),
    (15, 22, "Filtro",            "GPIO_OUTPUT", False, 0),
    (16, 23, "Bomba Agua",        "GPIO_OUTPUT", False, 0),
    (17, -1, "3V3 Power",        "POWER_3V3",   False, 1),
    (18, 24, "Oxigenador",        "GPIO_OUTPUT", False, 0),
    (19, 10, "GPIO10 (SPI MOSI)", "GPIO_SPI",    False, 0),
    (20, -1, "Ground",            "GROUND",      False, 0),
    (21,  9, "GPIO9 (SPI MISO)",  "GPIO_SPI",    False, 0),
    (22, 25, "Calentador",        "GPIO_OUTPUT", False, 0),
    (23, 11, "GPIO11 (SPI SCLK)", "GPIO_SPI",    False, 0),
    (24,  8, "GPIO8 (SPI CE0)",   "GPIO_SPI",    False, 0),
    (25, -1, "Ground",            "GROUND",      False, 0),
    (26,  7, "GPIO7 (SPI CE1)",   "GPIO_SPI",    False, 0),
    (27,  0, "GPIO0 (ID SD)",     "ID_EEPROM",   False, 0),
    (28,  1, "GPIO1 (ID SC)",     "ID_EEPROM",   False, 0),
    (29,  5, "Comedero Auto",     "GPIO_OUTPUT", False, 0),
    (30, -1, "Ground",            "GROUND",      False, 0),
    (31,  6, "Motor Corriente",   "GPIO_PWM",    False, 0),
    (32, 12, "GPIO12 (PWM0)",     "GPIO_PWM",    False, 0),
    (33, 13, "GPIO13 (PWM1)",     "GPIO_PWM",    False, 0),
    (34, -1, "Ground",            "GROUND",      False, 0),
    (35, 19, "GPIO19 (PCM FS)",   "GPIO_PWM",    False, 0),
    (36, 16, "GPIO16",            "GPIO_OUTPUT", False, 0),
    (37, 26, "GPIO26",            "GPIO_OUTPUT", False, 0),
    (38, 20, "GPIO20 (PCM DIN)",  "GPIO_OUTPUT", False, 0),
    (39, -1, "Ground",            "GROUND",      False, 0),
    (40, 21, "GPIO21 (PCM DOUT)", "GPIO_OUTPUT", False, 0),
]

# Pines GPIO que pueden ser controlables (BCM >= 0 y tipo GPIO_OUTPUT o GPIO_INPUT)
CONTROLLABLE_TYPES = {"GPIO_OUTPUT", "GPIO_INPUT", "GPIO_PWM", "GPIO_CLOCK"}


# ─────────────────────────────────────────────────────────────────
# GESTOR DE CONEXIONES WEBSOCKET
# ─────────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self) -> None:
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)
        logger.info(f"🔌 WebSocket conectado — total: {len(self._clients)}")

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.remove(ws)
        logger.info(f"🔌 WebSocket desconectado — total: {len(self._clients)}")

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """Emite JSON a todos los clientes conectados en paralelo."""
        if not self._clients:
            return
        message = json.dumps(payload, ensure_ascii=False, default=str)
        dead: list[WebSocket] = []
        for client in self._clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)
        for d in dead:
            self._clients.remove(d)


manager = ConnectionManager()


# ─────────────────────────────────────────────────────────────────
# CAPA DE BASE DE DATOS
# ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def get_db() -> aiosqlite.Connection:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.execute("PRAGMA cache_size=-32000")   # 32 MB cache
        yield db


async def init_db() -> None:
    """Crea las tablas si no existen e inserta configuración por defecto."""
    async with get_db() as db:
        # ── pin_configurations ────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS pin_configurations (
                pin_number   INTEGER PRIMARY KEY,
                bcm_number   INTEGER NOT NULL DEFAULT -1,
                name         VARCHAR(120) NOT NULL,
                pin_type     VARCHAR(40)  NOT NULL,
                is_active_low BOOLEAN NOT NULL DEFAULT 0,
                current_state BOOLEAN NOT NULL DEFAULT 0,
                updated_at   TIMESTAMP NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
            )
        """)

        # ── gpio_logs ─────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS gpio_logs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                pin_number INTEGER NOT NULL REFERENCES pin_configurations(pin_number),
                old_state  BOOLEAN NOT NULL,
                new_state  BOOLEAN NOT NULL,
                source     VARCHAR(40) NOT NULL DEFAULT 'WEB_APP',
                metadata   TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_gpio_logs_pin ON gpio_logs(pin_number)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_gpio_logs_ts  ON gpio_logs(created_at DESC)")

        # ── voice_chat_logs ───────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS voice_chat_logs (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                raw_transcript     TEXT NOT NULL,
                interpreted_intent VARCHAR(80),
                execution_status   VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN_COMMAND',
                bot_response       TEXT,
                created_at         TIMESTAMP NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
            )
        """)

        # ── sensor_data ───────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_name VARCHAR(80) NOT NULL,
                value       REAL NOT NULL,
                unit        VARCHAR(20),
                created_at  TIMESTAMP NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sensor_name ON sensor_data(sensor_name)")

        await db.commit()
        logger.info("✅ Esquema de base de datos verificado/creado")

        # ── Insertar pines por defecto si la tabla está vacía ─────
        async with db.execute("SELECT COUNT(*) FROM pin_configurations") as cur:
            (count,) = await cur.fetchone()

        if count == 0:
            await db.executemany(
                """INSERT OR IGNORE INTO pin_configurations
                   (pin_number, bcm_number, name, pin_type, is_active_low, current_state)
                   VALUES (?,?,?,?,?,?)""",
                DEFAULT_PINS,
            )
            await db.commit()
            logger.info(f"✅ {len(DEFAULT_PINS)} pines GPIO insertados en pin_configurations")

        # ── Inicializar hardware GPIO ─────────────────────────────
        async with db.execute(
            "SELECT bcm_number, pin_type, current_state FROM pin_configurations"
        ) as cur:
            gpio_init_rows = [dict(r) for r in await cur.fetchall()]

        for row in gpio_init_rows:
            bcm, ptype, state = row["bcm_number"], row["pin_type"], row["current_state"]
            if bcm >= 0 and ptype in CONTROLLABLE_TYPES:
                GPIO.setup(bcm, GPIO.OUT)
                GPIO.output(bcm, GPIO.HIGH if state else GPIO.LOW)

        logger.info("✅ GPIO inicializado desde base de datos")


# ─────────────────────────────────────────────────────────────────
# LÓGICA DE NEGOCIO GPIO
# ─────────────────────────────────────────────────────────────────
async def toggle_pin(
    pin_number: int,
    source: str = "WEB_APP",
    metadata: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Cambia el estado de un pin en hardware y BBDD.
    Emite broadcast WebSocket a todos los clientes.
    Retorna el estado resultante.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM pin_configurations WHERE pin_number = ?", (pin_number,)
        ) as cur:
            row = await cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Pin {pin_number} no encontrado")

        # Convertir a dict mientras la conexión aún está abierta
        pin = dict(row)

        if pin["pin_type"] not in CONTROLLABLE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Pin {pin_number} es de tipo '{pin['pin_type']}' y no es controlable",
            )

        bcm = pin["bcm_number"]
        old_state = int(pin["current_state"])
        new_state = 0 if old_state else 1

        # Aplicar en hardware
        if bcm >= 0:
            gpio_val = GPIO.LOW if (new_state == 1 and pin["is_active_low"]) else (
                GPIO.HIGH if new_state == 1 else GPIO.LOW
            )
            GPIO.output(bcm, gpio_val)

        # Persistir nuevo estado
        await db.execute(
            """UPDATE pin_configurations
               SET current_state = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now')
               WHERE pin_number = ?""",
            (new_state, pin_number),
        )

        # Registrar en gpio_logs
        meta_str = json.dumps(metadata) if metadata else None
        await db.execute(
            """INSERT INTO gpio_logs (pin_number, old_state, new_state, source, metadata)
               VALUES (?,?,?,?,?)""",
            (pin_number, old_state, new_state, source, meta_str),
        )
        await db.commit()

    result = {
        "event": "GPIO_TOGGLE",
        "pin_number": pin_number,
        "bcm_number": bcm,
        "name": pin["name"],
        "pin_type": pin["pin_type"],
        "old_state": old_state,
        "new_state": new_state,
        "source": source,
        "metadata": metadata,
        "timestamp": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
    }

    # Broadcast a todos los clientes WebSocket
    await manager.broadcast(result)
    logger.info(f"🔄 Pin {pin_number} ({pin['name']}): {old_state}→{new_state} [{source}]")
    return result


# ─────────────────────────────────────────────────────────────────
# TAREA EN BACKGROUND — Lectura de botones físicos
# ─────────────────────────────────────────────────────────────────
_prev_button_states: dict[int, int] = {}


async def poll_physical_buttons() -> None:
    """
    Monitoriza en background los pines configurados como GPIO_INPUT.
    Detecta flancos descendentes (botón presionado) y hace toggle en la BBDD.
    """
    logger.info("🔁 Tarea de polling de botones físicos iniciada")
    while True:
        try:
            async with get_db() as db:
                async with db.execute(
                    "SELECT pin_number, bcm_number, current_state FROM pin_configurations "
                    "WHERE pin_type = 'GPIO_INPUT' AND bcm_number >= 0"
                ) as cur:
                    buttons = [dict(r) for r in await cur.fetchall()]

            for btn in buttons:
                pin, bcm = btn["pin_number"], btn["bcm_number"]
                current_hw = GPIO.input(bcm)
                prev = _prev_button_states.get(pin, 1)

                # Flanco descendente = botón presionado (pull-up interno)
                if prev == 1 and current_hw == 0:
                    await toggle_pin(
                        pin_number=pin,
                        source="PHYSICAL_BUTTON",
                        metadata={"bcm": bcm},
                    )

                _prev_button_states[pin] = current_hw

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Error en poll_physical_buttons: {exc}")

        await asyncio.sleep(0.05)  # 50ms — 20 lecturas/seg


# ─────────────────────────────────────────────────────────────────
# LIFESPAN — Startup / Shutdown
# ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AquaPi iniciando...")
    await init_db()
    task = asyncio.create_task(poll_physical_buttons())
    logger.info("✅ AquaPi listo para recibir conexiones")
    yield
    task.cancel()
    GPIO.cleanup()
    logger.info("🛑 AquaPi detenido correctamente")


# ─────────────────────────────────────────────────────────────────
# APLICACIÓN FASTAPI
# ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AquaPi Control System",
    description="API de control GPIO para acuario automatizado con Raspberry Pi 4B",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# MODELOS PYDANTIC
# ─────────────────────────────────────────────────────────────────
class ToggleRequest(BaseModel):
    source: str = "WEB_APP"
    metadata: Optional[dict[str, Any]] = None


class VoiceLogRequest(BaseModel):
    raw_transcript: str
    interpreted_intent: Optional[str] = None
    execution_status: str = "UNKNOWN_COMMAND"
    bot_response: Optional[str] = None


class SensorDataRequest(BaseModel):
    sensor_name: str
    value: float
    unit: Optional[str] = None


# ─────────────────────────────────────────────────────────────────
# ENDPOINTS — GPIO
# ─────────────────────────────────────────────────────────────────
@app.get("/api/v1/gpio/status", summary="Estado actual de todos los pines")
async def gpio_status():
    """
    Devuelve el estado de los 40 pines leído desde la BBDD.
    Para pines GPIO activos, verifica también el estado real en hardware.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM pin_configurations ORDER BY pin_number"
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    pins = []
    for pin in rows:
        bcm = pin["bcm_number"]
        # Verificar estado real en hardware para pines configurables
        if bcm >= 0 and pin["pin_type"] in CONTROLLABLE_TYPES:
            hw_state = GPIO.input(bcm)
            pin["hardware_state"] = hw_state
        else:
            pin["hardware_state"] = pin["current_state"]
        pins.append(pin)

    return {"pins": pins, "total": len(pins), "gpio_available": GPIO_AVAILABLE}


@app.post("/api/v1/gpio/toggle/{pin_number}", summary="Toggle de un pin GPIO")
async def toggle_gpio(pin_number: int, body: ToggleRequest):
    """
    Cambia el estado de un pin, guarda el log y notifica por WebSocket.
    """
    return await toggle_pin(
        pin_number=pin_number,
        source=body.source,
        metadata=body.metadata,
    )


@app.post("/api/v1/gpio/set/{pin_number}", summary="Establece un estado específico")
async def set_gpio(pin_number: int, state: int = Query(..., ge=0, le=1), body: ToggleRequest = ToggleRequest()):
    """
    Establece un pin a un estado específico (0 o 1) sin importar el estado actual.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT current_state FROM pin_configurations WHERE pin_number = ?", (pin_number,)
        ) as cur:
            _row = await cur.fetchone()
            current_state_db = int(_row["current_state"]) if _row else None

    if current_state_db is None:
        raise HTTPException(status_code=404, detail=f"Pin {pin_number} no encontrado")

    if current_state_db != state:
        return await toggle_pin(pin_number, body.source, body.metadata)

    return {"message": "Pin ya estaba en el estado solicitado", "pin_number": pin_number, "state": state}


class PinUpdateRequest(BaseModel):
    name: Optional[str] = None


@app.patch("/api/v1/gpio/pin/{pin_number}", summary="Actualiza propiedades de un pin (nombre, etc.)")
async def update_pin(pin_number: int, body: PinUpdateRequest):
    """Permite renombrar un pin GPIO."""
    updates: list[str] = []
    params: list[Any] = []

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
        if len(name) > 64:
            raise HTTPException(status_code=422, detail="El nombre no puede superar 64 caracteres")
        updates.append("name = ?")
        params.append(name)

    if not updates:
        raise HTTPException(status_code=422, detail="No hay campos a actualizar")

    params.append(pin_number)
    async with get_db() as db:
        async with db.execute(
            "SELECT pin_number FROM pin_configurations WHERE pin_number = ?", (pin_number,)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Pin {pin_number} no encontrado")
        await db.execute(
            f"UPDATE pin_configurations SET {', '.join(updates)} WHERE pin_number = ?", params
        )
        await db.commit()
        async with db.execute(
            "SELECT * FROM pin_configurations WHERE pin_number = ?", (pin_number,)
        ) as cur:
            row = dict(await cur.fetchone())

    await manager.broadcast({"event": "PIN_RENAMED", "pin_number": pin_number, "name": row["name"]})
    return {"message": "Pin actualizado", "pin": row}


# ─────────────────────────────────────────────────────────────────
# ENDPOINTS — LOGS Y AUDITORÍA
# ─────────────────────────────────────────────────────────────────
@app.get("/api/v1/logs", summary="Historial de eventos GPIO con paginación")
async def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    pin_number: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
):
    offset = (page - 1) * page_size
    conditions: list[str] = []
    params: list[Any] = []

    if pin_number is not None:
        conditions.append("g.pin_number = ?")
        params.append(pin_number)
    if source:
        conditions.append("g.source = ?")
        params.append(source.upper())

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = f"""
        SELECT g.id, g.pin_number, p.name, g.old_state, g.new_state,
               g.source, g.metadata, g.created_at
        FROM gpio_logs g
        JOIN pin_configurations p ON g.pin_number = p.pin_number
        {where}
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
    """
    params += [page_size, offset]

    count_query = f"SELECT COUNT(*) FROM gpio_logs g {where}"

    async with get_db() as db:
        async with db.execute(count_query, params[:-2] if params else []) as cur:
            (total,) = await cur.fetchone()

        async with db.execute(query, params) as cur:
            raw_rows = await cur.fetchall()
            rows = [dict(r) for r in raw_rows]

    logs = []
    for entry in rows:
        if entry.get("metadata"):
            try:
                entry["metadata"] = json.loads(entry["metadata"])
            except Exception:
                pass
        logs.append(entry)

    return {
        "logs": logs,
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": (total + page_size - 1) // page_size,
    }


@app.get("/api/v1/logs/voice", summary="Historial de interacciones de voz/chatbot")
async def get_voice_logs(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
    offset = (page - 1) * page_size
    async with get_db() as db:
        async with db.execute("SELECT COUNT(*) FROM voice_chat_logs") as cur:
            (total,) = await cur.fetchone()
        async with db.execute(
            "SELECT * FROM voice_chat_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    return {"logs": rows, "total": total, "page": page}


@app.post("/api/v1/logs/voice", summary="Registrar interacción de voz/chatbot")
async def post_voice_log(body: VoiceLogRequest):
    async with get_db() as db:
        async with db.execute(
            """INSERT INTO voice_chat_logs
               (raw_transcript, interpreted_intent, execution_status, bot_response)
               VALUES (?,?,?,?)""",
            (body.raw_transcript, body.interpreted_intent, body.execution_status, body.bot_response),
        ) as cur:
            row_id = cur.lastrowid
        await db.commit()

    await manager.broadcast({
        "event": "VOICE_LOG",
        "id": row_id,
        "intent": body.interpreted_intent,
        "status": body.execution_status,
        "timestamp": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
    })
    return {"id": row_id, "status": "created"}


@app.get("/api/v1/sensors", summary="Últimas lecturas de sensores")
async def get_sensor_data(
    sensor_name: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    async with get_db() as db:
        if sensor_name:
            async with db.execute(
                "SELECT * FROM sensor_data WHERE sensor_name = ? ORDER BY created_at DESC LIMIT ?",
                (sensor_name, limit),
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
        else:
            async with db.execute(
                "SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT ?", (limit,)
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]

    return {"readings": rows}


@app.post("/api/v1/sensors", summary="Insertar lectura de sensor")
async def post_sensor_data(body: SensorDataRequest):
    async with get_db() as db:
        async with db.execute(
            "INSERT INTO sensor_data (sensor_name, value, unit) VALUES (?,?,?)",
            (body.sensor_name, body.value, body.unit),
        ) as cur:
            row_id = cur.lastrowid
        await db.commit()

    await manager.broadcast({
        "event": "SENSOR_DATA",
        "id": row_id,
        "sensor_name": body.sensor_name,
        "value": body.value,
        "unit": body.unit,
        "timestamp": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
    })
    return {"id": row_id, "status": "created"}


# ─────────────────────────────────────────────────────────────────
# WEBSOCKET ENDPOINT
# ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Enviar estado inicial al cliente recién conectado
        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM pin_configurations ORDER BY pin_number"
            ) as cur:
                pins = [dict(p) for p in await cur.fetchall()]
            async with db.execute(
                "SELECT g.*, p.name FROM gpio_logs g "
                "JOIN pin_configurations p ON g.pin_number = p.pin_number "
                "ORDER BY g.created_at DESC LIMIT 20"
            ) as cur:
                recent_logs = [dict(l) for l in await cur.fetchall()]

        await websocket.send_text(json.dumps({
            "event": "INITIAL_STATE",
            "pins": pins,
            "recent_logs": recent_logs,
            "gpio_available": GPIO_AVAILABLE,
            "timestamp": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
        }, default=str))

        # Mantener conexión activa — heartbeat
        while True:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            msg = json.loads(data)

            if msg.get("type") == "PING":
                await websocket.send_text(json.dumps({"event": "PONG", "ts": time.time()}))

            elif msg.get("type") == "TOGGLE":
                await toggle_pin(
                    pin_number=msg["pin_number"],
                    source=msg.get("source", "WEB_APP"),
                    metadata=msg.get("metadata"),
                )

    except asyncio.TimeoutError:
        pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"Error WebSocket: {exc}")
    finally:
        manager.disconnect(websocket)


# ─────────────────────────────────────────────────────────────────
# SERVIR FRONTEND ESTÁTICO
# Sirve dist/index.html (build React) si existe, o index.html legacy
# ─────────────────────────────────────────────────────────────────
_DIST  = os.path.join(os.path.dirname(__file__), "dist")
_INDEX = os.path.join(_DIST, "index.html") if os.path.isdir(_DIST) else "index.html"

if os.path.isdir(_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(_INDEX)


@app.get("/health", summary="Health check")
async def health():
    return {
        "status": "ok",
        "gpio_available": GPIO_AVAILABLE,
        "clients_connected": len(manager._clients),
        "timestamp": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
    }


@app.post("/api/v1/system/restart", summary="Reiniciar el servicio acuario-api")
async def restart_service():
    """Ejecuta: sudo systemctl restart acuario-api con delay para poder responder primero."""
    import subprocess
    import threading

    def _do_restart():
        import time
        time.sleep(1.2)  # espera a que la respuesta HTTP llegue al cliente
        subprocess.run(["sudo", "systemctl", "restart", "acuario-api"])

    try:
        # Comprobamos que sudo/systemctl existen antes de responder
        check = subprocess.run(["which", "systemctl"], capture_output=True)
        if check.returncode != 0:
            raise HTTPException(status_code=501, detail="systemctl no disponible en este sistema")
        threading.Thread(target=_do_restart, daemon=True).start()
        return {"status": "ok", "message": "Reiniciando servicio en 1 segundo…"}
    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="systemctl no disponible en este sistema")


@app.post("/api/v1/system/git-pull", summary="git pull en el directorio de trabajo")
async def git_pull():
    import subprocess
    wd = os.path.dirname(os.path.abspath(__file__))
    try:
        # Asegurar safe.directory para axier
        subprocess.run(
            ["sudo", "-u", "axier", "git", "config", "--global", "--add", "safe.directory", wd],
            capture_output=True
        )
        # Convertir remote HTTPS → SSH si hace falta
        url_r = subprocess.run(
            ["sudo", "-u", "axier", "git", "-C", wd, "remote", "get-url", "origin"],
            capture_output=True, text=True
        )
        remote = url_r.stdout.strip()
        if remote.startswith("https://github.com/"):
            subprocess.run(
                ["sudo", "-u", "axier", "git", "-C", wd, "remote", "set-url", "origin",
                 remote.replace("https://github.com/", "git@github.com:")],
                capture_output=True
            )
        result = subprocess.run(
            ["sudo", "-u", "axier", "git", "-C", wd, "pull"],
            capture_output=True, text=True, timeout=30
        )
        output = (result.stdout + result.stderr).strip()
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=output or "Error en git pull")
        return {"status": "ok", "output": output}
    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="git/sudo no disponible en este sistema")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/system/git-push", summary="git push al repositorio remoto")
async def git_push():
    import subprocess
    wd = os.path.dirname(os.path.abspath(__file__))
    try:
        subprocess.run(
            ["sudo", "-u", "axier", "git", "config", "--global", "--add", "safe.directory", wd],
            capture_output=True
        )
        url_r = subprocess.run(
            ["sudo", "-u", "axier", "git", "-C", wd, "remote", "get-url", "origin"],
            capture_output=True, text=True
        )
        remote = url_r.stdout.strip()
        if remote.startswith("https://github.com/"):
            subprocess.run(
                ["sudo", "-u", "axier", "git", "-C", wd, "remote", "set-url", "origin",
                 remote.replace("https://github.com/", "git@github.com:")],
                capture_output=True
            )
        result = subprocess.run(
            ["sudo", "-u", "axier", "git", "-C", wd, "push"],
            capture_output=True, text=True, timeout=30
        )
        output = (result.stdout + result.stderr).strip()
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=output or "Error en git push")
        return {"status": "ok", "output": output}
    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="git/sudo no disponible en este sistema")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/system/npm-build", summary="npm run build en frontend/")
async def npm_build():
    import subprocess
    base = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base, "frontend")
    # Cargar nvm explícitamente y ejecutar como axier
    cmd = (
        'export NVM_DIR="/home/axier/.nvm"; '
        '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; '
        f'cd \'{frontend_dir}\' && npm run build'
    )
    try:
        result = subprocess.run(
            ["sudo", "-u", "axier", "bash", "-c", cmd],
            capture_output=True, text=True, timeout=300
        )
        output = (result.stdout + result.stderr).strip()
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=output or "Error en npm run build")
        return {"status": "ok", "output": output}
    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="sudo/bash no disponible")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────
# PUNTO DE ENTRADA
# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level=LOG_LEVEL.lower(),
        ws_ping_interval=20,
        ws_ping_timeout=30,
    )
