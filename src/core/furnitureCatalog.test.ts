import { describe, expect, it } from 'vitest'
import { FURNITURE_IDS, furnitureHint, furnitureProgress, furnitureSources, sanitizeSeen, seenFurniture } from './furnitureCatalog'

describe('가구 도감 출처', () => {
  it('lists the shop, market, festival, DIY and gift routes for a furniture item', () => {
    expect(furnitureSources('chair')).toContain('상점')
    expect(furnitureSources('telescope')).toContain('장터에서 가끔')
    expect(furnitureSources('blossom-arch')).toEqual(['축제 보상'])
    expect(furnitureSources('log-stool')).toContain('DIY')
  })

  it('joins several routes and falls back to a plain place for unknown ones', () => {
    expect(furnitureHint('log-bench')).toBe('장터에서 가끔 · DIY · 주민 선물')
    expect(furnitureSources('not-a-furniture')).toEqual([])
    expect(furnitureHint('not-a-furniture')).toBe('섬 어딘가')
  })

  it('covers every furniture item with at least one route', () => {
    for (const id of FURNITURE_IDS) expect(furnitureSources(id).length, id).toBeGreaterThan(0)
  })
})

describe('가구 도감 기록', () => {
  it('keeps a furniture item seen even after it leaves the pocket', () => {
    const a = seenFurniture([], [{ id: 'chair' }], [], [], [])
    expect(a).toEqual(['chair'])
    const b = seenFurniture(a, [], [], [], [])
    expect(b).toBe(a)
  })

  it('counts placed, home and storage furniture, and ignores non-furniture', () => {
    const got = seenFurniture([], [{ id: 'sea-bass' }], [{ itemId: 'table' }], [{ itemId: 'lamp' }], [{ id: 'mailbox' }])
    expect(got.sort()).toEqual(['lamp', 'mailbox', 'table'])
  })

  it('counts a furniture gift as seen once its letter arrives', () => {
    expect(seenFurniture([], [], [], [], [], ['chair', null, 'flower-seed'])).toEqual(['chair'])
  })

  it('does not record the same item twice', () => {
    expect(seenFurniture(['chair'], [{ id: 'chair' }, { id: 'chair' }], [], [], [])).toEqual(['chair'])
  })

  it('sanitizes a saved list', () => {
    expect(sanitizeSeen(['chair', 'chair', 'peach', 3, 'table'])).toEqual(['chair', 'table'])
    expect(sanitizeSeen(undefined)).toEqual([])
  })

  it('reports completion over the whole catalog', () => {
    expect(furnitureProgress([]).pct).toBe(0)
    expect(furnitureProgress(FURNITURE_IDS.slice(0, 1)).found).toBe(1)
    expect(furnitureProgress(FURNITURE_IDS).pct).toBe(100)
  })
})
