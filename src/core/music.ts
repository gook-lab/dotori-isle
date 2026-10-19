/**
 * 시간대 배경음악의 순수 계산: 어느 테마를 틀지, 루프 음표, 크로스페이드 세기, 볼륨 값.
 * 소리를 실제로 내는 것은 game/music.ts 가 맡는다. 여기엔 WebAudio 가 없어서 테스트로 확인할 수 있다.
 */

import { hashString, mulberry32 } from './rng'

export type Theme = 'morning' | 'day' | 'evening' | 'night'

export interface Note {
  /** 루프 안에서 시작하는 박(0부터) */
  beat: number
  /** MIDI 음 번호 */
  midi: number
  /** 길이(박) */
  dur: number
}

export interface ThemeDef {
  id: Theme
  name: string
  bpm: number
  /** 으뜸음(MIDI) */
  root: number
  /** 음계: 으뜸음부터의 반음 간격 */
  scale: readonly number[]
  /** 마디마다 화음의 뿌리 음 위치(음계 칸 번호). 길이만큼 되풀이한다. */
  progression: readonly number[]
  /** 루프 마디 수(8~16) */
  bars: number
  /** 한 박에 음이 울릴 확률 */
  density: number
  seed: number
}

/** 네 테마. 아침은 맑은 장조 오르골, 낮은 밝은 마림바풍, 저녁은 단조 마림바, 밤은 느린 도리안 패드. */
export const THEMES: Record<Theme, ThemeDef> = {
  morning: { id: 'morning', name: '아침 오르골', bpm: 96, root: 67, scale: [0, 2, 4, 7, 9], progression: [0, 3, 4, 0], bars: 8, density: 0.7, seed: 11 },
  day: { id: 'day', name: '낮 마림바', bpm: 110, root: 64, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 3, 4, 0], bars: 8, density: 0.6, seed: 22 },
  evening: { id: 'evening', name: '저녁 마림바', bpm: 84, root: 62, scale: [0, 3, 5, 7, 10], progression: [0, 4, 2, 3], bars: 8, density: 0.6, seed: 33 },
  night: { id: 'night', name: '밤 패드', bpm: 70, root: 57, scale: [0, 2, 3, 5, 7, 9, 10], progression: [0, 0, 5, 3], bars: 16, density: 0.4, seed: 44 },
}

/** 시각(정수 시)으로 어느 테마인지. 아침 6~9시, 낮 10~16시, 저녁 17~19시, 밤 20~5시. */
export function themeAt(hour: number): Theme {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 6 && h < 9) return 'morning'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}

/** 음계 칸 번호(음계를 넘어가면 옥타브가 올라간다)를 MIDI 음으로 */
export function scaleMidi(def: ThemeDef, degree: number): number {
  const n = def.scale.length
  const octave = Math.floor(degree / n)
  const idx = ((degree % n) + n) % n
  return def.root + octave * 12 + def.scale[idx]
}

/** 한 루프의 음표. 같은 테마는 언제나 같은 멜로디다(씨앗 고정). 화음 음만 쓰고, 가끔 쉰다. */
export function loopNotes(def: ThemeDef): Note[] {
  const rng = mulberry32(def.seed)
  const out: Note[] = []
  for (let bar = 0; bar < def.bars; bar++) {
    const root = def.progression[bar % def.progression.length] % def.scale.length
    // 화음 음: 뿌리, 셋째, 다섯째 칸
    const chord = [root, root + 2, root + 4]
    for (let beat = 0; beat < 4; beat++) {
      if (rng() > def.density) continue
      const pick = chord[Math.floor(rng() * chord.length)]
      // 가끔 한 옥타브 위로 올린다
      const degree = rng() < 0.25 ? pick + def.scale.length : pick
      out.push({ beat: bar * 4 + beat, midi: scaleMidi(def, degree), dur: rng() < 0.3 ? 0.5 : 1 })
    }
  }
  return out
}

/** 루프 길이(박) */
export function loopBeats(def: ThemeDef): number {
  return def.bars * 4
}

/** 루프 길이(초) */
export function loopSeconds(def: ThemeDef): number {
  return (loopBeats(def) * 60) / def.bpm
}

export const CROSSFADE_SECONDS = 2

/** 크로스페이드 진행(0~1)에 따른 나가는 소리와 들어오는 소리의 세기. 등전력 곡선이라 가운데서 소리가 꺼지지 않는다. */
export function crossfadeGains(progress: number): { out: number; in: number } {
  const p = Math.min(1, Math.max(0, progress))
  return { out: Math.cos((p * Math.PI) / 2), in: Math.sin((p * Math.PI) / 2) }
}

/** 경과 초로 크로스페이드 진행을 구한다 */
export function crossfadeProgress(elapsed: number, duration = CROSSFADE_SECONDS): number {
  return Math.min(1, Math.max(0, elapsed / duration))
}

/** 비 오는 날 저역 통과 필터 차단 주파수(Hz). 맑은 날엔 사실상 열어 둔다. */
export function rainCutoff(raining: boolean): number {
  return raining ? 700 : 20000
}

/** 실내(집·박물관·주민 집)에서는 배경음을 낮춘다 */
export const INDOOR_SCALE = 0.45

/** 배경음 최종 세기. 음소거면 0, 실내면 줄인다. */
export function bgmGain(volume: number, indoors: boolean, muted: boolean): number {
  if (muted) return 0
  return clampVolume(volume, 0) * (indoors ? INDOOR_SCALE : 1)
}

/** 볼륨 값을 0~1 로. 숫자가 아니면 기본값을 준다. */
export function clampVolume(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(1, Math.max(0, v))
}

/** 다음 정각(매시 0분 0초)까지 남은 밀리초 */
export function msToNextHour(now: Date): number {
  const next = new Date(now.getTime())
  next.setMinutes(60, 0, 0)
  return next.getTime() - now.getTime()
}

/** 테마가 같은 씨앗으로 늘 같은 소리인지 확인할 때 쓴다 */
export function themeFingerprint(def: ThemeDef): number {
  return hashString(loopNotes(def).map((n) => `${n.beat}:${n.midi}:${n.dur}`).join('|'))
}
