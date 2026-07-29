#!/usr/bin/env python3
"""Reproductor de GIF a 30 FPS ultra fluido para GC9A01 directo por SPI."""

import sys
import time
import spidev
import RPi.GPIO as GPIO
from PIL import Image, ImageSequence

# --- CONFIGURACIÓN DE PINES (BCM) ---
DC_PIN  = 4   # Pin físico 7
RST_PIN = 13  # Pin físico 33

WIDTH  = 240
HEIGHT = 240

def init_gpio_spi():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(DC_PIN, GPIO.OUT)
    GPIO.setup(RST_PIN, GPIO.OUT)

    # Hardware Reset
    GPIO.output(RST_PIN, GPIO.HIGH)
    time.sleep(0.01)
    GPIO.output(RST_PIN, GPIO.LOW)
    time.sleep(0.01)
    GPIO.output(RST_PIN, GPIO.HIGH)
    time.sleep(0.12)

    spi = spidev.SpiDev()
    spi.open(0, 0) # SPI0, CE0 (Pin físico 24)
    spi.max_speed_hz = 60000000 # 60 MHz
    spi.mode = 0
    return spi

def send_cmd(spi, cmd):
    GPIO.output(DC_PIN, GPIO.LOW)
    spi.writebytes([cmd])

def send_data(spi, data):
    GPIO.output(DC_PIN, GPIO.HIGH)
    if isinstance(data, (bytes, bytearray)):
        spi.writebytes2(data)
    else:
        spi.writebytes(data)

def init_gc9a01(spi):
    """Secuencia de inicialización nativa GC9A01A."""
    cmds = [
        (0xEF, []),
        (0xEB, [0x14]),
        (0xFE, []),
        (0xEF, []),
        (0xEB, [0x14]),
        (0x84, [0x40]),
        (0x85, [0xFF]),
        (0x86, [0xFF]),
        (0x87, [0xFF]),
        (0x88, [0x0A]),
        (0x89, [0x21]),
        (0x8A, [0x00]),
        (0x8B, [0x80]),
        (0x8C, [0x01]),
        (0x8D, [0x01]),
        (0x8E, [0xFF]),
        (0x8F, [0xFF]),
        (0xB6, [0x00, 0x20]),
        (0x36, [0x08]), # Memory Access
        (0x3A, [0x05]), # Format 16-bit RGB565
        (0x90, [0x08, 0x08, 0x08, 0x08]),
        (0xBD, [0x06]),
        (0xBC, [0x00]),
        (0xFF, [0x60, 0x01, 0x04]),
        (0xC3, [0x13]),
        (0xC4, [0x13]),
        (0xC9, [0x22]),
        (0xBE, [0x11]),
        (0xE1, [0x10, 0x0E]),
        (0xDF, [0x21, 0x0C, 0x02]),
        (0xF0, [0x45, 0x09, 0x08, 0x08, 0x26, 0x2A]),
        (0xF1, [0x43, 0x70, 0x72, 0x36, 0x37, 0x6F]),
        (0xF2, [0x45, 0x09, 0x08, 0x08, 0x26, 0x2A]),
        (0xF3, [0x43, 0x70, 0x72, 0x36, 0x37, 0x6F]),
        (0xED, [0x1B, 0x0B]),
        (0xAE, [0x77]),
        (0xCD, [0x63]),
        (0x70, [0x07, 0x07, 0x04, 0x0E, 0x0F, 0x09, 0x07, 0x08, 0x03]),
        (0xE8, [0x34]),
        (0x62, [0x18, 0x0D, 0x71, 0xED, 0x70, 0x70, 0x18, 0x0F, 0x71, 0xCB, 0x70, 0x70]),
        (0x63, [0x18, 0x0D, 0x71, 0xED, 0x70, 0x70, 0x18, 0x0F, 0x71, 0xCB, 0x70, 0x70]), # Corregido 0x70
        (0x64, [0x28, 0x29, 0xF1, 0x01, 0xF1, 0x00, 0x07]),
        (0x66, [0x3C, 0x00, 0xCD, 0x67, 0x45, 0x45, 0x10, 0x00, 0x00, 0x00]),
        (0x67, [0x00, 0x3C, 0x00, 0x00, 0x00, 0x01, 0x54, 0x10, 0x32, 0x98]),
        (0x74, [0x10, 0x85, 0x80, 0x00, 0x00, 0x4E, 0x00]),
        (0x98, [0x3E, 0x07]),
        (0x21, []), # Inversión de color ON
        (0x11, []), # Sleep Out
    ]
    for cmd, data in cmds:
        send_cmd(spi, cmd)
        if data:
            send_data(spi, data)
    time.sleep(0.12)
    send_cmd(spi, 0x29) # Display ON

def frame_to_bytes(frame):
    img = frame.convert("RGB")
    if img.size != (WIDTH, HEIGHT):
        img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    
    buf = bytearray(WIDTH * HEIGHT * 2)
    idx = 0
    
    # Compatibilidad con versiones de Pillow antiguas y modernas
    if hasattr(img, "get_flattened_data"):
        pixels_data = img.get_flattened_data()
    else:
        pixels_data = list(img.getdata())

    for r, g, b in pixels_data:
        val = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
        buf[idx] = val >> 8
        buf[idx + 1] = val & 0xFF
        idx += 2
    return bytes(buf)

def draw_frame(spi, frame_data):
    send_cmd(spi, 0x2A) # Column Addr Set
    send_data(spi, [0x00, 0x00, 0x00, 0xEF])
    send_cmd(spi, 0x2B) # Row Addr Set
    send_data(spi, [0x00, 0x00, 0x00, 0xEF])
    send_cmd(spi, 0x2C) # RAM Write

    GPIO.output(DC_PIN, GPIO.HIGH)
    spi.writebytes2(frame_data)

def main():
    if len(sys.argv) < 2:
        print("Uso: sudo /var/www/html/venv/bin/python ojo_fluido.py <ruta_gif>")
        sys.exit(1)

    gif_path = sys.argv[1]
    
    print("🔌 Inicializando hardware SPI...")
    spi = init_gpio_spi()
    init_gc9a01(spi)

    print(f"⚡ Cargando animación en memoria RAM: {gif_path}...")
    gif = Image.open(gif_path)
    
    frames_bytes = []
    count = 0
    for frame in ImageSequence.Iterator(gif):
        frames_bytes.append(frame_to_bytes(frame))
        count += 1
        print(f"\rConvertidos {count} fotogramas...", end="")

    print(f"\n🚀 ¡{count} fotogramas listos! Reproduciendo animación a 30 FPS...")
    print("Presiona Ctrl+C para salir.")

    try:
        while True:
            for frame_data in frames_bytes:
                t_start = time.time()
                
                draw_frame(spi, frame_data)
                
                elapsed = time.time() - t_start
                time.sleep(max(0, 0.033 - elapsed))
    except KeyboardInterrupt:
        print("\n🛑 Animación detenida.")
    finally:
        spi.close()
        GPIO.cleanup()

if __name__ == "__main__":
    main()
