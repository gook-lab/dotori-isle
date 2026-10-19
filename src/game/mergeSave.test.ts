import { describe, expect, it } from 'vitest'
import { useGame, mergeSave } from './store'

/** zustand 기본 병합과 같은 결과인지 비교한다. loanHistory 만 예외다. */
describe('저장 병합(mergeSave)', () => {
  const current = useGame.getState()
  const base = (persisted: object) => ({ ...current, ...persisted })

  it('기본 병합과 다른 필드가 모두 같다(깊은 객체는 얕게 통째로 바뀐다)', () => {
    const persisted = { money: 42, home: { stage: 1, loan: 1000, order: null }, bank: { savings: 5 } }
    const merged = mergeSave(persisted, current)
    const expected = base(persisted)
    for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
      if (k === 'loanHistory') continue
      expect(merged[k], k).toEqual(expected[k])
    }
    // 깊은 객체는 저장값 그대로 남는다(현재 값과 합치지 않는다)
    expect(merged.home).toEqual(persisted.home)
    expect(merged.bank).toEqual(persisted.bank)
  })

  it('loanHistory 가 없고 빚이 있으면 지금 빚으로 채우고, 그 밖에는 기본 병합과 같다', () => {
    const persisted = { home: { stage: 1, loan: 1000, order: null } }
    const merged = mergeSave(persisted, current)
    expect(merged.loanHistory).toEqual({ borrowed: 2500, paid: 1500, recent: [] })
    expect(base(persisted).loanHistory).toBe(current.loanHistory)
  })

  it('loanHistory 가 있으면 저장값을 그대로 쓴다', () => {
    const saved = { borrowed: 300, paid: 100, recent: [] }
    const persisted = { home: { stage: 1, loan: 200, order: null }, loanHistory: saved }
    expect(mergeSave(persisted, current)).toEqual(base(persisted))
    expect(mergeSave(persisted, current).loanHistory).toEqual(saved)
  })

  it('빚이 0 이거나 단계 표와 안 맞으면 기록을 만들지 않는다', () => {
    const zero = mergeSave({ home: { stage: 2, loan: 0, order: null } }, current)
    expect(zero.loanHistory).toEqual(current.loanHistory)
    const over = mergeSave({ home: { stage: 1, loan: 99999, order: null } }, current)
    expect(over.loanHistory).toEqual(current.loanHistory)
  })

  it('저장이 없으면(undefined) 현재 상태를 그대로 돌려준다', () => {
    expect(mergeSave(undefined, current)).toEqual(current)
  })
})
