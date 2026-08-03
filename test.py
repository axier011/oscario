import ST7789
from PIL import Image, ImageDraw, ImageFont

# Configuración del display para tus 7 pines
# - DC:  Pin físico 7  -> BCM 4
# - RST: Pin físico 33 -> BCM 13
# - CS:  Pin físico 24 -> SPI0 CE0 (port=0, cs=0)
# - BL:  None (No existe el pin físicamente)

disp = ST7789.ST7789(
    port=0,
    cs=0,               # CE0 (pin físico 24)
    dc=4,               # BCM 4 (pin físico 7)
    rst=13,             # BCM 13 (pin físico 33)
    backlight=None,     # <--- IMPORTANTE: Desactivado porque no tienes el pin
    width=240,
    height=240,
    rotation=0,
    spi_speed_hz=60000000
)

# Inicializar la pantalla
disp.begin()

# Crear una imagen de 240x240 pixels (fondo azul)
image = Image.new("RGB", (240, 240), (0, 102, 204))
draw = ImageDraw.Draw(image)

# Dibujar un círculo blanco en el centro
draw.ellipse((20, 20, 220, 220), outline=(255, 255, 255), width=3)
draw.text((75, 110), "¡FUNCIONA!", fill=(255, 255, 255))

# Enviar la imagen a la pantalla
disp.display(image)
print("Imagen enviada con éxito a la pantalla.")
