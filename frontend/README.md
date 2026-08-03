# Oscario Frontend

React 18 + TypeScript + Vite 5 — Panel de control GPIO para acuario automatizado.

## Setup

```bash
cd frontend
npm install
```

## Desarrollo

```bash
npm run dev     # dev server con proxy a Pi en 192.168.1.26:8000
```

Abre http://localhost:5173 — las peticiones `/api` y `/ws` se reenvían a la Pi.

## Producción

```bash
npm run build   # genera z:\dist\ para que FastAPI lo sirva
```

FastAPI detecta automáticamente `dist/` y sirve la app desde `/`.

## Estructura

```
src/
  types.ts          — interfaces TypeScript compartidas
  constants.ts      — pin type map, escenas, iconos
  api.ts            — llamadas REST al backend
  hooks/
    useOscario.ts   — estado global + WebSocket + acciones
  components/
    TopBar.tsx      — logo, theme switcher, WS status
    ControlTab.tsx  — panel principal de dispositivos
    PinCard.tsx     — tarjeta de pin individual
    AddDeviceModal  — añadir pin al panel
    ScenesGrid.tsx  — escenas de acuario
    HealthCard.tsx  — salud del acuario + reinicio
    SensorGauge.tsx — gauge SVG de sensor
    GpioMap.tsx     — mapa J8 40 pines Raspberry Pi 4B
    LogHistory.tsx  — historial de eventos
    Toast.tsx       — notificaciones flotantes
    ContextMenu.tsx — menú contextual en pin cards
    RenameModal.tsx — renombrar pin
    ConfirmModal.tsx — confirmación genérica
```
