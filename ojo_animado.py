#!/usr/bin/env python3
"""Reproductor directo a VRAM para GC9A01 con cambio instantáneo de GIF."""

import os
import sys
import time
import struct
from PIL import Image

import board
import busio
import displayio
import adafruit_gc9a01a

try:
    from fourwire import FourWire
except ImportError:
    from displayio import FourWire

WIDTH, HEIGHT = 240, 240
PAUSA_ENTRE_FRAMES = 0.07

# Archivo de estado que el backend escribe para cambiar de GIF
_DIR        = os.path.dirname(os.path.abspath(__file__))
_STATE_FILE = os.path.join(_DIR, ".ojo_gif_actual")

def precalcular_frames(gif_path):
    print(f"👁️ Cargando GIF: {gif_path}...")
    try:
        gif = Image.open(gif_path)
    except Exception as e:
        print(f"❌ Error al abrir el GIF: {e}")
        return []

    frames_raw = []
    total = getattr(gif, 'n_frames', 1)
    for i in range(total):
        gif.seek(i)
        img = gif.copy().convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS)
        pixels = list(img.getdata())
        buf = bytearray(WIDTH * HEIGHT * 2)
        idx = 0
        for r, g, b in pixels:
            c = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            buf[idx] = (c >> 8) & 0xFF
            buf[idx+1] = c & 0xFF
            idx += 2
        frames_raw.append(bytes(buf))
        print(f"\r  {i+1}/{total} fotogramas...", end="", flush=True)
    print(f"\n✅ {len(frames_raw)} frames listos: {os.path.basename(gif_path)}")
    return frames_raw

def main():
    if len(sys.argv) < 2:
        print("Uso: python ojo_animado.py <gif_principal> [gif_secundario]")
        sys.exit(1)

    gif_paths = {
        sys.argv[1]: None,  # GIF por defecto
    }
    # GIF secundario opcional (ojo 2.gif)
    if len(sys.argv) >= 3:
        gif_paths[sys.argv[2]] = None

    # Pre-cargar todos los GIFs antes de mostrar nada
    all_frames: dict[str, list] = {}
    for path in gif_paths:
        all_frames[path] = precalcular_frames(path)

    displayio.release_displays()
    spi = busio.SPI(board.SCK, board.MOSI)
    display_bus = FourWire(
        spi,
        command=board.D5,     # DC  → BCM 5, PIN 29
        chip_select=board.D8, # CE0 → BCM 8, PIN 24
        reset=board.D6,       # RST → BCM 6, PIN 31
        baudrate=60000000
    )
    display = adafruit_gc9a01a.GC9A01A(display_bus, width=WIDTH, height=HEIGHT)
    display.auto_refresh = False

    cmd_col = 0x2A
    cmd_row = 0x2B
    cmd_ram = 0x2C
    coords  = struct.pack(">HH", 0, 239)

    print("🚀 Reproduciendo. El backend cambia el GIF escribiendo en .ojo_gif_actual")

    active_path  = sys.argv[1]
    frame_list   = all_frames[active_path]
    frame_idx    = 0

    try:
        while True:
            t_start = time.time()

            # Comprobar si el backend cambió el GIF (cada frame, coste mínimo)
            try:
                wanted = open(_STATE_FILE).read().strip()
                if wanted and wanted != active_path and wanted in all_frames:
                    active_path = wanted
                    frame_list  = all_frames[active_path]
                    frame_idx   = 0
            except OSError:
                pass

            if frame_list:
                frame_bytes = frame_list[frame_idx % len(frame_list)]
                display_bus.send(cmd_col, coords)
                display_bus.send(cmd_row, coords)
                display_bus.send(cmd_ram, frame_bytes)
                frame_idx += 1

            elapsed = time.time() - t_start
            time.sleep(max(0, PAUSA_ENTRE_FRAMES - elapsed))

    except KeyboardInterrupt:
        print("\n🛑 Reproducción detenida.")

if __name__ == "__main__":
    main()

