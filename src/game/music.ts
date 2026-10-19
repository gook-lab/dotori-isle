import { isIndoor } from './indoor'
/**
 * 시간대 배경음악. 음원 파일 없이 WebAudio 오르골·마림바·패드 음색으로 짧은 루프를 합성한다.
 * 정각마다 테마가 바뀌면 2초 크로스페이드한다. 비 오는 날은 저역 통과로 먹먹하게, 실내에선 작게.
 * 계산(테마·루프·세기)은 core/music.ts 에 있다.
 */

import { currentHour } from '../core/clock'
import { bgmGain, CROSSFADE_SECONDS, loopNotes, loopSeconds, type Note, rainCutoff, THEMES, themeAt, type Theme, type ThemeDef } from '../core/music'
import { weatherFor } from '../core/weather'
import { volumes } from './audioPrefs'
import { audio, isMuted } from './sfx'
import { useGame } from './store'

const TICK_MS = 200
/** 소리는 이만큼 앞서 예약한다(초) */
const AHEAD = 0.25
/** 악기 세기의 최고값. 배경음은 아주 작게 깔리는 편이다. */
const PEAK = 0.16

interface Layer {
  def: ThemeDef
  notes: Note[]
  gain: GainNode
  /** 첫 루프가 시작하는 시각(오디오 시계) */
  t0: number
  /** 다음에 예약할 루프 번호 */
  cycle: number
  /** 사라지기 시작한 시각. 없으면 지금 테마다. */
  fadeOutAt: number | null
}

let lowpass: BiquadFilterNode | null = null
let master: GainNode | null = null
let layers: Layer[] = []
let current: Theme | null = null
let timer: ReturnType<typeof setInterval> | null = null

const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** 크로스페이드 곡선(들어옴 sin, 나감 cos). 등전력이라 가운데서 소리가 꺼지지 않는다. */
function curve(into: boolean): Float32Array {
  const n = 64
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1)
    out[i] = into ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2)
  }
  return out
}

function ensureGraph(c: AudioContext) {
  if (master) return
  lowpass = c.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.Q.value = 0.7
  lowpass.frequency.value = 20000
  master = c.createGain()
  master.gain.value = 0
  lowpass.connect(master)
  master.connect(c.destination)
}

/** 한 음을 악기 음색으로 울린다. 음색은 테마마다 다르다. */
function voice(c: AudioContext, dest: GainNode, freq: number, at: number, dur: number, theme: Theme) {
  const env = c.createGain()
  env.connect(dest)
  const add = (type: OscillatorType, f: number, peak: number, attack: number, ring: number) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
    o.connect(g).connect(env)
    o.start(at)
    o.stop(at + ring + 0.05)
    o.onended = () => {
      o.disconnect()
      g.disconnect()
    }
  }
  if (theme === 'morning' || theme === 'day') {
    // 오르골: 맑은 사인에 옥타브 위 삼각파가 살짝 얹힌다
    add('sine', freq, PEAK, 0.01, Math.max(dur * 1.6, 1.2))
    add('triangle', freq * 2, PEAK * 0.25, 0.01, Math.max(dur, 0.6))
  } else if (theme === 'evening') {
    // 마림바: 짧게 치고 빨리 죽는 사인, 배음은 더 짧게
    add('sine', freq, PEAK, 0.005, Math.max(dur, 0.5))
    add('sine', freq * 4, PEAK * 0.15, 0.003, 0.12)
  } else {
    // 밤 패드: 느리게 차오르고 길게 남는 삼각파
    add('triangle', freq, PEAK * 0.7, 0.15, Math.max(dur * 1.5, 1.6))
    add('sine', freq * 2, PEAK * 0.15, 0.2, Math.max(dur * 1.5, 1.6))
  }
  // 음이 다 울리면 연결을 떼어 그래프가 쌓이지 않게 한다
  setTimeout(() => env.disconnect(), (Math.max(dur, 1.6) + 0.5) * 1000)
}

function startLayer(c: AudioContext, def: ThemeDef, at: number): Layer {
  const gain = c.createGain()
  gain.gain.value = 0
  gain.connect(lowpass!)
  return { def, notes: loopNotes(def), gain, t0: at + 0.05, cycle: 0, fadeOutAt: null }
}

/** 아직 예약하지 않은 루프를 AHEAD 안까지 예약한다 */
function scheduleLoops(c: AudioContext, l: Layer, now: number) {
  const len = loopSeconds(l.def)
  const beat = 60 / l.def.bpm
  while (l.t0 + l.cycle * len < now + AHEAD) {
    const base = l.t0 + l.cycle * len
    for (const n of l.notes) voice(c, l.gain, midiFreq(n.midi), base + n.beat * beat, n.dur * beat, l.def.id)
    l.cycle++
  }
}

function tick() {
  const c = audio()
  if (!c) return
  ensureGraph(c)
  const now = c.currentTime
  const theme = themeAt(Math.floor(currentHour()))
  if (theme !== current) {
    // 정각에 바뀌면: 나가는 테마는 줄이고, 들어오는 테마는 키운다
    for (const l of layers) {
      if (l.fadeOutAt !== null) continue
      l.fadeOutAt = now
      l.gain.gain.setValueCurveAtTime(curve(false), now, CROSSFADE_SECONDS)
    }
    const next = startLayer(c, THEMES[theme], now)
    next.gain.gain.setValueCurveAtTime(curve(true), now, CROSSFADE_SECONDS)
    layers.push(next)
    current = theme
  }
  // 다 사라진 테마는 떼어 낸다
  layers = layers.filter((l) => {
    if (l.fadeOutAt !== null && now > l.fadeOutAt + CROSSFADE_SECONDS + 0.2) {
      l.gain.disconnect()
      return false
    }
    return true
  })
  for (const l of layers) if (l.fadeOutAt === null) scheduleLoops(c, l, now)
  // 실내·비·음소거에 맞춰 전체 세기와 필터를 부드럽게 바꾼다
  const s = useGame.getState()
  const indoors = isIndoor(s)
  const raining = weatherFor(s.day) === 'rain'
  master!.gain.setTargetAtTime(bgmGain(volumes().bgm, indoors, isMuted()), now, 0.05)
  lowpass!.frequency.setTargetAtTime(rainCutoff(raining), now, 0.3)
  // 개발 중 크로스페이드 확인용: 지금 테마와 층마다 게인 값을 남긴다
  if (import.meta.env.DEV) {
    ;(window as unknown as { __music: unknown }).__music = {
      current,
      layers: layers.map((l) => ({ theme: l.def.id, gain: Number(l.gain.gain.value.toFixed(3)), fadeOutAt: l.fadeOutAt })),
      at: now,
    }
  }
}

/** 배경음 루프를 켠다. 여러 번 불러도 한 번만 돈다. 오디오가 아직 막혀 있으면 조용히 기다린다. */
export function startMusicLoop() {
  if (timer || typeof window === 'undefined') return
  timer = setInterval(tick, TICK_MS)
}

/** 테스트나 화면을 떠날 때 루프를 멈춘다 */
export function stopMusicLoop() {
  if (timer) clearInterval(timer)
  timer = null
}
