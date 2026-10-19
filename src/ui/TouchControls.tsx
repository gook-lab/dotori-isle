import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { onKey } from '../game/controls'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

const RADIUS = 48

// 일부 브라우저는 터치 화면에서도 pointer: coarse 를 보고하지 않아 터치 점 개수도 함께 본다.
const isTouch = (mq: MediaQueryList) => mq.matches || navigator.maxTouchPoints > 0

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && isTouch(window.matchMedia('(pointer: coarse)')))
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const on = () => setCoarse(isTouch(mq))
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return coarse
}

/** 터치 기기용 가상 조이스틱과 행동 버튼. 키보드와 같은 onKey 를 부른다. */
export function TouchControls() {
  const coarse = useCoarsePointer()
  // 바깥 놓기(placing)와 방 안 놓기(homePlacing) 모두 돌리기·그만 버튼이 나와야 한다
  const placing = useGame((s) => !!(s.placing || s.homePlacing))
  const panel = useGame((s) => s.panel)
  // 주머니가 열리면 아래 칸들이 조이스틱·행동 버튼 밑으로 들어가니, 그 위로 띄워 칸을 누를 수 있게 한다
  const bagOpen = useGame((s) => s.bagOpen)
  const prompt = useGame((s) => s.prompt)
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  if (!coarse) return null

  const move = (e: PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return
    // 스틱으로 움직이기 시작하면 찍어 둔 칸은 풀고, 다시 바라보는 칸을 쓴다
    useGame.getState().setHomePlaceCell(null)
    useGame.getState().setPlaceCell(null)
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    runtime.stick.x = dx / RADIUS
    runtime.stick.z = dy / RADIUS
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    runtime.stick.x = 0
    runtime.stick.z = 0
  }

  return (
    <div className={`touch ${bagOpen ? 'lifted' : ''}`}>
      {!panel && (
        <div
          ref={base}
          className="stick"
          onPointerDown={(e) => {
            active.current = e.pointerId
            e.currentTarget.setPointerCapture(e.pointerId)
            move(e)
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      )}
      {/* 도감·수첩 같은 패널이 열리면 행동 버튼도 숨겨 목록 아래쪽을 가리지 않게 한다. 대화(talk)는 E 로 넘기므로 남긴다. */}
      {(!panel || panel === 'talk') && (
        <div className={`touch-buttons${placing ? ' is-placing' : ''}`}>
          {placing && (
            <button className="round" onClick={() => onKey('KeyR')} aria-label="돌리기" title="가구를 돌려요 (R)">
              ↻
            </button>
          )}
          {/* 좁은 화면에서 놓는 중에는 주머니가 옅게 깔리지 않고, 이 버튼으로 잠깐 연다(CSS 에서 넓은 화면에는 숨긴다) */}
          {placing && (
            <button className="round bag-toggle" onClick={() => useGame.getState().toggleBag()} aria-label={bagOpen ? '주머니 닫기' : '주머니 열기'} title="주머니를 여닫아요 (I)">
              🎒
            </button>
          )}
          {!panel && (
            <span className="round-wrap">
              <button
                className="round"
                onClick={() => onKey(placing ? 'Escape' : 'KeyQ')}
                aria-label={placing ? '그만 놓기' : '도구 바꾸기'}
                title={placing ? '가구 놓기를 그만둬요 (Esc)' : '손과 도구를 차례로 바꿔요 (Q)'}
              >
                {placing ? '✕' : '⇄'}
              </button>
              <span className="round-cap">{placing ? '그만' : '도구'}</span>
            </span>
          )}
          {!panel && (
            <span className="round-wrap">
              <button className="round" onClick={() => useGame.getState().openPanel('phone')} aria-label="휴대폰" title="휴대폰을 열어요">
                📱
              </button>
              <span className="round-cap">휴대폰</span>
            </span>
          )}
          <button className="round big-btn" onClick={() => onKey('KeyE')} aria-label="행동">
            E
          </button>
        </div>
      )}
      {/* 가구 넣기 버튼은 행동 줄 밖, E 위 빈 자리에 둔다. 줄 안에 두면 조이스틱 쪽으로 넘쳐 스틱과 겹친다. */}
      {!panel && prompt?.includes('넣기') && (
        <button className="round stow-cta stow-float" onClick={() => onKey('KeyR')} aria-label="가구 넣기" title="가구를 주머니에 넣어요 (R)">
          📦
        </button>
      )}
    </div>
  )
}
