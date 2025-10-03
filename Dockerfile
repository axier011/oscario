FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python directamente
RUN pip install --upgrade pip && \
    pip install Flask==2.3.3 Flask-CORS==4.0.0 RPi.GPIO==0.7.1 gunicorn==21.2.0 requests==2.31.0

# Copiar código de la aplicación
COPY app.py gpio_controller.py ./

# Variables de entorno
ENV API_HOST=0.0.0.0
ENV API_PORT=5000
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["python", "app.py"]