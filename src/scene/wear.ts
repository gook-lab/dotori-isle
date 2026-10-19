/**
 * 쓰인 흔적(도끼 자국·바위 금·깨진 조각)의 자리. 순수 데이터라 화면 없이도 개수를 검증할 수 있다.
 * 나무는 몸통 둘레에 자국이 하나씩 늘고, 바위는 금이 하나씩 늘다가 다 쓰면 조각이 흩어진다.
 */

/** 도끼 자국 방향(라디안, 0 = 카메라 쪽 +z). 카메라가 보는 면에 부채꼴로 모아 찍힌 게 바로 보이게 한다. */
export const NOTCH_ANGLES = [0, 1.2, -1.2]

/** 나무 밑동에 흩어진 나뭇조각. 자국이 늘수록 조각도 는다(자국 수 + 2). */
export const CHIP_SPOTS = [
  { a: 0.3, d: 0.42, tilt: 0.3, spin: 0.5 },
  { a: 2.0, d: 0.36, tilt: -0.2, spin: 1.1 },
  { a: 3.6, d: 0.44, tilt: 0.4, spin: -0.4 },
  { a: 5.1, d: 0.38, tilt: 0.1, spin: 0.8 },
  { a: 1.1, d: 0.5, tilt: 0.25, spin: 2.2 },
]

/** 바위 금. 바위 한 덩이의 면 위 자리(구면 각도)와 금 길이. 맞을 때마다 하나씩 생긴다. */
export const CRACKS = [
  { phi: 0.6, theta: 0.4, spin: 0.3, len: 0.22 },
  { phi: 0.9, theta: 2.3, spin: -0.5, len: 0.26 },
  { phi: 0.5, theta: 3.9, spin: 1.1, len: 0.2 },
  { phi: 1.1, theta: 5.2, spin: 0.2, len: 0.24 },
  { phi: 0.8, theta: 1.2, spin: -1.2, len: 0.18 },
]

/** 다 쓴 바위 둘레에 흩어진 작은 돌 조각(a: 방향, d: 거리, s: 크기). */
export const PEBBLE_SPOTS = [
  { a: 0.4, d: 0.85, s: 0.09 },
  { a: 2.2, d: 0.95, s: 0.07 },
  { a: 3.7, d: 0.8, s: 0.1 },
  { a: 5.0, d: 0.9, s: 0.06 },
]

export const notchAngles = (n: number) => NOTCH_ANGLES.slice(0, Math.min(n, NOTCH_ANGLES.length))
export const chipSpots = (n: number) => (n > 0 ? CHIP_SPOTS.slice(0, Math.min(n + 2, CHIP_SPOTS.length)) : [])
export const crackSpots = (hits: number) => CRACKS.slice(0, Math.min(hits, CRACKS.length))
