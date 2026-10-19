import { describe, expect, it } from 'vitest'
import {
  afterStoryCandidates,
  afterStoryHudLine,
  afterStoryLine,
  afterStoryOpen,
  AFTER_CELEBRATED_KEEP,
  AFTER_GOAL_COUNT,
  cleanAfterCelebrated,
  cleanWeekMilestones,
  milestoneLabel,
  milestoneText,
  milestoneWeekLine,
  nearestAfterGoals,
  newAfterMilestones,
  reachedAfterKeys,
  WEEK_MILESTONE_KEEP,
  type AfterStoryInput,
} from './afterStory'
import { STORY_CHAPTERS } from './story'

const DONE = STORY_CHAPTERS.length
const base: AfterStoryInput = { storyChapter: DONE, homeStars: 0, shopTier: 0, dexFound: 0, islandStars: 3 }

describe('섬 이야기 이후 다음 목표', () => {
  it('5장을 마치기 전에는 목표가 없다', () => {
    expect(afterStoryOpen(DONE - 1)).toBe(false)
    expect(nearestAfterGoals({ ...base, storyChapter: DONE - 1 })).toEqual([])
    expect(afterStoryLine([])).toBeNull()
  })

  it('후보는 집 별, 백화점, 도감, 섬 별점이고 이미 채운 것은 뺀다', () => {
    const all = afterStoryCandidates({ ...base, homeStars: 5, shopTier: 3, dexFound: 150, islandStars: 5 })
    expect(all).toEqual([])
    const ids = afterStoryCandidates(base).map((g) => g.id)
    expect(ids).toEqual(['home-stars', 'shop-tier', 'dex', 'island-stars'])
  })

  it('집 별은 다음 별 하나를 목표로 하고, 도감은 다음 구간(50, 100, 150)을 본다', () => {
    const g = afterStoryCandidates({ ...base, homeStars: 1, dexFound: 50 })
    expect(g.find((x) => x.id === 'home-stars')).toEqual({ id: 'home-stars', label: '집 별 2', current: 1, target: 2 })
    expect(g.find((x) => x.id === 'dex')).toEqual({ id: 'dex', label: '도감 100종', current: 50, target: 100 })
  })

  it('가까운 목표 세 개를 남은 비율 순서로 고른다', () => {
    // 집 별 0/1, 백화점 1/3, 도감 30/50(0.6), 섬 별점 3/5(0.6)
    const goals = nearestAfterGoals({ ...base, shopTier: 1, dexFound: 30, islandStars: 3 })
    expect(goals).toHaveLength(AFTER_GOAL_COUNT)
    expect(goals.map((g) => g.id)).toEqual(['dex', 'island-stars', 'shop-tier'])
  })

  it('같은 비율이면 후보 순서를 따른다', () => {
    const goals = nearestAfterGoals({ ...base, homeStars: 0, shopTier: 0, dexFound: 0, islandStars: 0 })
    expect(goals.map((g) => g.id)).toEqual(['home-stars', 'shop-tier', 'dex'])
  })

  it('목표 한 줄은 이름과 진행을 가운데 점으로 잇는다', () => {
    const goals = nearestAfterGoals({ ...base, homeStars: 2, shopTier: 0, dexFound: 32, islandStars: 3 })
    expect(afterStoryLine(goals)).toBe('다음 목표: 집 별 3 (2/3) · 도감 50종 (32/50) · 섬 별점 5개 (3/5)')
  })

  it('HUD 목표 줄은 첫 번째 목표 하나만 보여 준다. 목표가 없으면 null이다', () => {
    const goals = nearestAfterGoals({ ...base, homeStars: 2, shopTier: 0, dexFound: 32, islandStars: 3 })
    expect(afterStoryHudLine(goals)).toBe('🎯 다음 목표: 집 별 3 (2/3)')
    expect(afterStoryHudLine([])).toBeNull()
    expect(afterStoryHudLine(nearestAfterGoals({ ...base, storyChapter: DONE - 1 }))).toBeNull()
  })

  it('채운 목표 키는 집 별 단계, 백화점, 도감 구간, 섬 별점 순서로 나온다', () => {
    expect(reachedAfterKeys({ ...base, homeStars: 2, shopTier: 3, dexFound: 100, islandStars: 5 })).toEqual([
      'home-stars:1',
      'home-stars:2',
      'shop-tier:3',
      'dex:50',
      'dex:100',
      'island-stars:5',
    ])
    expect(reachedAfterKeys(base)).toEqual([])
  })

  it('목표 이름은 축하 글에 쓰는 말과 같다', () => {
    expect(milestoneLabel('home-stars:2')).toBe('집 별 2')
    expect(milestoneLabel('shop-tier:3')).toBe('백화점 열기')
    expect(milestoneLabel('dex:50')).toBe('도감 50종')
    expect(milestoneLabel('island-stars:5')).toBe('섬 별점 5개')
  })

  it('새로 채운 목표만 골라 한 번씩 알린다(이미 채운 것과 축하한 것은 뺀다)', () => {
    const prev = { ...base, dexFound: 49 }
    const now = { ...base, dexFound: 50 }
    expect(newAfterMilestones(prev, now, [])).toEqual(['dex:50'])
    expect(newAfterMilestones(prev, now, ['dex:50'])).toEqual([])
    expect(newAfterMilestones({ ...base, dexFound: 50 }, { ...base, dexFound: 51 }, [])).toEqual([])
  })

  it('섬 이야기를 마치기 전에는 축하하지 않는다', () => {
    expect(newAfterMilestones({ ...base, storyChapter: 4, dexFound: 49 }, { ...base, storyChapter: 4, dexFound: 50 }, [])).toEqual([])
  })

  it('예전 저장에서 이미 채운 목표는 처음 바뀔 때 축하하지 않는다', () => {
    expect(newAfterMilestones({ ...base, dexFound: 60 }, { ...base, dexFound: 61 }, [])).toEqual([])
  })

  it('축하 글은 채운 목표와 다음 목표 하나를 말한다', () => {
    expect(milestoneText('dex:50', { id: 'island-stars', label: '섬 별점 5개', current: 3, target: 5 })).toBe('🎯 도감 50종 목표를 채웠어요! 다음 목표는 섬 별점 5개예요')
    expect(milestoneText('dex:150', null)).toBe('🎯 도감 150종 목표를 채웠어요! 섬 이야기 이후 목표를 모두 채웠어요')
    expect(milestoneWeekLine('dex:50')).toBe('🎯 도감 50종 목표를 채웠어요')
  })

  it('저장된 축하 키는 목표 키 형식만 남기고 중복과 넘치는 개수를 버린다', () => {
    expect(cleanAfterCelebrated(['dex:50', 'dex:50', 'dex:999', 'hack', 3, 'island-stars:5'])).toEqual(['dex:50', 'island-stars:5'])
    expect(cleanAfterCelebrated(undefined)).toEqual([])
    const many = Array.from({ length: AFTER_CELEBRATED_KEEP + 2 }, (_, i) => `home-stars:${(i % 5) + 1}`)
    expect(cleanAfterCelebrated(many).length).toBeLessThanOrEqual(AFTER_CELEBRATED_KEEP)
  })

  it('저장된 주간 소식 줄은 길이와 개수를 제한한다', () => {
    expect(cleanWeekMilestones(['ok', 'x'.repeat(200), 4])).toEqual(['ok'])
    const many = Array.from({ length: WEEK_MILESTONE_KEEP + 3 }, (_, i) => `줄 ${i}`)
    expect(cleanWeekMilestones(many)).toEqual(many.slice(-WEEK_MILESTONE_KEEP))
  })
})
