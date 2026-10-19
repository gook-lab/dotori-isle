import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isFence } from '../core/fence'
import { dateKey } from '../core/rng'
import { BED_TOP, villagerRoomTargets } from '../core/furnitureActions'
import { homeBed, homeChest } from '../core/home'
import { HOME_ROOM, ROOM_FLOOR, roomCenter } from '../core/interior'
import { ITEMS } from '../core/items'
import { createBank } from '../core/bank'
import { VILLAGERS } from '../core/villagers'
import { findAction, runAction } from './actions'
import { runtime } from './runtime'
import { migrateSave, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
const c = roomCenter(HOME_ROOM)

/** 방 가운데 기준 자리에 선다 */
function standHome(lx: number, lz: number, facing = 0) {
  runtime.player.x = c.x + lx
  runtime.player.z = c.z + lz
  runtime.player.facing = facing
}

beforeEach(() => {
  runtime.seat = null
  runtime.act = null
  runtime.reactFx = null
  runtime.react = null
  runtime.fishing = { phase: 'idle' }
  useGame.setState({
    panel: null,
    placing: null,
    homePlacing: null,
    placed: [],
    inHome: true,
    inside: null,
    doorFade: false,
    night: false,
    money: 0,
    miles: 0,
    inventory: [],
    letters: [],
    home: { stage: 0, loan: 0, order: null },
    homeFurniture: [],
    homeStorage: [],
    napDay: null,
    roomLampsOff: [],
    bank: createBank(today),
    day: today,
    stats: {},
  })
})

describe('방 가구 E 행동', () => {
  it('a bed in the house is lain on, and the window looks outside', () => {
    standHome(homeBed(0).x, homeBed(0).z + 1.2)
    expect(findAction()?.kind).toBe('home-bed')

    standHome(-2.6, -2.9)
    expect(findAction()?.kind).toBe('home-window')
  })

  it('the storage chest stays the chest, and the nearest thing wins', () => {
    standHome(homeChest(0).x, homeChest(0).z + 0.5)
    expect(findAction()?.kind).toBe('storage')
  })

  it('a flowerpot is patted, and the label keeps R to put it away', () => {
    useGame.setState({ homeFurniture: [{ id: 'h1', itemId: 'flowerpot', x: 0, z: -1, rot: 0 }] })
    standHome(0, -0.2)
    const a = findAction()
    expect(a?.kind).toBe('home-act')
    expect(a?.label).toBe('화분 잎 쓰다듬기 · R 넣기')
  })

  it('a chair still sits, and a lamp still switches', () => {
    useGame.setState({
      homeFurniture: [
        { id: 'ch', itemId: 'chair', x: 0, z: -1, rot: 0 },
        { id: 'lp', itemId: 'lamp', x: 2, z: -1, rot: 0, off: true },
      ],
    })
    standHome(0, -0.2)
    expect(findAction()).toMatchObject({ kind: 'home-use', use: 'sit' })
    standHome(2, -0.2)
    expect(findAction()).toMatchObject({ kind: 'home-use', use: 'light', label: '버섯 램프 켜기 · R 넣기' })
  })

  it('every furniture item has a use in the house, so none falls back to stowing', () => {
    // 울타리는 바깥 정원 물건이라 방 쓰임 대상이 아니다(core/fence.ts)
    const furniture = Object.values(ITEMS).filter((d) => d.kind === 'furniture' && !isFence(d.id))
    for (const d of furniture) {
      useGame.setState({ homeFurniture: [{ id: 'one', itemId: d.id, x: 0, z: -1, rot: 0 }] })
      standHome(0, -0.2)
      expect(findAction()?.kind, d.id).not.toBe('home-stow')
    }
  })

  it('running the tea action keeps the furniture where it is', () => {
    useGame.setState({ homeFurniture: [{ id: 'tb', itemId: 'table', x: 0, z: -1, rot: 0 }] })
    standHome(0, -0.2)
    const a = findAction()!
    runAction(a)
    expect(useGame.getState().homeFurniture).toHaveLength(1)
    expect(runtime.act?.kind).toBe('sip')
  })

  it('the bed lays the body down, with the head to the back wall', () => {
    standHome(homeBed(0).x, homeBed(0).z)
    runAction(findAction()!)
    expect(runtime.seat).toMatchObject({ lie: true, facing: 0, y: BED_TOP })
    // 누운 몸 가운데가 침대 가운데에 오도록 발 쪽(+z)으로 0.55 밀린다
    expect(runtime.seat!.x).toBeCloseTo(c.x + homeBed(0).x)
    expect(runtime.seat!.z).toBeCloseTo(c.z + homeBed(0).z + 0.55)
  })

  it('the storage chest and the window are not sat on or stowed by the bed rule', () => {
    standHome(homeChest(0).x, homeChest(0).z)
    runAction(findAction()!)
    expect(runtime.seat).toBeNull()
  })
})

describe('잠 보너스', () => {
  it('a night nap gives the miles once a day and shows the fade', () => {
    useGame.getState().nap(23)
    expect(useGame.getState().miles).toBe(10)
    expect(useGame.getState().napDay).toBe(today)
    expect(useGame.getState().doorFade).toBe(true)

    useGame.getState().nap(23)
    expect(useGame.getState().miles).toBe(10)
  })

  it('a daytime rest gives nothing and does not fade', () => {
    useGame.getState().nap(12)
    expect(useGame.getState().miles).toBe(0)
    expect(useGame.getState().napDay).toBeNull()
    expect(useGame.getState().doorFade).toBe(false)
  })
})

describe('주민 방 E 행동', () => {
  const villager = VILLAGERS.find((v) => villagerRoomTargets(v.gifts).some((t) => t.use === 'light'))!
  const roomAt = (lx: number, lz: number, facing = 0) => {
    const rc = roomCenter(VILLAGERS.indexOf(villager))
    runtime.player.x = rc.x + lx
    runtime.player.z = rc.z + lz
    runtime.player.facing = facing
  }

  beforeEach(() => {
    useGame.setState({ inside: villager.id, inHome: false })
  })

  it('sitting on a stool puts the body in the seat, at the seat height', () => {
    const stool = villagerRoomTargets(villager.gifts).find((t) => t.id === 'stool0')!
    roomAt(stool.x, stool.z + 0.3)
    const a = findAction()!
    expect(a).toMatchObject({ kind: 'room-act' })
    runAction(a)
    expect(runtime.seat).toMatchObject({ y: ROOM_FLOOR + 0.45 })
    expect(runtime.seat?.lie).toBeUndefined()
  })

  it('a villager lamp toggles and the label follows it', () => {
    const lamp = villagerRoomTargets(villager.gifts).find((t) => t.use === 'light')!
    roomAt(lamp.x, lamp.z + 0.3)
    const key = `${villager.id}/${lamp.id}`
    // 램프는 처음부터 켜져 있어서 E 는 끄기다
    const first = findAction()!
    expect(first).toMatchObject({ kind: 'room-act', label: '버섯 램프 끄기' })
    runAction(first)
    expect(useGame.getState().roomLampsOff).toContain(key)
    expect(findAction()?.label).toBe('버섯 램프 켜기')
  })

  it('the villager never offers to put room furniture away', () => {
    for (const t of villagerRoomTargets(villager.gifts)) {
      roomAt(t.x, t.z + 0.3)
      expect(findAction()?.kind).not.toBe('home-stow')
      expect(findAction()?.kind).not.toBe('stow')
    }
  })

  it('a host villager at home reacts, and the reaction is the villager mood', () => {
    const lamp = villagerRoomTargets(villager.gifts).find((t) => t.use === 'light')!
    roomAt(lamp.x, lamp.z + 0.3)
    runAction(findAction()!)
    expect(runtime.react).toMatchObject({ id: villager.id, mood: 'happy' })
  })
})

describe('저장 v5 마이그레이션', () => {
  it('an old save without napDay gets null and keeps the rest', () => {
    const s = migrateSave({ day: today, money: 120, homeFurniture: [{ id: 'a', itemId: 'chair', x: 0, z: 0, rot: 0 }] })
    expect(s.napDay).toBeNull()
    expect(s.money).toBe(120)
    expect(s.homeFurniture).toHaveLength(1)
  })

  it('keeps a valid napDay and drops a broken one', () => {
    expect(migrateSave({ day: today, napDay: today }).napDay).toBe(today)
    expect(migrateSave({ day: today, napDay: 'not-a-day' }).napDay).toBeNull()
    expect(migrateSave({ day: today, napDay: 3 }).napDay).toBeNull()
  })
})
