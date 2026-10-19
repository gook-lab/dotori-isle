import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSave, parseSaveFile, restoreBackup, writeSave } from './saveFile'
import { BACKUP_PREFIX, migrateSave, resumeSaveWrites, SAVE_KEY, useGame } from './store'

/** 기기 저장소 흉내(테스트 전용). 브라우저 localStorage 의 getItem·setItem·removeItem 만 쓴다 */
function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

/** 저장 키에 든 저장의 돈 */
const savedMoney = () => JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{"state":{"money":null}}').state.money

describe('저장 가져오기 검사', () => {
  it('깨진 글은 이유와 함께 거절한다', () => {
    const r = parseSaveFile('{not json')
    expect(r.ok).toBe(false)
  })

  it('도토리섬 저장이 아닌 JSON 은 거절한다', () => {
    expect(parseSaveFile('{"hello":1}').ok).toBe(false)
    expect(parseSaveFile('[1,2,3]').ok).toBe(false)
    expect(parseSaveFile('null').ok).toBe(false)
  })

  it('래퍼({state, version})와 맨 상태를 둘 다 받고 migrateSave 결과를 준다', () => {
    const base = migrateSave({ money: 321, day: '2026-10-19', inventory: [] })
    const wrapped = parseSaveFile(JSON.stringify({ state: base, version: 26 }))
    expect(wrapped.ok && wrapped.state.money).toBe(321)
    const bare = parseSaveFile(JSON.stringify(base))
    expect(bare.ok && bare.state.day).toBe('2026-10-19')
  })
})

describe('처음부터·되살리기·덮어쓰기 뒤에는 저장 쓰기가 멈춘다', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })
  afterEach(() => {
    resumeSaveWrites()
    vi.unstubAllGlobals()
  })

  it('처음부터 다시 뒤 상태가 바뀌어도 저장 키가 다시 써지지 않는다', () => {
    useGame.setState({ money: 111 })
    expect(savedMoney()).toBe(111)
    clearSave()
    useGame.setState({ money: 999 })
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('덮어쓰기 뒤에는 넣은 저장이 그대로 남는다', () => {
    writeSave(migrateSave({ money: 321, day: '2026-10-19', inventory: [] }))
    useGame.setState({ money: 5 })
    expect(savedMoney()).toBe(321)
  })

  it('되살리기 뒤에는 백업 돈이 그대로 남는다', () => {
    const base = migrateSave({ money: 654, day: '2026-10-19', inventory: [] })
    localStorage.setItem(`${BACKUP_PREFIX}29-1`, JSON.stringify({ state: base, version: 29 }))
    expect(restoreBackup(`${BACKUP_PREFIX}29-1`)).toBe(true)
    useGame.setState({ money: 5 })
    expect(savedMoney()).toBe(654)
  })

  it('되살리기가 실패하면 쓰기를 멈추지 않는다', () => {
    expect(restoreBackup(`${BACKUP_PREFIX}29-404`)).toBe(false)
    useGame.setState({ money: 777 })
    expect(savedMoney()).toBe(777)
  })
})
