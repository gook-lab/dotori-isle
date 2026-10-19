import { describe, expect, it } from 'vitest'
import { birdsOn, dripsPerSecond, isNight, nightCallsOn, proximity, rainVolume, waveVolume, windVolume } from './soundscape'

describe('거리 감쇠', () => {
  it('가까울수록 크고 범위 밖에서는 0이다', () => {
    expect(proximity(0, 8)).toBe(1)
    expect(proximity(4, 8)).toBeCloseTo(0.25)
    expect(proximity(9, 8)).toBe(0)
  })

  it('가까워질수록 급하게 커진다(선형보다 작은 거리에서 크다)', () => {
    expect(proximity(4, 8)).toBeLessThan(0.5)
  })
})

describe('파도', () => {
  it('물가에 가까울수록, 태풍일수록 커진다', () => {
    expect(waveVolume(1, 'calm')).toBeGreaterThan(waveVolume(0, 'calm'))
    expect(waveVolume(0.5, 'typhoon')).toBeGreaterThan(waveVolume(0.5, 'breeze'))
    expect(waveVolume(0.5, 'breeze')).toBeGreaterThan(waveVolume(0.5, 'calm'))
  })
})

describe('바람 소리', () => {
  it('바람 날에만 들리고, 태풍이 가장 세며, 집 안에선 거의 없다', () => {
    expect(windVolume('calm', false)).toBe(0)
    expect(windVolume('breeze', false)).toBeGreaterThan(0)
    expect(windVolume('typhoon', false)).toBeGreaterThan(windVolume('breeze', false))
    expect(windVolume('typhoon', true)).toBeLessThan(windVolume('breeze', false))
  })
})

describe('빗소리', () => {
  it('비 오는 날에만 들리고, 태풍 비가 더 세며, 집 안은 먹먹하다', () => {
    expect(rainVolume('sunny', 'calm', false)).toBe(0)
    expect(rainVolume('rain', 'calm', false)).toBeGreaterThan(0)
    expect(rainVolume('rain', 'typhoon', false)).toBeGreaterThan(rainVolume('rain', 'calm', false))
    expect(rainVolume('rain', 'calm', true)).toBeLessThan(rainVolume('rain', 'calm', false))
  })
})

describe('새와 밤 풀벌레', () => {
  it('낮 바깥에서는 새가, 밤 바깥에서는 풀벌레와 부엉이가 운다', () => {
    expect(birdsOn(12, 'sunny', false)).toBe(true)
    expect(birdsOn(22, 'sunny', false)).toBe(false)
    expect(nightCallsOn(22, 'sunny', false)).toBe(true)
    expect(nightCallsOn(12, 'sunny', false)).toBe(false)
  })

  it('비·눈 오거나 집 안이면 울지 않는다', () => {
    expect(birdsOn(12, 'rain', false)).toBe(false)
    expect(birdsOn(12, 'sunny', true)).toBe(false)
    expect(nightCallsOn(22, 'snow', false)).toBe(false)
    expect(nightCallsOn(22, 'sunny', true)).toBe(false)
  })

  it('밤은 5시 전과 19시 뒤다', () => {
    expect(isNight(4.9)).toBe(true)
    expect(isNight(5)).toBe(false)
    expect(isNight(18.9)).toBe(false)
    expect(isNight(19)).toBe(true)
  })
})

describe('동굴 물방울', () => {
  it('동굴 안에서만 떨어진다', () => {
    expect(dripsPerSecond(true)).toBeGreaterThan(0)
    expect(dripsPerSecond(false)).toBe(0)
  })
})
