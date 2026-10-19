import { describe, expect, it, vi } from 'vitest'

// 겉모양은 맞는데 옮기는 중 던지는 경우를 흉내 낸다. 실제 깨진 입력을 찾기보다 확실하게 던지게 한다.
vi.mock('./store', async (importOriginal) => {
  const real = await importOriginal<typeof import('./store')>()
  return {
    ...real,
    migrateSave: () => {
      throw new Error('broken')
    },
  }
})

import { parseSaveFile } from './saveFile'

describe('저장 가져오기 — 옮기다 던져도 화면까지 올리지 않는다', () => {
  it('겉모양은 맞고 속이 깨진 파일은 이유와 함께 거절한다', () => {
    const r = parseSaveFile(JSON.stringify({ money: 1, day: '2026-10-19', inventory: [] }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.why).toContain('읽을 수 없어요')
  })
})
