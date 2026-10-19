import { useEffect, useRef, useState } from 'react'

/** 숫자가 바뀔 때 세어 오르내리는 시간(ms) */
export const COUNT_MS = 300

/** 0 → 1 진행률을 부드럽게 바꾼다(처음 빠르고 끝에서 천천히). 순수 함수. */
export function easeOut(k: number): number {
  const t = Math.min(1, Math.max(0, k))
  return 1 - Math.pow(1 - t, 3)
}

/** 진행 중인 숫자 값: from 에서 to 로 k(0~1) 만큼 간 자리. 소수는 버리고 정수로 보인다. */
export function countValue(from: number, to: number, k: number): number {
  return Math.round(from + (to - from) * easeOut(k))
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 숫자 span 의 텍스트만 프레임마다 바꾼다(리렌더 없음). 값이 바뀌면 현재 보이는 자리에서 COUNT_MS 동안 센다.
 * 동작 줄이기 설정이면 바로 바뀐다.
 */
export function useCountUp(value: number) {
  const el = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  useEffect(() => {
    const from = shown.current
    const set = (v: number) => {
      shown.current = v
      if (el.current) el.current.textContent = v.toLocaleString()
    }
    if (from === value || reducedMotion()) {
      set(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = (now - t0) / COUNT_MS
      if (k >= 1) return set(value)
      set(countValue(from, value, k))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return el
}

/**
 * 숫자 한 칸. 첫 글자는 마운트 때 값으로 고정해 React 가 이후 텍스트를 덮어쓰지 않게 한다.
 * 바뀐 값은 useCountUp 이 span 텍스트를 직접 바꾼다.
 */
export function CountUp({ value }: { value: number }) {
  const [first] = useState(value)
  const ref = useCountUp(value)
  return <span ref={ref}>{first.toLocaleString()}</span>
}
