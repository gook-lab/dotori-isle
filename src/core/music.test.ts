import { describe, expect, it } from 'vitest'
import {
  bgmGain, clampVolume, crossfadeGains, crossfadeProgress, CROSSFADE_SECONDS, INDOOR_SCALE, loopBeats, loopNotes, loopSeconds, msToNextHour, rainCutoff, scaleMidi, THEMES, themeAt, themeFingerprint,
} from './music'

describe('시간대별 테마', () => {
  it('아침 6~8시, 낮 9~16시, 저녁 17~19시, 밤 20~5시', () => {
    expect(themeAt(5)).toBe('night')
    expect(themeAt(6)).toBe('morning')
    expect(themeAt(8)).toBe('morning')
    expect(themeAt(9)).toBe('day')
    expect(themeAt(16)).toBe('day')
    expect(themeAt(17)).toBe('evening')
    expect(themeAt(19)).toBe('evening')
    expect(themeAt(20)).toBe('night')
    expect(themeAt(23)).toBe('night')
  })

  it('소수 시각은 그 시의 테마를 따른다(정각에 바뀐다)', () => {
    expect(themeAt(8.99)).toBe('morning')
    expect(themeAt(9)).toBe('day')
    expect(themeAt(-1)).toBe('night')
  })
})

describe('루프 음표', () => {
  it('네 테마 모두 8~16마디이고 길이가 정해져 있다', () => {
    for (const def of Object.values(THEMES)) {
      expect(def.bars).toBeGreaterThanOrEqual(8)
      expect(def.bars).toBeLessThanOrEqual(16)
      expect(loopBeats(def)).toBe(def.bars * 4)
      expect(loopSeconds(def)).toBeCloseTo((loopBeats(def) * 60) / def.bpm, 6)
    }
  })

  it('같은 테마는 늘 같은 멜로디이고, 테마끼리는 다르다', () => {
    const fp = Object.values(THEMES).map((d) => themeFingerprint(d))
    expect(new Set(fp).size).toBe(4)
    expect(loopNotes(THEMES.day)).toEqual(loopNotes(THEMES.day))
  })

  it('음표는 루프 안에 있고 시작 순서대로 놓인다', () => {
    for (const def of Object.values(THEMES)) {
      const notes = loopNotes(def)
      expect(notes.length).toBeGreaterThan(0)
      let last = -1
      for (const n of notes) {
        expect(n.beat).toBeGreaterThanOrEqual(0)
        expect(n.beat).toBeLessThan(loopBeats(def))
        expect(n.beat).toBeGreaterThanOrEqual(last)
        expect(n.dur).toBeGreaterThan(0)
        last = n.beat
      }
    }
  })

  it('음은 음계 안에서 고르고, 음역이 너무 벗어나지 않는다', () => {
    for (const def of Object.values(THEMES)) {
      for (const n of loopNotes(def)) {
        expect(n.midi).toBeGreaterThanOrEqual(def.root - 2)
        expect(n.midi).toBeLessThanOrEqual(def.root + 36)
        const pc = (n.midi - def.root + 1200) % 12
        expect(def.scale).toContain(pc)
      }
    }
  })

  it('음계 칸은 옥타브를 넘으면 한 옥타브 위로 올라간다', () => {
    expect(scaleMidi(THEMES.morning, 0)).toBe(67)
    expect(scaleMidi(THEMES.morning, 5)).toBe(79)
    expect(scaleMidi(THEMES.morning, -1)).toBe(64)
  })
})

describe('크로스페이드', () => {
  it('2초 동안 진행하고 그 뒤로는 끝난 값이다', () => {
    expect(CROSSFADE_SECONDS).toBe(2)
    expect(crossfadeProgress(0)).toBe(0)
    expect(crossfadeProgress(1)).toBe(0.5)
    expect(crossfadeProgress(5)).toBe(1)
    expect(crossfadeProgress(-1)).toBe(0)
  })

  it('처음엔 나가는 소리만, 끝에는 들어오는 소리만 난다', () => {
    const start = crossfadeGains(0)
    const end = crossfadeGains(1)
    expect(start.out).toBeCloseTo(1, 6)
    expect(start.in).toBeCloseTo(0, 6)
    expect(end.out).toBeCloseTo(0, 6)
    expect(end.in).toBeCloseTo(1, 6)
  })

  it('가운데에서도 합친 세기(등전력)가 1 을 유지한다', () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const g = crossfadeGains(p)
      expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1, 6)
    }
  })
})

describe('볼륨과 필터', () => {
  it('비 오는 날은 저역 통과로 낮추고, 맑은 날은 열어 둔다', () => {
    expect(rainCutoff(true)).toBeLessThan(1000)
    expect(rainCutoff(false)).toBeGreaterThan(15000)
  })

  it('실내에서는 배경음을 줄이고, 음소거면 0', () => {
    expect(bgmGain(0.8, false, false)).toBeCloseTo(0.8, 6)
    expect(bgmGain(0.8, true, false)).toBeCloseTo(0.8 * INDOOR_SCALE, 6)
    expect(bgmGain(0.8, false, true)).toBe(0)
  })

  it('볼륨은 0~1 로 자르고, 숫자가 아니면 기본값', () => {
    expect(clampVolume(2, 0.5)).toBe(1)
    expect(clampVolume(-3, 0.5)).toBe(0)
    expect(clampVolume('loud', 0.5)).toBe(0.5)
    expect(clampVolume(NaN, 0.5)).toBe(0.5)
  })

  it('다음 정각까지 남은 시간을 잰다', () => {
    expect(msToNextHour(new Date(2026, 9, 19, 14, 0, 0))).toBe(60 * 60 * 1000)
    expect(msToNextHour(new Date(2026, 9, 19, 14, 30, 0))).toBe(30 * 60 * 1000)
    expect(msToNextHour(new Date(2026, 9, 19, 14, 59, 59, 500))).toBe(500)
  })
})
