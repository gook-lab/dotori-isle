import { useEffect, useState } from 'react'
import { placeBlocker, placementCell } from '../core/placement'
import { pathCellsOf } from '../core/paths'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

/** 놓기 중엔 앞 칸이 왜 안 되는지 한 줄로 보여 준다(미리보기 빨강·초록과 같은 판정). */
export function PlaceHint() {
  const placing = useGame((s) => s.placing)
  const [why, setWhy] = useState<string | null>(null)
  useEffect(() => {
    if (!placing) return
    let raf = 0
    let last: string | null | undefined
    const tick = () => {
      const p = runtime.player
      const gs = useGame.getState()
      const c = gs.placeCell ?? placementCell(p.x, p.z, p.facing)
      const r = placeBlocker(c.x, c.z, gs.placed, gs.plants, { felled: gs.felled, day: gs.day, holes: gs.holes, paths: pathCellsOf(gs.infra.paths) })
      // 바뀔 때만 다시 그린다
      if (r !== last) {
        last = r
        setWhy(r)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [placing])
  if (!placing) return null
  return (
    <div className={`place-hint ${why ? 'bad' : 'ok'}`} role="status">
      {why ?? '여기에 놓을 수 있어요'}
    </div>
  )
}
