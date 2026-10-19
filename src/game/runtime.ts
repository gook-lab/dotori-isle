import type { InfraSpot } from '../core/infra'
import type { VisitState } from '../core/visits'
import type { PathKind } from '../core/paths'
import type { FishingState } from '../core/fishing'
import type { HomeUse } from '../core/furnitureActions'
import type { JustPlaced } from '../core/homeStow'
import type { CanLevel } from '../core/watering'
import type { Mood } from '../core/villagers'
import { SPAWN } from '../core/world'

/** 도구를 쓰는 동작. 재생 중에는 걷지 않는다. */
export type ActKind = 'look' | 'shake' | 'swing' | 'dig' | 'water' | 'hit' | 'chop' | 'build' | 'pick' | 'show' | 'pat' | 'wipe' | 'peek' | 'sip' | 'eat'

export const ACT_TIME: Record<ActKind, number> = {
  look: 1.6,
  shake: 0.6,
  swing: 0.35,
  dig: 0.55,
  water: 0.9,
  hit: 0.45,
  chop: 0.45,
  build: 0.8,
  pick: 0.35,
  show: 2,
  /** 가구 쓰다듬기·톡 건드리기 */
  pat: 0.7,
  /** 황금 도토리 닦기 */
  wipe: 1,
  /** 망원경·창밖 보기 */
  peek: 1.5,
  /** 차 마시기 */
  sip: 1.4,
  /** 요리 먹기: 손을 입에 대고 두 번 베어 문다 */
  eat: 1.5,
}

/** 바닥 물건이 어디서 튀어나와 떨어졌는지. 착지 애니메이션이 끝나면 지운다. */
export interface DropFx {
  from: [number, number, number]
  /** 포물선 꼭대기가 출발점보다 얼마나 높은지 */
  arc: number
  t0: number
}

/** 주운 물건이 손을 거쳐 주머니로 날아가는 연출 */
export interface FlyFx {
  key: number
  itemId: string
  from: [number, number, number]
  t0: number
}

export const DROP_TIME = 0.95
export const FLY_TIME = 0.5

export interface Burst {
  kind: 'dirt' | 'sparks' | 'chips' | 'leaves' | 'foliage' | 'water' | 'confetti' | 'party' | 'dust' | 'splash' | 'spray' | 'puff' | 'heart' | 'note'
  x: number
  y: number
  z: number
  /** 퍼져 나가는 기준 방향(라디안). 물줄기처럼 한쪽으로 뿌릴 때 쓴다. */
  dir?: number
  /** dir 쪽으로 퍼지는 각도 폭(라디안). 없으면 종류의 기본값을 쓴다. 넓은 물뿌리개가 부채꼴로 뿌린다. */
  cone?: number
  /** 날아가는 거리 배율. 1 이 기본이고 큰 물뿌리개는 더 멀리 보낸다. */
  reach?: number
}

/** 물뿌리개 한 번의 범위. 바닥 표시와 물줄기 연출이 함께 쓴다. */
export interface WaterFx {
  level: CanLevel
  /** 범위 칸들의 월드 좌표 중심 */
  cells: { x: number; z: number }[]
  /** 물줄기가 뻗는 방향(라디안). 칸 범위와 같은 방향이다. */
  dir: number
  t0: number
}
/** 바닥 표시가 사라지는 데 걸리는 시간(초) */
export const WATER_FX_TIME = 0.9

/**
 * 매 프레임 바뀌는 값. React 상태로 두면 프레임마다 리렌더가 일어나므로
 * 모듈 객체에 두고 useFrame 안에서만 읽고 쓴다.
 */
export const runtime = {
  player: { x: SPAWN.x, z: SPAWN.z, y: 1, facing: Math.PI, moving: false, running: false },
  fishing: { phase: 'idle' } as FishingState,
  /** 도토리 상점 재개장 리본 연출을 시작한 시각(초). 저장하지 않는다. */
  shopRibbon: -99,
  /** 경제 이정표가 난 날(상점 올림·섬 가꾸기 완성). 주민 수다가 쓴다. 저장하지 않는다. */
  milestoneDays: { shopUp: null as string | null, giftDone: null as string | null },
  /** 플레이어가 새 집 근처(8칸)에 한 번이라도 왔는지. 저장하지 않는다. */
  homeNearSeen: false,
  /** 방금 놓은 방 가구(id·시각). 3초 동안 넣기 대상으로 먼저 잡는다. 저장하지 않는다. */
  justPlaced: null as JustPlaced | null,
  /** 나무·바위가 흔들리는 연출. id 는 맞은 대상 */
  shake: null as { id: string; t: number } | null,
  /** 첫 나무 흔들기 말풍선의 화면 위치(CSS px). 없으면 null. behind 면 카메라 뒤라 숨긴다. */
  shakeHint: null as { x: number; y: number; behind: boolean; angle?: number } | null,
  /** 가장 가까운 나무의 가장자리 화살표. HUD 에 가린 말풍선을 대신한다. */
  shakeHintEdge: null as { x: number; y: number; behind: boolean; angle?: number } | null,
  act: null as { kind: ActKind; t: number } | null,
  /** 지금 물뿌리개가 덮는 범위. 물 주기 동작이 끝나면 흐려져 사라진다. */
  waterFx: null as WaterFx | null,
  /** 몸동작 시각(act.t)이 닿을 때 터뜨릴 효과 대기열. 시작 즉시 두면 칼날보다 소리가 먼저 난다. */
  impacts: [] as { at: number; fn: () => void; heavy: boolean }[],
  /** 타격 순간 남은 히트스톱 시간(초). 동안 몸동작 시계가 멈춘다. */
  hitStop: 0,
  /** 타격 카메라 흔들림 남은 시간(초). 0 이면 흔들림 없음. */
  kick: 0,
  /** 이번 프레임에 터뜨릴 파티클. Particles 가 비운다. */
  bursts: [] as Burst[],
  /** 모래·눈 위에 남은 발자국. 오래된 것부터 지운다(Footprints 가 그린다). */
  footprints: [] as { x: number; z: number; rot: number; t0: number; snow: boolean }[],
  /** 우산 없이 비를 맞은 누적 초. 비가 그치거나 집에 들어가면 0 이 된다. */
  rainSeconds: 0,
  /** 지금 섬에 있는 웅덩이 자리와 남은 정도(0~1). Puddles.tsx 가 갱신한다. */
  puddleSpots: [] as { x: number; z: number }[],
  puddleLevel: 0,
  /** 이번 프레임에 퍼뜨릴 물 파문. Sky 가 물 셰이더로 넘기고 비운다. */
  ripples: [] as { x: number; z: number; s: number }[],
  drops: {} as Record<string, DropFx>,
  /** 베어 넘어가는 나무. t0 부터 기울어 떨어지고, 닿으면 null 로 지운다. */
  fall: null as { id: string; t0: number; yaw: number } | null,
  fly: [] as FlyFx[],
  /** 잡은 벌레·물고기를 머리 위로 들어 보이는 중 */
  show: null as { itemId: string; t0: number } | null,
  /** 장터 패널을 열어 카메라가 가판대 쪽으로 옮겨 간 정도 0~1 */
  marketCam: 0,
  /** 불꽃 구경 카메라 블렌드(의자에 앉아 여름 밤 불꽃을 볼 때) */
  fireCam: 0,
  /** 유성우 밤 하늘 올려다보기 카메라 블렌드(바깥 자리에 앉거나 소원을 빌 때) */
  skyCam: 0,
  /** 사진 모드 공전 카메라(플레이어 둘레의 각도와 거리). 입력마다 바뀌므로 스토어에 두지 않는다. */
  photoOrbit: { yaw: 0, pitch: 0.35, dist: 6 },
  /** 소원을 빌었고 별똥별이 떨어지기를 기다리는 중 */
  wishing: false,
  /** 집들이 방문: 지금 방에 와 있는 주민과 시작 시각(저장하지 않는다) */
  visit: null as VisitState | null,
  /** 방문을 치른 날(같은 날 두 번 오지 않게) */
  visitDone: null as string | null,
  /** 방문객이 지금 있는 자리(방 가운데 기준). 주민 옆에서 E 를 누르는지 볼 때 쓴다 */
  visitPos: null as { x: number; z: number } | null,
  /** 방문객과 나눈 대화 횟수 */
  visitTalks: 0,
  /** 수영 중이면 들어간 시각(초). 물가에서 들어가고, 물가에 닿으면 나온다. */
  // wet: 한 번이라도 물에 들어갔는지. 물가에 서서 들어가기 전엔 밖으로 나오지 않는다.
  swim: null as { t0: number; wet: boolean } | null,
  /** 잠수 중이면 시작 시각(초)과 거품 자리 키 */
  dive: null as { t0: number; key: string } | null,
  /** 오늘 잡은 거품 자리(날이 바뀌면 빈다) */
  dived: { day: '', keys: [] as string[] },
  /** '너무 멀어요'를 마지막으로 띄운 시각(초) */
  swimWarnAt: -99,
  /** 요리 효과(저장하지 않는다): 달리기가 빨라지는 시각, 기쁨 표정이 끝나는 시각(초), 다음 바위 한 번에 깨기 */
  hasteUntil: 0,
  happyUntil: 0,
  rockCharge: false,
  /** 무지개 알림을 띄운 날짜(같은 날 한 번만 알린다) */
  rainbowToldDay: null as string | null,
  /** 여행처럼 순간이동한 뒤 카메라를 부드럽게 따라가지 말고 바로 붙인다 */
  snapCamera: false,
  /** 방금 지은 집의 완공 연출 시작 시각 */
  builtAt: {} as Record<string, number>,
  /** 주민마다 따로 흐르는 시계. 대화 중인 주민은 멈춘다. */
  vclock: {} as Record<string, number>,
  /** 축하 색종이를 주민 머리 위에서 한 번 터뜨릴 주민 id(장면이 위치를 읽고 지운다) */
  party: {} as Record<string, boolean>,
  /** 불꽃이 터진 시각(장면 시계). 주민이 환호할 때 본다. */
  boomAt: -99,
  /** 앉아 있는 가구. 몸은 이 자리에 고정된다. */
  seat: null as { id: string; x: number; z: number; y: number; facing: number; lie?: boolean } | null,
  /** 망원경으로 밤하늘을 올려다보는 중. 움직이면 내려온다. */
  telescope: false,
  /** 오늘 바람 풍선을 잡은 날짜(세션 기록만 둔다) */
  balloonCaught: null as string | null,
  /** 타이틀에서 시작을 누른 시각(초). 카메라가 여기서부터 1.2초 동안 내려온다. */
  titleEndAt: null as number | null,
  /** 섬 정비 자리 고르기: 다리·계단 중 하나, 맡길 수 있는 자리 목록, 지금 가장 가까운 자리 */
  infraMode: null as null | 'bridge' | 'stair',
  infraSpots: [] as InfraSpot[],
  infraTarget: null as InfraSpot | null,
  /** 낙엽더미를 찬 마지막 시각(id → 초). 연달아 차면 바스락 효과를 한 번만 낸다. */
  kickedAt: {} as Record<string, number>,
  /** 낙엽더미를 찬 날짜(id → 'YYYY-MM-DD'). 그날은 납작하고 다음 날 다시 쌓인다. */
  kickedDay: {} as Record<string, string>,
  /** 섬 곳곳 발견거리를 마지막으로 쓴 날(발견 id -> 날짜). 하루 한 번 제한이며 저장하지 않는다. */
  discovered: {} as Record<string, string>,
  /** 잠자리채로 잡힌 반딧불이(번호 -> 다시 나올 시각(초)과 옮길 덤불 번호). 저장하지 않는다. */
  fireflyGone: {} as Record<number, { until: number; shift: number }>,
  /** 길 깔기 중인 종류. 켜져 있으면 E 는 바라보는 칸에 길을 놓거나 걷는다. */
  paintMode: null as PathKind | null,
  /** 낚시 대회 진행 중인 판. 저장하지 않는다(새로고침하면 판은 사라진다). */
  tourney: null as null | { day: string; endAt: number; count: number },
  /** 길 깔기 미리보기: 바라보는 칸, 놓을 수 있는지, 걷어내는 칸인지 */
  paintTarget: null as null | { x: number; z: number; ok: boolean; remove: boolean },
  /** 방 가구가 반응하는 중. id 는 놓인 가구, use 는 쓰임, t0 는 시작 시각(now 기준). 씬의 가구가 읽는다. */
  reactFx: null as { id: string; use: HomeUse; t0: number } | null,
  /** 주민이 방에서 뭔가에 반응하는 중. 방에 있는 주민 표정을 잠깐 바꾼다. */
  react: null as { id: string; mood: Mood; t0: number } | null,
  /** 옷 갈아입기 연출: 한 바퀴 돌며 연기 속에서 옷이 바뀐다. t0 는 now() 기준 시작 시각. */
  dress: null as { t0: number } | null,
  /** 사다리로 절벽을 오르내리는 중. t 는 흐른 시간(초), from·to 는 출발·도착 자리다. */
  climb: null as { t: number; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; up: boolean } | null,
  /** 카메라 거리 배율. 휠·두 손가락으로 바꾼다. */
  zoom: 1,
  /** 대화 구도로 옮겨 간 정도 0~1. 카메라가 부드럽게 들어갔다 나온다. */
  talkCam: 0,
  /** 대화창이 아직 글자를 찍고 있는지. 이때 E 는 넘기기 대신 남은 글자를 한 번에 보여준다. */
  /** 잡은 것을 자랑할 때 카메라가 주인공 앞으로 다가간 정도 0~1 */
  showCam: 0,
  /** 오늘 질문에 대답해 준 주민(주민:날짜). 대답 호감도는 하루 한 번 */
  answered: new Set<string>(),
  /** 이번에 켠 뒤로 주민마다 말 건 횟수 */
  talks: {} as Record<string, number>,
  typing: false,
  skipTyping: false,
  /** 터치 조이스틱 입력(-1~1) */
  stick: { x: 0, z: 0 },
}

export const SHAKE_TIME = 0.6
/** 옷 갈아입기 한 바퀴 시간(초). 절반쯤에 연기가 피고 옷이 바뀐다. */
export const DRESS_TIME = 0.6
export const DRESS_SWAP = 0.25
/** 주민이 반응 표정을 유지하는 시간(초) */
export const REACT_TIME = 1.8
/** 방 가구 반응이 끝나는 데 걸리는 시간(초) */
export const FX_TIME = 2.2
/** 낚아 올린 물고기가 물에서 손까지 날아가는 시간(초). 자랑 연출은 이만큼 늦게 뜬다. */
export const CATCH_FLY = 0.5

export function startAct(kind: ActKind) {
  runtime.act = { kind, t: 0 }
}

export function burst(b: Burst) {
  runtime.bursts.push(b)
}

/** 몸동작이 실제로 닿는 시점(act.t, 초). 스윙 시작이 아니라 내려치는 순간에 효과가 나게 한다. */
export const IMPACT_AT = { chop: 0.225, hit: 0.225, dig: 0.3, shake: 0.1, swing: 0.16, water: 0.25 } as const
export const HIT_STOP = 0.045
/** 나무가 기울어 쓰러지는 시간(초) */
export const FALL_TIME = 0.8
export const KICK_TIME = 0.15
export const KICK_AMP = 0.05

/** 몸동작 시각 act.t 가 at 에 닿으면 fn 을 실행한다. heavy 면 히트스톱과 카메라 흔들림을 함께 준다. */
export function impactAt(at: number, fn: () => void, heavy = true) {
  runtime.impacts.push({ at, fn, heavy })
}

/** 게임 로직 쪽에서 물 파문을 요청한다(렌더 모듈을 직접 부르지 않게). */
export function rippleAt(x: number, z: number, s = 1) {
  runtime.ripples.push({ x, z, s })
}

/** 벌레 위치 계산에 쓰는 공용 시계. 렌더와 판정이 같은 시각을 봐야 한다. */
export const now = () => performance.now() / 1000

let flySeq = 0
export function flyToPocket(itemId: string, from: [number, number, number]) {
  runtime.fly.push({ key: ++flySeq, itemId, from, t0: now() })
}
