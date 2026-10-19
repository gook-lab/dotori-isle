import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listBackups, restoreBackup } from './saveFile'
import { BACKUP_PREFIX, SAVE_KEY } from './store'

/** 기기 저장소 흉내. 키 목록은 length·key 로 읽는다(브라우저 localStorage 와 같은 방식) */
function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    get length() {
      return m.size
    },
    key: (i: number) => [...m.keys()][i] ?? null,
  }
}

const GOOD = JSON.stringify({ state: { money: 42, day: '2026-10-19', inventory: [] }, version: 26 })
let store: ReturnType<typeof memoryStorage>

beforeEach(() => {
  store = memoryStorage()
  vi.stubGlobal('localStorage', store)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('백업 목록(listBackups)', () => {
  it('백업이 없으면 빈 목록이다. 설정 창은 이 구간을 숨긴다', () => {
    expect(listBackups()).toEqual([])
  })

  it('새것부터 버전·시각·돈·날짜 미리보기를 준다', () => {
    store.setItem(`${BACKUP_PREFIX}24-1000`, GOOD)
    store.setItem(`${BACKUP_PREFIX}26-2000`, GOOD)
    const list = listBackups()
    expect(list.map((b) => b.key)).toEqual([`${BACKUP_PREFIX}26-2000`, `${BACKUP_PREFIX}24-1000`])
    expect(list[0]).toMatchObject({ version: 26, at: 2000, ok: true, money: 42, day: '2026-10-19' })
  })

  it('저장된 백업이 많아도 목록은 최근 몇 개만 보여 준다', () => {
    for (let t = 1; t <= 5; t++) store.setItem(`${BACKUP_PREFIX}26-${t * 1000}`, GOOD)
    expect(listBackups().map((b) => b.at)).toEqual([5000, 4000, 3000])
  })

  it('읽을 수 없는 백업은 ok 가 false 로 나온다', () => {
    store.setItem(`${BACKUP_PREFIX}26-3000`, '{not json')
    expect(listBackups()[0]).toMatchObject({ ok: false })
  })
})

describe('백업 되살리기(restoreBackup)', () => {
  it('백업 글을 저장 키에 그대로 옮긴다(이행은 새로고침 때 보통 경로로 한다)', () => {
    store.setItem(`${BACKUP_PREFIX}26-3000`, GOOD)
    expect(restoreBackup(`${BACKUP_PREFIX}26-3000`)).toBe(true)
    expect(store.getItem(SAVE_KEY)).toBe(GOOD)
  })

  it('읽을 수 없는 백업이면 저장 키를 건드리지 않는다', () => {
    store.setItem(SAVE_KEY, 'current')
    store.setItem(`${BACKUP_PREFIX}26-3000`, '{not json')
    expect(restoreBackup(`${BACKUP_PREFIX}26-3000`)).toBe(false)
    expect(store.getItem(SAVE_KEY)).toBe('current')
  })

  it('백업 키가 아니면 거절한다', () => {
    store.setItem(SAVE_KEY, GOOD)
    expect(restoreBackup(SAVE_KEY)).toBe(false)
  })
})
