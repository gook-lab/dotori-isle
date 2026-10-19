import { describe, expect, it } from 'vitest'
import '../game/store'
import { HALL_R, HALL_SITE } from './hall'
import { HOME_SITE, pickHomePlot } from './home'
import { MARKET_SITE } from './market'
import { MUSEUM_GAP, MUSEUM_R, MUSEUM_SITE } from './museum'
import { HOUSE_R } from './villagers'
import { blockedByFixedProps, blockedByProps, live, SPAWN } from './world'
import { isWalkable } from './island'
import { flatWithin } from './tiers'

/** 가판대 반지름(market.ts 의 MARKET_HALF 와 같은 값) */
const MARKET_R = 2

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

describe('집터 고르기', () => {
  it('store 를 import 한 뒤 다시 골라도 HOME_SITE 와 같은 자리다', () => {
    expect(HOME_SITE).not.toBeNull()
    expect(pickHomePlot()).toEqual({ x: HOME_SITE!.x, z: HOME_SITE!.z, rot: HOME_SITE!.rot })
  })

  it('live 로 등록된 집 자리가 있어도 같은 자리를 고른다', () => {
    const first = pickHomePlot()
    const prev = live.home
    live.home = first ? { x: first.x, z: first.z, r: 1.1 } : null
    try {
      expect(pickHomePlot()).toEqual(first)
    } finally {
      live.home = prev
    }
  })

  it('고정 소품 판정은 live 로 등록된 집 자리를 뺀다', () => {
    const x = SPAWN.x + 0.5
    const z = SPAWN.z - 4
    const prev = live.home
    live.home = { x, z, r: 1.1 }
    try {
      expect(blockedByProps(x, z, 0)).toBe(true)
      expect(blockedByFixedProps(x, z, 0)).toBe(false)
    } finally {
      live.home = prev
    }
  })
})

describe('기본 섬의 네 자리 간격', () => {
  it('집·마을회관·가판대·전시관이 서로 간격 이상 떨어져 있다', () => {
    expect(HOME_SITE && HALL_SITE && MARKET_SITE && MUSEUM_SITE).toBeTruthy()
    const home = HOME_SITE!
    const hall = HALL_SITE!
    const market = MARKET_SITE!
    const museum = MUSEUM_SITE!
    // 집 자리: 집 반지름과 가판대 반지름, 여유 0.8 (home.ts·market.ts)
    expect(dist(home, market)).toBeGreaterThan(HOUSE_R + MARKET_R + 0.8)
    // 마을회관은 집 9칸 밖(loose 자리는 6칸) 과 가판대·전시관 간격 (hall.ts)
    expect(dist(home, hall)).toBeGreaterThan(6)
    expect(dist(hall, market)).toBeGreaterThan(MARKET_R + MUSEUM_GAP + HALL_R)
    expect(dist(hall, museum)).toBeGreaterThan(MUSEUM_R + MUSEUM_GAP + HALL_R)
    // 전시관은 집 9칸 밖, 가판대와 간격 (museum.ts)
    expect(dist(home, museum)).toBeGreaterThan(9)
    expect(dist(market, museum)).toBeGreaterThan(MARKET_R + MUSEUM_GAP + MUSEUM_R)
  })
})

describe('집 현관', () => {
  it('현관 자리는 걸을 수 있는 평평한 땅이고 소품에 막히지 않는다', () => {
    const door = HOME_SITE!.door
    expect(isWalkable(door.x, door.z)).toBe(true)
    expect(flatWithin(door.x, door.z, 0.5)).toBe(true)
    expect(blockedByFixedProps(door.x, door.z, 0.5)).toBe(false)
  })

  it('기본 섬에서 현관은 남쪽(+z)을 보고, 집 중심보다 남쪽에 있다', () => {
    const home = HOME_SITE!
    expect(home.rot).toBe(0)
    expect(home.door.z).toBeGreaterThan(home.z)
    expect(home.door.x).toBeCloseTo(home.x)
  })

  it('현관 방향은 남·동·서 중 하나다', () => {
    expect([0, Math.PI / 2, -Math.PI / 2]).toContain(pickHomePlot()!.rot)
  })
})
