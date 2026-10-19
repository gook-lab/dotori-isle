/**
 * 효과음. 음원 파일 없이 WebAudio 로 그때그때 합성한다.
 * 브라우저 밖(테스트)이나 오디오가 막힌 환경에서는 아무 일도 하지 않는다.
 */

export type Sfx = 'shutter' | 'pop' | 'pick' | 'thud' | 'chop' | 'dig' | 'splash' | 'swish' | 'water' | 'bite' | 'success' | 'build' | 'talk' | 'fail' | 'coin' | 'open' | 'close' | 'bag' | 'catch' | 'door' | 'cast' | 'plop' | 'launch' | 'boom' | 'chime'

import { volumes } from './audioPrefs'

const MUTE_KEY = 'dotori-isle-mute'

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let muted = readMuted()
/** 효과음 모음 출력. 효과음 볼륨 설정을 여기서 한 번에 잡는다. */
let bus: GainNode | null = null
function sfxBus(c: AudioContext): GainNode {
  if (!bus) {
    bus = c.createGain()
    bus.connect(c.destination)
  }
  bus.gain.value = volumes().sfx
  return bus
}

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const isMuted = () => muted
export const noiseBuffer = () => noise

export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  } catch {
    // 저장이 막혀도 이번 세션 동안은 설정이 유지된다.
  }
}

/** 사용자가 처음 누르거나 클릭하기 전엔 오디오를 만들지 않는다. 만들면 브라우저가 막고 경고를 남긴다. */
let gestured = false
if (typeof window !== 'undefined') {
  const unlock = () => {
    gestured = true
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
}

export function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window) || !gestured) return null
  if (!ctx) {
    ctx = new AudioContext()
    // 1초 분량 백색 소음을 미리 만들어 타격·흙·물 소리에 돌려 쓴다.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  // 브라우저는 사용자 입력 전에는 오디오를 막아 두므로 소리 낼 때마다 깨운다.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slideTo?: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(sfxBus(c))
  // 소리가 끝나면 떼어 낸다. 떼지 않으면 끝난 노드가 destination 에 붙은 채 쌓여 오디오 그래프가 계속 커진다.
  o.onended = () => {
    o.disconnect()
    g.disconnect()
  }
  o.start(at)
  o.stop(at + dur + 0.02)
}

function hiss(c: AudioContext, at: number, dur: number, filter: BiquadFilterType, freq: number, gain = 0.25, sweepTo?: number) {
  if (!noise) return
  const src = c.createBufferSource()
  src.buffer = noise
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(sfxBus(c))
  src.onended = () => {
    src.disconnect()
    f.disconnect()
    g.disconnect()
  }
  src.start(at, Math.random() * 0.5)
  src.stop(at + dur + 0.02)
}

export function play(name: Sfx) {
  if (muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  switch (name) {
    case 'shutter':
      // 셔터 딸깍: 짧고 높은 사각파가 빠르게 내려간다
      return tone(c, 1500, t, 0.05, 'square', 0.1, 500)
    case 'pop':
      return tone(c, 380, t, 0.12, 'sine', 0.16, 760)
    case 'pick':
      tone(c, 660, t, 0.08, 'triangle', 0.14)
      return tone(c, 990, t + 0.06, 0.12, 'triangle', 0.12)
    case 'thud':
      tone(c, 140, t, 0.18, 'sine', 0.3, 60)
      return hiss(c, t, 0.12, 'bandpass', 1800, 0.3)
    case 'chop':
      tone(c, 220, t, 0.1, 'square', 0.06, 120)
      return hiss(c, t, 0.15, 'bandpass', 900, 0.35)
    case 'dig':
      return hiss(c, t, 0.28, 'lowpass', 900, 0.4, 250)
    case 'splash':
      return hiss(c, t, 0.45, 'highpass', 1200, 0.3, 4000)
    case 'swish':
      return hiss(c, t, 0.22, 'bandpass', 600, 0.25, 3000)
    case 'water':
      return hiss(c, t, 0.8, 'highpass', 2500, 0.12)
    case 'bite':
      tone(c, 880, t, 0.06, 'square', 0.08)
      return tone(c, 880, t + 0.1, 0.06, 'square', 0.08)
    case 'success':
      return [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.22, 'triangle', 0.14))
    case 'build':
      return [392, 523, 659, 784, 659, 1047].forEach((f, i) => tone(c, f, t + i * 0.1, 0.3, 'triangle', 0.14))
    case 'talk':
      return [0, 1, 2].forEach((i) => tone(c, 500 + Math.random() * 300, t + i * 0.07, 0.06, 'sine', 0.08))
    case 'fail':
      return tone(c, 300, t, 0.25, 'triangle', 0.12, 150)
    case 'open':
      // 창을 열 때: 짧게 올라가는 두 음
      tone(c, 660, t, 0.07, 'sine', 0.08)
      return tone(c, 990, t + 0.05, 0.1, 'sine', 0.07)
    case 'close':
      tone(c, 880, t, 0.06, 'sine', 0.07)
      return tone(c, 587, t + 0.05, 0.09, 'sine', 0.06)
    case 'door':
      // 끼익 열리고 딸랑
      tone(c, 220, t, 0.25, 'sawtooth', 0.025, 330)
      tone(c, 1568, t + 0.12, 0.35, 'sine', 0.06)
      return tone(c, 2093, t + 0.18, 0.4, 'sine', 0.04)
    case 'bag':
      // 주머니 부스럭
      return hiss(c, t, 0.14, 'bandpass', 2200, 0.12, 900)
    case 'catch':
      // 잡았다! 빠밤~ 하고 올라가는 팡파르
      ;[523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.07, 0.12, 'square', 0.05))
      tone(c, 1047, t + 0.22, 0.45, 'triangle', 0.14)
      return tone(c, 1319, t + 0.22, 0.45, 'sine', 0.06)
    case 'cast':
      // 낚싯줄이 휙 풀리며 바람을 가른다
      return hiss(c, t, 0.28, 'bandpass', 500, 0.18, 2400)
    case 'plop':
      // 찌가 수면에 떨어지는 퐁
      tone(c, 520, t, 0.14, 'sine', 0.18, 180)
      return hiss(c, t, 0.12, 'lowpass', 1400, 0.16)
    case 'launch':
      // 폭죽이 쉭 하고 올라가는 소리
      return hiss(c, t, 0.9, 'bandpass', 400, 0.12, 2200)
    case 'boom':
      // 낮고 둥근 펑 소리에 쉿 하는 잔향
      tone(c, 110, t, 0.5, 'sine', 0.35, 40)
      return hiss(c, t, 0.45, 'lowpass', 900, 0.3, 200)
    case 'coin':
      tone(c, 988, t, 0.08, 'square', 0.06)
      return tone(c, 1319, t + 0.07, 0.2, 'square', 0.06)
    case 'chime':
      // 마을 방송 차임: 높은 두 음을 맑게 이어서
      tone(c, 1046, t, 0.7, 'sine', 0.14)
      return tone(c, 1568, t + 0.22, 0.9, 'sine', 0.11)
  }
}

/** 주민 목소리. 글자 하나마다 짧은 음을 내서 동물들이 웅얼웅얼 말하는 것처럼 들리게 한다. */
export interface Voice {
  /** 기준 음높이(Hz) */
  base: number
  wave: OscillatorType
  gain: number
  /** 한 음 길이(초) */
  dur: number
  /** 글자마다 음높이가 오르내리는 폭(반음) */
  range: number
}

const DEFAULT_VOICE: Voice = { base: 520, wave: 'triangle', gain: 0.07, dur: 0.06, range: 5 }

export const VOICES: Record<string, Voice> = {
  // 작고 여린 솜이는 높고 가늘게, 유자는 높고 날카롭게 빽빽
  somi: { base: 880, wave: 'sine', gain: 0.06, dur: 0.05, range: 3 },
  yuja: { base: 980, wave: 'square', gain: 0.035, dur: 0.045, range: 9 },
  soda: { base: 620, wave: 'triangle', gain: 0.07, dur: 0.06, range: 6 },
  bori: { base: 760, wave: 'sawtooth', gain: 0.03, dur: 0.05, range: 7 },
  maro: { base: 300, wave: 'triangle', gain: 0.09, dur: 0.08, range: 3 },
  coco: { base: 380, wave: 'triangle', gain: 0.08, dur: 0.07, range: 4 },
  mocha: { base: 560, wave: 'triangle', gain: 0.07, dur: 0.06, range: 5 },
  bomi: { base: 720, wave: 'sine', gain: 0.08, dur: 0.055, range: 6 },
  pengdol: { base: 440, wave: 'square', gain: 0.03, dur: 0.06, range: 4 },
  guriguri: { base: 340, wave: 'triangle', gain: 0.08, dur: 0.07, range: 3 },
  dongri: { base: 660, wave: 'sine', gain: 0.08, dur: 0.055, range: 5 },
  sora: { base: 640, wave: 'square', gain: 0.03, dur: 0.05, range: 6 },
  toto: { base: 420, wave: 'sine', gain: 0.09, dur: 0.08, range: 3 },
  kongi: { base: 820, wave: 'sine', gain: 0.07, dur: 0.05, range: 4 },
  mimi: { base: 700, wave: 'triangle', gain: 0.07, dur: 0.06, range: 5 },
  gomdol: { base: 280, wave: 'triangle', gain: 0.09, dur: 0.07, range: 5 },
  darami: { base: 900, wave: 'triangle', gain: 0.06, dur: 0.045, range: 8 },
  bamtol: { base: 330, wave: 'sawtooth', gain: 0.03, dur: 0.07, range: 4 },
  chumbung: { base: 460, wave: 'triangle', gain: 0.08, dur: 0.06, range: 7 },
  player: { base: 600, wave: 'triangle', gain: 0.07, dur: 0.055, range: 5 },
  pelican: { base: 240, wave: 'sawtooth', gain: 0.035, dur: 0.08, range: 4 },
}

export const voiceOf = (id: string) => VOICES[id] ?? DEFAULT_VOICE

/** 글자 하나를 웅얼거린다. 같은 글자는 늘 같은 음이라 말투처럼 들린다. 문장부호와 빈칸은 소리를 내지 않는다. */
export function babble(voice: Voice, ch: string, last = false, loud = 1) {
  if (muted || !/[가-힣a-zA-Z0-9ㄱ-ㅎ]/.test(ch)) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const step = (ch.charCodeAt(0) * 7) % (voice.range * 2 + 1) - voice.range
  const f = voice.base * 2 ** (step / 12)
  // 끝 글자는 살짝 끌어올려 말끝이 올라가는 느낌을 준다.
  tone(c, f, t, voice.dur, voice.wave, voice.gain * loud, last ? f * 1.25 : f * 0.92)
  tone(c, f * 2, t, voice.dur * 0.6, 'sine', voice.gain * 0.35 * loud)
}

export type Footing = 'grass' | 'sand' | 'wood' | 'snow'

/** 발소리. 잔디는 사박, 모래는 서걱, 부두 나무는 통, 눈밭은 뽀득. */
export function footstep(on: Footing, loud = 1) {
  if (muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const v = 0.6 + Math.random() * 0.4
  switch (on) {
    case 'grass':
      return hiss(c, t, 0.07, 'lowpass', 900 * v, 0.07 * loud)
    case 'sand':
      return hiss(c, t, 0.08, 'bandpass', 2400 * v, 0.06 * loud)
    case 'wood':
      tone(c, 170 * v, t, 0.07, 'triangle', 0.08 * loud, 120)
      return hiss(c, t, 0.04, 'bandpass', 1200, 0.04 * loud)
    case 'snow':
      return hiss(c, t, 0.1, 'bandpass', 1500 * v, 0.08 * loud, 700)
  }
}
