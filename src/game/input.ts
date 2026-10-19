import { runtime } from './runtime'

const held = new Set<string>()

export const isHeld = (...codes: string[]) => codes.some((c) => held.has(c))

/**
 * 스페이스를 화면의 버튼·입력 칸·패널이 가져가야 하는지. 패널이 열려 있거나 초점이 버튼·입력 칸에 있으면 참이다.
 * 그때는 Space 가 행동(E)이 아니라 초점 있는 버튼을 누르는 키가 된다. 가방 안 버튼은 예외로 행동 키로 남는다.
 */
const UI_TAGS = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']
/** 가방(.bag-area) 안 버튼인지. 가방 칸에 초점이 있어도 Space·Enter 는 여기서 따로 본다. */
export function isBagButton(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && el.tagName === 'BUTTON' && !!el.closest?.('.bag-area')
}
export function spaceBelongsToUi(code: string, target: EventTarget | null, panelOpen: boolean): boolean {
  if (code !== 'Space') return false
  if (isBagButton(target)) return false
  if (panelOpen) return true
  const el = target as HTMLElement | null
  return !!el && (UI_TAGS.includes(el.tagName) || !!el.isContentEditable)
}

/** 가방 안 버튼에 초점이 있을 때의 Enter 는 그 버튼을 누르는 키다. 월드 행동(E·Enter)으로 가지 않는다. */
export function enterBelongsToBag(code: string, target: EventTarget | null): boolean {
  return code === 'Enter' && isBagButton(target)
}

/** 눌린 키를 추적하고, 새로 눌린 키(반복 제외)는 onPress 로 알린다. yieldKey 가 참을 주면 그 키는 건드리지 않는다. */
export function bindInput(onPress: (code: string) => void, yieldKey: (e: KeyboardEvent) => boolean = () => false): () => void {
  const down = (e: KeyboardEvent) => {
    if (yieldKey(e)) return
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault()
    held.add(e.code)
    if (!e.repeat) onPress(e.code)
  }
  const up = (e: KeyboardEvent) => held.delete(e.code)
  const clear = () => held.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
  }
}

const ZOOM_MIN = 0.55
const ZOOM_MAX = 1.7
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** 마우스 휠과 두 손가락 벌리기로 카메라를 당기고 민다. 캔버스 위에서만 받는다. */
export function bindZoom(el: HTMLElement, set = (k: number) => (runtime.zoom = clampZoom(runtime.zoom * k))): () => void {
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    set(Math.exp(e.deltaY * 0.0012))
  }
  let pinch = 0
  const span = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
  const start = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch = span(e)
  }
  const move = (e: TouchEvent) => {
    if (e.touches.length !== 2 || !pinch) return
    const d = span(e)
    set(pinch / d)
    pinch = d
  }
  const end = () => (pinch = 0)
  el.addEventListener('wheel', wheel, { passive: false })
  el.addEventListener('touchstart', start)
  el.addEventListener('touchmove', move)
  el.addEventListener('touchend', end)
  return () => {
    el.removeEventListener('wheel', wheel)
    el.removeEventListener('touchstart', start)
    el.removeEventListener('touchmove', move)
    el.removeEventListener('touchend', end)
  }
}
