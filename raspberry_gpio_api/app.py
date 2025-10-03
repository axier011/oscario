#!/usr/bin/env python3
"""
Raspberry Pi GPIO API for Home Assistant
API REST para controlar pines GPIO desde Home Assistant
"""

from flask import Flask, request, jsonify
import logging
import sys
import os
from gpio_controller import GPIOController

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
app = Flask(__name__)

# Inicializar controlador GPIO
gpio_controller = GPIOController()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que la API está funcionando"""
    return jsonify({
        'status': 'ok',
        'message': 'Raspberry Pi GPIO API is running',
        'version': '1.0.0'
    })

@app.route('/api/gpio/<int:pin>/on', methods=['POST'])
def turn_pin_on(pin):
    """Activar un pin GPIO específico"""
    try:
        success = gpio_controller.turn_on(pin)
        if success:
            logger.info(f"Pin {pin} activado exitosamente")
            return jsonify({
                'status': 'success',
                'message': f'Pin {pin} turned ON',
                'pin': pin,
                'state': 'HIGH'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f'Failed to turn ON pin {pin}',
                'pin': pin
            }), 500
    except Exception as e:
        logger.error(f"Error activando pin {pin}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'pin': pin
        }), 500

@app.route('/api/gpio/<int:pin>/off', methods=['POST'])
def turn_pin_off(pin):
    """Desactivar un pin GPIO específico"""
    try:
        success = gpio_controller.turn_off(pin)
        if success:
            logger.info(f"Pin {pin} desactivado exitosamente")
            return jsonify({
                'status': 'success',
                'message': f'Pin {pin} turned OFF',
                'pin': pin,
                'state': 'LOW'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f'Failed to turn OFF pin {pin}',
                'pin': pin
            }), 500
    except Exception as e:
        logger.error(f"Error desactivando pin {pin}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'pin': pin
        }), 500

@app.route('/api/gpio/<int:pin>/status', methods=['GET'])
def get_pin_status(pin):
    """Obtener el estado actual de un pin GPIO"""
    try:
        state = gpio_controller.get_pin_state(pin)
        return jsonify({
            'status': 'success',
            'pin': pin,
            'state': 'HIGH' if state else 'LOW',
            'value': state
        })
    except Exception as e:
        logger.error(f"Error obteniendo estado del pin {pin}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'pin': pin
        }), 500

@app.route('/api/gpio/all/status', methods=['GET'])
def get_all_pins_status():
    """Obtener el estado de todos los pines configurados"""
    try:
        all_states = gpio_controller.get_all_pins_status()
        return jsonify({
            'status': 'success',
            'pins': all_states
        })
    except Exception as e:
        logger.error(f"Error obteniendo estados de todos los pines: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/gpio/setup', methods=['POST'])
def setup_pins():
    """Configurar múltiples pines de una vez"""
    try:
        data = request.get_json()
        if not data or 'pins' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing pins configuration in request body'
            }), 400

        pins = data['pins']
        if not isinstance(pins, list):
            return jsonify({
                'status': 'error',
                'message': 'Pins must be an array'
            }), 400

        setup_results = gpio_controller.setup_pins(pins)
        return jsonify({
            'status': 'success',
            'message': 'Pins configured successfully',
            'results': setup_results
        })

    except Exception as e:
        logger.error(f"Error configurando pines: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/gpio/cleanup', methods=['POST'])
def cleanup_gpio():
    """Limpiar configuración GPIO y liberar recursos"""
    try:
        gpio_controller.cleanup()
        logger.info("GPIO cleanup realizado exitosamente")
        return jsonify({
            'status': 'success',
            'message': 'GPIO cleanup completed'
        })
    except Exception as e:
        logger.error(f"Error en GPIO cleanup: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    try:
        # Configurar host y puerto
        host = os.environ.get('API_HOST', '0.0.0.0')
        port = int(os.environ.get('API_PORT', 5000))
        debug = os.environ.get('API_DEBUG', 'False').lower() == 'true'

        logger.info(f"Iniciando Raspberry Pi GPIO API en {host}:{port}")
        logger.info(f"Debug mode: {debug}")
        
        # Inicializar pines por defecto si están configurados
        default_pins = os.environ.get('DEFAULT_PINS', '').split(',')
        if default_pins and default_pins[0]:
            try:
                pins_list = [int(pin.strip()) for pin in default_pins if pin.strip()]
                if pins_list:
                    gpio_controller.setup_pins(pins_list)
                    logger.info(f"Pines por defecto configurados: {pins_list}")
            except ValueError as e:
                logger.warning(f"Error configurando pines por defecto: {e}")

        app.run(host=host, port=port, debug=debug)
        
    except KeyboardInterrupt:
        logger.info("API interrumpida por el usuario")
    except Exception as e:
        logger.error(f"Error iniciando la API: {e}")
        sys.exit(1)
    finally:
        # Limpiar GPIO al salir
        gpio_controller.cleanup()
        logger.info("GPIO cleanup realizado al salir")