# Raspberry Pi GPIO API para Home Assistant

Una API REST completa para controlar pines GPIO de Raspberry Pi desde Home Assistant y otros sistemas de automatización del hogar.

## 🚀 Características

- **Control GPIO completo**: Activar/desactivar pines GPIO individuales
- **API REST simple**: Endpoints intuitivos para integración fácil
- **Integración Home Assistant**: Diseñado específicamente para trabajar con HA
- **Seguridad**: Validación de pines y manejo seguro de errores
- **Logging completo**: Monitoreo detallado de todas las operaciones
- **Auto-configuración**: Configuración automática de pines al inicio
- **Modo simulación**: Funciona en desarrollo sin hardware GPIO

## 📋 Requisitos

### Hardware
- Raspberry Pi 4B (recomendado) o modelos compatibles
- Tarjeta SD con Raspberry Pi OS
- Conexión a internet

### Software
- Python 3.7+
- Raspberry Pi OS (Debian/Ubuntu basado)
- Acceso sudo para instalación

## 🔧 Instalación

### Instalación Automática (Recomendada)

1. **Clonar o descargar el proyecto** en tu Raspberry Pi:
```bash
git clone https://github.com/tu-usuario/raspberry-gpio-api.git
cd raspberry-gpio-api
```

2. **Ejecutar el script de instalación**:
```bash
chmod +x setup.sh
./setup.sh
```

El script automáticamente:
- Actualiza el sistema
- Instala dependencias
- Crea un entorno virtual Python
- Configura el servicio systemd
- Configura el firewall
- Prepara la API para ejecutarse automáticamente

### Instalación Manual

1. **Instalar dependencias del sistema**:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv python3-dev git -y
```

2. **Crear entorno virtual**:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. **Instalar dependencias Python**:
```bash
pip install -r requirements.txt
```

4. **Ejecutar la API**:
```bash
python3 app.py
```

## 🎯 Uso

### Iniciar la API

**Como servicio (después de la instalación automática)**:
```bash
sudo systemctl start raspberry-gpio-api
sudo systemctl status raspberry-gpio-api
```

**Manualmente**:
```bash
cd /opt/raspberry_gpio_api
./start_api.sh
```

**Para desarrollo**:
```bash
source venv/bin/activate
python3 app.py
```

La API estará disponible en: `http://IP_DE_TU_RASPBERRY:5000`

### Endpoints de la API

#### 1. Verificar estado de la API
```http
GET /api/health
```

**Respuesta**:
```json
{
  "status": "ok",
  "message": "Raspberry Pi GPIO API is running",
  "version": "1.0.0"
}
```

#### 2. Activar un pin GPIO
```http
POST /api/gpio/{pin}/on
```

**Ejemplo**:
```bash
curl -X POST http://192.168.1.100:5000/api/gpio/18/on
```

**Respuesta**:
```json
{
  "status": "success",
  "message": "Pin 18 turned ON",
  "pin": 18,
  "state": "HIGH"
}
```

#### 3. Desactivar un pin GPIO
```http
POST /api/gpio/{pin}/off
```

**Ejemplo**:
```bash
curl -X POST http://192.168.1.100:5000/api/gpio/18/off
```

#### 4. Consultar estado de un pin
```http
GET /api/gpio/{pin}/status
```

**Ejemplo**:
```bash
curl http://192.168.1.100:5000/api/gpio/18/status
```

#### 5. Consultar estado de todos los pines
```http
GET /api/gpio/all/status
```

#### 6. Configurar múltiples pines
```http
POST /api/gpio/setup
Content-Type: application/json

{
  "pins": [18, 19, 20, 21]
}
```

#### 7. Limpiar configuración GPIO
```http
POST /api/gpio/cleanup
```

## 🏠 Integración con Home Assistant

### Configuración en Home Assistant

Añade este código a tu `configuration.yaml`:

```yaml
# Configuración de switches GPIO para Raspberry Pi
switch:
  - platform: rest
    name: "GPIO Pin 18"
    resource: "http://IP_DE_TU_RASPBERRY:5000/api/gpio/18"
    body_on: ""
    body_off: ""
    method_on: "POST"
    method_off: "POST"
    is_on_template: >
      {% set response = states('sensor.gpio_18_status') %}
      {{ response == 'HIGH' if response != 'unknown' else false }}
    headers:
      Content-Type: application/json
    value_template: >
      {{ value_json.state }}

  - platform: rest
    name: "GPIO Pin 19"
    resource: "http://IP_DE_TU_RASPBERRY:5000/api/gpio/19"
    body_on: ""
    body_off: ""
    method_on: "POST"
    method_off: "POST"
    is_on_template: >
      {% set response = states('sensor.gpio_19_status') %}
      {{ response == 'HIGH' if response != 'unknown' else false }}

# Sensores para monitorear estado de pines
sensor:
  - platform: rest
    name: "GPIO 18 Status"
    resource: "http://IP_DE_TU_RASPBERRY:5000/api/gpio/18/status"
    value_template: "{{ value_json.state }}"
    scan_interval: 30

  - platform: rest
    name: "GPIO 19 Status"
    resource: "http://IP_DE_TU_RASPBERRY:5000/api/gpio/19/status"
    value_template: "{{ value_json.state }}"
    scan_interval: 30
```

### Automatización de ejemplo

```yaml
automation:
  - alias: "Activar GPIO 18 al atardecer"
    trigger:
      platform: sun
      event: sunset
    action:
      service: switch.turn_on
      target:
        entity_id: switch.gpio_pin_18

  - alias: "Desactivar GPIO 18 al amanecer"
    trigger:
      platform: sun
      event: sunrise
    action:
      service: switch.turn_off
      target:
        entity_id: switch.gpio_pin_18
```

## ⚙️ Configuración

### Variables de entorno

Puedes configurar la API usando variables de entorno o editando el archivo `config.env`:

```bash
# Host y puerto
API_HOST=0.0.0.0
API_PORT=5000

# Modo debug (solo desarrollo)
API_DEBUG=false

# Pines por defecto (se configuran al iniciar)
DEFAULT_PINS=18,19,20,21

# Nivel de logging
LOG_LEVEL=INFO
```

### Pines GPIO válidos

La API soporta los siguientes pines GPIO (numeración BCM):

```
2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
```

**⚠️ Importante**: Algunos pines tienen funciones especiales (I2C, SPI, UART). Consulta la documentación de tu Raspberry Pi antes de usarlos.

## 🔧 Gestión del Servicio

### Comandos útiles

```bash
# Iniciar servicio
sudo systemctl start raspberry-gpio-api

# Detener servicio
sudo systemctl stop raspberry-gpio-api

# Reiniciar servicio
sudo systemctl restart raspberry-gpio-api

# Ver estado
sudo systemctl status raspberry-gpio-api

# Ver logs en tiempo real
sudo journalctl -u raspberry-gpio-api -f

# Habilitar inicio automático
sudo systemctl enable raspberry-gpio-api

# Deshabilitar inicio automático
sudo systemctl disable raspberry-gpio-api
```

### Logs

Los logs se almacenan en:
- **Servicio systemd**: `sudo journalctl -u raspberry-gpio-api`
- **Ejecución manual**: Consola directa

## 🔒 Seguridad

### Recomendaciones

1. **Firewall**: El script de instalación configura automáticamente el firewall
2. **Red local**: Usar solo en redes confiables
3. **Proxy reverso**: Para exposición a internet, usar nginx/apache con HTTPS
4. **Autenticación**: Implementar autenticación adicional si es necesario

### Configuración de firewall manual

```bash
sudo ufw allow 5000/tcp comment "Raspberry Pi GPIO API"
sudo ufw enable
```

## 🐛 Solución de Problemas

### La API no inicia

1. **Verificar logs**:
```bash
sudo journalctl -u raspberry-gpio-api -f
```

2. **Verificar puerto**:
```bash
sudo netstat -tlnp | grep :5000
```

3. **Verificar dependencias**:
```bash
cd /opt/raspberry_gpio_api
source venv/bin/activate
pip list
```

### Error de permisos GPIO

```bash
# Añadir usuario al grupo gpio
sudo usermod -a -G gpio $USER
# Reiniciar sesión
```

### Puerto ocupado

```bash
# Encontrar proceso usando el puerto
sudo lsof -i :5000
# Terminar proceso si es necesario
sudo kill -9 <PID>
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
2. Busca en los [Issues existentes](https://github.com/tu-usuario/raspberry-gpio-api/issues)
3. Crea un nuevo issue con detalles completos

## 🎯 Próximas características

- [ ] Autenticación con tokens
- [ ] Soporte para PWM
- [ ] Interfaz web de administración
- [ ] Soporte para sensores digitales
- [ ] Integración con MQTT
- [ ] Soporte para múltiples Raspberry Pi

---

**¡Disfruta controlando tu Raspberry Pi desde Home Assistant! 🎉**