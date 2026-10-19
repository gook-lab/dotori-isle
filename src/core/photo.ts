/**
 * 사진 모드의 순수 계산: 자세·필터 목록, 공전 카메라 제한, 날짜 도장.
 * 화면과 캡처는 scene·ui 쪽이 맡는다.
 */
import type { Mood } from './villagers'

export type PhotoPose = 'v' | 'wave' | 'jump' | 'sit' | 'heart'

export const PHOTO_POSES: { id: PhotoPose; label: string; icon: string }[] = [
  { id: 'v', label: '브이', icon: '✌️' },
  { id: 'wave', label: '손 흔들기', icon: '👋' },
  { id: 'jump', label: '점프', icon: '🦘' },
  { id: 'sit', label: '앉기', icon: '🪑' },
  { id: 'heart', label: '하트', icon: '💗' },
]

export const PHOTO_MOODS: { id: Mood; label: string }[] = [
  { id: 'happy', label: '기쁨' },
  { id: 'surprised', label: '놀람' },
  { id: 'sad', label: '시무룩' },
  { id: 'calm', label: '차분' },
]

export type PhotoFilter = 'basic' | 'warm' | 'film' | 'mono'

/** 캔버스 필터 문자열. 미리보기 CSS 와 저장할 때의 canvas 2D 필터가 같이 쓴다. */
export const PHOTO_FILTERS: { id: PhotoFilter; label: string; css: string }[] = [
  { id: 'basic', label: '기본', css: 'none' },
  { id: 'warm', label: '따뜻함', css: 'sepia(0.25) saturate(1.2) brightness(1.04)' },
  { id: 'film', label: '필름', css: 'contrast(1.1) saturate(0.85) sepia(0.15) brightness(0.96)' },
  { id: 'mono', label: '흑백', css: 'grayscale(1) contrast(1.05)' },
]

export interface Orbit {
  /** 플레이어 둘레를 도는 각도(라디안) */
  yaw: number
  /** 위·아래 각도(라디안). 양수면 위에서 내려다본다. */
  pitch: number
  /** 플레이어까지 거리 */
  dist: number
}

export const DEFAULT_ORBIT: Orbit = { yaw: 0, pitch: 0.35, dist: 6 }
export const ORBIT_LIMITS = { minDist: 2.5, maxDist: 12, minPitch: -0.1, maxPitch: 1.2 }
/** 카메라가 지면 위에 최소로 떠 있는 높이 */
export const CAMERA_CLEARANCE = 0.4

export function clampOrbit(o: Orbit): Orbit {
  const { minDist, maxDist, minPitch, maxPitch } = ORBIT_LIMITS
  return {
    yaw: ((o.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: Math.min(maxPitch, Math.max(minPitch, o.pitch)),
    dist: Math.min(maxDist, Math.max(minDist, o.dist)),
  }
}

/**
 * 공전 카메라의 위치. 목표(플레이어 머리) 둘레를 yaw·pitch·dist 로 돌고,
 * 지면보다 낮아지면 지면 위로 끌어 올린다. ground 는 (x, z) 의 지면 높이.
 */
export function orbitCamera(target: { x: number; y: number; z: number }, o: Orbit, ground: (x: number, z: number) => number): { x: number; y: number; z: number } {
  const c = clampOrbit(o)
  const horiz = Math.cos(c.pitch) * c.dist
  const x = target.x + Math.sin(c.yaw) * horiz
  const z = target.z + Math.cos(c.yaw) * horiz
  const y = Math.max(target.y + Math.sin(c.pitch) * c.dist, ground(x, z) + CAMERA_CLEARANCE)
  return { x, y, z }
}

/** 사진 도장 글자: 도토리섬 · 2026.10.19 */
export function stampText(day: string): string {
  return `도토리섬 · ${day.replace(/-/g, '.')}`
}

/** 저장할 파일 이름 */
export function photoFileName(day: string): string {
  return `dotori-isle-${day}.png`
}

export function filterCss(id: PhotoFilter): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.css ?? 'none'
}
