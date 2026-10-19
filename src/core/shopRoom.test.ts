import { describe, expect, it } from 'vitest'
import { CLERKS, clerkLine, clerkPool, SHOP_BELL_TEXT, SHOP_NAME, songiMood } from './shopRoom'
import { roomWalkable, roomCenter, SHOP_ROOM, SHOP_OBJECTS } from './interior'
import { isMarketDay } from './market'
import { josa } from './items'
import { limitedFor, limitedName } from './weeklyLimited'
import { weatherFor } from './weather'

const ctx = (day: string, tier = 0, songi: 'high' | 'low' | 'normal' | 'none' = 'normal') => ({ day, tier, songi })

describe('도토리 상점 점원', () => {
  it('점원은 두 마리이고 기본 대사는 각각 열 줄 이상이다', () => {
    expect(CLERKS).toHaveLength(2)
    for (const c of CLERKS) expect(c.lines.length).toBeGreaterThanOrEqual(10)
  })

  it('같은 날·같은 조건이면 같은 줄이 나오고, 날이 바뀌면 줄이 바뀐다', () => {
    expect(clerkLine('garam', ctx('2026-10-19'))).toBe(clerkLine('garam', ctx('2026-10-19')))
    const lines = new Set([0, 1, 2, 3, 4].map((d) => clerkLine('narl', ctx(`2026-10-${10 + d}`))))
    expect(lines.size).toBeGreaterThan(1)
  })

  it('상점 단계·날씨·장날·송이 시세에 맞는 말이 풀에 들어간다', () => {
    const tier3 = clerkPool('garam', ctx('2026-10-19', 3))
    expect(tier3.some((l) => l.includes('백화점'))).toBe(true)
    expect(clerkPool('garam', ctx('2026-10-19', 0)).some((l) => l.includes('노점'))).toBe(true)

    const rainDay = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].find((d) => weatherFor(d) === 'rain')
    if (rainDay) expect(clerkPool('narl', ctx(rainDay)).some((l) => l.includes('비'))).toBe(true)

    const market = ['2026-10-24', '2026-10-31'].find((d) => isMarketDay(d))!
    expect(clerkPool('narl', ctx(market)).some((l) => l.includes('장날'))).toBe(true)

    expect(clerkPool('narl', ctx('2026-10-19', 0, 'high')).some((l) => l.includes('올랐어요'))).toBe(true)
    expect(clerkPool('narl', ctx('2026-10-19', 0, 'normal')).some((l) => l.includes('올랐어요'))).toBe(false)
  })

  it('송이 시세 상태는 가격에 따라 높음·낮음·보통·닫힘으로 나뉜다', () => {
    expect(['high', 'low', 'normal', 'none']).toContain(songiMood('2026-10-19', 9))
    expect(songiMood('2026-10-19', 2)).toBe('none')
  })

  it('들어갈 때 알리는 문구에 상점 이름이 들어간다', () => {
    expect(SHOP_BELL_TEXT).toContain(SHOP_NAME)
  })
})

describe('도토리 상점 방 안 자리', () => {
  it('계산대와 ATM 은 걸을 수 없고, 입구 앞은 걸을 수 있다', () => {
    const c = roomCenter(SHOP_ROOM)
    expect(roomWalkable(c.x + SHOP_OBJECTS.atm.x, c.z + SHOP_OBJECTS.atm.z)).toBe(false)
    expect(roomWalkable(c.x + SHOP_OBJECTS.counter[1].x, c.z + SHOP_OBJECTS.counter[1].z)).toBe(false)
    expect(roomWalkable(c.x, c.z + 2.9)).toBe(true)
  })
})

describe('도토리 상점 점원 — 주간 한정 소개', () => {
  const MON_DAY = '2026-10-19'
  const pick = limitedFor(MON_DAY)!
  const name = limitedName(pick.itemId, pick.variant)

  it('한정 물건이 있으면 두 점원 풀에 그 물건을 소개하는 줄이 들어간다', () => {
    const ctx = { day: MON_DAY, tier: 2, songi: 'normal' as const, weekly: name }
    expect(clerkPool('garam', ctx).some((l) => l.includes(`${josa(name, '이', '가')} 나왔어요`))).toBe(true)
    expect(clerkPool('narl', ctx).some((l) => l.includes(`${josa(name, '은', '는')} 한 주에 한 번`))).toBe(true)
  })

  it('한정 물건이 없으면 소개 줄도 없다', () => {
    const pool = [...clerkPool('garam', { day: MON_DAY, tier: 2, songi: 'normal' }), ...clerkPool('narl', { day: MON_DAY, tier: 2, songi: 'normal' })]
    expect(pool.some((l) => l.includes('주간 한정'))).toBe(false)
  })
})
