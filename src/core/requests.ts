/**
 * 주민 부탁 종류와 진행. 순수 계산만 한다.
 * 주민마다 하루에 부탁 하나. 날이 바뀌면 지난 부탁은 사라진다(만료).
 *
 * bring   : 정해진 물고기·벌레·과일을 가져다 준다(기존 부탁, 물건은 dailyRequest 가 고른다)
 * deliver : 다른 주민에게 말을 전해 달라고 한다(그 주민과 이야기하면 끝)
 * lost    : 해변에서 잃어버린 조개를 찾아 준다(떨어진 조개를 주우면 끝)
 * water   : 마른 꽃에 물을 주며 도와 달라고 한다(물주기 세 번이면 끝)
 */
import { isWalkable, groundAt } from './island'
import { hashString, mulberry32 } from './rng'

export type ReqKind = 'bring' | 'deliver' | 'lost' | 'water'

export const WATER_TARGET = 3
/** 잃어버린 물건의 종류(해변에 떨어져 있는 조개) */
export const LOST_ITEM = 'conch'

/** 부탁을 끝냈을 때 받는 보상 */
export const REWARD: Record<ReqKind, { acorns: number; friendship: number; furniture?: string }> = {
  bring: { acorns: 0, friendship: 2 },
  deliver: { acorns: 20, friendship: 3 },
  lost: { acorns: 30, friendship: 2, furniture: 'flowerpot' },
  water: { acorns: 15, friendship: 2 },
}

export interface Req {
  kind: ReqKind
  /** 부탁이 생긴 날. 날이 다르면 만료된 부탁이다. */
  day: string
  /** 지금까지 진행(물주기 횟수 등) */
  progress: number
  target: number
  /** deliver 는 말을 전할 주민, 그 밖에는 null */
  to: string | null
  /** lost 는 떨어진 물건의 땅 위 id, 그 밖에는 null */
  item: string | null
  done: boolean
}

/** 주민과 날짜로 부탁 종류를 고른다. 같은 날·같은 주민이면 항상 같다. */
export function kindOf(villagerId: string, day: string): ReqKind {
  const u = mulberry32(hashString(`reqkind:${villagerId}:${day}`))()
  if (u < 0.4) return 'bring'
  if (u < 0.55) return 'deliver'
  if (u < 0.7) return 'lost'
  return 'water'
}

/** deliver 의 받는 주민. 자기 자신은 빼고 고른다. 후보가 없으면 null. */
export function deliverTo(villagerId: string, day: string, ids: readonly string[]): string | null {
  const others = ids.filter((id) => id !== villagerId)
  if (others.length === 0) return null
  const rng = mulberry32(hashString(`reqto:${villagerId}:${day}`))
  return others[Math.floor(rng() * others.length)]
}

/** lost 물건을 떨굴 해변 자리. 섬 둘레의 모래밭 중 걸을 수 있는 곳을 날짜·주민 해시로 고른다. */
export function lostSpot(villagerId: string, day: string): { x: number; z: number } | null {
  const rng = mulberry32(hashString(`reqlost:${villagerId}:${day}`))
  for (let i = 0; i < 80; i++) {
    const a = rng() * Math.PI * 2
    // 모래밭은 섬 가장자리 둘레의 띠다
    const r = 30 + rng() * 30
    const px = Math.cos(a) * r
    const pz = Math.sin(a) * r
    if (groundAt(px, pz) === 'sand' && isWalkable(px, pz)) return { x: px, z: pz }
  }
  return null
}

/** 새 부탁. lost 의 땅 위 id 와 deliver 의 받는 주민은 호출하는 쪽이 넣는다. */
export function newReq(kind: ReqKind, day: string, extra: { to?: string | null; item?: string | null } = {}): Req {
  return {
    kind,
    day,
    progress: 0,
    target: kind === 'water' ? WATER_TARGET : 1,
    to: kind === 'deliver' ? (extra.to ?? null) : null,
    item: kind === 'lost' ? (extra.item ?? null) : null,
    done: false,
  }
}

/** 오늘의 부탁이면 그대로, 지난 날의 부탁이면 null(만료) */
export function activeReq(req: Req | undefined | null, day: string): Req | null {
  if (!req || req.day !== day) return null
  return req
}

/** 물주기 한 번. 목표에 닿으면 끝난다. */
export function onWater(req: Req): Req {
  if (req.kind !== 'water' || req.done) return req
  const progress = Math.min(req.target, req.progress + 1)
  return { ...req, progress, done: progress >= req.target }
}

/** 말을 건 주민이 부탁의 받는 주민이면 끝난다. */
export function onTalk(req: Req, villagerId: string): Req {
  if (req.kind !== 'deliver' || req.done || req.to !== villagerId) return req
  return { ...req, progress: 1, done: true }
}

/** 떨어진 물건을 주우면 끝난다. */
export function onPickup(req: Req, groundId: string): Req {
  if (req.kind !== 'lost' || req.done || req.item !== groundId) return req
  return { ...req, progress: 1, done: true }
}

export function rewardOf(req: Req): { acorns: number; friendship: number; furniture?: string } {
  return REWARD[req.kind]
}

/** 부탁 한 줄 설명. 이름은 nameOf 로 받는다. */
export function reqText(req: Req, nameOf: (id: string) => string): string {
  if (req.kind === 'deliver') return `${nameOf(req.to ?? '')}에게 말을 전해 줄래?`
  if (req.kind === 'lost') return '바닷가에서 잃어버린 조개를 찾아 줄래?'
  if (req.kind === 'water') return `꽃에 물을 ${req.target}번 줘 줄래? (${req.progress}/${req.target})`
  return '오늘 가져다 줄 게 있어요'
}

/** 저장된 부탁을 검증한다. 틀린 값은 버린다. */
export function sanitizeReq(raw: unknown): Req | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kinds: ReqKind[] = ['bring', 'deliver', 'lost', 'water']
  if (!kinds.includes(r.kind as ReqKind) || typeof r.day !== 'string') return null
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
  return {
    kind: r.kind as ReqKind,
    day: r.day,
    progress: num(r.progress),
    target: Math.max(1, num(r.target)),
    to: typeof r.to === 'string' ? r.to : null,
    item: typeof r.item === 'string' ? r.item : null,
    done: r.done === true,
  }
}
