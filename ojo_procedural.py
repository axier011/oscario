import time
import random
import st7789
from PIL import Image, ImageDraw

disp = st7789.ST7789(
    port=0, cs=0, dc=4, rst=13, backlight=None,
    width=240, height=240, rotation=0, spi_speed_hz=60000000
)
disp.begin()

# Coordenadas centrales
CENTER_X, CENTER_Y = 120, 120

def dibujar_ojo(offset_x=0, offset_y=0, parpado=0):
    # Crear lienzo (Esclera/Blanco del ojo con sombra)
    img = Image.new("RGB", (240, 240), (230, 230, 235))
    draw = ImageDraw.Draw(img)

    # 1. Dibujar Iris (Azul / Verde hiperrealista)
    iris_x = CENTER_X + offset_x
    iris_y = CENTER_Y + offset_y
    draw.ellipse((iris_x - 55, iris_y - 55, iris_x + 55, iris_y + 55), fill=(0, 102, 153), outline=(0, 40, 80), width=3)

    # 2. Dibujar Pupila (Negra)
    draw.ellipse((iris_x - 25, iris_y - 25, iris_x + 25, iris_y + 25), fill=(0, 0, 0))

    # 3. Brillo de la luz en la pupila (Reflejo realista)
    draw.ellipse((iris_x - 15, iris_y - 18, iris_x - 5, iris_y - 8), fill=(255, 255, 255))

    # 4. Parpados superiores e inferiores (Color piel)
    if parpado > 0:
        # Párpado superior
        draw.rectangle((0, 0, 240, parpado), fill=(40, 25, 20))
        # Párpado inferior
        draw.rectangle((0, 240 - parpado, 240, 240), fill=(40, 25, 20))

    # Bordes redondos de la cuenca
    draw.ellipse((-20, -20, 260, 260), outline=(0, 0, 0), width=15)

    return img

print("Iniciando simulación de ojo animado...")

try:
    while True:
        # Movimientos de mirada aleatorios
        target_x = random.choice([-40, -20, 0, 20, 40])
        target_y = random.choice([-20, 0, 20])
        
        # Transición suave hacia la posición
        frame = dibujar_ojo(target_x, target_y)
        disp.display(frame)
        time.sleep(random.uniform(0.8, 2.5))

        # Posibilidad de parpadear
        if random.random() < 0.4:
            for p in [30, 70, 110, 120, 70, 0]:
                disp.display(dibujar_ojo(target_x, target_y, parpado=p))
                time.sleep(0.02)

except KeyboardInterrupt:
    print("Simulación finalizada.")
