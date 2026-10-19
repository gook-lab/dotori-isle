/**
 * 언덕과 절벽: 집 섬 안의 높은 평지(티어)와 그 둘레의 절벽·경사로.
 * 높이는 island.ts 의 baseHeightAt 이 tierHeightAt 과 최댓값으로 합친다.
 * 가장자리 띠가 좁으면 절벽(걸을 수 없음), 경사로 자리에서는 띠가 넓어져 완만하게 걸어 오른다.
 * 다른 모듈을 import 하지 않는다.
 */

/** 절벽 띠 폭(월드 단위). 높이차가 이 폭에 몰리므로 가파르다. */
export const CLIFF_W = 0.7
/** 경사로 띠 폭. 같은 높이차를 넓게 펴서 걸어 오를 만큼 완만하게 한다. */
export const RAMP_W = 3.2
/** 걸을 수 있는 가장 가파른 경사(높이차 / 거리). 절벽 띠는 이보다 훨씬 가파르다. */
export const MAX_SLOPE = 1
/** 경사로 반각(라디안). 가장자리 바깥 부드러운 경계까지 포함한다. */
/** 계단 블록 주변 장애물 금지 여유(월드 단위). 나무·바위·배치 판정이 블록에서 이만큼 떨어져야 한다. */
export const STEP_PAD = 0.5

/**
 * 계단(경사로) 반각. 계단 칸·옆벽(RampSteps)과 절벽 벽 끊김(Island)이 이 한 값을 같이 쓴다.
 * 홈 바깥은 바로 절벽이라 경계는 각도 0.01 안에서만 부드럽다.
 */
export const RAMP_HALF_ANGLE = 0.27

export interface Plateau {
  id: string
  x: number
  z: number
  /** 평균 반지름(가장자리 바깥쪽 선) */
  r: number
  /** 평지 높이(잔디 1.0 기준) */
  top: number
  /** 가장자리 울퉁불퉁함 */
  wobble: number
  phase: number
  /** 경사로가 놓이는 방향(라디안, 중심에서 바깥쪽) */
  ramps: number[]
}

/**
 * 집 섬 안 세 언덕. 서쪽 언덕 위에 한 단 더 높은 봉우리가 얹혀 두 단계 티어가 된다.
 * 연못·개울·상점·스폰에서 떨어진 자리로, 주민 집터와 산책 마당은 평지에만 놓인다.
 */
export const PLATEAUS: Plateau[] = [
  { id: 'west-hill', x: -28, z: 14, r: 10.5, top: 2.6, wobble: 0.08, phase: 0.6, ramps: [-0.4, Math.PI - 0.2] },
  { id: 'summit', x: -29, z: 13, r: 5, top: 4.2, wobble: 0.06, phase: 1.9, ramps: [Math.PI / 2] },
  { id: 'east-hill', x: 30, z: -22, r: 8.5, top: 2.6, wobble: 0.1, phase: 2.7, ramps: [2.44] },
]

const smooth01 = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** 그 방향의 가장자리 바깥 선 반지름 */
export function plateauRimAt(p: Plateau, theta: number): number {
  return p.r * (1 + p.wobble * Math.sin(3 * theta + p.phase))
}

/** 경사로 가까이면 1, 멀면 0. 띠 폭을 CLIFF_W 에서 RAMP_W 로 넓히는 데 쓴다. */
/** 섬 정비로 새로 낸 계단(infra.ts): 언덕 id 마다 계단 각도 목록. 경사로와 같은 방식으로 띠를 넓히고 걸을 수 있게 한다. */
export const extraRamps: Record<string, number[]> = {}

export function rampWeight(p: Plateau, theta: number): number {
  let w = 0
  const extra = extraRamps[p.id]
  for (const a of extra ? [...p.ramps, ...extra] : p.ramps) {
    const d = Math.abs(wrapAngle(theta - a))
    w = Math.max(w, 1 - smooth01((d - (RAMP_HALF_ANGLE - 0.005)) / 0.01))
  }
  return w
}

/** 경사로를 나누는 계단 칸 수. 경사로 띠가 이 칸들로 올라가고, 칸 윗면이 평평한 디딤 자리가 된다. */
export const RAMP_STEPS = 5
/** 칸 모서리 턱의 높이 폭(월드 단위). 턱은 이 폭 안에서 부드럽게 올라가 걸을 수 있게 한다. */
export const STEP_RISER = 0.3

/**
 * 경사로 띠 위치(u: 0 띠 바깥 가장자리 ~ 1 절벽 윗선)를 계단 높이 비율로 바꾼다.
 * 칸 윗면은 평평하고(바깥 칸부터 (j+1)/N), 각 칸 끝의 턱에서만 올라간다. 맨 위 칸 윗면은 정확히 1(언덕 윗면)이다.
 */
export function stepProfile(u: number): number {
  const k = Math.max(0, Math.min(1, u)) * RAMP_STEPS
  const j = Math.min(RAMP_STEPS - 1, Math.floor(k))
  const f = k - j
  const riser = (STEP_RISER / RAMP_W) * RAMP_STEPS
  const rise = j < RAMP_STEPS - 1 ? smooth01((f - (1 - riser)) / riser) : 0
  return (j + 1 + rise) / RAMP_STEPS
}

/**
 * 한 언덕이 그 자리에 주는 높이(0 ~ top). 평지는 top, 절벽 띠 안에서 안쪽으로 올라온다.
 * 경사로 띠는 절벽 바깥(rim ~ rim + RAMP_W)에 계단으로 붙어, 아래층 땅에서 절벽 윗선까지 올라간다.
 * linear 는 계단 이전 선형 높이(장식 배치 판정용)로, 예전 안쪽 경사 그대로다.
 */
function plateauHeight(p: Plateau, x: number, z: number, linear = false): number {
  const dx = x - p.x
  const dz = z - p.z
  const d = Math.hypot(dx, dz)
  if (d > p.r * 1.3 + RAMP_W) return 0
  const theta = Math.atan2(dz, dx)
  // 안쪽으로 들어갈수록 높다. s 가 음수면 평지 위다.
  const s = d - plateauRimAt(p, theta)
  if (linear) {
    const w = CLIFF_W + (RAMP_W - CLIFF_W) * rampWeight(p, theta)
    return p.top * Math.max(0, Math.min(1, -s / w))
  }
  // 계단 블록 자리는 블록 좌표(rho, lam)로 높이를 정한다. 블록 밖 비탈은 두지 않는다.
  for (const a of rampsOf(p)) {
    const f = stepFrameOf(p, x, z, a)
    const h = f ? stepBlockHeight(p, f) : null
    if (h !== null) return h
  }
  // 블록 밖: 절벽 바깥은 아래층 땅(0), 절벽 띠 안은 안쪽으로 올라오는 비탈
  if (s > 0) return 0
  return p.top * Math.min(1, -s / CLIFF_W)
}

/** 언덕 높이. 바깥은 0, 평지는 top 이다. 여러 언덕이 겹치면 가장 높은 것을 쓴다. */
export function tierHeightAt(x: number, z: number): number {
  let h = 0
  for (const p of PLATEAUS) h = Math.max(h, plateauHeight(p, x, z))
  return h
}

/** 계단 이전의 선형 높이. 장식·나무·바위의 자리 판정(cliffFaceAt)이 예전과 같은 자리를 고르도록 따로 둔다. */
function legacyTierHeightAt(x: number, z: number): number {
  let h = 0
  for (const p of PLATEAUS) h = Math.max(h, plateauHeight(p, x, z, true))
  return h
}

const EPS = 0.1

/** 언덕 높이의 기울기 크기(가파름). 절벽 띠는 크고 평지·경사로는 작다. */
export function tierSlopeAt(x: number, z: number): number {
  const gx = (tierHeightAt(x + EPS, z) - tierHeightAt(x - EPS, z)) / (2 * EPS)
  const gz = (tierHeightAt(x, z + EPS) - tierHeightAt(x, z - EPS)) / (2 * EPS)
  return Math.hypot(gx, gz)
}

/** 계단 블록의 옆 반폭. 절벽 끊김 각도(RAMP_HALF_ANGLE)에 양옆 0.15 여유를 더한다. RampSteps 도 같은 값으로 그린다. */
export const stepHalfWidth = (rimA: number) => rimA * RAMP_HALF_ANGLE + 0.15

/** 언덕 p 의 경사로 목록(섬 정비로 더한 계단 포함). */
export function rampsOf(p: Plateau): number[] {
  const extra = extraRamps[p.id]
  return extra ? [...p.ramps, ...extra] : p.ramps
}

/**
 * 계단 블록 좌표. 경사로 a 기준으로 rho 는 중심에서 경사로 방향 거리(투영), lam 은 옆 방향 거리(부호 있음).
 * rimA 는 경사로 각도의 림, half 는 블록 옆 반폭. 경사로 쪽 반평면(cos > 0)만 값을 준다.
 */
export interface StepFrame {
  rimA: number
  rho: number
  lam: number
  half: number
}

export function stepFrameOf(p: Plateau, x: number, z: number, a: number): StepFrame | null {
  const dx = x - p.x
  const dz = z - p.z
  const d = Math.hypot(dx, dz)
  const diff = wrapAngle(Math.atan2(dz, dx) - a)
  if (Math.cos(diff) <= 0) return null
  const rimA = plateauRimAt(p, a)
  return { rimA, rho: d * Math.cos(diff), lam: d * Math.sin(diff), half: stepHalfWidth(rimA) }
}

/**
 * 블록 안 높이(top 배율 × top). 옆 반폭 밖이거나 블록 바깥 끝을 넘으면 null.
 * 림 안쪽은 평지(top), 림부터 바깥 끝까지 칸 윗면이 계단으로 내려간다.
 */
export function stepBlockHeight(p: Plateau, f: StepFrame): number | null {
  if (Math.abs(f.lam) > f.half || f.rho > f.rimA + RAMP_W) return null
  if (f.rho < f.rimA) return p.top
  return p.top * stepProfile(1 - (f.rho - f.rimA) / RAMP_W)
}

/** 블록 칸 판정: 옆 반폭과 안쪽 0.05·바깥 0.05 여유(pad 만큼 더). */
const inStepFrame = (f: StepFrame, pad: number) => Math.abs(f.lam) <= f.half + pad && f.rho >= f.rimA - 0.05 - pad && f.rho <= f.rimA + RAMP_W + 0.05 + pad

/**
 * 테두리 벽 건너뛰기: 림 둘레 각도 theta 의 자리가 계단 블록의 옆 반폭 안이면 벽을 끊는다.
 * 블록 밖 자리는 벽이 그대로 이어진다.
 */
export function stepSectorAt(p: Plateau, theta: number): boolean {
  const rimT = plateauRimAt(p, theta)
  return rampsOf(p).some((a) => {
    const diff = wrapAngle(theta - a)
    return Math.cos(diff) > 0 && Math.abs(rimT * Math.sin(diff)) <= stepHalfWidth(plateauRimAt(p, a))
  })
}

/** 경사로·계단 띠 위인지. 계단 칸 블록 안만 걸을 수 있는 계단으로 친다(절벽 판정 제외). */
function onRampBand(x: number, z: number): boolean {
  return inStepBlockAt(x, z, 0)
}

/**
 * 계단 블록이 덮는 자리인지: 블록 옆 반폭과 바깥·안쪽 여유(pad) 이내.
 * 렌더용 지형 높이를 아래층으로 누르고, 장식·배치를 막는 데 쓴다.
 */
export function inStepBlockAt(x: number, z: number, pad = 0): boolean {
  return PLATEAUS.some((p) => rampsOf(p).some((a) => {
    const f = stepFrameOf(p, x, z, a)
    return f !== null && inStepFrame(f, pad)
  }))
}

export const STEP_CLEAR_PAD = 0.3
export const onStepSpot = (x: number, z: number) => inStepBlockAt(x, z, STEP_CLEAR_PAD)

/** 경사로·계단 띠(절벽 바깥)의 지형은 누르지 않는다. 계단 블록이 그 위를 덮는다. */
export const rampBandAt = onRampBand

/** 걸을 수 없는 절벽 띠인지(경사로·계단 띠는 예외) */
export const cliffAt = (x: number, z: number) => tierSlopeAt(x, z) > MAX_SLOPE && !onRampBand(x, z)

/**
 * 절벽 면(회색 돌로 칠할 자리). 경사로는 기울기가 이보다 완만해서 잔디로 남는다.
 * 띠 가장자리 정점까지 면으로 잡히도록 걸을 수 있는 기준보다 낮게 둔다.
 */
/** 계단 이전 선형 기울기. 장식·나무·바위·발견거리 등 배치 판정은 이 값을 읽어 섬 모습이 바뀌지 않게 한다. */
export function legacyTierSlopeAt(x: number, z: number): number {
  const gx = (legacyTierHeightAt(x + EPS, z) - legacyTierHeightAt(x - EPS, z)) / (2 * EPS)
  const gz = (legacyTierHeightAt(x, z + EPS) - legacyTierHeightAt(x, z - EPS)) / (2 * EPS)
  return Math.hypot(gx, gz)
}

/** 계단 블록 자리(바깥 여유 0.5 포함)는 나무·바위 등 장애물을 놓지 않는다. */
export function cliffFaceAt(x: number, z: number): boolean {
  return legacyTierSlopeAt(x, z) > 1.5
}

/** 경사로 띠 위인지(걸을 수 있는 완만한 언덕 면). 길처럼 흙색으로 칠한다. */
export function onRampAt(x: number, z: number): boolean {
  if (tierHeightAt(x, z) < 0.05) return false
  const s = tierSlopeAt(x, z)
  return s > 0.2 && s <= MAX_SLOPE
}

/**
 * 가장자리 둘레 r 위의 여덟 점과 가운데가 모두 평평한지. 잔디·꽃처럼 바닥에 붙는 것이 절벽 띠 위나
 * 경사로 가장자리에 서지 않게 한다. 기울기가 조금이라도 있으면 false.
 */
export function flatRing(x: number, z: number, r: number): boolean {
  if (legacyTierSlopeAt(x, z) > 0.2) return false
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    if (legacyTierSlopeAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0.2) return false
  }
  return true
}

/** 주변 반경 r 안이 전부 평지인지(기울기 없음). 집터·주민 산책 마당·가구 자리에 쓴다. 얇은 절벽 띠도 놓치지 않게 격자로 훑는다. */
export function flatWithin(x: number, z: number, r: number): boolean {
  const step = 0.35
  const n = Math.ceil(r / step)
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const px = i * step
      const pz = j * step
      if (px * px + pz * pz > r * r) continue
      if (legacyTierSlopeAt(x + px, z + pz) > 0.05) return false
    }
  }
  return true
}

/** 언덕 둘레 윤곽 점(0~1 각도 샘플). 미니맵과 절벽 테두리 선이 같이 쓴다. */
export function plateauOutline(p: Plateau, inset: number, n = 72): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = plateauRimAt(p, a) - inset
    pts.push([p.x + Math.cos(a) * r, p.z + Math.sin(a) * r])
  }
  return pts
}
