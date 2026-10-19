import { describe, expect, it } from 'vitest'
import { enterBelongsToBag, spaceBelongsToUi } from './input'

const button = { tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget
const input = { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget
const body = { tagName: 'BODY', isContentEditable: false } as unknown as EventTarget

describe('스페이스 키 소유', () => {
  it('stays the action key in the world when no panel is open and focus is on the page', () => {
    expect(spaceBelongsToUi('Space', body, false)).toBe(false)
  })

  it('goes to the focused button or text field, even with no panel open', () => {
    expect(spaceBelongsToUi('Space', button, false)).toBe(true)
    expect(spaceBelongsToUi('Space', input, false)).toBe(true)
  })

  it('goes to the open panel, so Space presses its focused button', () => {
    expect(spaceBelongsToUi('Space', body, true)).toBe(true)
  })

  it('never claims other keys', () => {
    expect(spaceBelongsToUi('KeyE', button, true)).toBe(false)
    expect(spaceBelongsToUi('Enter', button, true)).toBe(false)
  })
})

describe('엔터 키 소유', () => {
  it('goes to a button inside the bag, so Enter presses it instead of the world action', () => {
    const bagButton = { tagName: 'BUTTON', closest: (sel: string) => (sel === '.bag-area' ? {} : null) } as unknown as EventTarget
    expect(enterBelongsToBag('Enter', bagButton)).toBe(true)
  })

  it('stays the world action key for Enter elsewhere, and never claims other keys', () => {
    const outside = { tagName: 'BUTTON', closest: () => null } as unknown as EventTarget
    expect(enterBelongsToBag('Enter', outside)).toBe(false)
    expect(enterBelongsToBag('Enter', body)).toBe(false)
    expect(enterBelongsToBag('Space', { tagName: 'BUTTON', closest: () => ({}) } as unknown as EventTarget)).toBe(false)
  })
})

describe('가방 안 버튼의 스페이스', () => {
  it('stays the world action key on a bag button, so Space does not press it', () => {
    const bagButton = { tagName: 'BUTTON', closest: (sel: string) => (sel === '.bag-area' ? {} : null) } as unknown as EventTarget
    expect(spaceBelongsToUi('Space', bagButton, false)).toBe(false)
  })
})
