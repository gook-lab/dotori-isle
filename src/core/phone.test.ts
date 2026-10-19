import { describe, expect, it } from 'vitest'
import { phoneApps } from './phone'

const ids = (c: { photoOpen: boolean; sunday: boolean; inHome?: boolean }) => phoneApps({ inHome: false, ...c }).map((a) => a.id)

describe('휴대폰 앱 목록', () => {
  it('always shows the core apps in order', () => {
    expect(ids({ photoOpen: true, sunday: false })).toEqual(['quest', 'dex', 'map', 'miles', 'calendar', 'life', 'photo', 'album', 'closet', 'design', 'help', 'settings', 'notices'])
  })

  it('keeps the camera visible but locked until photo mode opens', () => {
    const locked = (c: { photoOpen: boolean; sunday: boolean }) => phoneApps({ inHome: false, ...c }).find((a) => a.id === 'photo')?.locked
    expect(locked({ photoOpen: false, sunday: false })).toBe(true)
    expect(locked({ photoOpen: true, sunday: false })).toBe(false)
    expect(ids({ photoOpen: false, sunday: false })).toContain('photo')
  })

  it('adds the songi merchant app only on Sunday', () => {
    expect(ids({ photoOpen: false, sunday: true })).toContain('songi')
    expect(ids({ photoOpen: false, sunday: false })).not.toContain('songi')
  })
})

describe('꾸미기 점수 앱', () => {
  it('shows the decorating score only inside the house', () => {
    expect(ids({ photoOpen: false, sunday: false, inHome: true })).toContain('homeScore')
    expect(ids({ photoOpen: false, sunday: false, inHome: false })).not.toContain('homeScore')
  })
})
