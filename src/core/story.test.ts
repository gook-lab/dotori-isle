import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { MUSEUM_DEX } from './museum'
import { cleanStoryChapter, currentChapter, epilogueStage, EPILOGUE_MS, goalCurrent, STORY_CHAPTERS, storyAwaitingClaim, storyBannerTexts, storyClearedCount, storyProgress, storyRewards, type StoryCtx } from './story'

const ctx = (over: Partial<StoryCtx> & { questsDone?: string[]; dexCount?: number; stats?: Record<string, number> } = {}): StoryCtx => {
  const questsDone = over.questsDone ?? over.unlock?.questsDone ?? []
  return {
    unlock: {
      day: '2026-10-19',
      islandStart: '2026-10-01',
      questsDone,
      dexCount: over.dexCount ?? 0,
      stats: { sold: 0, spent: 0, questsDone },
    },
    stats: over.stats ?? {},
    stars: over.stars ?? 0,
  }
}

const FIRST = ['welcome', 'dig', 'garden']
const SECOND = ['newcomer-guriguri', 'newcomer-dongri', 'shore-day2']
const THIRD = ['home-mocha', 'home-bomi', 'home-pengdol']

describe('섬 이야기 장', () => {
  it('다섯 장이고 번호가 1부터 이어진다', () => {
    expect(STORY_CHAPTERS.map((c) => c.no)).toEqual([1, 2, 3, 4, 5])
    expect(currentChapter(0)?.title).toBe('섬에 오다')
    expect(currentChapter(5)).toBeNull()
  })

  it('퀘스트 목표는 완료 기록이 있으면 채워진다', () => {
    const c = ctx({ questsDone: ['welcome'] })
    expect(storyProgress(STORY_CHAPTERS[0], c)).toMatchObject({ done: false, goals: [{ current: 1, target: 1 }, { current: 0, target: 1 }, { current: 0, target: 1 }] })
  })

  it('조건을 다 채우면 장을 넘기고, 여러 장이 한꺼번에 채워져도 한 번에 센다', () => {
    expect(storyClearedCount(0, ctx({ questsDone: FIRST.slice(0, 2) }))).toBe(0)
    expect(storyClearedCount(0, ctx({ questsDone: FIRST }))).toBe(1)
    expect(storyClearedCount(0, ctx({ questsDone: [...FIRST, ...SECOND, ...THIRD] }))).toBe(3)
  })

  it('이미 넘긴 장은 다시 세지 않고, 다섯 장을 넘으면 더 넘지 않는다', () => {
    expect(storyClearedCount(1, ctx({ questsDone: FIRST }))).toBe(1)
    const all = ctx({ questsDone: [...FIRST, ...SECOND, ...THIRD], dexCount: MUSEUM_DEX, stars: 3, stats: { plant: 10, bloom: 3 } })
    expect(storyClearedCount(0, all)).toBe(5)
    expect(storyClearedCount(5, all)).toBe(5)
  })

  it('통계 목표는 목표값에서 멈추고, 별점 목표도 같다', () => {
    expect(goalCurrent({ kind: 'stat', stat: 'plant', target: 10, label: '' }, ctx({ stats: { plant: 25 } }))).toBe(10)
    expect(goalCurrent({ kind: 'stat', stat: 'plant', target: 10, label: '' }, ctx({ stats: { plant: 4 } }))).toBe(4)
    expect(goalCurrent({ kind: 'stars', target: 3, label: '' }, ctx({ stars: 2 }))).toBe(2)
  })

  it('기능 열림 목표는 전시관 도감 수로 본다', () => {
    const c4 = ctx({ questsDone: [...FIRST, ...SECOND, ...THIRD], stats: { plant: 10, bloom: 3 }, dexCount: MUSEUM_DEX - 1 })
    expect(storyClearedCount(3, c4)).toBe(3)
    expect(storyClearedCount(3, { ...c4, unlock: { ...c4.unlock, dexCount: MUSEUM_DEX } })).toBe(4)
  })

  it('저장값은 0 이상의 정수 장 수만 믿는다', () => {
    expect(cleanStoryChapter(3)).toBe(3)
    expect(cleanStoryChapter(5)).toBe(5)
    expect(cleanStoryChapter(6)).toBe(0)
    expect(cleanStoryChapter(-1)).toBe(0)
    expect(cleanStoryChapter(1.5)).toBe(0)
    expect(cleanStoryChapter('2')).toBe(0)
    expect(cleanStoryChapter(undefined)).toBe(0)
  })

  it('보상은 넘긴 장들의 합이다', () => {
    expect(storyRewards(0, 1)).toEqual({ money: 200, miles: 0 })
    expect(storyRewards(0, 2)).toEqual({ money: 500, miles: 100 })
    expect(storyRewards(1, 1)).toEqual({ money: 0, miles: 0 })
  })
})

describe('섬 이야기 보상 안내와 배너 순서', () => {
  it('says the chapter waits for a reward claim when the goals are met but nothing is claimed yet', () => {
    const ch1 = STORY_CHAPTERS[0]
    expect(storyAwaitingClaim(ch1, ctx(), ['welcome'])).toBe(false)
    expect(storyAwaitingClaim(ch1, ctx({ questsDone: ['welcome'] }), [])).toBe(false)
    const c = ctx({ questsDone: ['welcome', 'dig'] })
    expect(storyAwaitingClaim(ch1, c, ['garden'])).toBe(true)
    expect(storyAwaitingClaim(ch1, c, [])).toBe(false)
  })

  it('lists every chapter the player just passed, in order, for the banner queue', () => {
    expect(storyBannerTexts(0, 1)).toEqual(['2장 · 이웃 맞이'])
    expect(storyBannerTexts(1, 3)).toEqual(['3장 · 내 집 마련', '4장 · 섬 꾸미기'])
    expect(storyBannerTexts(4, 5)).toEqual(['섬 이야기를 모두 마쳤어요'])
    expect(storyBannerTexts(5, 5)).toEqual([])
  })

  it('counts the flower goal as done when the blossom quest was finished before (old saves)', () => {
    const flower = STORY_CHAPTERS[3].goals.find((g) => g.kind === 'stat' && g.stat === 'bloom')!
    const old = ctx({ questsDone: ['blossom'], stats: { bloom: 0 } })
    expect(goalCurrent(flower, old)).toBe(3)
    expect(storyProgress(STORY_CHAPTERS[3], old).goals.find((g) => g.label.startsWith('활짝 핀 꽃'))).toMatchObject({ current: 3, target: 3 })
    // 퀘스트도 꽃도 없으면 아직 0이다
    expect(goalCurrent(flower, ctx({ stats: { bloom: 0 } }))).toBe(0)
  })

  it('counts the flower goal by blooms when the quest is not done yet', () => {
    const flower = STORY_CHAPTERS[3].goals.find((g) => g.kind === 'stat' && g.stat === 'bloom')
    expect(flower).toMatchObject({ target: 3 })
    expect(goalCurrent(flower!, ctx({ stats: { bloom: 2 } }))).toBe(2)
    expect(storyProgress(STORY_CHAPTERS[3], ctx({ stats: { bloom: 1 } })).goals.map((g) => g.label)).toContain('활짝 핀 꽃 (사흘 동안 매일 물 주기)')
  })

  it('shows the prerequisite for the second chapter neighbors', () => {
    const labels = STORY_CHAPTERS[1].goals.map((g) => g.label)
    expect(labels).toContain('새 이웃 구리구리 (모카 집 짓기부터)')
    expect(labels).toContain('새 이웃 동그리 (봄이 집 짓기부터)')
  })
})

describe('섬 이야기 기념 가구', () => {
  it('장마다 다른 기념 가구 하나가 있고, 모두 가구 정의다', () => {
    const gifts = STORY_CHAPTERS.map((c) => c.gift)
    expect(new Set(gifts).size).toBe(STORY_CHAPTERS.length)
    for (const id of gifts) expect(ITEMS[id]?.kind).toBe('furniture')
  })
})

describe('에필로그 단계', () => {
  it('처음에는 어둡지 않고, 0.8초 만에 거의 까맣게 덮인다', () => {
    expect(epilogueStage(0).dark).toBe(0)
    expect(epilogueStage(800).dark).toBeCloseTo(0.9)
  })

  it('1.5초부터는 반투명으로 걷혀 섬 하늘 카메라가 비친다', () => {
    expect(epilogueStage(1500).dark).toBeCloseTo(0.45)
    expect(epilogueStage(2500).dark).toBeCloseTo(0.45)
  })

  it('글은 1초부터 4초까지 떠 있고, 그 밖에서는 보이지 않는다', () => {
    expect(epilogueStage(500).text).toBe(0)
    expect(epilogueStage(2500).text).toBe(1)
    expect(epilogueStage(4500).text).toBe(0)
  })

  it('4.5초부터 밝아지고, 5초에 끝난다', () => {
    expect(epilogueStage(4750).dark).toBeCloseTo(0.225)
    expect(epilogueStage(EPILOGUE_MS)).toEqual({ dark: 0, text: 0, done: true })
  })
})
