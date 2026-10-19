import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

/** 기기 저장소 흉내. 테스트 환경에 localStorage 가 없을 수 있어 Map 으로 대신한다 */
function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-19T09:00:00'))
  useGame.setState({ title: true, news: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('아침 섬 소식 표시', () => {
  it('타이틀 화면 중에는 소식을 띄우지 않는다', () => {
    useGame.getState().showNews()
    expect(useGame.getState().news).toBeNull()
    expect(localStorage.getItem('dotori-isle-news-day')).toBeNull()
  })

  it('타이틀이 끝나면 오늘 소식을 한 번 띄운다', () => {
    useGame.getState().endTitle()
    const news = useGame.getState().news
    expect(news).not.toBeNull()
    expect(news!.length).toBeGreaterThan(0)
    expect(news!.length).toBeLessThanOrEqual(4)
    expect(localStorage.getItem('dotori-isle-news-day')).toBe('2026-10-19')
  })

  it('같은 날에는 다시 띄우지 않는다', () => {
    useGame.getState().endTitle()
    useGame.getState().closeNews()
    useGame.getState().showNews()
    expect(useGame.getState().news).toBeNull()
  })

  it('날이 바뀌면 다음 아침에 다시 띄운다', () => {
    useGame.getState().endTitle()
    useGame.getState().closeNews()
    vi.setSystemTime(new Date('2026-10-20T08:00:00'))
    useGame.getState().showNews()
    expect(useGame.getState().news).not.toBeNull()
    expect(localStorage.getItem('dotori-isle-news-day')).toBe('2026-10-20')
  })

  it('닫기는 소식만 비우고 저장된 날짜는 그대로 둔다', () => {
    useGame.getState().endTitle()
    useGame.getState().closeNews()
    expect(useGame.getState().news).toBeNull()
    expect(localStorage.getItem('dotori-isle-news-day')).toBe('2026-10-19')
  })
})
