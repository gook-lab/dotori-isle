import { describe, expect, it } from 'vitest'
import { cleanHomeNew, floorArrivalText, homeGrowthText, homeRibbonShown, HOME_NEAR_R, isAreaArrivalText, isFirstRoomVisit, markRoomVisited, nearHome, newHomeGreeting, newRoomNotes, pointerFloor, POINTER_SPOT, ROOM_GIFT, roomGiftFloors } from './homeWelcome'
import { ATTIC, MAIN_EAST_WALL_DOOR, MAIN_STAIR } from './interior'
import { ITEMS } from './items'

const D = '2026-10-21'
const NEXT = '2026-10-22'

describe('새 집 안내: 저장값 검증', () => {
  it('keeps a valid record and turns a missing greeted flag into false', () => {
    expect(cleanHomeNew({ day: D, greeted: true, from: 1 })).toEqual({ day: D, greeted: true, from: 1 })
    expect(cleanHomeNew({ day: D, from: 2 })).toEqual({ day: D, greeted: false, from: 2 })
  })

  it('drops broken values so old saves have no welcome', () => {
    expect(cleanHomeNew(undefined)).toBeNull()
    expect(cleanHomeNew(null)).toBeNull()
    expect(cleanHomeNew('x')).toBeNull()
    expect(cleanHomeNew({ day: 'not-a-day', greeted: false, from: 1 })).toBeNull()
    expect(cleanHomeNew({ day: 3, greeted: false, from: 1 })).toBeNull()
    expect(cleanHomeNew({ day: D, greeted: false })).toBeNull()
    expect(cleanHomeNew({ day: D, greeted: false, from: 9 })).toBeNull()
  })
})

describe('새 집 안내: 근처 판정', () => {
  const site = { x: 10, z: 10 }

  it('counts a player within 8 cells as near, and not beyond', () => {
    expect(HOME_NEAR_R).toBe(8)
    expect(nearHome(10 + 8, 10, site)).toBe(true)
    expect(nearHome(10, 10 + 5.6, site)).toBe(true)
    expect(nearHome(10 + 8.5, 10, site)).toBe(false)
  })

  it('is never near when there is no home site', () => {
    expect(nearHome(0, 0, null)).toBe(false)
  })
})

describe('새 집 안내: 깃발', () => {
  it('stands only on the completion day, after the player has been near', () => {
    const fresh = { day: D, greeted: false, from: 1 as const }
    expect(homeRibbonShown(fresh, D, true)).toBe(true)
    expect(homeRibbonShown(fresh, D, false)).toBe(false)
    expect(homeRibbonShown(fresh, NEXT, true)).toBe(false)
    expect(homeRibbonShown(null, D, true)).toBe(false)
  })
})

describe('새 집 안내: 늘어난 것만 말하기', () => {
  it('names the grid and storage that grew from the previous stage', () => {
    expect(homeGrowthText(1, 2)).toBe('가구 칸 5×5 · 보관 30칸이 됐어요')
    expect(homeGrowthText(0, 1)).toBe('가구 칸 4×4 · 보관 20칸이 됐어요')
  })

  it('names only the storage when the grid stays the same', () => {
    expect(homeGrowthText(3, 4)).toBe('방이 새로 늘었어요')
    expect(homeGrowthText(2, 3)).toBe('가구 칸 6×5 · 보관 40칸이 됐어요')
  })
})

describe('새 집 안내: 문 앞 인사', () => {
  it('greets once on the completion day and says what grew', () => {
    const r = newHomeGreeting({ day: D, greeted: false, from: 1 }, D, 2)
    expect(r?.text).toBe('🏡 새 집에 들어왔어요! 가구 칸 5×5 · 보관 30칸이 됐어요')
    expect(r?.next).toEqual({ day: D, greeted: true, from: 1 })
    expect(newHomeGreeting(r!.next, D, 2)).toBeNull()
  })

  it('stays silent on other days and without a record', () => {
    expect(newHomeGreeting({ day: D, greeted: false, from: 1 }, NEXT, 2)).toBeNull()
    expect(newHomeGreeting(null, D, 2)).toBeNull()
  })
})

describe('새로 생긴 방 안내', () => {
  it('증축으로 새로 열린 방마다 가는 길을 한 줄씩 적는다', () => {
    expect(newRoomNotes(0, 1)).toEqual([])
    expect(newRoomNotes(2, 3).join('')).toContain('다락이 생겼어요')
    expect(newRoomNotes(3, 4).join('')).toContain('옆방이 생겼어요')
    expect(newRoomNotes(4, 5).join('')).toContain('지하실이 생겼어요')
  })

  it('이미 있던 방은 다시 적지 않는다', () => {
    expect(newRoomNotes(3, 4).join('')).not.toContain('다락')
    expect(newRoomNotes(4, 5).join('')).not.toContain('옆방')
  })

  it('첫 입장 안내에 새 방 이름과 가는 길이 들어간다', () => {
    const day = '2026-10-19'
    const g = newHomeGreeting({ day, greeted: false, from: 2 }, day, 3)!
    expect(g.text).toContain('다락이 생겼어요')
    expect(g.text).toContain('사다리')
    expect(g.text).not.toContain('방이 새로 늘었어요')
  })

  it('방이 늘지 않은 증축은 예전 문구를 그대로 쓴다', () => {
    const day = '2026-10-19'
    const g = newHomeGreeting({ day, greeted: false, from: 0 }, day, 1)!
    expect(g.text).toContain('가구 칸')
    expect(g.text).not.toContain('생겼어요')
  })
})

describe('새 방 가리킴', () => {
  const D = '2026-10-19'
  const rec = (from: 0 | 1 | 2 | 3 | 4 | 5, visited?: (1 | 2 | 3)[]) => ({ day: D, greeted: true, from, ...(visited && { visited }) })

  it('첫 방은 사다리(다락), 그다음 옆문, 마지막 계단 순으로 가리킨다', () => {
    expect(pointerFloor(rec(2), D, 3)).toBe(1)
    expect(pointerFloor(rec(2, [1]), D, 3)).toBeNull()
    expect(pointerFloor(rec(3), D, 4)).toBe(2)
    expect(pointerFloor(rec(4), D, 5)).toBe(3)
  })

  it('완성된 날이 아니면 가리키지 않는다', () => {
    expect(pointerFloor(rec(2), '2026-10-20', 3)).toBeNull()
    expect(pointerFloor(null, D, 3)).toBeNull()
  })

  it('방을 처음 들어가면 기록하고, 같은 방은 다시 적지 않는다', () => {
    const r = rec(2)
    const once = markRoomVisited(r, 1)
    expect(once.visited).toEqual([1])
    expect(markRoomVisited(once, 1)).toBe(once)
    expect(markRoomVisited(r, 0)).toBe(r)
  })

  it('저장값은 1~3 층 번호만 남기고 중복을 없앤다', () => {
    expect(cleanHomeNew({ day: D, from: 2, visited: [1, 1, 7, 'x', 3] })).toEqual({ day: D, greeted: false, from: 2, visited: [1, 3] })
    expect(cleanHomeNew({ day: D, from: 2 })).toEqual({ day: D, greeted: false, from: 2 })
  })

  it('가리킴 자리는 사다리·옆문·계단 근처에 있다', () => {
    expect(POINTER_SPOT[1].x).toBe(ATTIC.ladderX)
    expect(POINTER_SPOT[2].x).toBeLessThan(MAIN_EAST_WALL_DOOR.x)
    expect(POINTER_SPOT[3].x).toBe(MAIN_STAIR.x)
  })

  it('화살표 끝은 대상의 맨 위보다 높게 떠 있다', () => {
    expect(POINTER_SPOT[1].h).toBeGreaterThan(ATTIC.floorY)
    expect(POINTER_SPOT[2].h).toBeGreaterThan(1.6)
    expect(POINTER_SPOT[3].h).toBeGreaterThan(1.0)
  })
})

describe('집 안 방 옮김 알림', () => {
  it('처음 들어간 새 방에는 가구를 놓는 법을 한 줄 붙인다', () => {
    expect(floorArrivalText(0, 2, true)).toBe('옆방으로 왔어요. 주머니에서 가구를 꺼내 놓아요')
    expect(floorArrivalText(0, 3, true)).toBe('지하실로 내려왔어요. 주머니에서 가구를 꺼내 놓아요')
    expect(floorArrivalText(0, 1, true)).toBe('다락에 올라왔어요. 주머니에서 가구를 꺼내 놓아요')
  })

  it('다시 들어간 방과 본채로 돌아오는 알림에는 놓는 법을 붙이지 않는다', () => {
    expect(floorArrivalText(0, 2, false)).toBe('옆방으로 왔어요')
    expect(floorArrivalText(3, 0, true)).toBe('본채로 올라왔어요')
    expect(floorArrivalText(2, 0, false)).toBe('본채로 돌아왔어요')
    expect(floorArrivalText(1, 0, false)).toBe('방바닥으로 내려왔어요')
  })

  it('처음 가는 새 방인지 가린다(가기 전에 본다). 본채와 예전 방은 아니다', () => {
    const hn = { day: '2026-10-18', greeted: true, from: 2 as const, visited: [1 as const] }
    expect(isFirstRoomVisit(hn, 1)).toBe(false)
    expect(isFirstRoomVisit(hn, 3)).toBe(true)
    expect(isFirstRoomVisit(hn, 0)).toBe(false)
    expect(isFirstRoomVisit(null, 2)).toBe(false)
  })

  it('설명이 붙은 옮김 알림도 같은 종류로 알아본다(줄에 남은 것을 지울 때 쓴다)', () => {
    expect(isAreaArrivalText(floorArrivalText(0, 2, true))).toBe(true)
    expect(isAreaArrivalText(floorArrivalText(0, 3, false))).toBe(true)
    expect(isAreaArrivalText('방바닥으로 내려왔어요')).toBe(false)
  })
})

describe('새 방 선물', () => {
  it('어제 새 방이 열렸으면 그 방들을 오늘 아침 선물 대상으로 준다', () => {
    const hn = { day: '2026-10-18', greeted: true, from: 2 as const }
    expect(roomGiftFloors(hn, '2026-10-18', 5)).toEqual([1, 2, 3])
  })

  it('다른 날이거나 새 방이 없으면 선물이 없다(예전 저장도 소급하지 않는다)', () => {
    const hn = { day: '2026-10-18', greeted: true, from: 2 as const }
    expect(roomGiftFloors(hn, '2026-10-17', 5)).toEqual([])
    expect(roomGiftFloors(null, '2026-10-18', 5)).toEqual([])
    expect(roomGiftFloors({ day: '2026-10-18', greeted: true, from: 5 as const }, '2026-10-18', 5)).toEqual([])
  })

  it('방마다 어울리는 가구는 실제 가구 정의이고 방 이름이 편지 id 가 된다', () => {
    for (const g of Object.values(ROOM_GIFT)) {
      expect(ITEMS[g!.item]?.kind).toBe('furniture')
      expect(g!.key).toMatch(/^[a-z]+$/)
    }
    expect(new Set(Object.values(ROOM_GIFT).map((g) => g!.key)).size).toBe(3)
  })
})
