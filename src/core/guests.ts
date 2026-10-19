/**
 * 여행 섬 손님. 펠리를 타고 갈 때마다 아직 도토리섬에 오지 않은 손님 몇 명이 무작위 자리에 놀러 와 있다.
 * 말을 걸어 초대하면 도토리섬에 그 손님 집터가 생기고, 집을 지어 주면 이사 온다.
 */

import { TRIP, tripDist } from './island'
import { PERSONALITY, withTic, type Ask } from './chat'
import { josa } from './items'
import { hashString, mulberry32 } from './rng'
import { VILLAGERS, WANDER_R, type Villager } from './villagers'
import { DOCKS } from './world'
import { canWalk as canStand } from './scenery'

export interface TripGuest {
  id: string
  x: number
  z: number
}

export const GUESTS: Villager[] = VILLAGERS.filter((v) => v.guest)

/** 한 번에 놀러 와 있는 손님 수 */
export const GUESTS_PER_TRIP = 2

/** 산책 원이 통째로 섬 안 걸을 수 있는 땅이어야 손님이 물이나 바위에 걸리지 않는다. */
function roomy(x: number, z: number): boolean {
  if (tripDist(x, z) > 0.62) return false
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    if (!canStand(x + Math.cos(a) * WANDER_R, z + Math.sin(a) * WANDER_R)) return false
  }
  return canStand(x, z)
}

/**
 * 이번 여행에 놀러 온 손님과 자리. seed 가 같으면 결과도 같다.
 * 이미 초대했거나 이사 온 손님(taken)은 빼고, 남은 손님이 없으면 빈 목록이다.
 */
export function tripGuestsFor(seed: string, taken: readonly string[], n = GUESTS_PER_TRIP): TripGuest[] {
  const rng = mulberry32(hashString(`trip-guests:${seed}`))
  const pool = GUESTS.filter((g) => !taken.includes(g.id))
  // 섞어서 앞에서부터 고른다.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const arrive = DOCKS.find((d) => d.id === 'trip')!.arrive
  const out: TripGuest[] = []
  for (const g of pool) {
    if (out.length >= n) break
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = TRIP.x + (rng() * 2 - 1) * TRIP.r
      const z = TRIP.z + (rng() * 2 - 1) * TRIP.r
      if (!roomy(x, z)) continue
      // 부두에서 내리자마자 부딪히지 않게, 손님끼리도 떨어뜨린다.
      if (Math.hypot(x - arrive.x, z - arrive.z) < WANDER_R + 2.5) continue
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < WANDER_R * 2 + 1.2)) continue
      out.push({ id: g.id, x, z })
      break
    }
  }
  return out
}

/** 성격마다 손님이 여행 섬에 온 이유. 대화마다 차례로 돌려 가며 쓴다. */
const WHY: Record<string, string[]> = {
  cheery: [
    '바다 바람 쐬러 놀러 왔어! 여기 오렌지가 엄청 달아!',
    '여행 다니는 게 취미야. 오늘은 이 섬이 마음에 들어!',
    '배 타고 오다 갈매기랑 경주했어! 내가 이겼지!',
    '파도 소리에 맞춰 노래 연습하기 좋대서 왔어!',
    '친구가 여기 오렌지 맛있다고 해서 따라왔어!',
  ],
  lazy: [
    '낮잠 자기 좋은 데 찾다가 여기까지 왔어…',
    '오렌지 냄새 따라왔는데 졸리네~',
    '야자수 그늘이 편하다길래 왔어~',
    '배에서 한숨 자고 일어나니까 여기더라~',
    '햇볕이 따뜻해서 그냥 눌러앉고 싶어~',
  ],
  shy: [
    '저, 저기… 조용한 데가 좋아서 혼자 왔어요…',
    '사람 많은 데는 좀 무서워서… 여긴 괜찮네요.',
    '바다 소리가 좋아서… 그냥 와 봤어요…',
    '꽃이 많다고 해서… 구경하러 왔어요…',
    '아무도 나를 모르는 데라서 마음이 편해요…',
  ],
  cool: [
    '멋진 경치를 찾아 떠도는 중이야.',
    '이 섬 노을이 좋다길래 와 봤어.',
    '새 책을 찾으러 왔는데 서점이 없더라.',
    '별이 잘 보이는 곳을 찾다 보니 여기까지 왔어.',
    '조용히 차 마시기 좋은 곳이 필요했거든.',
    '바람 따라 걷다 보니 여기까지 왔어.',
  ],
  sporty: [
    '아침마다 이 섬 한 바퀴 뛰는 중이야! 하나, 둘!',
    '여기 길이 평평해서 달리기 좋겠어!',
    '수영하다 보니 여기까지 왔지 뭐야!',
    '더 넓은 데서 달리고 싶어서 왔어! 여기 길 좋다!',
    '여행지 달리기 대회에 나갔다가 1등을 놓쳤어!',
    '바닷바람 맞으며 뛰면 기분이 최고거든!',
  ],
  grumpy: [
    '흥, 그냥 지나가는 길이야.',
    '살 곳을 찾는 중이야. 아무 데나 살 순 없잖아?',
    '여기 오렌지가 달다길래… 흥, 한 번 와 본 거야.',
    '시끄러운 데는 질려서 조용한 곳을 찾았어.',
    '칭찬해 줄 사람이 있을까 해서 와 봤어. 흥.',
    '배에서 자다 깼는데 여기더라. 흥.',
  ],
}

/** 손님에게 던지는 질문. 질문에는 말끝 버릇을 붙이지 않는다. */
const ASKS = [
  '너는 어디서 왔어? 도토리섬? 거긴 어떤 곳이야?',
  '도토리섬엔 어떤 일이 제일 재밌어?',
  '도토리섬 바다는 파래? 수영하기 좋아?',
  '너는 주로 뭐 하면서 시간을 보내?',
  '도토리섬엔 어떤 주민들이 살아?',
  '여기 오렌지 말고 또 맛있는 과일 있어?',
  '도토리섬 밤하늘에도 별이 많이 떠?',
  '너희 섬에서 제일 좋아하는 곳이 어디야?',
  '여기 말고 또 가 보고 싶은 섬 있어?',
  '도토리섬에도 나무가 많이 자라?',
]

/** 두 번째 이야기부터 쓰는 인사. 평서문만 쓴다. */
const GREETS = ['어, 또 왔구나!', '또 만났네! 오늘도 바닷바람이 좋아.', '어라, 또 보네!', '오, 아까 그 친구!', '또 왔네. 이 섬이 그렇게 좋대?', '어머, 여기서 또 보네!']

/** 여러 번 말을 걸어도 같은 줄이 연달아 나오지 않도록, 대화 순번과 날짜로 자리를 돌린다. */
function rotate<T>(xs: readonly T[], nth: number, seed: string): T {
  return xs[(Math.max(nth, 1) - 1 + hashString(seed)) % xs.length]
}

export interface GuestTalk {
  lines: string[]
  ask: Ask | null
}

/**
 * 여행 섬 손님과의 대화. 처음엔 자기소개, 그다음엔 도토리섬 이야기에 귀를 기울이다 초대를 받는다.
 * - invited: 이미 초대받아 집터를 기다리는 중
 * - waiting: 다른 손님 집을 아직 안 지어서 지금은 초대할 수 없음
 * nth 는 이 손님과의 대화 순번, day 는 날짜. 둘로 줄을 돌려 쓴다.
 */
export function guestTalk(v: Villager, c: { nth: number; invited: boolean; waiting: string | null; day?: string }): GuestTalk {
  const kind = PERSONALITY[v.id] ?? 'cheery'
  const t = (line: string) => withTic(line, v.tic)
  const seed = `${v.id}:${c.day ?? ''}`
  if (c.invited) {
    return { lines: [t('또 만났네!'), t(rotate(['내 집이 다 지어지면 바로 이사 갈게. 기대된다!', '집터 생겼다는 소식 들었어! 짐 싸 두고 기다릴게.'], c.nth, seed))], ask: null }
  }
  const hello = c.nth <= 1 ? t(`안녕! 나는 ${v.name}. 처음 보는 얼굴이네?`) : t(rotate(GREETS, c.nth, seed))
  const lines = [hello, t(rotate(WHY[kind], c.nth, seed))]
  if (c.waiting) {
    lines.push(t(`${josa(c.waiting, '이', '가')} 곧 이사 간대! 거기 재밌어 보이더라.`))
    return { lines, ask: null }
  }
  lines.push(rotate(ASKS, c.nth, seed))
  return {
    lines,
    ask: {
      options: [
        { label: '🏡 우리 섬에 와서 살래?', reply: t('정말? 나 거기 살아도 돼?! 좋아, 집터 잡아 두면 갈게!'), invite: true },
        { label: '🌊 바다가 예쁜 섬이야', reply: t('우와, 언젠가 꼭 가 보고 싶다!') },
        { label: '👋 다음에 또 봐', reply: t('응! 또 놀러 와!') },
      ],
    },
  }
}
