import { describe, expect, it } from 'vitest'
import { gardenTileBlocker, decodeGarden, encodeGarden, gardenStats, GARDEN_TILE_MAX, paintGarden, GARDEN_ITEM, isGardenItem, GARDEN_KIND_OF_ITEM, type GardenTile } from './gardenTiles'
import { FENCE_ID } from './fence'
import type { Placed } from './placement'

const site = { x: 20, z: 20, door: { x: 20, z: 23.3 } }
const place = (x: number, z: number, itemId = FENCE_ID): Placed => ({ id: `${x}-${z}`, itemId, x, z, rot: 0 })

describe('garden tile codec', () => {
  it('round-trips kinds and drops broken or repeated cells', () => {
    const tiles: GardenTile[] = [
      { x: 22, z: 20, kind: 'gravel' },
      { x: 23, z: 20, kind: 'brick' },
      { x: 24, z: 20, kind: 'deck' },
    ]
    expect(decodeGarden(encodeGarden(tiles))).toEqual(tiles)
    expect(decodeGarden('22,20g;22,20b;zz;23,20x;24,20w')).toEqual([
      { x: 22, z: 20, kind: 'gravel' },
      { x: 24, z: 20, kind: 'deck' },
    ])
    expect(decodeGarden(undefined)).toEqual([])
  })

  it('keeps at most the tile cap', () => {
    const many = Array.from({ length: GARDEN_TILE_MAX + 5 }, (_, i) => `${i},0g`).join(';')
    expect(decodeGarden(many)).toHaveLength(GARDEN_TILE_MAX)
  })
})

describe('paintGarden', () => {
  it('adds, replaces, and removes a tile the same way the path brush does', () => {
    const a = paintGarden([], 22, 20, 'gravel')
    expect(a.done).toBe('added')
    const b = paintGarden(a.tiles, 22, 20, 'deck')
    expect(b.done).toBe('replaced')
    expect(b.tiles).toEqual([{ x: 22, z: 20, kind: 'deck' }])
    const c = paintGarden(b.tiles, 22, 20, 'deck')
    expect(c.done).toBe('removed')
    expect(c.tiles).toEqual([])
  })

  it('stops at the cap', () => {
    const full = decodeGarden(Array.from({ length: GARDEN_TILE_MAX }, (_, i) => `${i},0g`).join(';'))
    expect(paintGarden(full, 99, 99, 'brick').done).toBe('full')
  })
})

describe('gardenTileBlocker', () => {
  it('stays inside the ring and off the front door', () => {
    expect(gardenTileBlocker(20, 20, site, [], [])).toContain('몸체')
    expect(gardenTileBlocker(20, 23, site, [], [])).toContain('현관')
    expect(gardenTileBlocker(40, 20, site, [], [])).toContain('여섯 칸')
    expect(gardenTileBlocker(24, 20, site, [], [])).toBeNull()
  })

  it('will not lay a tile under a fence or other furniture', () => {
    expect(gardenTileBlocker(24, 20, site, [place(24, 20)], [])).not.toBeNull()
  })

  it('lets a laid tile be changed or taken up again', () => {
    expect(gardenTileBlocker(24, 20, site, [], [{ x: 24, z: 20, kind: 'gravel' }])).toBeNull()
  })
})

describe('gardenStats and item ids', () => {
  it('counts fence links and in-ring tiles for the home score', () => {
    const stats = gardenStats([place(23, 20), place(24, 20)], [{ x: 25, z: 20, kind: 'deck' }, { x: 40, z: 40, kind: 'brick' }], site)
    expect(stats).toEqual({ fenceLinks: 1, tiles: 1 })
  })

  it('maps each tile item to its kind', () => {
    for (const kind of ['gravel', 'brick', 'deck'] as const) expect(GARDEN_KIND_OF_ITEM[GARDEN_ITEM[kind]]).toBe(kind)
    expect(isGardenItem('tile-deck')).toBe(true)
    expect(isGardenItem('chair')).toBe(false)
    expect(isGardenItem(null)).toBe(false)
  })
})
