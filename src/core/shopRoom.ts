/**
 * 도토리 상점 안. 상점 건물 문으로 들어가면 방 한 칸에 들어서고, 계산대 뒤의 점원에게 E 로 상점 패널을,
 * 오른쪽 벽 ATM 에 E 로 통장 패널을 연다. 점원은 너구리 형제 둘이다(형 가람, 동생 나루).
 * 점원의 말은 날짜·상점 단계·날씨·요일·장날·송이 시세에 따라 고른 풀에서 나온다.
 * 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { dayIndex } from './economy'
import { josa } from './items'
import { isMarketDay, weekdayOf } from './market'
import { songiBase, songiOpen, songiWeekOf, songiWeekQuotes } from './songi'
import { weatherFor, type Weather } from './weather'
import { hashString } from './rng'

export const SHOP_NAME = '도토리 상점'

export interface Clerk {
  id: 'garam' | 'narl'
  name: string
  /** 어느 날에나 쓰는 말. 상점 단계·날씨 같은 조건에 맞는 말이 여기에 더해진다. */
  lines: readonly string[]
}

/** 송이 시세 상태. 평소보다 크게 높으면 high, 크게 낮으면 low, 시장이 닫혔으면 none. */
export type SongiMood = 'high' | 'low' | 'normal' | 'none'

export const CLERKS: readonly Clerk[] = [
  {
    id: 'garam',
    name: '가람',
    lines: [
      '어서 오세요, 도토리 상점이에요. 진열은 날마다 조금씩 바뀌어요.',
      '계산은 제가 맡아요. 고른 물건은 저기 계산대에서 사요.',
      '특가 칸은 싸게 드려요. 금방 빠지니까 서두르세요!',
      '물건을 들고 다니다 보면 주머니가 금방 차요. 필요 없는 건 팔고 가세요.',
      '저는 셈이 빨라요. 도토리 얼마 있는지 한눈에 봐 드릴게요.',
      '진열대 위 상품은 날마다 똑같지 않아요. 어제 못 본 게 있을지도 몰라요.',
      '가구 하나를 사면 섬에 놓아 보세요. 방에 놓으면 집 꾸미기 점수도 올라가요.',
      '계산대에 종이 있어요. 손님이 오면 울려 주려고 달아 둔 거예요.',
      '오늘도 찾아 주셔서 고마워요. 천천히 골라 보세요.',
      '흥정은 안 해요. 대신 특가는 제가 정직하게 붙여 둬요.',
      '사다 놓은 물건은 방에서 R 로 돌릴 수 있어요. 잊지 마세요.',
      '영수증은 필요하면 말씀하세요. 종이는 넉넉히 있어요.',
    ],
  },
  {
    id: 'narl',
    name: '나루',
    lines: [
      '형은 계산을, 저는 진열을 맡아요. 천천히 구경하세요.',
      '통장은 오른쪽 벽의 ATM 에서 맡기고 찾아요.',
      '가구는 한 번 가져 본 것만 주문할 수 있어요. 주문은 주문 탭에서요.',
      '진열대 칸을 보세요. 뒤쪽 칸부터 채워 두었어요.',
      '꽃병은 햇빛 드는 곳에 두면 더 예뻐요. 제 생각이에요.',
      '다른 집 가구가 궁금하면 방 장식을 보러 와 보세요. 우리 가게가 다 준비해요.',
      '저는 낮은 진열이 좋아요. 손님 눈높이에서 물건이 잘 보이거든요.',
      '포장은 천으로 해 드려요. 빨간 끈이 제 취향이에요.',
      '문 열 때 종이 울리면 저희가 나가 볼게요. 가끔 혼자 울리기도 해요.',
      '형이 가끔 졸아요. 그럴 땐 제가 대신 셈을 맞춰요.',
      '바깥에서 망치 소리가 들리면 공사 중이에요. 그래도 문은 열려 있을 때가 많아요.',
      '물건이 마음에 들면 바로 사 가세요. 다음 날엔 자리가 바뀌어 있을지 몰라요.',
    ],
  },
]

/** 상점 단계별 말. 단계(노점·가게·큰 가게·백화점)에 맞춰 같이 고른다. */
const TIER_LINES: readonly (readonly string[])[] = [
  ['노점 시절부터 오신 손님, 이제 가게 간판이 달린 곳에서 만나요.', '지금은 작은 노점이지만 진열은 정성껏 해요.', '손수레 하나로 시작한 가게예요. 알아 주셔서 고마워요.'],
  ['가게로 키운 뒤로 진열 칸이 늘었어요. 오른쪽 선반도 보세요.', '가게 간판을 새로 달았어요. 물건이 더 많아졌어요.', '이제 가구도 같이 놓아요. 골라 가 보세요.'],
  ['큰 가게가 되니까 손님이 많아졌어요. 천천히 봐 주세요.', '진열 칸이 다섯 줄이에요. 어디서부터 보실래요?', '큰 가게로 키워 주셔서 고마워요. 특가도 자주 붙어요.'],
  ['백화점이에요! 이 방에 다 있어요. 모든 진열을 한 번씩 보세요.', '백화점은 오늘도 활기차요. 특가 현수막 보셨어요?', '층마다 물건이 가득하던 가게가 여기까지 왔어요.'],
]

/** 날씨별 말. 맑음·흐림·비·눈 */
const WEATHER_LINES: Record<Weather, readonly string[]> = {
  sunny: ['창밖이 맑아요. 햇살에 진열이 더 잘 보여요.', '오늘처럼 맑은 날엔 밖에서 놀다 들어오는 손님이 많아요.'],
  cloudy: ['하늘이 흐려요. 실내에서 천천히 구경하기 좋은 날이에요.', '흐린 날엔 등을 켜 두어요. 그래도 물건은 잘 보여요.'],
  rain: ['비가 와서 손님이 적어요. 우산 두고 가지 마세요!', '비 오는 날엔 창가가 시끄러워요. 그래도 여기는 따뜻해요.'],
  snow: ['눈이 와요! 계산대 난로 앞으로 오세요.', '눈 오는 날엔 털모자 파는 걸 생각해 봤어요. 아직 진열엔 없어요.'],
}

/** 주말(토·일)에 하는 말. 장날(토요일)은 따로 있다. */
const WEEKEND_LINES: readonly string[] = ['주말엔 손님이 많아서 계산대가 바빠요.', '주말 구경은 천천히 해 주세요. 줄은 금방 줄어요.']

/** 장날(토요일)에 하는 말. 광장 장터와 같은 날이다. */
const MARKET_LINES: readonly string[] = ['오늘은 장날이라 광장에 가판대가 나와요. 가판대 물건은 거기서 사요.', '장날엔 가게가 조금 한가해요. 장터 구경도 같이 해 보세요.']

/** 송이 시세가 높을 때와 낮을 때의 말 */
const SONGI_LINES: Record<Exclude<SongiMood, 'none' | 'normal'>, readonly string[]> = {
  high: ['송이 값이 많이 올랐어요! 광장 송이 상인한테 가 보세요.', '오늘 송이는 비싸게 쳐 줘요. 팔 게 있으면 지금이에요.'],
  low: ['송이 값이 떨어졌어요. 사기엔 좋지만 팔기엔 아쉬운 날이에요.', '송이 시세가 내려갔어요. 다음 주를 기다려 봐도 좋아요.'],
}

/** 주간 한정 물건을 소개하는 말. 점원마다 말투가 다르다(둘 다 지금 점원의 해요체). */
const WEEKLY_LINES: Record<Clerk['id'], (name: string) => string> = {
  garam: (n) => `주간 한정으로 ${josa(n, '이', '가')} 나왔어요. 백화점 마감을 미리 입혀 뒀어요.`,
  narl: (n) => `주간 한정 ${josa(n, '은', '는')} 한 주에 한 번만 살 수 있어요. 다음 월요일에 새로 나와요.`,
}

/** 날짜·단계·송이 시세로 점원 말 풀을 짠다. 날씨와 요일과 장날은 날짜에서 바로 얻는다. weekly 는 주간 한정 물건의 이름(마감 포함, 없으면 null). */
export interface ClerkCtx {
  day: string
  tier: number
  songi: SongiMood
  weekly?: string | null
}

/** 점원이 쓸 수 있는 말 전부. 같은 조건이면 같은 풀이 나온다. */
export function clerkPool(id: Clerk['id'], ctx: ClerkCtx): string[] {
  const c = CLERKS.find((x) => x.id === id) ?? CLERKS[0]
  const tier = TIER_LINES[Math.min(3, Math.max(0, ctx.tier))]
  const weather = weatherFor(ctx.day)
  const weekday = weekdayOf(ctx.day)
  const weekend = weekday === 0 || weekday === 6
  const pool = [...c.lines, ...tier, ...WEATHER_LINES[weather]]
  if (weekend) pool.push(...WEEKEND_LINES)
  if (isMarketDay(ctx.day)) pool.push(...MARKET_LINES)
  if (ctx.songi === 'high' || ctx.songi === 'low') pool.push(...SONGI_LINES[ctx.songi])
  if (ctx.weekly) pool.push(WEEKLY_LINES[id](ctx.weekly))
  return pool
}

/** 점원의 대사 한 줄. 같은 날, 같은 조건이면 같은 줄이 나온다. */
export function clerkLine(id: Clerk['id'], ctx: ClerkCtx): string {
  const pool = clerkPool(id, ctx)
  const n = (dayIndex(ctx.day) ?? 0) + hashString(`${id}:${ctx.tier}`)
  return pool[Math.abs(n) % pool.length]
}

/** 토요일 오후 칸(주의 마지막 칸) 번호. songiSlotOf(토요일, 오후)와 같다. */
const SONGI_LAST_SLOT = 11

/** 지금 송이 시세가 어떤지. 평소 값(주간 기준)에서 많이 벗어나면 높음·낮음으로 본다. */
export function songiMood(day: string, hour: number): SongiMood {
  if (!songiOpen(day, hour)) return 'none'
  const week = songiWeekOf(day)
  if (!week) return 'none'
  // 일요일엔 칸이 없어 songiNow 가 0 이다. 그래서 그 주 마지막 시세(토요일 오후)를 지금 시세로 본다.
  const now = songiWeekQuotes(week)[SONGI_LAST_SLOT]
  const base = songiBase(week)
  if (now >= base * 1.25) return 'high'
  if (now <= base * 0.8) return 'low'
  return 'normal'
}

/** 점원이 말풍선으로 한 줄 말하는 시간(밀리초). 끝나면 상점 패널이 열린다. */
export const CLERK_SAY_MS = 1500

/** 들어갈 때 알리는 문구. 문 종소리와 함께 뜬다. */
export const SHOP_BELL_TEXT = `🔔 딸랑! ${SHOP_NAME}에 왔어요`
