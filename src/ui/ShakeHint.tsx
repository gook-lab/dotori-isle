import { useEffect, useRef } from 'react'
import { shakeHintOn } from '../core/guide'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { isTouchDevice } from './device'

/** 말풍선이 화면 위쪽에서 잘리기 시작하는 높이(CSS px) */
const FLIP_Y = 90
/** 말풍선이 가리는 상자(점 기준 반폭·위·아래)와 화살표 상자 반크기. 점 주변에 말풍선 글자와 ▼ 가 들어갈 만큼이다. */
const BUBBLE_BOX = { half: 80, up: 60, down: 60 }
const ARROW_HALF = 24
/** 말풍선이 HUD 위에 겹치면 안 되는 덩어리: 왼쪽·오른쪽 알약 줄, 아래 안내 줄, 미니맵, 보물 바 */
const HUD_SELECTOR = '.hud-left, .hud-right, .hud-bottom, .minimap, .tourney-bar, .morning-news, .morning-news-fold'

/** 사각형 둘이 겹치는지 */
function clashes(l: number, t: number, r: number, b: number, rects: readonly DOMRect[]): boolean {
  return rects.some((q) => l < q.right && r > q.left && t < q.bottom && b > q.top)
}

/** 첫 열매나무 위에 뜨는 ▼ 말풍선. 위치는 ShakeHintTracker 가 매 프레임 정한다. */
export function ShakeHintBubble() {
  const on = useGame((s) => shakeHintOn(s.stats, s.questsDone))
  // 첫 흔들기 전에는 가장자리 화살표를 크게 맥박치게 한다(첫 흔들기 뒤에는 원래 크기)
  const first = useGame((s) => (s.stats.shake ?? 0) < 1)
  // 패널·대화·사진 모드가 열려 있으면 말풍선을 숨긴다
  const blocked = useGame((s) => s.panel !== null || s.dialog !== null || s.photo || s.treasureMap !== null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = ref.current
      const rects = Array.from(document.querySelectorAll(HUD_SELECTOR), (e) => e.getBoundingClientRect())
      let h = runtime.shakeHint
      // 말풍선이 HUD 에 가리면 가장자리 화살표로 바꾸고, 그 화살표마저 가리면 숨긴다
      if (h && h.angle === undefined && clashes(h.x - BUBBLE_BOX.half, h.y - BUBBLE_BOX.up, h.x + BUBBLE_BOX.half, h.y + BUBBLE_BOX.down, rects)) h = runtime.shakeHintEdge
      if (h && clashes(h.x - ARROW_HALF, h.y - ARROW_HALF, h.x + ARROW_HALF, h.y + ARROW_HALF, rects)) h = null
      if (el) {
        el.style.display = h && !h.behind ? '' : 'none'
        if (h) {
          el.style.transform = `translate(${h.x}px, ${h.y}px)`
          // 나무 꼭대기가 화면 맨 위에 걸리면 말풍선을 나무 아래로 뒤집어 잘리지 않게 한다
          el.classList.toggle('flip', h.y < FLIP_Y)
          // 화면 밖이면 방향 화살표만 남긴다
          el.classList.toggle('edge', h.angle !== undefined)
          if (h.angle !== undefined) el.style.setProperty('--ang', `${h.angle}deg`)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!on || blocked) return null
  return (
    <div ref={ref} className={`shake-hint${first ? ' first' : ''}`} aria-hidden>
      <div className="shake-hint-box">
        <span className="shake-bubble">{isTouchDevice() ? '가까이 가서 ✋' : '가까이 가서 E'}</span>
        <span className="shake-arrow">▼</span>
      </div>
      <span className="shake-edge">▲</span>
    </div>
  )
}
