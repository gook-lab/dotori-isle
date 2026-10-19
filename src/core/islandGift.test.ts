import { describe, expect, it } from 'vitest'
import { DISCOVERIES, DISCOVERY_REACH } from './discoveries'
import { cleanIslandGift, currentGift, donateGift, fundedAmount, fundRoom, GIFT_PROJECTS, GIFT_PROJECTS_2, giftBuiltText, giftLine, giftSite, giftSiteOk, morningGift, NEW_ISLAND_GIFT, receptionLabel, type IslandGiftState, warmFundOn, warmFundStart } from './islandGift'
import { SHOP, SHOP_MAX } from './world'

const D1 = '2026-03-10'
const D2 = '2026-03-11'

describe('섬 가꾸기 — 값과 순서', () => {
  it('네 시설을 값 순서대로 든다(3000, 4000, 5000, 6000)', () => {
    expect(GIFT_PROJECTS.map((p) => p.cost)).toEqual([3000, 4000, 5000, 6000])
    expect(GIFT_PROJECTS.map((p) => p.name)).toEqual(['꽃길 벤치', '광장 물분수', '조약돌 징검다리', '등대 불빛'])
  })
})

describe('섬 가꾸기 — 저장 검사', () => {
  it('없거나 틀린 값은 처음 상태로 본다', () => {
    expect(cleanIslandGift(undefined)).toEqual(NEW_ISLAND_GIFT)
    expect(cleanIslandGift({ built: 9, fund: 0, ready: null })).toEqual(NEW_ISLAND_GIFT)
    expect(cleanIslandGift({ built: 0, fund: 3001, ready: null })).toEqual(NEW_ISLAND_GIFT)
    expect(cleanIslandGift({ built: 0, fund: 10, ready: 'not-a-day' })).toEqual(NEW_ISLAND_GIFT)
  })

  it('맞는 값은 그대로 읽는다', () => {
    expect(cleanIslandGift({ built: 1, fund: 2000, ready: null })).toEqual({ built: 1, fund: 2000, ready: null })
  })
})

describe('섬 가꾸기 — 기부', () => {
  it('나눠 내면 값이 쌓이고, 값이 차면 다음 날을 완성일로 적는다', () => {
    const a = donateGift(NEW_ISLAND_GIFT, 5000, 1000, D1)
    expect(a).toMatchObject({ ok: true, miles: 4000, done: false })
    if (!a.ok) throw new Error('기부 실패')
    const b = donateGift(a.state, a.miles, 1500, D1)
    expect(b).toMatchObject({ ok: true, miles: 2500, done: false, state: { fund: 2500, ready: null } })
    if (!b.ok) throw new Error('기부 실패')
    const c = donateGift(b.state, b.miles, 500, D1)
    expect(c).toMatchObject({ ok: true, miles: 2000, done: true, state: { fund: 3000, ready: D2 } })
  })

  it('값이 3000인 벤치는 3000을 넘겨 낼 수 없고, 마일이 모자라면 실패한다', () => {
    expect(donateGift(NEW_ISLAND_GIFT, 9999, 3001, D1)).toMatchObject({ ok: false, reason: expect.stringContaining('3,000') })
    expect(donateGift(NEW_ISLAND_GIFT, 100, 200, D1)).toEqual({ ok: false, reason: '마일이 모자라요' })
    expect(donateGift(NEW_ISLAND_GIFT, 100, 0, D1)).toMatchObject({ ok: false })
  })

  it('값이 차면 다음 날 아침에 완성되고, 그 전에는 더 낼 수 없다', () => {
    const full = donateGift(NEW_ISLAND_GIFT, 3000, 3000, D1)
    if (!full.ok) throw new Error('기부 실패')
    expect(full.state.ready).toBe(D2)
    expect(donateGift(full.state, 3000, 1, D1)).toEqual({ ok: false, reason: '이 시설은 내일 아침에 완성돼요' })
    expect(morningGift(full.state, D1).built).toBeNull()
    const built = morningGift(full.state, D2)
    expect(built.built?.id).toBe('flower-bench')
    expect(built.state).toEqual({ built: 1, fund: 0, ready: null })
  })

  it('네 시설을 다 들이면 더 기부할 곳이 없다', () => {
    const done: IslandGiftState = { built: GIFT_PROJECTS.length, fund: 0, ready: null }
    expect(donateGift(done, 9999, 1, D1)).toEqual({ ok: false, reason: '섬 가꾸기가 모두 끝났어요' })
    expect(giftLine(done)).toContain('모두 마쳤어요')
  })
})

describe('섬 가꾸기 — 진행 한 줄', () => {
  it('지금 모은 양과 다음 시설을 한 줄로 보여 준다', () => {
    expect(giftLine({ built: 0, fund: 1200, ready: null })).toBe('🏗 꽃길 벤치 1,200/3,000마일 · 다음 광장 물분수')
  })
})

describe('섬 가꾸기 — 자리', () => {
  it('네 자리는 모두 평지에 서고 걸을 수 있으며 물에서 떨어져 있다', () => {
    for (const p of GIFT_PROJECTS) {
      expect(giftSite(p.anchor), p.id).toEqual(p.anchor)
      expect(giftSiteOk(p.anchor.x, p.anchor.z), p.id).toBe(true)
    }
  })

  it('자리끼리 서로 4 이상 떨어져 있다', () => {
    for (let i = 0; i < GIFT_PROJECTS.length; i++)
      for (let j = i + 1; j < GIFT_PROJECTS.length; j++) {
        const a = GIFT_PROJECTS[i].anchor
        const b = GIFT_PROJECTS[j].anchor
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${GIFT_PROJECTS[i].id}-${GIFT_PROJECTS[j].id}`).toBeGreaterThan(4)
      }
  })

  it('발견거리(조약돌·우물 등)와 상점 건물에서 떨어져 있다', () => {
    for (const p of GIFT_PROJECTS) {
      for (const d of DISCOVERIES) expect(Math.hypot(p.anchor.x - d.x, p.anchor.z - d.z), `${p.id}-${d.id}`).toBeGreaterThan(DISCOVERY_REACH + 1.5)
      const inShop = Math.abs(p.anchor.x - SHOP.x) < SHOP_MAX.w / 2 + 1 && Math.abs(p.anchor.z - SHOP.z) < SHOP_MAX.d / 2 + 1
      expect(inShop, p.id).toBe(false)
    }
  })
})

describe('섬 가꾸기 — 따뜻한 모금(12월 첫째 주 1.2배)', () => {
  const WARM = '2026-12-02'
  it('12월 1~7일만 주간이고, 첫날에만 편지 날이다', () => {
    expect(warmFundOn('2026-12-01')).toBe(true)
    expect(warmFundOn('2026-12-07')).toBe(true)
    expect(warmFundOn('2026-12-08')).toBe(false)
    expect(warmFundOn('2026-11-30')).toBe(false)
    expect(warmFundOn('2027-12-03')).toBe(true)
    expect(warmFundStart('2026-12-01')).toBe(true)
    expect(warmFundStart('2026-12-02')).toBe(false)
  })

  it('적립은 1.2배를 내림해서 정수로 쌓고, 주간 밖에서는 그대로다', () => {
    expect(fundedAmount(100, WARM)).toBe(120)
    expect(fundedAmount(5, WARM)).toBe(6)
    expect(fundedAmount(3, WARM)).toBe(3)
    expect(fundedAmount(7, WARM)).toBe(8)
    expect(fundedAmount(100, '2026-12-08')).toBe(100)
  })

  it('한 번에 낼 수 있는 한도는 남은 값을 넘지 않는 가장 큰 마일이다', () => {
    for (let left = 1; left <= 300; left++) {
      const room = fundRoom(left, WARM)
      expect(fundedAmount(room, WARM)).toBeLessThanOrEqual(left)
      expect(fundedAmount(room + 1, WARM)).toBeGreaterThan(left)
    }
    expect(fundRoom(3000, WARM)).toBe(2500)
    expect(fundRoom(3000, '2026-03-10')).toBe(3000)
  })

  it('기부하면 표시한 1.2배만큼 쌓이고, 한도를 넘는 기부는 막힌다', () => {
    const a = donateGift(NEW_ISLAND_GIFT, 5000, 100, WARM)
    expect(a).toMatchObject({ ok: true, miles: 4900, credited: 120, state: { fund: 120 } })
    const full = donateGift(NEW_ISLAND_GIFT, 9999, 2501, WARM)
    expect(full).toEqual({ ok: false, reason: '이 시설에는 2,500마일까지만 기부할 수 있어요' })
    const max = donateGift(NEW_ISLAND_GIFT, 9999, 2500, WARM)
    expect(max).toMatchObject({ ok: true, credited: 3000, done: true })
  })

  it('접수대 이름은 주간이고 기부할 시설이 있을 때만 바뀐다', () => {
    expect(receptionLabel(NEW_ISLAND_GIFT, WARM)).toBe('접수대 · 따뜻한 모금 1.2배 기부')
    expect(receptionLabel(NEW_ISLAND_GIFT, '2026-03-10')).toBe('접수대에 말 걸기')
    const done = { built: GIFT_PROJECTS.length, fund: 0, ready: null }
    const acornDone = { built: GIFT_PROJECTS_2.length, fund: 0, ready: null }
    expect(receptionLabel(done, WARM, acornDone)).toBe('접수대에 말 걸기')
  })
})

describe('섬 가꾸기 2차 — 도토리 값과 순서', () => {
  it('네 시설을 도토리 값 순서대로 든다(10000, 15000, 20000, 30000)', () => {
    expect(GIFT_PROJECTS_2.map((p) => p.cost)).toEqual([10000, 15000, 20000, 30000])
    expect(new Set(GIFT_PROJECTS_2.map((p) => p.id)).size).toBe(GIFT_PROJECTS_2.length)
  })

  it('1차 자리와 2차 자리는 서로 4 이상 떨어져 있고, 2차 자리도 평지에 선다', () => {
    const all = [...GIFT_PROJECTS, ...GIFT_PROJECTS_2]
    for (const p of GIFT_PROJECTS_2) expect(giftSite(p.anchor), p.id).not.toBeNull()
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i].anchor
        const b = all[j].anchor
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${all[i].id}-${all[j].id}`).toBeGreaterThan(4)
      }
  })

  it('2차 자리 중심은 계단 자리를 피한다', () => {
    for (const p of GIFT_PROJECTS_2) expect(giftSiteOk(p.anchor.x, p.anchor.z), p.id).toBe(true)
  })
})

describe('섬 가꾸기 2차 — 기부와 완성', () => {
  it('1차를 다 들이면 2차 접수 이름이 보이고, 1차가 남아 있으면 보이지 않는다', () => {
    const acorn: IslandGiftState = { built: 0, fund: 0, ready: null }
    expect(currentGift(acorn, GIFT_PROJECTS_2)?.id).toBe('lighthouse-lamps')
    expect(receptionLabel({ built: GIFT_PROJECTS.length, fund: 0, ready: null }, D1, acorn)).toBe('접수대 · 섬 가꾸기 2차 (도토리)')
    expect(receptionLabel({ built: 1, fund: 0, ready: null }, D1, acorn)).toBe('접수대에 말 걸기')
  })

  it('도토리는 1.2배 없이 그대로 쌓이고, 값이 차면 다음 날 완성된다', () => {
    const acorn: IslandGiftState = { built: 0, fund: 0, ready: null }
    const r = donateGift(acorn, 20000, 10000, '2026-12-03', GIFT_PROJECTS_2, false)
    expect(r.ok && r.credited).toBe(10000)
    if (!r.ok) return
    expect(r.done).toBe(true)
    expect(r.state.ready).toBe('2026-12-04')
    expect(r.miles).toBe(10000)
    expect(donateGift(r.state, 9999, 1, '2026-12-03', GIFT_PROJECTS_2, false)).toEqual({ ok: false, reason: '이 시설은 내일 아침에 완성돼요' })
  })

  it('완성 아침에 2차 시설 하나를 들이고 다음 차례로 넘긴다', () => {
    const ready: IslandGiftState = { built: 0, fund: 10000, ready: '2026-04-02' }
    const m = morningGift(ready, '2026-04-02', GIFT_PROJECTS_2)
    expect(m.built?.id).toBe('lighthouse-lamps')
    expect(m.state).toEqual({ built: 1, fund: 0, ready: null })
  })

  it('2차 저장 검사는 2차 값으로 본다', () => {
    expect(cleanIslandGift({ built: 1, fund: 15001, ready: null }, GIFT_PROJECTS_2)).toEqual(NEW_ISLAND_GIFT)
    expect(cleanIslandGift({ built: 1, fund: 9000, ready: null }, GIFT_PROJECTS_2)).toEqual({ built: 1, fund: 9000, ready: null })
  })

  it('진행 한 줄은 도토리 단위로 보여 준다', () => {
    expect(giftLine({ built: 0, fund: 4000, ready: null }, GIFT_PROJECTS_2, (n) => `${n.toLocaleString()}개`)).toContain('4,000/10,000개')
  })
})

describe('섬 가꾸기 — 완성 알림 문장', () => {
  it('1차·2차 시설 이름마다 받침에 맞는 조사를 쓴다', () => {
    expect(giftBuiltText('꽃길 벤치')).toBe('🏗 꽃길 벤치가 완성됐어요! 섬에 나타났어요')
    expect(giftBuiltText('등대 산책로 가로등')).toBe('🏗 등대 산책로 가로등이 완성됐어요! 섬에 나타났어요')
    expect(giftBuiltText('해변 파라솔')).toBe('🏗 해변 파라솔이 완성됐어요! 섬에 나타났어요')
    expect(giftBuiltText('서쪽 언덕 전망 정자')).toBe('🏗 서쪽 언덕 전망 정자가 완성됐어요! 섬에 나타났어요')
    expect(giftBuiltText('광장 시계탑')).toBe('🏗 광장 시계탑이 완성됐어요! 섬에 나타났어요')
  })

  it('2차 시설 네 가지의 완성 알림이 모두 자연스러운 조사를 쓴다', () => {
    expect(GIFT_PROJECTS_2.map((p) => giftBuiltText(p.name))).toEqual([
      '🏗 등대 산책로 가로등이 완성됐어요! 섬에 나타났어요',
      '🏗 해변 파라솔이 완성됐어요! 섬에 나타났어요',
      '🏗 서쪽 언덕 전망 정자가 완성됐어요! 섬에 나타났어요',
      '🏗 광장 시계탑이 완성됐어요! 섬에 나타났어요',
    ])
  })
})
