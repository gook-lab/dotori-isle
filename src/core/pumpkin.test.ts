import { describe, expect, it } from 'vitest'
import type { Personality } from './chat'
import { newsFor } from '../game/news'
import { NEW_SHOP } from './shopTiers'
import {
  candyOutcome,
  costumeShown,
  pumpkinAskLines,
  pumpkinPrankLines,
  pumpkinThanksLines,
  CANDY_ID,
  CANDY_PRICE,
  costumeFor,
  isCandyWeek,
  isPumpkinDay,
  isPumpkinEve,
  isPumpkinNight,
  isPumpkinOutfit,
  LANTERN_AVOID,
  LANTERN_RING,
  lanternSpotsAround,
  PRANK_OUTFIT,
  PUMPKIN_COSTUMES,
  PUMPKIN_GIFTS,
  pumpkinLetter,
  pumpkinOutfitColor,
  pumpkinThanksLetter,
  PUMPKIN_EVE_LINE,
} from './pumpkin'
import { ITEMS } from './items'

describe('호박 등불 밤 시간', () => {
  it('opens on October 31 from 17:00 until midnight only', () => {
    expect(isPumpkinNight('2026-10-31', 16.9)).toBe(false)
    expect(isPumpkinNight('2026-10-31', 17)).toBe(true)
    expect(isPumpkinNight('2026-10-31', 23.9)).toBe(true)
    expect(isPumpkinNight('2026-10-31', 24)).toBe(false)
    expect(isPumpkinNight('2026-10-30', 19)).toBe(false)
    expect(isPumpkinNight('2026-11-01', 19)).toBe(false)
  })

  it('knows the eve, the day, and the candy week (October 25 to 31)', () => {
    expect(isPumpkinDay('2026-10-31')).toBe(true)
    expect(isPumpkinEve('2026-10-30')).toBe(true)
    expect(isCandyWeek('2026-10-24')).toBe(false)
    expect(isCandyWeek('2026-10-25')).toBe(true)
    expect(isCandyWeek('2026-10-31')).toBe(true)
    expect(isCandyWeek('2026-11-01')).toBe(false)
  })

  it('puts the eve broadcast line into that morning news only', () => {
    const home = { stage: 0 as const, loan: 0, order: null }
    expect(newsFor({ day: '2026-10-30', houses: [], shop: NEW_SHOP, home })).toContain(PUMPKIN_EVE_LINE)
    expect(newsFor({ day: '2026-10-29', houses: [], shop: NEW_SHOP, home }).join(' ')).not.toContain('호박 등불 밤')
  })
})

describe('사탕 교환과 장난', () => {
  it('gives a treat when the player has candy, a prank when not', () => {
    expect(candyOutcome(false, 'x')).toEqual({ kind: 'prank' })
    const t = candyOutcome(true, '2026-10-31:mocha')
    expect(t.kind).toBe('treat')
    if (t.kind === 'treat') expect(PUMPKIN_GIFTS).toContain(t.gift)
    expect(candyOutcome(true, 'same')).toEqual(candyOutcome(true, 'same'))
  })

  it('uses a candy item from the catalog and the gifts are event furniture', () => {
    expect(ITEMS[CANDY_ID]).toBeDefined()
    for (const g of PUMPKIN_GIFTS) expect(ITEMS[g]).toMatchObject({ kind: 'furniture' })
    expect(PUMPKIN_GIFTS.length).toBeGreaterThanOrEqual(2)
  })

  it('takes the candy price from one constant, so selling it back never pays more than buying', () => {
    // 되팔 때 값(items)과 살 때 값(상점)이 같은 상수에서 나온다. 사서 바로 팔면 손해도 이득도 없다.
    expect(ITEMS[CANDY_ID].price).toBe(CANDY_PRICE)
  })

  it('writes the thank-you letter with the gift and the day', () => {
    const l = pumpkinThanksLetter('2026-10-31', { id: 'mocha', name: '모카' }, 'pumpkin-lantern')
    expect(l).toMatchObject({ id: 'pumpkin-thanks-2026-10-31-mocha', from: 'mocha', gift: 'pumpkin-lantern' })
    expect(pumpkinLetter('2026-10-31')).toMatchObject({ id: 'pumpkin-2026-10-31', gift: null })
  })
})

describe('주민 옷과 행사 색', () => {
  it('gives each villager a fixed cape or mask for the night', () => {
    const ids = PUMPKIN_COSTUMES.map((c) => c.id)
    expect(ids).toContain(costumeFor('mocha'))
    expect(costumeFor('mocha')).toBe(costumeFor('mocha'))
  })

  it('knows the event outfits and their colors, and keeps them apart from the wardrobe', () => {
    for (const c of PUMPKIN_COSTUMES) expect(isPumpkinOutfit(c.id)).toBe(true)
    expect(isPumpkinOutfit(PRANK_OUTFIT.id)).toBe(true)
    expect(pumpkinOutfitColor(PRANK_OUTFIT.id)).toBe(PRANK_OUTFIT.color)
    expect(isPumpkinOutfit('shirt-sky')).toBe(false)
  })
})

describe('호박 등불 자리', () => {
  const center = { x: 0, z: 0 }

  it('puts up to eight lanterns on a ring, skipping blocked spots and lamp spots', () => {
    const all = lanternSpotsAround(center, [], () => true)
    expect(all).toHaveLength(8)
    for (const p of all) expect(Math.hypot(p.x, p.z)).toBeCloseTo(LANTERN_RING, 6)
    expect(lanternSpotsAround(center, [], () => false)).toEqual([])
    const lamp = { x: LANTERN_RING, z: 0 }
    const near = lanternSpotsAround(center, [lamp], () => true)
    expect(near).toHaveLength(7)
    for (const p of near) expect(Math.hypot(p.x - lamp.x, p.z - lamp.z)).toBeGreaterThanOrEqual(LANTERN_AVOID)
  })
})

describe('행사 옷 시간과 사탕 대사', () => {
  it('shows capes and masks only in the evening, and the prank color all day', () => {
    for (const c of PUMPKIN_COSTUMES) {
      expect(costumeShown(c.id, false)).toBe(false)
      expect(costumeShown(c.id, true)).toBe(true)
    }
    expect(costumeShown(PRANK_OUTFIT.id, false)).toBe(true)
    expect(costumeShown('shirt-sky', false)).toBe(true)
  })

  it('gives every personality two different lines for asking, thanks, and the prank', () => {
    const all: Personality[] = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy']
    const asks = new Set<string>()
    for (const p of all) {
      expect(pumpkinAskLines(p)).toHaveLength(2)
      expect(pumpkinThanksLines(p, '호박 등불🎃')).toHaveLength(2)
      expect(pumpkinPrankLines(p)).toHaveLength(2)
      expect(pumpkinThanksLines(p, '호박 등불🎃').join(' ')).toContain('호박 등불🎃')
      for (const l of pumpkinAskLines(p)) asks.add(l)
    }
    expect(asks.size).toBe(all.length * 2)
  })
})
