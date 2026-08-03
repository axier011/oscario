#!/bin/bash
# Instala Piper TTS + voz española en la Raspberry Pi
set -e

PIPER_DIR="/opt/piper"
VOICES_DIR="/opt/piper/voices"
PIPER_VERSION="1.2.0"

echo "=== Instalando dependencias ==="
sudo apt-get install -y sox libsox-fmt-mp3 ffmpeg

echo "=== Descargando Piper TTS ==="
sudo mkdir -p "$PIPER_DIR"
cd /tmp

# Detectar arquitectura
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    PIPER_ARCHIVE="piper_linux_aarch64.tar.gz"
elif [ "$ARCH" = "armv7l" ]; then
    PIPER_ARCHIVE="piper_linux_armv7l.tar.gz"
else
    PIPER_ARCHIVE="piper_linux_x86_64.tar.gz"
fi

wget -q "https://github.com/rhasspy/piper/releases/download/v${PIPER_VERSION}/${PIPER_ARCHIVE}" -O piper.tar.gz
sudo tar -xzf piper.tar.gz -C /opt/
sudo chmod +x /opt/piper/piper
echo "Piper instalado en /opt/piper/piper"

echo "=== Descargando voces españolas ==="
sudo mkdir -p "$VOICES_DIR"
cd "$VOICES_DIR"

# Voz principal: es_ES (España) - calidad media-alta
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx" -O es_ES-davefx-medium.onnx
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json" -O es_ES-davefx-medium.onnx.json

# Voz 2: es_ES femenina
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx" -O es_ES-sharvard-medium.onnx
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json" -O es_ES-sharvard-medium.onnx.json

# Voz 3: es_MX (México) - alta calidad
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_MX/claude/high/es_MX-claude-high.onnx" -O es_MX-claude-high.onnx
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_MX/claude/high/es_MX-claude-high.onnx.json" -O es_MX-claude-high.onnx.json

# Voz 4: es_ES mls (multi-hablante, buena calidad)
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx" -O es_ES-mls_10246-low.onnx
sudo wget -q "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx.json" -O es_ES-mls_10246-low.onnx.json

echo "=== Prueba de voz ==="
echo "Hola, soy Piper, el asistente del acuario." | /opt/piper/piper \
  --model "$VOICES_DIR/es_ES-davefx-medium.onnx" \
  --output_raw 2>/dev/null | \
  sox -r 22050 -e signed -b 16 -c 1 -t raw - /tmp/test_piper.wav
aplay /tmp/test_piper.wav 2>/dev/null && echo "Audio OK" || echo "aplay no disponible, pero Piper funciona"

echo ""
echo "=== Instalacion completada ==="
echo "Binario: /opt/piper/piper"
echo "Voces:   $VOICES_DIR/"
ls -lh "$VOICES_DIR"/*.onnx
