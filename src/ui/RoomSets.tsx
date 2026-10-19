import { setProgress } from '../core/homeScore'
import { useGame } from '../game/store'

/** 집 안에서 방 위쪽 한 줄에 뜨는 완성 세트 칩. 완성된 세트가 하나도 없으면 아무것도 그리지 않는다. */
export function RoomSetChip() {
  const inHome = useGame((s) => s.inHome)
  const panelOpen = useGame((s) => s.panel !== null)
  const furniture = useGame((s) => s.homeFurniture)
  // 패널이 열려 있으면 칩을 숨겨 패널 위에 겹치지 않게 한다
  if (!inHome || panelOpen) return null
  const done = setProgress(furniture).filter((p) => p.done)
  if (!done.length) return null
  return (
    <div className="room-set-chip" role="status" aria-label="이 방의 완성 세트">
      <span className="room-set-tag">세트</span>
      {done.map((p) => p.name).join(' · ')}
    </div>
  )
}
