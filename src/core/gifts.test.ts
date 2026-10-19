import { describe, expect, it } from 'vitest'
import { moodOf } from './villagers'
import { canGiveToday, categoryOf, finishGlimpse, giftPoints, giftReaction, presentFor, tasteOf, tastesOf } from './gifts'

describe('gift tastes', () => {
  it('a villager has a love and a like category that differ', () => {
    for (const id of ['mocha', 'bomi', 'somi', 'sora', 'coco']) {
      const t = tastesOf(id)
      expect(t.love).not.toBe(t.like)
      expect(tastesOf(id)).toEqual(t)
    }
  })

  it('maps items to categories, seeds to flowers, junk to junk', () => {
    expect(categoryOf('sea-bass')).toBe('fish')
    expect(categoryOf('peach')).toBe('fruit')
    expect(categoryOf('flower-seed')).toBe('flower')
    expect(categoryOf('empty-can')).toBe('junk')
    expect(categoryOf('trip-ticket')).toBeNull()
    expect(categoryOf('nope')).toBeNull()
  })

  it('the favourite is love, the second is like, junk is always disliked', () => {
    const t = tastesOf('mocha')
    const loveItem = { fish: 'sea-bass', bug: 'honeybee', shell: 'conch', fruit: 'peach', furniture: 'chair', flower: 'flower-seed', treasure: 'fossil', material: 'wood', junk: 'empty-can' }[t.love]!
    expect(tasteOf('mocha', loveItem)).toBe('love')
    expect(tasteOf('mocha', 'empty-can')).toBe('dislike')
  })

  it('a birthday gift is worth more than a normal one at every taste', () => {
    for (const taste of ['love', 'like', 'neutral'] as const) {
      expect(giftPoints(taste, true)).toBeGreaterThan(giftPoints(taste, false))
    }
    expect(giftPoints('love', true)).toBeGreaterThan(giftPoints('love', false))
    expect(giftPoints('love', false)).toBeGreaterThan(giftPoints('like', false))
    expect(giftPoints('like', false)).toBeGreaterThan(giftPoints('neutral', false))
  })

  it('each taste reads with its own expression', () => {
    const v = { id: 'mocha', name: '모카', tic: '냥' }
    const moods = (itemId: string, birthday = false) => giftReaction(v, '테스트', itemId, birthday).lines.map(moodOf)
    // 취향 종류 하나씩 골라 네 가지 반응을 모두 만든다
    const t = tastesOf('mocha')
    const pick = (cat: string) => ({ fish: 'sea-bass', bug: 'honeybee', shell: 'conch', fruit: 'peach', furniture: 'chair', flower: 'flower-seed', treasure: 'fossil', material: 'wood', junk: 'empty-can' })[cat]!
    expect(moods(pick(t.love))).toEqual(['happy'])
    expect(moods(pick(t.like))).toEqual(['happy'])
    const neutral = ['fish', 'bug', 'shell', 'fruit', 'furniture', 'flower', 'treasure', 'material'].find((c) => c !== t.love && c !== t.like)!
    expect(moods(pick(neutral))).toEqual(['calm'])
    expect(moods('empty-can')).toEqual(['sad'])
    expect(moods(pick(t.love), true)).toEqual(['surprised', 'happy'])
  })

  it('a birthday reaction starts with a surprised line before the taste line', () => {
    const r = giftReaction({ id: 'mocha', name: '모카', tic: '냥' }, '복숭아', 'peach', true)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0]).toContain('생일')
  })
})

describe('gift limits and replies', () => {
  it('one gift per villager per day', () => {
    expect(canGiveToday(undefined, '2026-03-03')).toBe(true)
    expect(canGiveToday('2026-03-02', '2026-03-03')).toBe(true)
    expect(canGiveToday('2026-03-03', '2026-03-03')).toBe(false)
  })

  it('picks a birthday present from the villager favourite furniture, the same on the same day', () => {
    const gifts = ['flowerpot', 'chair', 'snowman']
    const a = presentFor(gifts, '2026-03-03', 'bomi')
    expect(gifts).toContain(a)
    expect(presentFor(gifts, '2026-03-03', 'bomi')).toBe(a)
    expect(presentFor([], '2026-03-03', 'bomi')).toBeNull()
  })
})

describe('편지 동봉 마감 가구 알아보기', () => {
  it('금박은 번쩍번쩍, 반짝이는 반짝반짝으로 알아보고 주민 말버릇을 붙인다', () => {
    expect(finishGlimpse({ tic: '냥' }, 'gold')).toBe('금박이 번쩍번쩍하네냥. 이런 건 처음 봐.')
    expect(finishGlimpse({ tic: '' }, 'glitter')).toBe('반짝이 마감이라 반짝반짝하네. 눈이 부셔.')
  })

  it('기본 가구와 색 변형은 아무 줄도 붙이지 않는다', () => {
    expect(finishGlimpse({ tic: '냥' }, undefined)).toBeNull()
    expect(finishGlimpse({ tic: '냥' }, null)).toBeNull()
    expect(finishGlimpse({ tic: '냥' }, 'honey')).toBeNull()
  })
})
