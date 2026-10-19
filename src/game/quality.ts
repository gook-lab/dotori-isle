import { useSyncExternalStore } from 'react'
import { guessQuality, isQuality, PROFILES, type Quality, type QualityProfile } from '../core/quality'

/** 그래픽 품질 설정. 기기에 남기며, 저장 게임(persist)과 따로 둔다. */
const KEY = 'dotori-isle-quality'

const listeners = new Set<() => void>()

function deviceHint() {
  return {
    touch: typeof window !== 'undefined' && 'ontouchstart' in window,
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
  }
}

function read(): Quality {
  try {
    const raw = localStorage.getItem(KEY)
    if (isQuality(raw)) return raw
  } catch {
    // 저장이 막혀 있으면 기기 기본값을 쓴다
  }
  return guessQuality(deviceHint())
}

let current: Quality = read()

export function quality(): Quality {
  return current
}

export function setQuality(q: Quality) {
  current = q
  try {
    localStorage.setItem(KEY, q)
  } catch {
    // 저장이 막혀도 이번 세션 동안은 유지된다
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 현재 품질 값과 그 값의 설정. 바뀌면 다시 그린다. */
export function useQuality(): { quality: Quality; profile: QualityProfile } {
  const q = useSyncExternalStore(subscribe, quality, quality)
  return { quality: q, profile: PROFILES[q] }
}
