import type { Scene } from './types'

// ─── Pin type metadata map ────────────────────────────────────────────────────
export const PM: Record<string, { c: string; ctrl: boolean; icon: string; label: string }> = {
  POWER_5V:    { c: 'var(--c5v)',   ctrl: false, icon: 'fa-bolt',                    label: '5V'      },
  POWER_3V3:   { c: 'var(--c33v)', ctrl: false, icon: 'fa-bolt',                    label: '3.3V'    },
  GROUND:      { c: '#4a5568',     ctrl: false, icon: 'fa-minus',                   label: 'GND'     },
  GPIO_OUTPUT: { c: 'var(--cout)', ctrl: true,  icon: 'fa-lightbulb',              label: 'GPIO'    },
  GPIO_INPUT:  { c: 'var(--cin)',  ctrl: true,  icon: 'fa-circle-dot',             label: 'GPIO'    },
  GPIO_SPI:    { c: 'var(--cspi)', ctrl: false, icon: 'fa-arrow-right-arrow-left', label: 'SPI'     },
  GPIO_I2C:    { c: 'var(--ci2c)', ctrl: false, icon: 'fa-link',                   label: 'I²C'     },
  GPIO_UART:   { c: 'var(--cuart)',ctrl: false, icon: 'fa-wave-square',            label: 'UART'    },
  GPIO_PWM:    { c: 'var(--cpwm)', ctrl: true,  icon: 'fa-rotate',                 label: 'PWM'     },
  GPIO_CLOCK:  { c: 'var(--cclk)', ctrl: true,  icon: 'fa-clock',                  label: 'Clock'   },
  ID_EEPROM:   { c: 'var(--cid)',  ctrl: false, icon: 'fa-lock',                   label: 'EEPROM'  },
  // ── Custom groups ────────────────────────────────────────────────────────────
  BTN_WEB:     { c: 'var(--cout)', ctrl: true,  icon: 'fa-hand-pointer',           label: 'Web Btn' },
  BTN_PHYSICAL:{ c: 'var(--cin)',  ctrl: true,  icon: 'fa-circle-dot',             label: 'Físico'  },
  DISPLAY:     { c: 'var(--cspi)', ctrl: false, icon: 'fa-display',                label: 'Pantalla'},
  BTN_PUMPKIN: { c: 'var(--amber)',ctrl: true,  icon: 'fa-ghost',                  label: 'Calabaza'},
}

export const CTRL_TYPES = new Set(['GPIO_OUTPUT', 'GPIO_INPUT', 'GPIO_PWM', 'GPIO_CLOCK', 'BTN_WEB', 'BTN_PHYSICAL', 'BTN_PUMPKIN'])

/** Tipos que se pueden encender/apagar desde la web (excluye entradas físicas) */
export const TOGGLEABLE_FE = new Set(['GPIO_OUTPUT', 'GPIO_PWM', 'GPIO_CLOCK', 'BTN_WEB'])

// ─── Pin groups ───────────────────────────────────────────────────────────────
export const PIN_GROUPS = {
  /** 6 relés controlados desde la app web */
  BTN_WEB:      [7, 11, 15, 18, 21, 26],
  /** 5 botones físicos (entradas) */
  BTN_PHYSICAL: [12, 13, 16, 22, 37],
  /** 7 pines para la pantalla */
  DISPLAY:      [19, 23, 24, 29, 31, 32, 33],
  /** 1 botón de la calabaza */
  BTN_PUMPKIN:  [36],
} as const

export const DEFAULT_VISIBLE = [
  ...PIN_GROUPS.BTN_WEB,
  ...PIN_GROUPS.BTN_PHYSICAL,
  ...PIN_GROUPS.BTN_PUMPKIN,
]

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
  { pin:  7, bcm:  4, label: 'Oxigenador',        type: 'BTN_WEB'     },
  { pin:  8, bcm: 14, label: 'GPIO14 (UART TXD)', type: 'GPIO_UART'   },
  { pin:  9, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 10, bcm: 15, label: 'GPIO15 (UART RXD)', type: 'GPIO_UART'   },
  { pin: 11, bcm: 17, label: 'Calentador',        type: 'BTN_WEB'     },
  { pin: 12, bcm: 18, label: 'Botón Calentador',  type: 'BTN_PHYSICAL'},
  { pin: 13, bcm: 27, label: 'Botón Oxigenador',  type: 'BTN_PHYSICAL'},
  { pin: 14, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 15, bcm: 22, label: 'Filtro',            type: 'BTN_WEB'     },
  { pin: 16, bcm: 23, label: 'Botón Filtro',      type: 'BTN_PHYSICAL'},
  { pin: 17, bcm: -1, label: '3V3 Power',         type: 'POWER_3V3'   },
  { pin: 18, bcm: 24, label: 'Luz Blanca',        type: 'BTN_WEB'     },
  { pin: 19, bcm: 10, label: 'Pantalla MOSI',     type: 'DISPLAY'     },
  { pin: 20, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 21, bcm:  9, label: 'Comedero',          type: 'BTN_WEB'     },
  { pin: 22, bcm: 25, label: 'Botón Comedero',    type: 'BTN_PHYSICAL'},
  { pin: 23, bcm: 11, label: 'Pantalla SCLK',     type: 'DISPLAY'     },
  { pin: 24, bcm:  8, label: 'Pantalla CE0',      type: 'DISPLAY'     },
  { pin: 25, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 26, bcm:  7, label: 'Luz Azul',          type: 'BTN_WEB'     },
  { pin: 27, bcm:  0, label: 'GPIO0 (ID SD)',     type: 'ID_EEPROM'   },
  { pin: 28, bcm:  1, label: 'GPIO1 (ID SC)',     type: 'ID_EEPROM'   },
  { pin: 29, bcm:  5, label: 'Pantalla DC',       type: 'DISPLAY'     },
  { pin: 30, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 31, bcm:  6, label: 'Pantalla RST',      type: 'DISPLAY'     },
  { pin: 32, bcm: 12, label: 'Pantalla MOSI',     type: 'DISPLAY'     },
  { pin: 33, bcm: 13, label: 'Pantalla MISO',     type: 'DISPLAY'     },
  { pin: 34, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 35, bcm: 19, label: 'Pantalla BL',       type: 'DISPLAY'     },
  { pin: 36, bcm: 16, label: 'Botón Calabaza',    type: 'BTN_PUMPKIN' },
  { pin: 37, bcm: 26, label: 'Botón Luz',         type: 'BTN_PHYSICAL'},
  { pin: 38, bcm: 20, label: 'Pin 38 (libre)',    type: 'GPIO_OUTPUT' },
  { pin: 39, bcm: -1, label: 'Ground',            type: 'GROUND'      },
  { pin: 40, bcm: 21, label: 'Pin 40 (libre)',    type: 'GPIO_OUTPUT' },
]
