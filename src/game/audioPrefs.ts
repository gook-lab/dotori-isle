/**
 * 소리 크기 설정: 배경음과 효과음을 따로 잡는다. localStorage 에 두고, 막혀 있으면 이번 세션 동안만 유지한다.
 * 저장 게임(persist)과는 따로 두어 저장 버전을 올리지 않는다.
 */

import { clampVolume } from '../core/music'

const KEY = 'dotori-isle-volume'

export interface Volumes {
  bgm: number
  sfx: number
}

const DEFAULT: Volumes = { bgm: 0.5, sfx: 1 }

function read(): Volumes {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    const p = JSON.parse(raw) as Partial<Volumes>
    return { bgm: clampVolume(p.bgm, DEFAULT.bgm), sfx: clampVolume(p.sfx, DEFAULT.sfx) }
  } catch {
    return { ...DEFAULT }
  }
}

let vols: Volumes = read()

export function volumes(): Volumes {
  return vols
}

export function setVolume(kind: keyof Volumes, v: number) {
  vols = { ...vols, [kind]: clampVolume(v, vols[kind]) }
  try {
    localStorage.setItem(KEY, JSON.stringify(vols))
  } catch {
    // 저장이 막혀도 이번 세션 동안은 설정이 유지된다.
  }
}
