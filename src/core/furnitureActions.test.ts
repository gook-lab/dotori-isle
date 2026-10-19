import { describe, expect, it } from 'vitest'
import { isFence } from './fence'
import { ITEMS } from './items'
import { BED_TOP, furnitureNote, homeUse, homeUseLabel, homeUseLine, isSleepHour, nearestWithin, napBonus, napLine, roomLabel, roomLine, villagerRoomTargets, windowLine } from './furnitureActions'
import { ROOM_FLOOR } from './interior'
import { SEAT_HEIGHT } from './placement'

// 울타리는 바깥 정원 물건이라 방 쓰임 대상이 아니다(core/fence.ts)
const FURNITURE = Object.values(ITEMS).filter((d) => d.kind === 'furniture' && !isFence(d.id))

describe('내 방 가구 쓰임', () => {
  it('every furniture item has an E use in the house, so E never falls back to stowing', () => {
    for (const d of FURNITURE) expect(homeUse(d.id), d.id).not.toBeNull()
  })

  it('maps each item to its use, and lamps and campfires are switched on and off', () => {
    expect(homeUse('chair')).toBe('sit')
    expect(homeUse('log-stool')).toBe('sit')
    expect(homeUse('log-bench')).toBe('sit')
    expect(homeUse('table')).toBe('tea')
    expect(homeUse('flowerpot')).toBe('pet')
    expect(homeUse('wooden-box')).toBe('open')
    expect(homeUse('snowman')).toBe('poke')
    expect(homeUse('gold-acorn')).toBe('polish')
    expect(homeUse('telescope')).toBe('scope')
    expect(homeUse('mailbox')).toBe('mail')
    for (const id of ['lamp', 'campfire', 'stone-lantern', 'iron-lamp']) expect(homeUse(id), id).toBe('light')
  })

  it('returns null for something that is not furniture, so it can only be put away', () => {
    expect(homeUse('wood')).toBeNull()
  })

  it('writes the E label with the right particle and on/off state', () => {
    expect(homeUseLabel('sit', '나무 의자')).toBe('나무 의자에 앉기')
    expect(homeUseLabel('light', '버섯 램프', true)).toBe('버섯 램프 켜기')
    expect(homeUseLabel('light', '버섯 램프', false)).toBe('버섯 램프 끄기')
    expect(homeUseLabel('scope', '별 망원경')).toBe('별 망원경으로 창밖 보기')
    expect(homeUseLabel('tea', '원목 탁자')).toBe('원목 탁자에서 차 한 잔')
  })

  it('has a toast line for each interaction, and none for the mailbox, which opens the panel', () => {
    const ctx = { weather: 'sunny' as const, season: 'spring' as const, night: false }
    expect(homeUseLine('tea', '원목 탁자', ctx)).toContain('차')
    expect(homeUseLine('pet', '화분', ctx)).toContain('꽃')
    expect(homeUseLine('poke', '눈사람 인형', ctx)).toContain('뒤뚱')
    expect(homeUseLine('polish', '황금 도토리상', ctx)).toContain('반짝')
    expect(homeUseLine('open', '나무 상자', ctx)).toContain('뚜껑')
    expect(homeUseLine('mail', '우체통', ctx)).toBeNull()
  })
})

describe('창밖 한 줄', () => {
  it('rain and snow come before the time of day, and the moon shows at night', () => {
    expect(windowLine({ weather: 'rain', season: 'summer', night: true })).toContain('빗방울')
    expect(windowLine({ weather: 'snow', season: 'winter', night: false })).toContain('눈이')
    expect(windowLine({ weather: 'sunny', season: 'autumn', night: true })).toContain('달빛')
  })

  it('a clear day shows the season, and a cloudy one shows drifting clouds', () => {
    expect(windowLine({ weather: 'sunny', season: 'spring', night: false })).toContain('벚꽃')
    expect(windowLine({ weather: 'sunny', season: 'summer', night: false })).toContain('바다')
    expect(windowLine({ weather: 'sunny', season: 'autumn', night: false })).toContain('단풍')
    expect(windowLine({ weather: 'sunny', season: 'winter', night: false })).toContain('눈밭')
    expect(windowLine({ weather: 'cloudy', season: 'spring', night: false })).toContain('구름')
  })
})

describe('침대 잠 보너스', () => {
  it('counts 22:00 to before 05:00 as sleeping time', () => {
    expect(isSleepHour(21.9)).toBe(false)
    expect(isSleepHour(22)).toBe(true)
    expect(isSleepHour(23.5)).toBe(true)
    expect(isSleepHour(4.99)).toBe(true)
    expect(isSleepHour(5)).toBe(false)
    expect(isSleepHour(12)).toBe(false)
  })

  it('gives the bonus only at night and only once a day', () => {
    expect(napBonus(null, '2026-10-18', 23)).toBe(true)
    expect(napBonus('2026-10-18', '2026-10-18', 23)).toBe(false)
    expect(napBonus('2026-10-17', '2026-10-18', 23)).toBe(true)
    expect(napBonus(null, '2026-10-18', 12)).toBe(false)
  })

  it('says how it went', () => {
    expect(napLine(false, false)).toContain('쉬었어요')
    expect(napLine(true, false)).toBe('푹 잤어요')
    expect(napLine(true, true)).toContain('기분 좋게')
  })
})

describe('주민 방 물건', () => {
  const gifts = ['flowerpot', 'lamp', 'telescope']
  const targets = villagerRoomTargets(gifts)
  const byId = (id: string) => targets.find((t) => t.id === id)!

  it('lets you sit on both stools and the edge of the bed, but never stow anything', () => {
    expect(byId('stool0').use).toBe('sit')
    expect(byId('stool1').use).toBe('sit')
    expect(byId('stool0').item).toBe('log-stool')
    expect(byId('stool0').seatY).toBe(ROOM_FLOOR + SEAT_HEIGHT['log-stool'])
    expect(byId('bed-edge').use).toBe('sit')
    expect(byId('bed-edge').seatY).toBe(BED_TOP)
    expect(byId('bed-edge').item).toBeUndefined()
  })

  it('toggles only the glowing gift and only examines the rest', () => {
    expect(byId('gift1').use).toBe('light')
    expect(byId('gift0').use).toBe('look')
    expect(byId('gift2').use).toBe('look')
    for (const id of ['dresser', 'shelf', 'plant', 'table']) expect(byId(id).use).toBe('look')
  })

  it('skips a gift slot the villager does not have', () => {
    expect(villagerRoomTargets(['lamp']).some((t) => t.id === 'gift1')).toBe(false)
  })

  it('labels the action by use, and a lamp flips between on and off', () => {
    expect(roomLabel(byId('stool0'))).toBe('통나무 의자에 앉기')
    expect(roomLabel(byId('gift1'), true)).toBe('버섯 램프 켜기')
    expect(roomLabel(byId('gift1'), false)).toBe('버섯 램프 끄기')
    expect(roomLabel(byId('dresser'))).toBe('서랍장 살펴보기')
  })

  it('examining decor sounds like the villager is proud of it', () => {
    const v = { name: '구리구리', tic: '' }
    expect(roomLine(v, byId('dresser'))).toBe('구리구리가 아끼는 서랍장이에요')
    expect(roomLine(v, byId('plant'))).toBe('구리구리가 아끼는 화분이에요')
    expect(roomLine(v, byId('gift2'))).toBe('구리구리가 아끼는 별 망원경이에요')
    expect(roomLine(v, byId('table'))).toBe('구리구리가 아끼는 탁자예요')
  })

  it('sitting and lamps get a line with the villager tic', () => {
    const v = { name: '모카', tic: '냥' }
    expect(roomLine(v, byId('stool0'))).toContain('모카:')
    expect(roomLine(v, byId('stool0'))).toContain('냥')
    expect(roomLine(v, byId('gift1'), true)).toContain('따뜻해졌어요')
    expect(roomLine(v, byId('gift1'), false)).toContain('조용해졌어요')
  })
})

describe('가장 가까운 대상', () => {
  const list = [
    { id: 'a', x: 0, z: 0, r: 1 },
    { id: 'b', x: 0.5, z: 0, r: 1 },
    { id: 'c', x: 5, z: 5, r: 1 },
  ]

  it('takes the nearest one within its reach', () => {
    expect(nearestWithin(list, 0.4, 0)?.id).toBe('b')
    expect(nearestWithin(list, 0.1, 0)?.id).toBe('a')
  })

  it('returns null when nothing is within reach', () => {
    expect(nearestWithin(list, 3, 3)).toBeNull()
  })
})

describe('가구 미리보기 쓰임 한 줄', () => {
  it('쓰임과 세트를 함께 적고, 밤에 켜지는 가구는 불빛 말을 쓴다', () => {
    expect(furnitureNote('chair')).toContain('앉을 수 있어요')
    expect(furnitureNote('floor-lamp')).toContain('밤에 불이 켜져요')
    expect(furnitureNote('floor-lamp')).toContain('세트: 서재')
    expect(furnitureNote('bookshelf')).toContain('세트: 서재')
  })

  it('쓰임도 세트도 없으면 null이다', () => {
    expect(furnitureNote('no-such-item')).toBeNull()
  })
})
