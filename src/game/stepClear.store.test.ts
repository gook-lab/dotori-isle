import { describe, expect, it } from 'vitest'
import { migrateSave } from './store'
import { PLATEAUS, plateauRimAt, RAMP_W } from '../core/tiers'

const summit = PLATEAUS.find((p) => p.id === 'summit') ?? PLATEAUS[0]
const stepPoint = () => {
  const a = summit.ramps[0]
  const r = plateauRimAt(summit, a) + RAMP_W / 2
  return { x: summit.x + Math.cos(a) * r, z: summit.z + Math.sin(a) * r }
}

describe('저장 이행 — 계단 자리 물건을 주머니로 돌려준다', () => {
  it('계단 자리 가구는 주머니로 가고 편지가 한 통 온다', () => {
    const base = migrateSave({})
    const on = stepPoint()
    const save = migrateSave({
      ...base,
      placed: [{ id: 'chair-1', itemId: 'chair', x: on.x, z: on.z, rot: 0 }],
      infra: { ...base.infra, paths: '' },
    })
    expect(save.placed.some((p) => p.id === 'chair-1')).toBe(false)
    expect(save.inventory.some((s) => s.id === 'chair' && s.count >= 1)).toBe(true)
    expect(save.letters.some((l) => l.id === `step-spot-${save.day}`)).toBe(true)
  })

  it('정리할 것이 없으면 편지를 보내지 않는다', () => {
    const base = migrateSave({})
    const save = migrateSave({ ...base, placed: [] })
    expect(save.letters.some((l) => l.id.startsWith('step-spot-'))).toBe(false)
  })

  it('주머니가 가득 차면 집 보관함으로 보낸다', () => {
    const base = migrateSave({})
    const on = stepPoint()
    const full = Array.from({ length: base.pocket }, (_, i) => ({ id: 'chair', count: 1, variant: `v${i}` }))
    const save = migrateSave({
      ...base,
      inventory: full,
      homeStorage: [],
      placed: [{ id: 'chair-1', itemId: 'chair', x: on.x, z: on.z, rot: 0 }],
    })
    expect(save.placed.some((p) => p.id === 'chair-1')).toBe(false)
    expect(save.homeStorage.some((s) => s.id === 'chair' && s.count >= 1)).toBe(true)
    expect(save.inventory.length).toBe(base.pocket)
  })

  it('두 번 로드해도 편지는 한 통이다', () => {
    const base = migrateSave({})
    const on = stepPoint()
    const raw = { ...base, placed: [{ id: 'chair-1', itemId: 'chair', x: on.x, z: on.z, rot: 0 }] }
    const once = migrateSave(raw)
    const twice = migrateSave(JSON.parse(JSON.stringify(once)))
    const count = (list: { id: string }[]) => list.filter((l) => l.id === `step-spot-${once.day}`).length
    expect(count(once.letters)).toBe(1)
    expect(count(twice.letters)).toBe(1)
    expect(twice.letters[0].id).toBe(`step-spot-${once.day}`)
  })
})
