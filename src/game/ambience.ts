import { ECHO, birdsOn, dripsPerSecond, isNight, nightCallsOn, rainVolume, waveVolume, windVolume } from '../core/soundscape'
import type { WindLevel } from '../core/wind'
import { volumes } from './audioPrefs'
import { audio, isMuted, noiseBuffer } from './sfx'

/**
 * 섬 소리 풍경. 음원 없이 WebAudio 로 합성한다. 배경음악은 game/music.ts 가 맡는다.
 * 파도(물가 거리), 바람(바람 날), 빗소리(비·태풍), 개울·폭포(가까이 갈수록), 낮 새, 밤 풀벌레와 부엉이,
 * 동굴 물방울(메아리 포함), 눈 바람, 집 안 울림, 전시관 고요, 수조 거품이다.
 * 세기 규칙은 core/soundscape.ts 에 있다. 전체 음량은 효과음 볼륨 설정을 따르고 음소거와 연동한다.
 */

let master: GainNode | null = null
let echo: GainNode | null = null
let waves: GainNode | null = null
let wind: GainNode | null = null
let rain: GainNode | null = null
let brook: GainNode | null = null
let falls: GainNode | null = null
let snow: GainNode | null = null
let roomTone: GainNode | null = null
let hush: GainNode | null = null
let nextBird = 0
let nextCricket = 0
let nextOwl = 0
let nextBubble = 0
let nextDrip = 0

function loopNoise(c: AudioContext, filter: BiquadFilterType, freq: number, out: AudioNode): GainNode {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer()
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.value = 0
  src.connect(f).connect(g).connect(out)
  src.start()
  return g
}

/** 첫 입력 뒤에 한 번 부른다. 브라우저는 사용자 입력 전 소리를 막는다. */
export function startAmbience() {
  if (master) return
  const c = audio()
  if (!c || !noiseBuffer()) return
  master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)
  // 동굴 메아리: 물방울이 되돌아오는 짧은 지연선. 되울림이 점점 줄어든다.
  echo = c.createGain()
  const delay = c.createDelay(1)
  delay.delayTime.value = ECHO.delay
  const feedback = c.createGain()
  feedback.gain.value = ECHO.feedback
  echo.connect(delay).connect(feedback).connect(delay)
  delay.connect(master)
  echo.connect(master)
  waves = loopNoise(c, 'lowpass', 420, master)
  rain = loopNoise(c, 'highpass', 1600, master)
  brook = loopNoise(c, 'bandpass', 1300, master)
  falls = loopNoise(c, 'lowpass', 900, master)
  wind = loopNoise(c, 'lowpass', 700, master)
  // 눈 오는 날의 바람: 낮게 깔리는 숨소리 같은 소음. 느린 LFO 로 바람이 세졌다 약해졌다 한다.
  const gust = c.createGain()
  gust.gain.value = 0.6
  gust.connect(master)
  snow = loopNoise(c, 'lowpass', 520, gust)
  // 집 안의 방 울림: 아주 낮고 부드러운 웅얼거림. 바깥 소리 대신 깔린다.
  roomTone = loopNoise(c, 'lowpass', 260, master)
  // 전시관의 고요: 숨을 죽인 듯 얇고 높은 바람 소리
  hush = loopNoise(c, 'lowpass', 700, master)
  const gustLfo = c.createOscillator()
  const gustDepth = c.createGain()
  gustLfo.frequency.value = 0.07
  gustDepth.gain.value = 0.35
  gustLfo.connect(gustDepth).connect(gust.gain)
  gustLfo.start()
  // 개발 중에만: 눈 바람 음량을 콘솔에서 확인한다.
  if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __ambience: { snow: () => snow?.gain.value ?? 0 } })
}

function note(c: AudioContext, out: AudioNode, freq: number, at: number, dur: number, wave: OscillatorType, gain: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = wave
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** 눈 바람의 목표 음량. 비(0.05)보다 훨씬 작고, 밤엔 더 가라앉고, 집 안에선 거의 안 들린다. */
export const snowLevel = (weather: AmbienceState['weather'], indoor: boolean, night: boolean) => (weather !== 'snow' ? 0 : indoor ? 0.006 : night ? 0.016 : 0.022)

export interface AmbienceState {
  hour: number
  /** 0(섬 한가운데)~1(물가) */
  shore: number
  weather: 'sunny' | 'cloudy' | 'rain' | 'snow'
  /** 오늘의 바람: 바람 날·태풍이면 바람 소리가 든다 */
  wind: WindLevel
  /** 집 안: 새·풀벌레는 안 들리고 빗소리는 먹먹하다 */
  indoor?: boolean
  /** 동굴 안: 물방울과 메아리 */
  cave?: boolean
  /** 0~1: 개울가에 가까울수록 졸졸 소리가 커진다 */
  brook?: number
  /** 0~1: 폭포에 가까울수록 쏴아 소리가 커진다 */
  falls?: number
  /** 자연사 전시관 안: 고요한 울림과 수조 거품 소리 */
  museum?: boolean
  /** 0~1: 수조에 가까울수록 거품 소리가 잦고 커진다 */
  bubble?: number
}

/** 수조 거품 세기. 가까울수록 1, 멀어지면 0. range 칸 안에서 선형으로 준다. */
export const bubbleLevel = (dist: number, range = 4) => Math.max(0, Math.min(1, 1 - dist / range))

/** 한 음을 짧게 톡 떨어뜨린다. 동굴에서는 메아리 쪽으로도 보낸다. */
function drip(c: AudioContext, at: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  const f = 1500 + Math.random() * 700
  o.frequency.setValueAtTime(f, at)
  o.frequency.exponentialRampToValueAtTime(f * 0.55, at + 0.12)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.05, at + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
  o.connect(g)
  g.connect(master!)
  g.connect(echo!)
  o.start(at)
  o.stop(at + 0.18)
}

/** 매 프레임 부른다. 음량을 부드럽게 맞추고, 새·풀벌레·물방울 소리를 확률로 예약한다. */
export function updateAmbience(st: AmbienceState) {
  const c = audio()
  if (!c || !master || !waves || !rain || !snow || !wind) return
  const t = c.currentTime
  // 효과음 볼륨 설정을 따르고, 음소거면 0 으로 내린다
  master.gain.setTargetAtTime(isMuted() ? 0 : volumes().sfx, t, 0.3)
  const indoor = !!st.indoor || !!st.cave
  waves.gain.setTargetAtTime(waveVolume(st.shore, st.wind), t, 0.5)
  rain.gain.setTargetAtTime(rainVolume(st.weather, st.wind, indoor), t, 0.8)
  // 바람은 느리게 세졌다 약해졌다 한다
  const breath = 0.8 + Math.sin(t * 0.37) * 0.2
  wind.gain.setTargetAtTime(windVolume(st.wind, indoor) * breath, t, 1.2)
  // 졸졸: 소리 크기를 조금씩 흔들어 물이 굽이치는 느낌을 낸다.
  const babble = 0.75 + Math.sin(t * 5.3) * 0.15 + Math.sin(t * 8.9) * 0.1
  brook?.gain.setTargetAtTime((st.brook ?? 0) * 0.05 * babble, t, 0.08)
  falls?.gain.setTargetAtTime((st.falls ?? 0) * 0.12, t, 0.4)

  const hour = Math.floor(st.hour)
  const night = isNight(hour)
  snow.gain.setTargetAtTime(snowLevel(st.weather, indoor, night), t, 1.5)
  roomTone?.gain.setTargetAtTime(st.indoor && !st.museum ? 0.02 : 0, t, 0.8)
  hush?.gain.setTargetAtTime(st.museum ? 0.012 : 0, t, 0.8)

  if (birdsOn(hour, st.weather, indoor) && t > nextBird) {
    // 짹짹: 짧게 올라갔다 내려오는 높은 음 두세 번
    const base = 2600 + Math.random() * 1400
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      const at = t + i * 0.11
      o.frequency.setValueAtTime(base, at)
      o.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.04)
      o.frequency.exponentialRampToValueAtTime(base * 0.9, at + 0.08)
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.018 * (1 - st.shore * 0.5), at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
      o.connect(g).connect(master)
      o.start(at)
      o.stop(at + 0.12)
    }
    nextBird = t + 2 + Math.random() * 4
  }
  // 거품: 수조 가까이 서면 잔잔한 방울 소리가 잦아진다
  const bubble = st.museum ? st.bubble ?? 0 : 0
  if (bubble > 0.05 && t > nextBubble) {
    // 물방울이 올라가듯 음이 살짝 올라가는 짧은 blip
    const f = 700 + Math.random() * 700
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.02 * bubble, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.09)
    nextBubble = t + (0.3 + Math.random() * 0.9) / bubble
  }
  if (nightCallsOn(hour, st.weather, indoor)) {
    if (t > nextCricket) {
      // 귀뚤귀뚤: 높은 음을 빠르게 세 번 떤다
      for (let i = 0; i < 3; i++) note(c, master, 4700, t + i * 0.045, 0.03, 'sine', 0.008)
      nextCricket = t + 0.7 + Math.random() * 0.6
    }
    if (t > nextOwl) {
      // 부엉: 낮은 음 두 번, 뒤의 음이 더 길고 낮다. 드물게 운다.
      note(c, master, 420, t, 0.5, 'sine', 0.02)
      note(c, master, 350, t + 0.7, 0.8, 'sine', 0.02)
      nextOwl = t + 9 + Math.random() * 8
    }
  }
  const rate = dripsPerSecond(!!st.cave)
  if (rate > 0 && t > nextDrip) {
    drip(c, t)
    // 떨어지는 간격은 들쭉날쭉하게: 평균 1/rate 초
    nextDrip = t + (1 / rate) * (0.4 + Math.random() * 1.2)
  }
}
