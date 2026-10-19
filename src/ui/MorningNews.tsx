import { FIRST_QUEST } from '../core/quests'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { RECAP_HEAD } from '../core/weekRecap'

/** 펼친 카드가 접히기까지의 시간. 좁은 화면(390)은 카드가 화면을 많이 가리므로 짧게 한다 */
const FOLD_MS = 12000
const FOLD_MS_NARROW = 8000
const NARROW_PX = 560
/** 카드 위쪽 시작선과 HUD 조각 사이 간격 */
const GAP = 8
const TOP = 12
/** 카드가 피해야 하는 HUD 조각: 왼쪽·오른쪽 알약 하나하나, 미니맵, 보물 바 */
const HUD_BLOCK = '.hud-left > *, .hud-right > *, .minimap, .tourney-bar'
/** HUD 자리를 다시 재는 간격(ms) */
const PLACE_MS = 200
/** 토스트가 카드 아래로 내려갈 자리를 알려 주는 CSS 변수 */
const TOAST_VAR = '--toast-top'

/** 사각형 둘이 겹치는지 */
function overlaps(l: number, t: number, r: number, b: number, q: DOMRect): boolean {
  return l < q.right && r > q.left && t < q.bottom && b > q.top
}

/** 카드 자리(가로 위치는 그대로, 세로는 TOP 부터)를 HUD 조각 아래로 밀어낸 세로 위치를 돌려준다 */
function clearOfHud(left: number, w: number, h: number): number {
  const rects = Array.from(document.querySelectorAll(HUD_BLOCK), (e) => e.getBoundingClientRect())
  let top = TOP
  let moved = true
  // 아래로만 밀리므로 조각 수만큼 돌면 끝난다
  while (moved) {
    moved = false
    for (const q of rects) {
      if (overlaps(left, top, left + w, top + h, q)) {
        top = q.bottom + GAP
        moved = true
      }
    }
  }
  return top
}

/** 아침 섬 소식 카드. 모달이 아니라 HUD 아래에 뜨고, 닫거나 잠시 뒤 알약으로 접힌다. */
export function MorningNews() {
  const news = useGame((s) => s.news)
  // 패널(설정·도감 등)이 열리면 카드는 가린다. 패널 뒤로 겹쳐 보이지 않게.
  const panelOpen = useGame((s) => s.panel !== null)
  // 첫날 첫 퀘스트(나무 흔들기)를 시작하기 전에는 카드를 미룬다. 화면에 알림이 한꺼번에 쌓이지 않게.
  // 첫날 보류는 아침 자동 카드에만 건다. 마을회관 마이크로 다시 튼 방송은 바로 보인다.
  const hold = useGame((s) => !s.newsFromHall && !s.questsDone.includes(FIRST_QUEST) && (s.stats.shake ?? 0) < 1)
  const closeNews = useGame((s) => s.closeNews)
  const [folded, setFolded] = useState(false)
  const ref = useRef<HTMLElement>(null)
  // 새 소식이 오면 펼쳐서 보여 준다
  useEffect(() => {
    if (news) setFolded(false)
  }, [news])
  // 펼쳐진 동안만 시간을 재서 접는다. 알약을 눌러 다시 펼치면 그때부터 다시 잰다.
  useEffect(() => {
    if (!news || folded || hold) return
    const narrow = window.innerWidth < NARROW_PX
    const t = window.setTimeout(() => setFolded(true), narrow ? FOLD_MS_NARROW : FOLD_MS)
    return () => window.clearTimeout(t)
  }, [news, folded, hold])
  // 카드가 떠 있는 동안 HUD 를 피해 자리를 잡고, 토스트를 카드 아래로 내린다
  useEffect(() => {
    const root = document.documentElement
    if (!news) {
      root.style.removeProperty(TOAST_VAR)
      return
    }
    // 매 프레임 재면 강제 배치가 프레임마다 생겨 꼬리 프레임이 길어진다. HUD 는 자주 안 바뀌므로 0.2초마다 잰다.
    const tick = () => {
      const el = ref.current
      if (!el) return
      const box = el.getBoundingClientRect()
      // 위치는 CSS top 기준이므로 현재 top 과 화면 위치의 차이를 빼고 계산한다
      const base = box.top - (parseFloat(el.style.top) || TOP)
      const top = clearOfHud(box.left, box.width, box.height)
      const css = `${top - base}px`
      // 값이 같으면 스타일을 건드리지 않는다
      if (el.style.top !== css) el.style.top = css
      const toast = `${top + box.height + GAP}px`
      if (root.style.getPropertyValue(TOAST_VAR) !== toast) root.style.setProperty(TOAST_VAR, toast)
    }
    tick()
    const id = window.setInterval(tick, PLACE_MS)
    return () => {
      window.clearInterval(id)
      root.style.removeProperty(TOAST_VAR)
    }
  }, [news, folded])
  if (!news || panelOpen || hold) return null
  if (folded) {
    return (
      <button ref={ref as React.RefObject<HTMLButtonElement>} className="pill morning-news-fold" onClick={() => setFolded(false)}>
        📻 마을 방송
      </button>
    )
  }
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="morning-news" aria-label="마을 방송">
      <header className="morning-news-head">
        <strong>📻 마을 방송</strong>
        <button className="pill" onClick={closeNews}>
          닫기
        </button>
      </header>
      <ul>
        {news.map((line) => (
          <li key={line} className={line === RECAP_HEAD ? 'morning-news-sep' : undefined}>
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}
