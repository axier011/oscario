import type { Scene } from './types'

// ─── Pin type metadata map ────────────────────────────────────────────────────
export const PM: Record<string, { c: string; ctrl: boolean; icon: string; label: string }> = {
  POWER_5V:    { c: 'var(--c5v)',   ctrl: false, icon: 'fa-bolt',                    label: '5V'    },
  POWER_3V3:   { c: 'var(--c33v)', ctrl: false, icon: 'fa-bolt',                    label: '3.3V'  },
  GROUND:      { c: '#4a5568',     ctrl: false, icon: 'fa-minus',                   label: 'GND'   },
  GPIO_OUTPUT: { c: 'var(--cout)', ctrl: true,  icon: 'fa-lightbulb',              label: 'GPIO'  },
  GPIO_INPUT:  { c: 'var(--cin)',  ctrl: true,  icon: 'fa-circle-dot',             label: 'GPIO'  },
  GPIO_SPI:    { c: 'var(--cspi)', ctrl: false, icon: 'fa-arrow-right-arrow-left', label: 'SPI'   },
  GPIO_I2C:    { c: 'var(--ci2c)', ctrl: false, icon: 'fa-link',                   label: 'I²C'   },
  GPIO_UART:   { c: 'var(--cuart)',ctrl: false, icon: 'fa-wave-square',            label: 'UART'  },
  GPIO_PWM:    { c: 'var(--cpwm)', ctrl: true,  icon: 'fa-rotate',                 label: 'PWM'   },
  GPIO_CLOCK:  { c: 'var(--cclk)', ctrl: true,  icon: 'fa-clock',                  label: 'Clock' },
  ID_EEPROM:   { c: 'var(--cid)',  ctrl: false, icon: 'fa-lock',                   label: 'EEPROM'},
}

export const CTRL_TYPES = new Set(['GPIO_OUTPUT', 'GPIO_INPUT', 'GPIO_PWM', 'GPIO_CLOCK'])

export const DEFAULT_VISIBLE = [11, 13, 15, 18, 22, 29]

// ─── Icon helper by device name ───────────────────────────────────────────────
export function faFor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('luz') || n.includes('light') || n.includes('lamp'))      return 'fa-lightbulb'
  if (n.includes('bomba') || n.includes('pump'))                            return 'fa-water'
  if (n.includes('filtro') || n.includes('filter'))                         return 'fa-filter'
  if (n.includes('calentador') || n.includes('heat'))                       return 'fa-temperature-high'
  if (n.includes('oxigenador') || n.includes('oxygen') || n.includes('aire')) return 'fa-wind'
  if (n.includes('comedero') || n.includes('feeder') || n.includes('food')) return 'fa-utensils'
  if (n.includes('motor') || n.includes('corriente'))                        return 'fa-gear'
  if (n.includes('relay') || n.includes('relé'))                             return 'fa-toggle-on'
  if (n.includes('azul') || n.includes('blue'))                              return 'fa-water'
  return 'fa-microchip'
}

// ─── Aquarium scenes ──────────────────────────────────────────────────────────
export const SCENES: Scene[] = [
  {
    id:    'day',
    label: 'Día',
    icon:  'fa-sun',
    color: 'var(--amber)',
    on:    ['luz', 'filtro', 'calentador', 'oxigenador'],
    off:   ['comedero'],
  },
  {
    id:    'night',
    label: 'Noche',
    icon:  'fa-moon',
    color: 'var(--blue)',
    on:    ['filtro', 'calentador', 'oxigenador'],
    off:   ['luz', 'comedero'],
  },
  {
    // Enciende filtro+calentador+oxigenador+luz blanca. Impulso comedero en activateScene.
    id:    'feed',
    label: 'Alimentación',
    icon:  'fa-utensils',
    color: 'var(--teal)',
    on:    ['filtro', 'calentador', 'oxigenador', 'blanca'],
    off:   [],
  },
  {
    // Apaga todo menos luz blanca.
    id:    'maint',
    label: 'Mantenimiento',
    icon:  'fa-wrench',
    color: 'var(--purple)',
    on:    ['blanca'],
    off:   ['azul', 'filtro', 'calentador', 'oxigenador', 'bomba', 'motor', 'comedero'],
  },
]

// ─── Static GPIO header layout (Raspberry Pi 4B J8 40-pin) ──────────────────
export interface GpioPinMeta {
  pin: number
  bcm: number
  label: string
  type: string
}

export const GPIO_PINS: GpioPinMeta[] = [
  { pin:  1, bcm: -1, label: '3V3 Power',        type: 'POWER_3V3'  },
  { pin:  2, bcm: -1, label: '5V Power',          type: 'POWER_5V'   },
  { pin:  3, bcm:  2, label: 'GPIO2 (I2C SDA)',   type: 'GPIO_I2C'   },
  { pin:  4, bcm: -1, label: '5V Power',          type: 'POWER_5V'   },
  { pin:  5, bcm:  3, label: 'GPIO3 (I2C SCL)',   type: 'GPIO_I2C'   },
  { pin:  6, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin:  7, bcm:  4, label: 'GPIO4 (GPCLK0)',    type: 'GPIO_CLOCK' },
  { pin:  8, bcm: 14, label: 'GPIO14 (UART TXD)', type: 'GPIO_UART'  },
  { pin:  9, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 10, bcm: 15, label: 'GPIO15 (UART RXD)', type: 'GPIO_UART'  },
  { pin: 11, bcm: 17, label: 'GPIO17',            type: 'GPIO_PWM'   },
  { pin: 12, bcm: 18, label: 'GPIO18 (PCM CLK)',  type: 'GPIO_PWM'   },
  { pin: 13, bcm: 27, label: 'GPIO27',            type: 'GPIO_PWM'   },
  { pin: 14, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 15, bcm: 22, label: 'GPIO22',            type: 'GPIO_OUTPUT'},
  { pin: 16, bcm: 23, label: 'GPIO23',            type: 'GPIO_OUTPUT'},
  { pin: 17, bcm: -1, label: '3V3 Power',         type: 'POWER_3V3'  },
  { pin: 18, bcm: 24, label: 'GPIO24',            type: 'GPIO_OUTPUT'},
  { pin: 19, bcm: 10, label: 'GPIO10 (SPI MOSI)', type: 'GPIO_SPI'   },
  { pin: 20, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 21, bcm:  9, label: 'GPIO9 (SPI MISO)',  type: 'GPIO_SPI'   },
  { pin: 22, bcm: 25, label: 'GPIO25',            type: 'GPIO_OUTPUT'},
  { pin: 23, bcm: 11, label: 'GPIO11 (SPI SCLK)', type: 'GPIO_SPI'   },
  { pin: 24, bcm:  8, label: 'GPIO8 (SPI CE0)',   type: 'GPIO_SPI'   },
  { pin: 25, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 26, bcm:  7, label: 'GPIO7 (SPI CE1)',   type: 'GPIO_SPI'   },
  { pin: 27, bcm:  0, label: 'GPIO0 (ID SD)',     type: 'ID_EEPROM'  },
  { pin: 28, bcm:  1, label: 'GPIO1 (ID SC)',     type: 'ID_EEPROM'  },
  { pin: 29, bcm:  5, label: 'GPIO5',             type: 'GPIO_OUTPUT'},
  { pin: 30, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 31, bcm:  6, label: 'GPIO6',             type: 'GPIO_PWM'   },
  { pin: 32, bcm: 12, label: 'GPIO12 (PWM0)',     type: 'GPIO_PWM'   },
  { pin: 33, bcm: 13, label: 'GPIO13 (PWM1)',     type: 'GPIO_PWM'   },
  { pin: 34, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 35, bcm: 19, label: 'GPIO19 (PCM FS)',   type: 'GPIO_PWM'   },
  { pin: 36, bcm: 16, label: 'GPIO16',            type: 'GPIO_OUTPUT'},
  { pin: 37, bcm: 26, label: 'GPIO26',            type: 'GPIO_OUTPUT'},
  { pin: 38, bcm: 20, label: 'GPIO20 (PCM DIN)',  type: 'GPIO_OUTPUT'},
  { pin: 39, bcm: -1, label: 'Ground',            type: 'GROUND'     },
  { pin: 40, bcm: 21, label: 'GPIO21 (PCM DOUT)', type: 'GPIO_OUTPUT'},
]
