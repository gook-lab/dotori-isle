import { describe, expect, it } from 'vitest'
import { FURNITURE_IDS, furnitureSources } from './furnitureCatalog'

describe('가구 도감 출처', () => {
  it('모든 가구에 얻는 길이 하나 이상 있다(도감의 "섬 어딘가" 칸이 없다)', () => {
    const missing = FURNITURE_IDS.filter((id) => furnitureSources(id).length === 0)
    expect(missing).toEqual([])
  })
})
