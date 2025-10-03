#!/bin/bash

# Script de instalación para Raspberry Pi GPIO API
# Autor: Assistant
# Descripción: Instala y configura la API para controlar GPIO desde Home Assistant

set -e  # Salir si hay errores

echo "=============================================="
echo "  Raspberry Pi GPIO API - Script de Instalación"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que se ejecuta en Raspberry Pi
check_raspberry_pi() {
    print_status "Verificando que estamos en Raspberry Pi..."
    
    if [[ ! -f /proc/device-tree/model ]]; then
        print_error "Este script debe ejecutarse en una Raspberry Pi"
        exit 1
    fi
    
    MODEL=$(cat /proc/device-tree/model)
    print_success "Detectado: $MODEL"
}

# Actualizar sistema
update_system() {
    print_status "Actualizando sistema..."
    sudo apt update
    sudo apt upgrade -y
    print_success "Sistema actualizado"
}

# Instalar dependencias del sistema
install_system_dependencies() {
    print_status "Instalando dependencias del sistema..."
    
    sudo apt install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        git \
        curl \
        build-essential
    
    print_success "Dependencias del sistema instaladas"
}

# Crear usuario para la API (opcional)
create_api_user() {
    local username="gpioapi"
    
    if id "$username" &>/dev/null; then
        print_warning "Usuario $username ya existe"
    else
        print_status "Creando usuario $username para la API..."
        sudo useradd -m -s /bin/bash -G gpio,i2c,spi "$username"
        print_success "Usuario $username creado"
    fi
}

# Configurar directorio de instalación
setup_installation_directory() {
    local install_dir="/opt/raspberry_gpio_api"
    
    print_status "Configurando directorio de instalación en $install_dir..."
    
    # Crear directorio si no existe
    sudo mkdir -p "$install_dir"
    
    # Copiar archivos de la API
    if [[ -f "app.py" ]]; then
        sudo cp app.py "$install_dir/"
        sudo cp gpio_controller.py "$install_dir/"
        sudo cp requirements.txt "$install_dir/"
        print_success "Archivos de la API copiados a $install_dir"
    else
        print_error "No se encontraron los archivos de la API en el directorio actual"
        print_error "Asegúrate de ejecutar este script desde el directorio del proyecto"
        exit 1
    fi
    
    # Cambiar permisos
    sudo chown -R pi:pi "$install_dir"
    sudo chmod +x "$install_dir/app.py"
    
    echo "$install_dir"
}

# Crear entorno virtual e instalar dependencias Python
setup_python_environment() {
    local install_dir="$1"
    
    print_status "Configurando entorno virtual Python..."
    
    cd "$install_dir"
    
    # Crear entorno virtual
    python3 -m venv venv
    source venv/bin/activate
    
    # Actualizar pip
    pip install --upgrade pip
    
    # Instalar dependencias
    pip install -r requirements.txt
    
    print_success "Entorno Python configurado"
}

# Crear script de inicio
create_startup_script() {
    local install_dir="$1"
    
    print_status "Creando script de inicio..."
    
    cat > /tmp/gpio_api_start.sh << EOF
#!/bin/bash
# Script de inicio para Raspberry Pi GPIO API

cd $install_dir
source venv/bin/activate

# Variables de entorno
export API_HOST=0.0.0.0
export API_PORT=5000
export API_DEBUG=false
export DEFAULT_PINS=18,19,20,21

# Iniciar API
python3 app.py
EOF

    sudo mv /tmp/gpio_api_start.sh "$install_dir/start_api.sh"
    sudo chmod +x "$install_dir/start_api.sh"
    sudo chown pi:pi "$install_dir/start_api.sh"
    
    print_success "Script de inicio creado en $install_dir/start_api.sh"
}

# Crear servicio systemd
create_systemd_service() {
    local install_dir="$1"
    
    print_status "Creando servicio systemd..."
    
    cat > /tmp/raspberry-gpio-api.service << EOF
[Unit]
Description=Raspberry Pi GPIO API for Home Assistant
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=pi
WorkingDirectory=$install_dir
ExecStart=$install_dir/start_api.sh
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/raspberry-gpio-api.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable raspberry-gpio-api.service
    
    print_success "Servicio systemd creado y habilitado"
}

# Configurar firewall (opcional)
configure_firewall() {
    print_status "Configurando firewall..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 5000/tcp comment "Raspberry Pi GPIO API"
        print_success "Puerto 5000 abierto en firewall"
    else
        print_warning "UFW no está instalado, saltando configuración de firewall"
    fi
}

# Crear archivo de configuración
create_config_file() {
    local install_dir="$1"
    
    print_status "Creando archivo de configuración..."
    
    cat > /tmp/config.env << EOF
# Configuración para Raspberry Pi GPIO API

# Host y puerto de la API
API_HOST=0.0.0.0
API_PORT=5000

# Modo debug (solo para desarrollo)
API_DEBUG=false

# Pines GPIO a configurar por defecto (separados por comas)
# Estos pines se configurarán automáticamente al iniciar la API
DEFAULT_PINS=18,19,20,21

# Logging
LOG_LEVEL=INFO
EOF

    sudo mv /tmp/config.env "$install_dir/config.env"
    sudo chown pi:pi "$install_dir/config.env"
    
    print_success "Archivo de configuración creado en $install_dir/config.env"
}

# Función principal
main() {
    print_status "Iniciando instalación..."
    
    # Verificaciones previas
    check_raspberry_pi
    
    # Instalación
    update_system
    install_system_dependencies
    
    # Configuración
    install_dir=$(setup_installation_directory)
    setup_python_environment "$install_dir"
    create_startup_script "$install_dir"
    create_systemd_service "$install_dir"
    create_config_file "$install_dir"
    configure_firewall
    
    print_success "=============================================="
    print_success "  Instalación completada exitosamente!"
    print_success "=============================================="
    echo
    print_status "Comandos útiles:"
    echo "  Iniciar servicio:    sudo systemctl start raspberry-gpio-api"
    echo "  Detener servicio:    sudo systemctl stop raspberry-gpio-api"
    echo "  Estado del servicio: sudo systemctl status raspberry-gpio-api"
    echo "  Ver logs:            sudo journalctl -u raspberry-gpio-api -f"
    echo "  Iniciar manualmente: cd $install_dir && ./start_api.sh"
    echo
    print_status "La API estará disponible en: http://$(hostname -I | awk '{print $1}'):5000"
    echo
    print_warning "Para iniciar el servicio automáticamente, ejecuta:"
    echo "  sudo systemctl start raspberry-gpio-api"
}

# Verificar si se ejecuta como script principal
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi