import { useEffect, useState } from 'react'
import { currentHour } from '../core/clock'
import { clockText, remainingMs, runOver, tourneyWindow } from '../core/tourney'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

/**
 * 대회 판이 도는 동안 남은 시간과 잡은 마릿수. 시간이 다 되었거나 대회 시간이 끝나면 여기서 판을 마친다.
 * 판은 실시간 시계로 재므로 0.25초마다 확인한다.
 */
export function TourneyBar() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      const run = runtime.tourney
      if (run && (runOver(run, Date.now()) || !tourneyWindow(useGame.getState().day, currentHour()))) useGame.getState().finishTourney()
      tick((n) => n + 1)
    }, 250)
    return () => clearInterval(id)
  }, [])
  const run = runtime.tourney
  if (!run) return null
  return (
    <div className="tourney-bar" role="status" aria-live="polite">
      🎣 대회 {clockText(remainingMs(run, Date.now()))} · 🐟 {run.count}마리
    </div>
  )
}
