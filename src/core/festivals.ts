import { hashString } from './rng'
import { seasonOfMonth, type Season } from './season'

/**
 * 계절 축제. 계절마다 한 번, 그 달 15일에 광장에서 열린다.
 * 축제 날에만 할 일 한 가지가 있고, 끝내면 축제 전용 가구를 받는다(상점에는 없다).
 * 날짜 계산과 할 일 판정은 순수 함수다. 진행 기록은 store 가 든다.
 */

export type FestivalTask = 'water' | 'sit' | 'offer' | 'snowman'

export interface Festival {
  season: Season
  name: string
  icon: string
  /** 축제가 열리는 달(일은 FESTIVAL_DAY) */
  month: number
  task: FestivalTask
  /** 할 일을 몇 번(또는 몇 종) 해야 끝나는지 */
  target: number
  /** 할 일 한 줄. 패널과 편지에 쓴다. */
  goal: string
  /** 축제 전용 가구 id (items.ts) */
  reward: string
  /** 축제 전날 편지 한 줄 */
  eve: string
  /** 축제 날 광장에서 주민이 건네는 한 줄 */
  line: string
}

export const FESTIVAL_DAY = 15

/** 저장되는 축제 기록. day 는 진행 중인 축제 날짜, n 은 할 일 진행 수, offered 는 수확제에 바친 과일, claimed 는 선물을 보낸 축제 날짜들. */
export interface FestivalState {
  day: string | null
  n: number
  offered: string[]
  claimed: string[]
}

export const FESTIVALS: Record<Season, Festival> = {
  spring: {
    season: 'spring',
    name: '봄 꽃잔치',
    icon: '🌸',
    month: 4,
    task: 'water',
    target: 3,
    goal: '오늘 꽃에 물을 3번 주기',
    reward: 'blossom-arch',
    eve: '내일은 꽃잔치예요. 꽃에 물을 듬뿍 줘 두면 광장이 더 예뻐질 거예요.',
    line: '오늘은 꽃잔치야! 꽃에 물 주는 사람이 제일 멋져.',
  },
  summer: {
    season: 'summer',
    name: '여름 불꽃놀이 밤',
    icon: '🎆',
    month: 7,
    task: 'sit',
    target: 1,
    goal: '밤에 벤치나 의자에 앉아 불꽃 보기',
    reward: 'paper-lantern',
    eve: '내일 밤에는 불꽃놀이가 있어요. 밤에 광장 의자에 앉아서 같이 봐요.',
    line: '밤에 불꽃이 터질 거야. 의자에 앉아서 같이 봐!',
  },
  autumn: {
    season: 'autumn',
    name: '가을 수확제',
    icon: '🧺',
    month: 10,
    task: 'offer',
    target: 3,
    goal: '과일 3개를 수확제 주인에게 바치기',
    reward: 'harvest-scarecrow',
    eve: '내일은 수확제예요. 과일을 여러 가지 가져오면 주인이 좋아할 거예요.',
    line: '수확제니까 과일을 가져와 줘. 색깔별로 다르면 더 좋아!',
  },
  winter: {
    season: 'winter',
    name: '겨울 눈사람 대회',
    icon: '⛄',
    month: 1,
    task: 'snowman',
    target: 1,
    goal: '눈사람 인형을 섬에 놓아 대회에 내기',
    reward: 'ice-sculpture',
    eve: '내일은 눈사람 대회예요. 눈사람 인형을 하나 놓아 두면 심사를 받을 수 있어요.',
    line: '오늘 눈사람 대회야! 제일 멋진 눈사람을 기대할게.',
  },
}

/** 광장 중심(장터 자리)에서 진행 천막과 그 뒤 벤치까지의 자리. 장면과 행동이 같은 값을 쓴다. */
export const HOST_OFFSET = { x: 0, z: -3.3 }
/** 여름 축제의 종이 등불 두 개가 장터 자리에서 떨어진 곳. 밤에 실제 빛을 낸다(scene/OutdoorLamps.tsx). */
export const SUMMER_LANTERNS = [
  { x: -1.9, z: -1.7 },
  { x: 1.9, z: -1.7 },
] as const
export const FIREWORK_BENCH = { x: 0, z: -4.4 }

/** 축제 날 주민이 광장에 모이는 시간대(저녁부터 밤까지) */
export function crowdHour(hour: number): boolean {
  return hour >= 17 && hour < 23
}

/** 축제 날 저녁 광장에서 몇 명이 짧게 외치는 말. 말풍선 자리가 모자라면 세 명까지만 말한다. */
export const CROWD_LINES = ['와…!', '예쁘다!', '불꽃 보러 가자!', '같이 구경해요!']
export const CROWD_SPEAKERS = 3

/** 광장에 모인 주민 가운데 말할 몇 명. 해시 순서로 정해서 언제나 같은 주민이 말한다. */
export function crowdSpeakers(ids: readonly string[], n = CROWD_SPEAKERS): string[] {
  return [...ids].sort((a, b) => hashString(a) - hashString(b)).slice(0, n)
}

/** 날짜 키의 다음 날 키 */
export function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** 그 날이 축제 날이면 축제. 아니면 null */
export function festivalOn(key: string): Festival | null {
  if (Number(key.slice(8, 10)) !== FESTIVAL_DAY) return null
  const month = Number(key.slice(5, 7))
  const season = seasonOfMonth(month)
  const f = FESTIVALS[season]
  return f.month === month ? f : null
}

/** 내일이 축제 날이면 그 축제. 전날 편지에 쓴다. */
export function festivalEve(key: string): Festival | null {
  return festivalOn(nextDay(key))
}

/** 축제 기록의 진행 수. 기록이 다른 날 것이면 0이다. */
export function progressOn(state: { day: string | null; n: number }, key: string): number {
  return state.day === key ? state.n : 0
}

export function festivalDone(f: Festival, progress: number): boolean {
  return progress >= f.target
}

