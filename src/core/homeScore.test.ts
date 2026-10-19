import { describe, expect, it } from 'vitest'
import { homeCells } from './home'
import { furnitureSources } from './furnitureCatalog'
import { ITEMS } from './items'
import { gardenPoints, HOME_MAX, homeScoreLetter, homeTips, HOME_SETS, HOME_TIERS, LIMITED_ITEM, nextTier, rewardText, scoreGainOf, scoreHome, scoreSummaryLine, starGiftFor, starsOf, STAR_GIFTS, strengthLine, tierOf, type HomeFurnitureInput } from './homeScore'

const STAGE = 0 as const
const cells = homeCells(STAGE).map((c) => `${c.x},${c.z}`)
const inside = (x: number, z: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => cells.includes(`${x + dx},${z + dz}`))
const wallCell = homeCells(STAGE).find((c) => !inside(c.x, c.z))!
const innerCell = homeCells(STAGE).find((c) => inside(c.x, c.z))!

/** 칸을 하나씩 채울 때 쓰는 가구 목록 */
function pieces(ids: string[], variant?: string, off?: boolean): HomeFurnitureInput[] {
  return ids.map((itemId, i) => {
    const c = homeCells(STAGE)[i % homeCells(STAGE).length]
    return { itemId, x: c.x, z: c.z, variant, off }
  })
}

describe('집 꾸미기 점수', () => {
  it('빈 방은 0점이다', () => {
    const s = scoreHome({ stage: STAGE, furniture: [], framed: false })
    expect(s.total).toBe(0)
    expect(tierOf(s.total)).toBeNull()
    expect(nextTier(s.total)?.min).toBe(20)
  })

  it('부분 점수의 최대치를 합하면 100점이다', () => {
    expect(Object.values(HOME_MAX).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('가구 수는 열 개에서 최대가 된다', () => {
    const ids = Array.from({ length: 12 }, () => 'chair')
    expect(scoreHome({ stage: STAGE, furniture: pieces(ids), framed: false }).parts.count).toBe(HOME_MAX.count)
  })

  it('종류 수는 다섯 종에서 최대가 된다', () => {
    const s = scoreHome({ stage: STAGE, furniture: pieces(['chair', 'table', 'flowerpot', 'stove', 'telescope']), framed: false })
    expect(s.kinds).toBe(5)
    expect(s.parts.variety).toBe(HOME_MAX.variety)
  })

  it('벽쪽과 가운데에 모두 놓으면 배치 점수를 받는다', () => {
    const only = scoreHome({ stage: STAGE, furniture: [{ itemId: 'chair', x: innerCell.x, z: innerCell.z }], framed: false })
    expect(only.wall).toBe(0)
    expect(only.parts.placement).toBe(5)
    const both = scoreHome({
      stage: STAGE,
      furniture: [
        { itemId: 'chair', x: innerCell.x, z: innerCell.z },
        { itemId: 'table', x: wallCell.x, z: wallCell.z },
      ],
      framed: false,
    })
    expect(both.wall).toBe(1)
    expect(both.parts.placement).toBe(10)
  })

  it('세트 하나를 다 놓으면 8점, 같은 색 셋이면 4점을 더한다', () => {
    const tea = HOME_SETS.find((s) => s.id === 'tea')!
    const one = scoreHome({ stage: STAGE, furniture: pieces([...tea.items]), framed: false })
    expect(one.doneSets).toEqual(['tea'])
    expect(one.parts.sets).toBe(8)
    const colored = scoreHome({ stage: STAGE, furniture: pieces([...tea.items, 'chair', 'chair'], 'mint'), framed: false })
    expect(colored.sameColor).toBe(true)
    expect(colored.parts.sets).toBe(8 + 4)
  })

  it('불빛 가구는 켜져 있을 때만 점수를 받는다', () => {
    expect(scoreHome({ stage: STAGE, furniture: pieces(['lamp'], undefined, true), framed: false }).parts.light).toBe(0)
    expect(scoreHome({ stage: STAGE, furniture: pieces(['lamp']), framed: false }).parts.light).toBe(HOME_MAX.light)
  })

  it('사진 액자가 걸려 있으면 10점이다', () => {
    expect(scoreHome({ stage: STAGE, furniture: [], framed: true }).parts.frame).toBe(HOME_MAX.frame)
  })

  it('구간은 20·40·60·80·100 이고, 최고 구간에만 한정 가구가 붙는다', () => {
    expect(HOME_TIERS.map((t) => t.min)).toEqual([20, 40, 60, 80, 100])
    expect(tierOf(19)).toBeNull()
    expect(tierOf(20)?.min).toBe(20)
    expect(tierOf(100)?.reward.item).toBe(LIMITED_ITEM)
    expect(HOME_TIERS.filter((t) => t.reward.item)).toHaveLength(1)
    expect(nextTier(100)).toBeNull()
  })

  it('팁은 두 가지를 넘지 않는다', () => {
    const s = scoreHome({ stage: STAGE, furniture: pieces(['chair']), framed: false })
    expect(homeTips(s).length).toBe(2)
  })

  it('가득 찬 방은 팁이 없다', () => {
    const ids = [...Array.from({ length: 12 }, () => 'table'), ...HOME_SETS.flatMap((set) => [...set.items]), 'paper-lantern']
    const furniture = pieces(ids, 'mint')
    const lit = furniture.map((f, i) => (i === 0 ? { ...f, itemId: 'lamp' } : f))
    const s = scoreHome({ stage: STAGE, furniture: lit, framed: true, garden: { fenceLinks: 6, tiles: 12 } })
    expect(homeTips(s)).toHaveLength(0)
  })

  it('정원 점수는 울타리 이음 최대 6점과 바닥 세 칸마다 1점(최대 4점), 합쳐서 10점이 최대다', () => {
    expect(gardenPoints(undefined)).toBe(0)
    expect(gardenPoints({ fenceLinks: 2, tiles: 0 })).toBe(2)
    expect(gardenPoints({ fenceLinks: 0, tiles: 6 })).toBe(2)
    expect(gardenPoints({ fenceLinks: 9, tiles: 30 })).toBe(HOME_MAX.garden)
    expect(Object.values(HOME_MAX).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('편지는 점수와 보상을 적고, 최고 구간에만 한정 가구를 선물로 붙인다', () => {
    const low = homeScoreLetter(scoreHome({ stage: STAGE, furniture: [], framed: false }), '2026-03-16')
    expect(low.id).toBe('home-score-2026-03-16')
    expect(low.text).toContain('0점')
    expect(low.gift).toBeNull()
    const top = homeScoreLetter({ ...scoreHome({ stage: STAGE, furniture: [], framed: false }), total: 100 }, '2026-03-16', [1, 2, 3, 4, 5])
    expect(top.gift).toBe(LIMITED_ITEM)
    expect(top.text).toContain('100마일')
    expect(rewardText({ acorns: 60 })).toBe('도토리 60개')
  })
})

describe('집 등급 별과 기념 가구', () => {
  it('점수 구간이 곧 별 번호다. 20점 아래는 별이 없다', () => {
    expect(starsOf(0)).toBe(0)
    expect(starsOf(19)).toBe(0)
    expect(starsOf(20)).toBe(1)
    expect(starsOf(60)).toBe(3)
    expect(starsOf(100)).toBe(5)
  })

  it('처음 오른 등급에만 기념 가구를 준다', () => {
    expect(starGiftFor(1, [])).toBe(STAR_GIFTS[1])
    expect(starGiftFor(1, [1])).toBeNull()
    expect(starGiftFor(3, [1])).toBe(STAR_GIFTS[3])
    expect(starGiftFor(0, [])).toBeNull()
    for (let n = 1; n <= 5; n++) expect(STAR_GIFTS[n]).toBeTruthy()
  })

  it('잘한 점은 최대치에 가장 가깝게 채운 부분이다', () => {
    const many = scoreHome({ stage: STAGE, furniture: Array.from({ length: 8 }, (_, i) => ({ itemId: 'chair', x: i, z: 0 })), framed: false })
    expect(strengthLine(many)).toBe('가구가 많아 집이 가득 차 보여요')
    expect(strengthLine(scoreHome({ stage: STAGE, furniture: [], framed: false }))).toContain('아직')
  })

  it('편지는 점수·별·잘한 점·다음 등급·팁을 적고, 처음 오른 등급이면 기념 가구를 선물로 붙인다', () => {
    const score = scoreHome({ stage: STAGE, furniture: Array.from({ length: 8 }, (_, i) => ({ itemId: 'chair', x: i, z: 0 })), framed: false })
    const first = homeScoreLetter(score, '2026-03-16', [])
    expect(first.text).toContain(`${score.total}점`)
    expect(first.text).toContain('잘한 점')
    expect(first.text).toContain('팁')
    expect(first.gift).toBe(score.total >= 20 ? starGiftFor(starsOf(score.total), []) : null)
    const again = homeScoreLetter(score, '2026-03-23', [starsOf(score.total)])
    expect(again.gift).toBeNull()
  })
})

describe('별 등급 기념품 가구', () => {
  it('다섯 등급 모두 가구이고, 도감 출처에 등급 번호가 붙는다', () => {
    for (let n = 1; n <= 5; n++) {
      const id = STAR_GIFTS[n]
      expect(ITEMS[id]?.kind, id).toBe('furniture')
      expect(ITEMS[id]?.buy, id).toBeUndefined()
      expect(furnitureSources(id), id).toContain(`섬 꾸미기 위원회 별 ${n}`)
    }
  })
})

describe('새 방 가구도 점수에 든다', () => {
  // 방마다 첫 칸(가구 칸 안의 자리)에 놓는다
  const at = (floor: 0 | 1 | 2 | 3, itemId: string): HomeFurnitureInput => {
    const c = homeCells(5, floor)[0]
    return { itemId, x: c.x, z: c.z, floor }
  }

  it('다락·옆방·지하실 가구를 가구 수와 종류에 같이 센다', () => {
    const score = scoreHome({ stage: 5, furniture: [at(1, 'chair'), at(2, 'bookshelf'), at(3, 'workbench')], framed: false })
    expect(score.count).toBe(3)
    expect(score.kinds).toBe(3)
    expect(score.wall + score.interior).toBe(3)
  })

  it('새 방에 흩어 놓은 세트 가구도 세트를 완성한다', () => {
    // 티타임 세트: 탁자는 본채, 의자는 다락, 꽃병은 옆방
    const score = scoreHome({ stage: 5, furniture: [at(0, 'table'), at(1, 'chair'), at(2, 'flowerpot')], framed: false })
    expect(score.doneSets).toContain('tea')
  })

  it('지하 작업실 세트는 지하실 가구만으로도 채울 수 있다', () => {
    const furniture = ['workbench', 'tool-rack', 'storage-shelf', 'boiler'].map((id) => at(3, id))
    const score = scoreHome({ stage: 5, furniture, framed: false })
    expect(score.doneSets).toContain('workshop')
  })

  it('점수 줄은 지금 점수와 다음 별까지 남은 점수를 함께 보여 준다', () => {
    expect(scoreSummaryLine(0)).toBe('집 꾸미기 0점 · 다음 별(작은 보금자리)까지 20점 남았어요')
    expect(scoreSummaryLine(45)).toBe('집 꾸미기 45점 · 별 2개 · 다음 별(센스 있는 방)까지 15점 남았어요')
    expect(scoreSummaryLine(100)).toBe('집 꾸미기 100점 · 별 5개 · 최고 등급이에요')
  })
})

describe('놓기 전 점수 미리보기', () => {
  it('같은 가구를 더 놓으면 점수 차이만큼 오르고, 입력이 같으면 0이다', () => {
    const base = { stage: 2 as const, furniture: [{ itemId: 'table', x: 0, z: 0 }], framed: false }
    const gain = scoreGainOf(base, { itemId: 'lamp', x: 1, z: 1 })
    expect(gain).toBeGreaterThanOrEqual(0)
    expect(scoreGainOf(base, { itemId: 'table', x: 0, z: 0 })).toBe(scoreGainOf(base, { itemId: 'table', x: 0, z: 0 }))
    expect(scoreHome({ ...base, furniture: [...base.furniture, { itemId: 'lamp', x: 1, z: 1 }] }).total - scoreHome(base).total).toBe(gain)
  })

  it('한 가지 가구를 같은 종류로 늘리면 점수가 오르거나 같다(놓을수록 떨어지지 않는다)', () => {
    const base = { stage: 2 as const, furniture: [{ itemId: 'table', x: 0, z: 0 }], framed: false }
    expect(scoreGainOf(base, { itemId: 'lamp', x: 1, z: 1 })).toBeGreaterThanOrEqual(0)
  })
})
