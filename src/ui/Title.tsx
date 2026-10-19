import { useEffect, useState } from 'react'
import { dayIndex } from '../core/economy'
import { SAVE_KEY, useGame } from '../game/store'

/** 저장된 게임이 있는지. 저장소를 못 읽으면 없는 것으로 본다. */
function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * 처음 열었을 때 뜨는 타이틀. 섬이 뒤에서 천천히 돌고, 아무 곳이나 누르거나 Enter·Space 를 치면 시작한다.
 * 저장이 있으면 '이어하기 · N일째', 없으면 '새로 시작'이다. 시간대와 날씨는 저장된 날짜를 따른다.
 */
export function Title() {
  const title = useGame((s) => s.title)
  const day = useGame((s) => s.day)
  const since = useGame((s) => s.rating.since)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory.length)
  const quests = useGame((s) => s.questsDone.length)
  const [stored] = useState(hasSave)

  useEffect(() => {
    if (!title) return
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return
      e.preventDefault()
      useGame.getState().endTitle()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [title])

  if (!title) return null
  const start = () => useGame.getState().endTitle()
  const a = dayIndex(day)
  const b = since ? dayIndex(since) : null
  const days = a !== null && b !== null ? Math.max(1, a - b + 1) : 1
  // 처음 열면 빈 저장이 먼저 만들어지므로, 하루가 지났거나 무언가 한 흔적이 있을 때만 '이어하기'로 본다
  const saved = stored && (days > 1 || money > 0 || inventory > 0 || quests > 0)
  return (
    <div className="title" onClick={start} role="presentation">
      <div className="title-logo">
        <svg className="title-acorn" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M14 26 C14 14 50 14 50 26 Z" fill="#8a5a2b" stroke="#3b2a20" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="32" cy="20" r="2" fill="#5a3a1c" />
          <path d="M20 26 C20 46 24 56 32 58 C40 56 44 46 44 26 Z" fill="#d9a35c" stroke="#3b2a20" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 34 C27 40 27 46 29 50" fill="none" stroke="#fff3d6" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </svg>
        <span className="title-name">도토리섬</span>
      </div>
      <div className="title-foot">
        <p className="title-hint">눌러서 시작</p>
        <button type="button" className="title-go" autoFocus onClick={(e) => { e.stopPropagation(); start() }}>
          {saved ? `이어하기 · ${days}일째` : '새로 시작'}
        </button>
      </div>
    </div>
  )
}
