/** 손가락으로 쓰는 기기인지. 일부 브라우저는 pointer: coarse 를 보고하지 않아 터치 점 수도 함께 본다. */
export const isTouchDevice = (): boolean => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
