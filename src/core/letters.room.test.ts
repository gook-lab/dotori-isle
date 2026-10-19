import { describe, expect, it } from 'vitest'
import { ROOM_GIFT } from './homeWelcome'
import { roomGiftLetter } from './letters'

describe('room gift letter', () => {
  const attic = ROOM_GIFT[1]!

  it('is a gift letter from the committee that names the room and the item', () => {
    const l = roomGiftLetter('2026-10-19', attic, '풍경')
    expect(l.from).toBe('committee')
    expect(l.gift).toBe(attic.item)
    expect(l.text).toContain('다락')
    expect(l.text).toContain('풍경을 보내요')
    expect(l.read).toBe(false)
    expect(l.claimed).toBe(false)
  })

  it('picks the right particle for the item name', () => {
    expect(roomGiftLetter('2026-10-19', ROOM_GIFT[2]!, '독서 의자').text).toContain('독서 의자를 보내요')
  })

  it('keys the id by the room name so each room sends one letter', () => {
    expect(roomGiftLetter('2026-10-19', attic, '풍경').id).toBe('room-gift-attic')
    expect(roomGiftLetter('2026-10-20', attic, '풍경').id).toBe('room-gift-attic')
    expect(roomGiftLetter('2026-10-19', ROOM_GIFT[3]!, '저장 선반').id).toBe('room-gift-cellar')
  })
})
