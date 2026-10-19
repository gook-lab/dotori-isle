import { describe, expect, it } from 'vitest'
import { byWater, normDist } from './island'
import { blockedByScenery, BUSHES, bushFind, canWalk, FILL_CELL, SCENERY, slideStep } from './scenery'
import { reservedByHomes, VILLAGERS } from './villagers'
import { ROCKS, SHOP, SPAWN, TREES } from './world'
import { inStepBlockAt, STEP_PAD } from './tiers'

describe('덤불 · 그루터기 · 통나무 · 버섯', () => {
  it('종류마다 정한 수만큼 놓이고, 물가·주민 마당·시작 자리를 피한다', () => {
    const count = (k: string) => SCENERY.filter((s) => s.kind === k && !s.id.includes('fill')).length
    expect(count('bush')).toBe(10)
    expect(count('stump')).toBe(6)
    expect(count('log')).toBe(4)
    expect(count('mushroom')).toBe(12)
    // 빈 땅 채우기에서 덤불은 10% 가 목표다. 칸이 40개 안팎이라 표본이 흔들려서 20% 를 넘지 않는지만 본다
    const fills = SCENERY.filter((s) => s.id.includes('fill'))
    const fillBush = fills.filter((s) => s.kind === 'bush').length
    expect(fillBush).toBeLessThanOrEqual(fills.length * 0.2)
    for (const s of SCENERY) {
      expect(byWater(s.x, s.z)).toBe(false)
      expect(reservedByHomes(s.x, s.z)).toBe(false)
    }
    expect(canWalk(SPAWN.x, SPAWN.z)).toBe(true)
  })

  it('덤불은 막고 버섯은 밟고 지나간다', () => {
    const bush = BUSHES[0]
    expect(blockedByScenery(bush.x, bush.z)).toBe(true)
    expect(canWalk(bush.x, bush.z)).toBe(false)
    const mush = SCENERY.find((s) => s.kind === 'mushroom')!
    expect(blockedByScenery(mush.x, mush.z)).toBe(false)
  })

  it('주민 산책 길은 막지 않는다', () => {
    for (const v of VILLAGERS) expect(blockedByScenery(v.home.x, v.home.z, 2)).toBe(false)
  })

  it('덤불에서 나오는 것은 날짜로 정해지고, 하루 몇 개 덤불에선 무언가 나온다', () => {
    expect(bushFind('bush-0', '2026-10-18')).toBe(bushFind('bush-0', '2026-10-18'))
    const found = BUSHES.map((b) => bushFind(b.id, '2026-10-18')).filter(Boolean)
    expect(found.length).toBeGreaterThan(3)
    expect(found.every((f) => f === 'flower-seed' || f === 'acorn-pouch' || f === 'mushroom' || f === 'petal')).toBe(true)
  })

  it('잔디가 넉넉한 칸은 어디든 볼거리가 하나 이상 있다(빈 땅이 길게 이어지지 않게)', () => {
    const things = [...TREES, ...ROCKS, ...SCENERY, ...VILLAGERS.map((v) => v.house), ...VILLAGERS.map((v) => v.home), SHOP, SPAWN]
    const empty: string[] = []
    for (let cx = -56; cx < 56; cx += FILL_CELL) {
      for (let cz = -56; cz < 56; cz += FILL_CELL) {
        let land = 0
        for (let x = cx; x < cx + FILL_CELL; x++) for (let z = cz; z < cz + FILL_CELL; z++) if (normDist(x, z) < 0.72 && !byWater(x, z)) land++
        if (land < 40) continue
        // 계단 블록 자리 근처 칸은 그 자리 물건을 일부러 뺐으므로 빈 칸 검사에서 뺀다
        if (inStepBlockAt(cx + FILL_CELL / 2, cz + FILL_CELL / 2, STEP_PAD + FILL_CELL)) continue
        if (!things.some((t) => t.x >= cx && t.x < cx + FILL_CELL && t.z >= cz && t.z < cz + FILL_CELL)) empty.push(`${cx},${cz}`)
      }
    }
    expect(empty).toEqual([])
  })
})

describe('막힌 자리에서 미끄러지기', () => {
  // 반지름 1 짜리 둥근 물건이 원점에 있다고 두고, 그 바깥만 설 수 있게 한다.
  const free = (x: number, z: number) => Math.hypot(x, z) >= 1

  it('정면이 막히면 방향을 틀어 옆으로 비껴 간다', () => {
    // 정면 한 걸음은 막히고, 비껴 가는 방향이 열려 있다.
    const step = slideStep(0, -1.05, 0, 0.1, free)
    expect(step).not.toBeNull()
    const [mx, mz] = step!
    expect(Math.abs(mx)).toBeGreaterThan(0)
    expect(Math.hypot(mx, mz)).toBeCloseTo(0.1, 5)
    expect(free(mx, -1.05 + mz)).toBe(true)
  })

  it('길이 열려 있으면 요청한 이동을 그대로 준다', () => {
    expect(slideStep(5, 0, 0.1, 0, free)).toEqual([0.1, 0])
  })

  it('사방이 막히면 null', () => {
    expect(slideStep(0, 0, 0.1, 0, () => false)).toBeNull()
  })
})
