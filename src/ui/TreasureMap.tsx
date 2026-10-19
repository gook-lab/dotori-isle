import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { groundAt } from '../core/island'
import { parseMapId } from '../core/bottle'

const EXTENT = 70
const STEP = 3.5
const COLOR = { grass: '#9fd27a', sand: '#f1dfb0', water: '#7fc8df' } as const

/** 보물 지도: 섬 윤곽을 칸으로 그리고, 목표 칸에 ✕ 를 그린다. 누르면 닫힌다. */
export function TreasureMap({ id, onClose }: { id: string; onClose: () => void }) {
  // Esc 로도 닫는다(다른 창과 같다)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const t = parseMapId(id)
  const cells: { x: number; z: number; fill: string }[] = []
  for (let x = -EXTENT; x < EXTENT; x += STEP) {
    for (let z = -EXTENT; z < EXTENT; z += STEP) {
      cells.push({ x, z, fill: COLOR[groundAt(x + STEP / 2, z + STEP / 2)] })
    }
  }
  // 가방 패널 안에 그리면 패널의 filter 때문에 fixed 가 패널 안으로 갇힌다. 그래서 body 에 붙인다.
  return createPortal(
    <div className="treasure-map" role="dialog" aria-label="보물 지도" onClick={onClose}>
      <div className="treasure-card" onClick={(e) => e.stopPropagation()}>
        <div className="treasure-head">
          <span>
            🗺️ 보물 지도 <small>✕ 자리를 삽으로 파요</small>
          </span>
          <button className="ghost treasure-close" onClick={onClose}>
            닫기 <kbd>Esc</kbd>
          </button>
        </div>
        <svg viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`} role="img" aria-label="섬 지도">
          {cells.map((c) => (
            <rect key={`${c.x},${c.z}`} x={c.x} y={c.z} width={STEP} height={STEP} fill={c.fill} />
          ))}
          {t && (
            <g stroke="#d9482b" strokeWidth={2.2} strokeLinecap="round">
              <line x1={t.x - 3} y1={t.z - 3} x2={t.x + 3} y2={t.z + 3} />
              <line x1={t.x + 3} y1={t.z - 3} x2={t.x - 3} y2={t.z + 3} />
            </g>
          )}
        </svg>
      </div>
    </div>,
    document.body,
  )
}
