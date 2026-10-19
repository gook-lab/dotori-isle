import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_KEEP, BACKUP_PREFIX, backupKeys, backupSave, loadSave, SAVE_KEY } from './store'

/** 기기 저장소 흉내. 테스트 환경에는 localStorage 가 없어서 Map 으로 대신한다 */
function memoryStorage(broken = false) {
  const m = new Map<string, string>()
  const fail = () => {
    throw new Error('storage blocked')
  }
  return {
    getItem: (k: string) => (broken ? fail() : m.get(k) ?? null),
    setItem: (k: string, v: string) => (broken ? fail() : void m.set(k, v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    keys: () => [...m.keys()],
    get length() {
      return m.size
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    get: (k: string) => m.get(k),
  }
}

/** 이행 실패를 흉내 낸다 */
const boom = () => {
  throw new Error('boom')
}

let storage: ReturnType<typeof memoryStorage>
let err: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
  err = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  err.mockRestore()
})

describe('저장 이행 실패 처리(loadSave)', () => {
  it('정상 저장은 백업 없이 옮긴다', () => {
    const s = loadSave({ money: 5, day: '2026-10-19' }, 26)
    expect(s.money).toBe(5)
    expect(storage.keys().filter((k) => k.startsWith(BACKUP_PREFIX))).toEqual([])
    expect(err).not.toHaveBeenCalled()
  })

  it('이행이 던지면 원본 글을 백업 키에 남기고 기본 상태로 시작한다', () => {
    const raw = JSON.stringify({ state: { money: 777 }, version: 26 })
    storage.setItem(SAVE_KEY, raw)
    const s = loadSave({ money: 777 }, 26, boom)
    expect(s.money).toBe(0)
    expect(s.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const keys = storage.keys().filter((k) => k.startsWith(BACKUP_PREFIX))
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(/^dotori-isle-backup-26-\d+$/)
    expect(storage.get(keys[0])).toBe(raw)
    expect(err).toHaveBeenCalled()
  })

  it('저장 글이 없으면 옮기기 전 상태를 버전과 함께 백업한다', () => {
    loadSave({ money: 9 }, 24, boom)
    const key = storage.keys().find((k) => k.startsWith(BACKUP_PREFIX))!
    expect(JSON.parse(storage.get(key)!)).toEqual({ state: { money: 9 }, version: 24 })
  })

  it('백업 키 이름은 저장 버전과 시각으로 만든다', () => {
    const key = backupSave({}, 27)
    expect(key).toMatch(/^dotori-isle-backup-27-\d+$/)
  })

  it('백업은 가장 최근 BACKUP_KEEP 개만 남기고 새것부터 돌려준다', () => {
    const now = vi.spyOn(Date, 'now')
    for (let i = 1; i <= BACKUP_KEEP + 2; i++) {
      now.mockReturnValue(1000 * i)
      backupSave({ money: i }, 26)
    }
    const keys = backupKeys()
    expect(keys).toHaveLength(BACKUP_KEEP)
    expect(keys).toEqual([`${BACKUP_PREFIX}26-5000`, `${BACKUP_PREFIX}26-4000`, `${BACKUP_PREFIX}26-3000`])
    now.mockRestore()
  })

  it('저장소가 막혀 있어도 던지지 않고 기본 상태로 시작한다', () => {
    vi.stubGlobal('localStorage', memoryStorage(true))
    const s = loadSave({ money: 3 }, 26, boom)
    expect(s.money).toBe(0)
    expect(backupSave({}, 26)).toBeNull()
  })
})
