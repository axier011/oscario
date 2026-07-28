import { useOsc } from '../hooks/useOscario'
import { SCENES } from '../constants'

export default function ScenesGrid() {
  const { activeScene, activateScene } = useOsc()

  return (
    <div className="scenes-grid" style={{ marginBottom: 20 }}>
      {SCENES.map(scene => (
        <div
          key={scene.id}
          className={`scene-card${activeScene === scene.id ? ' active' : ''}`}
          style={{ '--scene-color': scene.color } as React.CSSProperties}
          onClick={() => activateScene(scene.id)}
        >
          <div className="scene-icon" style={{ color: activeScene === scene.id ? scene.color : 'var(--t2)' }}>
            <i className={`fa-solid ${scene.icon}`} />
          </div>
          <span className="scene-label">{scene.label}</span>
        </div>
      ))}
    </div>
  )
}
