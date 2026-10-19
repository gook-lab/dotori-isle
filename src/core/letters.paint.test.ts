import { describe, expect, it } from 'vitest'
import { paintTipLetter } from './letters'

describe('paint tip letter', () => {
  it('comes from the committee, has no gift, and names the paint menu', () => {
    const l = paintTipLetter('2026-10-19')
    expect(l.from).toBe('committee')
    expect(l.gift).toBeNull()
    expect(l.read).toBe(false)
    expect(l.text).toContain('집 꾸미기')
  })

  it('keys the id by the arrival day so one morning makes one letter', () => {
    expect(paintTipLetter('2026-10-19').id).toBe('paint-tip-2026-10-19')
    expect(paintTipLetter('2026-10-19').id).not.toBe(paintTipLetter('2026-10-20').id)
  })
})
