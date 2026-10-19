import { describe, expect, it } from 'vitest'
import { indoorKind, isIndoor, type IndoorFlags } from './indoor'

const OUT: IndoorFlags = { inside: null, inHome: false, inMuseum: false, inHall: false, inCave: false }

describe('실내 판단 한 곳', () => {
  it('바깥이면 실내가 아니다', () => {
    expect(indoorKind(OUT)).toBeNull()
    expect(isIndoor(OUT)).toBe(false)
  })

  it('실내마다 종류를 돌려준다', () => {
    expect(indoorKind({ ...OUT, inside: 'ruby' })).toBe('inside')
    expect(indoorKind({ ...OUT, inHome: true })).toBe('home')
    expect(indoorKind({ ...OUT, inMuseum: true })).toBe('museum')
    expect(indoorKind({ ...OUT, inHall: true })).toBe('hall')
    expect(indoorKind({ ...OUT, inCave: true })).toBe('cave')
    expect(indoorKind({ ...OUT, inShop: true })).toBe('shop')
  })

  it('상점 플래그가 없어도(예전 상태) 바깥으로 본다', () => {
    expect(isIndoor({ ...OUT, inShop: undefined })).toBe(false)
  })
})
