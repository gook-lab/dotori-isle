import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parcelContents } from '../core/bottle'
import { weeklyPicks } from '../core/weekly'
import { STORY_CHAPTERS } from '../core/story'
import { useGame } from './store'

const FIRST = ['welcome', 'dig', 'garden']
const shellFor = (id: string, itemId: string) => ({ id, itemId, x: 60, z: 0 }) as never

beforeEach(() => {
  useGame.setState({ inventory: [], collected: [], money: 0, miles: 0, letters: [], questsDone: [], storyChapter: 0, storyFlash: null })
})

describe('섬 이야기 장 넘김', () => {
  it('첫 장의 퀘스트를 다 깨면 장을 넘기고 보상과 위원회 편지를 준다', () => {
    useGame.setState({ questsDone: [...FIRST] })
    const s = useGame.getState()
    expect(s.storyChapter).toBe(1)
    expect(s.money).toBe(STORY_CHAPTERS[0].reward.money)
    expect(s.letters[0]).toMatchObject({ id: 'story-1', from: 'committee', gift: 'story-photo-frame' })
    expect(s.storyFlash?.text).toContain('2장')
  })

  it('예전 저장처럼 이미 채운 조건이 있으면 한 번에 여러 장을 넘긴다', () => {
    useGame.setState({ questsDone: [...FIRST, 'newcomer-guriguri', 'newcomer-dongri', 'shore-day2'] })
    const s = useGame.getState()
    expect(s.storyChapter).toBe(2)
    expect(s.letters.filter((l) => l.id.startsWith('story-')).length).toBe(2)
  })

  it('조건이 덜 찼으면 장은 그대로다', () => {
    useGame.setState({ questsDone: ['welcome'] })
    expect(useGame.getState().storyChapter).toBe(0)
  })
})

describe('표류 소포', () => {
  it('소포를 열면 정해진 재료나 가구가 들어오고 소포는 사라진다', () => {
    const p = parcelContents('parcel-seed-a')
    useGame.getState().collectShell(shellFor('parcel-seed-a', 'parcel'))
    const s = useGame.getState()
    expect(s.inventory.some((x) => x.id === p.itemId)).toBe(true)
    expect(s.collected).toContain('parcel-seed-a')
  })
})

describe('송이 보관', () => {
  it('일요일이 되면 집 보관함의 송이도 상한다', () => {
    useGame.setState({ homeStorage: [{ id: 'songi', count: 10 }], inventory: [], day: '2026-10-17' })
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-18T12:00:00'))
      useGame.getState().syncClock()
      expect(useGame.getState().homeStorage.map((x) => x.id)).toEqual(['songi-spoiled'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('섬 이야기 끝 장면', () => {
  it('5장을 마치면 감사 편지와 에필로그를 한 번만 튼다', () => {
    useGame.setState({ storyChapter: 4, storyEnded: false, storyEnding: null, questsDone: [] })
    useGame.setState({
      questsDone: ['welcome', 'dig', 'garden', 'newcomer-guriguri', 'newcomer-dongri', 'shore-day2', 'home-mocha', 'home-bomi', 'home-pengdol', 'blossom'],
      stats: { plant: 10 },
      dex: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`x${i}`, 1])),
      islandStart: '2026-10-01',
      rating: { ...useGame.getState().rating, stars: 3 },
    })
    const s = useGame.getState()
    expect(s.storyChapter).toBe(5)
    expect(s.storyEnded).toBe(true)
    expect(s.storyEnding).not.toBeNull()
    expect(s.letters.some((l) => l.id === 'story-end')).toBe(true)
    useGame.setState({ storyEnding: null, letters: s.letters.filter((l) => l.id !== 'story-end') })
    // 같은 조건을 다시 채워도 에필로그는 두 번 뜨지 않는다
    useGame.setState({ storyChapter: 4 })
    useGame.setState({ questsDone: [...useGame.getState().questsDone] })
    expect(useGame.getState().storyChapter).toBe(5)
    expect(useGame.getState().storyEnding).toBeNull()
  })
})


describe('이번 주 목표 정산', () => {
  it('목표를 채우면 마일리지를 주고, 셋 모두 채우면 도토리와 편지를 한 번 준다', () => {
    const day = '2026-10-19'
    useGame.setState({ day, weekly: null, storyChapter: 5 })
    useGame.setState({ stats: { ...useGame.getState().stats } })
    expect(useGame.getState().weekly?.week).toBe('2026-10-19')
    const picks = weeklyPicks('2026-10-19')
    const base = useGame.getState().stats
    const stats = { ...base }
    for (const p of picks) stats[p.stat] = (base[p.stat] ?? 0) + p.target
    const miles = useGame.getState().miles
    const money = useGame.getState().money
    useGame.setState({ stats })
    const s = useGame.getState()
    expect(s.weekly?.bonus).toBe(true)
    expect(s.weekly?.got.length).toBe(3)
    expect(s.miles).toBe(miles + 40 * 3)
    expect(s.money).toBe(money + 300)
    expect(s.letters.some((l) => l.id === 'weekly-2026-10-19')).toBe(true)
    // 다시 건드려도 보상은 한 번이다
    useGame.setState({ stats: { ...stats } })
    expect(useGame.getState().money).toBe(money + 300)
  })
})

describe('이번 주 목표 시작 게이트', () => {
  it('섬 이야기 5장을 마치기 전에는 주가 바뀌어도 이번 주 목표가 시작되지 않는다', () => {
    // 앞 테스트가 채운 5장 조건을 비워서, 4장으로 되돌아가도 다시 넘어가지 않게 한다
    useGame.setState({ questsDone: [], stats: {}, dex: {}, rating: { ...useGame.getState().rating, stars: 0 }, storyChapter: 4, weekly: null, day: '2026-10-19' })
    useGame.setState({ day: '2026-10-26' })
    expect(useGame.getState().weekly).toBeNull()
  })
})
