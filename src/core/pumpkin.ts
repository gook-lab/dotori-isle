import type { Letter } from './letters'
import type { Personality } from './chat'
import { hashString } from './rng'

/**
 * 호박 등불 밤: 10월 31일 저녁 17시부터 자정까지 열리는 이 섬만의 계절 행사.
 * - 광장과 가로등 둘레에 호박 등불이 켜지고, 주민은 호박 망토나 달빛 가면을 쓴다(villagerWear 의 옷 칸을 쓴다).
 * - 말을 걸면 사탕을 달라고 한다. 사탕이 있으면 주고 답례 선물 편지를 받고, 없으면 장난을 쳐서 그날 옷 색이 바뀐다.
 * - 사탕은 행사 주간(10월 25일~31일) 도토리 상점에서 판다.
 * 판정은 모두 순수 함수다. 저장은 주민 장난·사탕 교환 기록(pumpkinDone)만 남긴다.
 */

export const PUMPKIN_MONTH_DAY = '10-31'
/** 저녁 행사 시작과 끝 시각(자정 전까지) */
export const PUMPKIN_FROM = 17
export const PUMPKIN_TO = 24
export const CANDY_ID = 'candy'
export const CANDY_PRICE = 30
export const CANDY_WEEK_FROM = 25
/** 사탕을 받은 주민이 주는 답례 가구 */
export const PUMPKIN_GIFTS = ['pumpkin-lantern', 'candy-basket'] as const

/** 옷 칸에 쓰는 행사 옷. 색만 쓰고 이름과 그림은 이 게임 것이다. */
export const PUMPKIN_COSTUMES = [
  { id: 'pumpkin-cape', name: '호박 망토', color: '#f08a2a' },
  { id: 'moon-mask', name: '달빛 가면', color: '#6b4fa0' },
] as const
/** 사탕을 안 주면 하는 장난: 그날 하루 옷 색이 이 색으로 바뀐다 */
export const PRANK_OUTFIT = { id: 'prank-teal', name: '장난 옷', color: '#4fb8a8' } as const

const costumeIds: readonly string[] = [...PUMPKIN_COSTUMES.map((c) => c.id), PRANK_OUTFIT.id]

/** 행사 옷 id 인가(주민이 입는 행사 옷·장난 옷) */
export const isPumpkinOutfit = (id: string): boolean => costumeIds.includes(id)

/** 옷 id 의 색. 행사 옷이 아니면 undefined. */
export function pumpkinOutfitColor(id: string): string | undefined {
  if (id === PRANK_OUTFIT.id) return PRANK_OUTFIT.color
  return PUMPKIN_COSTUMES.find((c) => c.id === id)?.color
}

/** 행사 옷(망토·가면)은 저녁 17시부터만 보인다. 장난 옷은 그날 하루 그대로다. */
export function costumeShown(outfit: string, night: boolean): boolean {
  if (PUMPKIN_COSTUMES.some((c) => c.id === outfit)) return night
  return true
}

/** 주민마다 망토와 가면을 번갈아 정한다. 같은 주민은 늘 같은 옷을 입는다. */
export function costumeFor(villagerId: string): string {
  return PUMPKIN_COSTUMES[hashString(`costume:${villagerId}`) % PUMPKIN_COSTUMES.length].id
}

/** 날짜 키가 10월 31일인가 */
export const isPumpkinDay = (day: string): boolean => day.endsWith(`-${PUMPKIN_MONTH_DAY}`)
/** 행사 전날(10월 30일)인가 */
export const isPumpkinEve = (day: string): boolean => day.endsWith('-10-30')
/** 행사 주간(10월 25일~31일)인가. 사탕은 이 주간에 도토리 상점에서 판다. */
export function isCandyWeek(day: string): boolean {
  const m = /^(\d{4})-10-(\d{2})$/.exec(day)
  return !!m && Number(m[2]) >= CANDY_WEEK_FROM && Number(m[2]) <= 31
}
/** 저녁 행사가 열려 있는 때: 10월 31일 17시부터 자정 전까지 */
export const isPumpkinNight = (day: string, hour: number): boolean => isPumpkinDay(day) && hour >= PUMPKIN_FROM && hour < PUMPKIN_TO

/** 사탕 교환 결과. 사탕이 있으면 답례 가구, 없으면 장난. 답례는 날짜와 주민으로 정한다. */
export type CandyOutcome = { kind: 'treat'; gift: (typeof PUMPKIN_GIFTS)[number] } | { kind: 'prank' }
export function candyOutcome(hasCandy: boolean, seed: string): CandyOutcome {
  if (!hasCandy) return { kind: 'prank' }
  return { kind: 'treat', gift: PUMPKIN_GIFTS[hashString(`candy-gift:${seed}`) % PUMPKIN_GIFTS.length] }
}

/** 광장 둘레에 호박 등불 자리를 고정 각도로 놓는다. 가로등과 막힌 자리는 건너뛴다. */
export const LANTERN_RING = 4.2
export const LANTERN_AVOID = 2.2
export function lanternSpotsAround(
  center: { x: number; z: number },
  avoid: readonly { x: number; z: number }[],
  clear: (x: number, z: number) => boolean,
): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const x = center.x + Math.cos(a) * LANTERN_RING
    const z = center.z + Math.sin(a) * LANTERN_RING
    if (!clear(x, z)) continue
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < LANTERN_AVOID)) continue
    out.push({ x, z })
  }
  return out
}

/** 행사 전날 아침 마을 방송 한 줄 */
export const PUMPKIN_EVE_LINE = '🎃 내일 저녁 17시부터 호박 등불 밤이에요. 사탕을 준비해 두면 주민들이 기뻐해요.'
/** 행사 당일 아침 마을 방송 한 줄 */
export const PUMPKIN_DAY_LINE = '🎃 오늘 저녁 17시부터 호박 등불 밤이에요. 광장과 상점 앞에 등불이 켜져요.'

/** 행사 날 아침 주민들이 보내는 편지 */
export function pumpkinLetter(day: string): Letter {
  return {
    id: `pumpkin-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '오늘 저녁엔 호박 등불 밤이에요. 광장과 상점 앞에 등불을 켜 둘게요. 사탕을 든 채 주민들을 찾아가 보세요!',
    gift: null,
    read: false,
    claimed: false,
  }
}

/** 사탕 답례 편지 */
export function pumpkinThanksLetter(day: string, v: { id: string; name: string }, gift: string): Letter {
  return {
    id: `pumpkin-thanks-${day}-${v.id}`,
    from: v.id,
    fromName: v.name,
    day,
    text: '사탕 고마워! 호박 등불 밤 답례로 작은 선물을 넣었어!',
    gift,
    read: false,
    claimed: false,
  }
}

/**
 * 사탕 대화 줄. 성격마다 두 줄씩 다르게 말한다.
 * ask: 사탕을 달라는 말, thanks: 사탕을 받은 고마움과 답례 소개, prank: 사탕이 없을 때의 장난 예고와 결과.
 */
const PUMPKIN_TALK: Record<Personality, { ask: [string, string]; thanks: (gift: string) => [string, string]; prank: [string, string] }> = {
  cheery: {
    ask: ['있잖아! 오늘 밤 사탕 있어? 나 사탕 주세요!', '호박 등불 보면서 같이 먹자, 헤헤!'],
    thanks: (g) => ['고마워! 진짜 달다!', `답례로 ${g} 줄게!`],
    prank: ['사탕 안 주면 장난칠 거야! 히히!', '에헤헤, 오늘 하루 옷 색이 바뀌었지?'],
  },
  shy: {
    ask: ['저기… 사탕 한 개만 줄래…?', '…나 사탕 엄청 좋아해…'],
    thanks: (g) => ['…고마워. 정말 달아…', `…답례로 ${g} 줄게…`],
    prank: ['…사탕 없으면 장난칠 거야…', '…헤헤, 오늘 옷 색 바뀐 거 눈치챘어?'],
  },
  cool: {
    ask: ['사탕 있어? 한 개면 충분해.', '호박 등불 밤엔 이런 것도 나쁘지 않지.'],
    thanks: (g) => ['고마워. 나쁘지 않은 맛이네.', `답례로 ${g} 줄게.`],
    prank: ['사탕이 없다니. 장난을 치는 수밖에.', '옷 색이 바뀌었지? 오늘 하루 그대로야.'],
  },
  lazy: {
    ask: ['사탕 줄 거지~? 한 개만~', '달달한 거 먹으면 졸린데도 눈이 번쩍 떠져~'],
    thanks: (g) => ['고마워~ 달콤하다~', `답례로 ${g} 줄게~`],
    prank: ['사탕 없으면 장난이야~ 히히~', '옷 색 바뀐 거 보여? 오늘 하루 그래~'],
  },
  sporty: {
    ask: ['사탕 주세요! 달리기 전에 에너지 충전!', '사탕 주면 같이 광장 한 바퀴 뛰자!'],
    thanks: (g) => ['좋아! 완전 힘 나!', `답례로 ${g} 줄게!`],
    prank: ['사탕 없으면 장난이다! 헤이!', '옷 색 바뀌었지? 오늘 하루 이 색이야!'],
  },
  grumpy: {
    ask: ['흥, 사탕 안 줄 거면 가만 안 둬.', '…사탕 달라고 한 거 아니거든. 그냥 한 개 줘.'],
    thanks: (g) => ['흥, 고마워. 나쁘지 않네.', `답례로 ${g} 줘. 쳇.`],
    prank: ['흥, 사탕 없으면 장난이다.', '…옷 색 바뀐 거 나만 본 거 아니지? 쳇.'],
  },
}

export const pumpkinAskLines = (p: Personality): string[] => [...PUMPKIN_TALK[p].ask]
export const pumpkinThanksLines = (p: Personality, gift: string): string[] => [...PUMPKIN_TALK[p].thanks(gift)]
export const pumpkinPrankLines = (p: Personality): string[] => [...PUMPKIN_TALK[p].prank]
