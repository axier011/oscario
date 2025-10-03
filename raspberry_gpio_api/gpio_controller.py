#!/usr/bin/env python3
"""
GPIO Controller para Raspberry Pi
Módulo para gestionar de forma segura los pines GPIO
"""

import logging
import time
import threading
from typing import List, Dict, Optional, Union

logger = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    logger.info("Librería RPi.GPIO importada correctamente")
except ImportError:
    GPIO_AVAILABLE = False
    logger.warning("RPi.GPIO no disponible - modo simulación activado")
    
    # Crear un mock de GPIO para desarrollo en otras plataformas
    class MockGPIO:
        BCM = "BCM"
        OUT = "OUT"
        IN = "IN"
        HIGH = 1
        LOW = 0
        
        _pin_states = {}
        _pin_modes = {}
        
        @classmethod
        def setmode(cls, mode):
            logger.debug(f"Mock GPIO: setmode({mode})")
        
        @classmethod
        def setup(cls, pin, mode, initial=None):
            cls._pin_modes[pin] = mode
            if initial is not None:
                cls._pin_states[pin] = initial
            else:
                cls._pin_states[pin] = cls.LOW
            logger.debug(f"Mock GPIO: setup pin {pin} as {mode}, initial={initial}")
        
        @classmethod
        def output(cls, pin, state):
            if pin in cls._pin_modes:
                cls._pin_states[pin] = state
                logger.debug(f"Mock GPIO: pin {pin} = {state}")
            else:
                raise ValueError(f"Pin {pin} not configured")
        
        @classmethod
        def input(cls, pin):
            return cls._pin_states.get(pin, cls.LOW)
        
        @classmethod
        def cleanup(cls):
            cls._pin_states.clear()
            cls._pin_modes.clear()
            logger.debug("Mock GPIO: cleanup completed")
    
    GPIO = MockGPIO()

class GPIOController:
    """Controlador para gestionar pines GPIO de forma segura"""
    
    def __init__(self):
        self.configured_pins = set()
        self.pin_states = {}
        self.lock = threading.Lock()
        self.is_initialized = False
        
        self._initialize_gpio()
    
    def _initialize_gpio(self):
        """Inicializar el sistema GPIO"""
        try:
            with self.lock:
                if not self.is_initialized:
                    GPIO.setmode(GPIO.BCM)
                    self.is_initialized = True
                    logger.info("GPIO inicializado en modo BCM")
        except Exception as e:
            logger.error(f"Error inicializando GPIO: {e}")
            raise
    
    def _validate_pin(self, pin: int) -> bool:
        """Validar que el número de pin sea válido para Raspberry Pi"""
        # Pines GPIO válidos en Raspberry Pi (BCM numbering)
        valid_pins = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27}
        
        if pin not in valid_pins:
            logger.error(f"Pin {pin} no es válido. Pines válidos: {sorted(valid_pins)}")
            return False
        
        return True
    
    def setup_pin(self, pin: int, initial_state: int = GPIO.LOW) -> bool:
        """Configurar un pin individual como salida"""
        try:
            if not self._validate_pin(pin):
                return False
            
            with self.lock:
                GPIO.setup(pin, GPIO.OUT, initial=initial_state)
                self.configured_pins.add(pin)
                self.pin_states[pin] = initial_state
                logger.info(f"Pin {pin} configurado como salida, estado inicial: {initial_state}")
                return True
                
        except Exception as e:
            logger.error(f"Error configurando pin {pin}: {e}")
            return False
    
    def setup_pins(self, pins: List[int], initial_state: int = GPIO.LOW) -> Dict[int, bool]:
        """Configurar múltiples pines como salida"""
        results = {}
        
        for pin in pins:
            results[pin] = self.setup_pin(pin, initial_state)
        
        successful_pins = [pin for pin, success in results.items() if success]
        failed_pins = [pin for pin, success in results.items() if not success]
        
        if successful_pins:
            logger.info(f"Pines configurados exitosamente: {successful_pins}")
        if failed_pins:
            logger.warning(f"Fallo configurando pines: {failed_pins}")
        
        return results
    
    def turn_on(self, pin: int) -> bool:
        """Activar (HIGH) un pin GPIO"""
        try:
            if pin not in self.configured_pins:
                logger.warning(f"Pin {pin} no está configurado, configurando automáticamente...")
                if not self.setup_pin(pin):
                    return False
            
            with self.lock:
                GPIO.output(pin, GPIO.HIGH)
                self.pin_states[pin] = GPIO.HIGH
                logger.debug(f"Pin {pin} activado (HIGH)")
                return True
                
        except Exception as e:
            logger.error(f"Error activando pin {pin}: {e}")
            return False
    
    def turn_off(self, pin: int) -> bool:
        """Desactivar (LOW) un pin GPIO"""
        try:
            if pin not in self.configured_pins:
                logger.warning(f"Pin {pin} no está configurado, configurando automáticamente...")
                if not self.setup_pin(pin):
                    return False
            
            with self.lock:
                GPIO.output(pin, GPIO.LOW)
                self.pin_states[pin] = GPIO.LOW
                logger.debug(f"Pin {pin} desactivado (LOW)")
                return True
                
        except Exception as e:
            logger.error(f"Error desactivando pin {pin}: {e}")
            return False
    
    def toggle(self, pin: int) -> bool:
        """Alternar el estado de un pin GPIO"""
        try:
            current_state = self.get_pin_state(pin)
            if current_state == GPIO.HIGH:
                return self.turn_off(pin)
            else:
                return self.turn_on(pin)
                
        except Exception as e:
            logger.error(f"Error alternando pin {pin}: {e}")
            return False
    
    def get_pin_state(self, pin: int) -> Optional[int]:
        """Obtener el estado actual de un pin"""
        try:
            if pin not in self.configured_pins:
                logger.warning(f"Pin {pin} no está configurado")
                return None
            
            with self.lock:
                # Leer el estado actual del hardware
                current_state = GPIO.input(pin)
                self.pin_states[pin] = current_state
                return current_state
                
        except Exception as e:
            logger.error(f"Error leyendo estado del pin {pin}: {e}")
            return None
    
    def get_all_pins_status(self) -> Dict[int, Dict[str, Union[int, str]]]:
        """Obtener el estado de todos los pines configurados"""
        status = {}
        
        for pin in self.configured_pins:
            state = self.get_pin_state(pin)
            status[pin] = {
                'state': state,
                'state_name': 'HIGH' if state == GPIO.HIGH else 'LOW',
                'configured': True
            }
        
        return status
    
    def pulse(self, pin: int, duration: float = 0.5) -> bool:
        """Generar un pulso en un pin (activar, esperar, desactivar)"""
        try:
            if not self.turn_on(pin):
                return False
            
            time.sleep(duration)
            
            return self.turn_off(pin)
            
        except Exception as e:
            logger.error(f"Error generando pulso en pin {pin}: {e}")
            return False
    
    def blink(self, pin: int, times: int = 5, interval: float = 0.5) -> bool:
        """Hacer parpadear un pin un número determinado de veces"""
        try:
            for _ in range(times):
                if not self.turn_on(pin):
                    return False
                time.sleep(interval)
                
                if not self.turn_off(pin):
                    return False
                time.sleep(interval)
            
            return True
            
        except Exception as e:
            logger.error(f"Error haciendo parpadear pin {pin}: {e}")
            return False
    
    def turn_all_off(self) -> bool:
        """Desactivar todos los pines configurados"""
        try:
            success = True
            for pin in self.configured_pins:
                if not self.turn_off(pin):
                    success = False
            
            if success:
                logger.info("Todos los pines desactivados")
            else:
                logger.warning("Algunos pines no pudieron ser desactivados")
            
            return success
            
        except Exception as e:
            logger.error(f"Error desactivando todos los pines: {e}")
            return False
    
    def cleanup(self):
        """Limpiar la configuración GPIO y liberar recursos"""
        try:
            with self.lock:
                if self.is_initialized:
                    # Desactivar todos los pines antes de limpiar
                    self.turn_all_off()
                    
                    GPIO.cleanup()
                    self.configured_pins.clear()
                    self.pin_states.clear()
                    self.is_initialized = False
                    logger.info("GPIO cleanup completado")
                    
        except Exception as e:
            logger.error(f"Error en cleanup: {e}")
    
    def get_configured_pins(self) -> List[int]:
        """Obtener lista de pines configurados"""
        return list(self.configured_pins)
    
    def is_pin_configured(self, pin: int) -> bool:
        """Verificar si un pin está configurado"""
        return pin in self.configured_pins
    
    def get_system_info(self) -> Dict[str, Union[str, bool, List[int]]]:
        """Obtener información del sistema GPIO"""
        return {
            'gpio_available': GPIO_AVAILABLE,
            'initialized': self.is_initialized,
            'configured_pins': list(self.configured_pins),
            'total_configured': len(self.configured_pins)
        }