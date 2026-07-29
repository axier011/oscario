#!/usr/bin/env python3
"""Reproductor directo a VRAM para GC9A01 con control de velocidad."""

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

# --- AJUSTE DE VELOCIDAD DE LA ANIMACIÓN ---
# Aumenta el valor para hacerlo MÁS LENTO (ej. 0.06, 0.08, 0.1)
PAUSA_ENTRE_FRAMES = 0.07 

def precalcular_frames(gif_path):
    print(f"👁️ Cargando GIF: {gif_path}...")
    try:
        gif = Image.open(gif_path)
    except Exception as e:
        print(f"❌ Error al abrir el GIF: {e}")
        sys.exit(1)

    frames_raw = []
    total_original = getattr(gif, 'n_frames', 1)

    # Procesar todos los fotogramas para máxima fluidez
    for i in range(total_original):
        gif.seek(i)
        img = gif.copy().convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS)
        
        if hasattr(img, "get_flattened_data"):
            pixels = img.get_flattened_data()
        else:
            pixels = list(img.getdata())
        
        buf = bytearray(WIDTH * HEIGHT * 2)
        idx = 0
        for r, g, b in pixels:
            color565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            buf[idx] = (color565 >> 8) & 0xFF
            buf[idx+1] = color565 & 0xFF
            idx += 2
            
        frames_raw.append(bytes(buf))
        print(f"\rPrecalculando fotograma {i+1}/{total_original}...", end="", flush=True)
        
    print(f"\n✅ ¡{len(frames_raw)} fotogramas cargados en memoria RAM!")
    return frames_raw

def main():
    if len(sys.argv) < 2:
        print("Uso: sudo python ojo_animado.py <gif>")
        sys.exit(1)

    displayio.release_displays()
    spi = busio.SPI(board.SCK, board.MOSI)
    
    display_bus = FourWire(
        spi, 
        command=board.D4, 
        chip_select=board.D8, 
        reset=board.D13, 
        baudrate=60000000
    )
    
    display = adafruit_gc9a01a.GC9A01A(display_bus, width=WIDTH, height=HEIGHT)
    display.auto_refresh = False

    frames_raw = precalcular_frames(sys.argv[1])
    
    print(f"🚀 Reproduciendo animación (Pausa por cuadro: {PAUSA_ENTRE_FRAMES}s). Press Ctrl+C.")
    
    cmd_col = 0x2A
    cmd_row = 0x2B
    cmd_ram = 0x2C
    coordenadas = struct.pack(">HH", 0, 239)

    try:
        while True:
            for frame_bytes in frames_raw:
                t_start = time.time()
                
                display_bus.send(cmd_col, coordenadas)
                display_bus.send(cmd_row, coordenadas)
                display_bus.send(cmd_ram, frame_bytes)
                
                # Control de velocidad regulable
                elapsed = time.time() - t_start
                time.sleep(max(0, PAUSA_ENTRE_FRAMES - elapsed))
                
    except KeyboardInterrupt:
        print("\n🛑 Reproducción detenida.")

if __name__ == "__main__":
    main()
