#!/bin/bash
DIR="$(dirname "$(realpath "$0")")"
PYTHON="$DIR/venv/bin/python"
SCRIPT="$DIR/ojo_animado.py"
GIF1="$DIR/ojo.gif"
GIF2="$DIR/ojo 2.gif"
echo "[ojo-display] Pre-cargando ambos GIFs..."
exec "$PYTHON" "$SCRIPT" "$GIF1" "$GIF2"