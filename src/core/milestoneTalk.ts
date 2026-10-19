/**
 * 경제 이정표 수다: 상점이 막 올라간 날, 집 빚을 다 갚은 날, 증축이 끝난 다음 날, 섬 가꾸기 시설이 완성된 날,
 * 따뜻한 모금·꽃 심기 주간. 주민은 하루에 한 번(그날 처음 말을 걸 때) 이 가운데 하나를 꺼낸다.
 * 이정표는 저장된 날짜와 편지에서 읽는 것만 쓴다. 같은 입력이면 같은 결과다.
 */

import type { Personality } from './chat'
import { flowerWeekOn } from './flowerWeek'
import { hashString } from './rng'
import { warmFundOn } from './islandGift'

export type Milestone = 'shop-up' | 'loan-paid' | 'room-done' | 'gift-built' | 'warm-week' | 'flower-week'

export interface MilestoneInput {
  /** 오늘 날짜 키 */
  day: string
  /** 어제 날짜 키(증축이 끝난 다음 날을 가리는 데 쓴다) */
  yesterday: string
  /** 상점을 마지막으로 올린 날(없으면 null). 런타임에만 기억한다. */
  shopUpDay: string | null
  /** 오늘 대출을 다 갚았다(대출 편지 id 가 오늘 날짜) */
  loanPaidToday: boolean
  /** 집이 마지막으로 완성된 날(homeNew.day) */
  homeDoneDay: string | null
  /** 섬 가꾸기 시설이 마지막으로 완성된 날. 런타임에만 기억한다. */
  giftDoneDay: string | null
  /** 섬 가꾸기가 아직 남아 있다. 다 끝났으면 계절 주간 이야기는 하지 않는다. */
  giftOpen: boolean
}

/** 여러 이정표가 겹치면 이 순서로 하나만 고른다(가장 최근의 큰 일이 먼저다). */
export function milestoneOf(s: MilestoneInput): Milestone | null {
  if (s.shopUpDay === s.day) return 'shop-up'
  if (s.loanPaidToday) return 'loan-paid'
  if (s.homeDoneDay !== null && s.homeDoneDay === s.yesterday) return 'room-done'
  if (s.giftDoneDay === s.day) return 'gift-built'
  if (s.giftOpen && warmFundOn(s.day)) return 'warm-week'
  if (flowerWeekOn(s.day)) return 'flower-week'
  return null
}

type Pair = [string, string]
const P: Record<Milestone, Record<Personality, Pair>> = {
  'shop-up': {
    cheery: ['가게 새 간판 봤어? 진열도 더 많아졌더라!', '와, 더 넓어진 상점 빨리 구경 가자!'],
    shy: ['…가게 간판이 새로 달렸어. 예쁘더라.', '진열이 많아졌대. 구경 가도 돼?'],
    cool: ['상점 새 간판 달렸더라. 나쁘지 않네.', '진열이 늘었다니까 한번 봐 둬.'],
    lazy: ['가게 간판 새로 달았대~ 의자도 늘었을까~', '더 커졌다니까 구경하러 가야지~'],
    sporty: ['가게 새 간판 달았다! 우리 같이 뛰어가 보자!', '더 커진 상점 완전 멋져! 빨리 봐!'],
    grumpy: ['흥, 가게 간판 새로 달았더라. 뭐, 괜찮긴 해.', '진열 늘었다고 자랑할 거면 먼저 말해. 쳇.'],
  },
  'loan-paid': {
    cheery: ['집 빚 다 갚았다며? 진짜 대단하다!', '이제 너도 마음 편하게 지낼 수 있겠다!'],
    shy: ['…빚 다 갚았대. 정말 잘했어.', '이제 편하겠다. 축하해…'],
    cool: ['빚을 다 갚았다니 꽤 하는데.', '이제 집도 네 것이네. 축하해.'],
    lazy: ['빚 다 갚았대~ 이제 낮잠 마음 놓고 자겠다~', '편하게 누워 지내도 되겠네~ 축하해~'],
    sporty: ['빚 다 갚았다고? 완주 축하해!', '이제 집 짓기 다음 단계로 달려가자!'],
    grumpy: ['흥, 빚 다 갚았다며. 잘했어, 인정해 줄게.', '…그래도 축하는 해 줄게. 쳇.'],
  },
  'room-done': {
    cheery: ['어제 새 방 생겼지? 한번 구경시켜 줘!', '새 방 아직 못 봤는데, 가도 돼?'],
    shy: ['…어제 방이 늘었다며. 구경해도 돼?', '새 방 생겼다니까 궁금해…'],
    cool: ['어제 방 늘렸더라. 구경 가 볼게.', '새 방이 생겼다니, 꽤 쓸 만하겠네.'],
    lazy: ['방이 하나 늘었다며~ 거기서 낮잠 자면 좋겠다~', '새 방 구경 가고 싶다~ 나중에 보여 줘~'],
    sporty: ['새 방 생겼다고? 달려가서 보고 싶다!', '방 늘린 기념으로 같이 한 바퀴 돌자!'],
    grumpy: ['흥, 어제 방 늘렸더라. 나 말고 누구 불렀어?', '새 방은 내가 먼저 볼 거야. 쳇.'],
  },
  'gift-built': {
    cheery: ['섬에 새 시설이 생겼대! 광장 가서 같이 보자!', '우리가 모은 마일로 만든 거지? 신난다!'],
    shy: ['…섬에 새 시설이 생겼어. 같이 보러 갈래?', '마일 모은 덕분이래. 고마워…'],
    cool: ['섬에 새 시설이 들어섰더라. 꽤 쓸 만해.', '마일을 제법 모았네. 보기 좋아.'],
    lazy: ['섬에 새 시설 생겼대~ 앉아 쉴 데가 늘었겠다~', '마일 모은 게 여기서 보이네~ 좋다~'],
    sporty: ['섬에 새 시설이 생겼다! 어디 있는지 찾으러 가자!', '우리가 같이 모은 마일이야! 최고다!'],
    grumpy: ['흥, 섬에 새 시설이 생겼대. 뭐, 나쁘진 않네.', '마일 모으느라 고생했지. 쳇, 인정이야.'],
  },
  'warm-week': {
    cheery: ['이번 주는 기부 마일이 1.2배래! 같이 모으자!', '따뜻한 모금 주간이야! 광장 접수대 가 볼래?'],
    shy: ['…이번 주는 기부하면 더 많이 쌓인대.', '따뜻한 모금 주간이래. 마음 모아 보자…'],
    cool: ['이번 주 기부는 1.2배로 쌓인다더군.', '따뜻한 모금 주간이니 기부할 만하겠네.'],
    lazy: ['이번 주 기부하면 더 쌓인대~ 낮잠 전에 한 번 해 볼까~', '따뜻한 모금이래~ 따뜻하게 모으자~'],
    sporty: ['이번 주 기부 1.2배다! 달려가서 모으자!', '따뜻한 모금 주간이다! 같이 힘내서 채우자!'],
    grumpy: ['흥, 이번 주는 기부가 1.2배래. 그럼 나도 조금은 낼게.', '따뜻한 모금이니까 봐 줄게. 쳇.'],
  },
  'flower-week': {
    cheery: ['이번 주는 꽃 심기 주간이래! 씨앗 같이 심을까?', '꽃 심으면 마일도 받는대! 물도 같이 주자!'],
    shy: ['…이번 주는 꽃 심기 주간이래. 같이 심을래?', '꽃에 물 주면 마일도 준대. 해 볼래…?'],
    cool: ['이번 주는 꽃 심기 주간이라더군. 씨앗 좀 심어 봐.', '꽃에 물을 주면 마일도 쌓인대. 나쁘지 않네.'],
    lazy: ['이번 주 꽃 심기 주간이래~ 물뿌리개 들고 놀자~', '꽃 심으면 마일 준다니까 느긋하게 심자~'],
    sporty: ['꽃 심기 주간이다! 씨앗 심고 물 주러 뛰자!', '이번 주는 꽃밭 레이스야! 누가 더 많이 심나!'],
    grumpy: ['흥, 이번 주는 꽃 심기 주간이래. 씨앗은 내가 먼저 심을 거야.', '꽃 심으면 마일 준다며? 쳇, 그럼 심어 주지.'],
  },
}

/** 이정표 수다 한 줄. 같은 날 같은 주민에게는 같은 줄이 나오도록 날짜와 이름으로 고른다. */
export function milestoneTalkLines(m: Milestone, personality: Personality, day: string, villagerId: string): string[] {
  const pair = P[m][personality]
  return [pair[hashString(`milestone:${day}:${villagerId}`) % pair.length]]
}

/** 테스트와 점검용: 모든 이정표의 모든 성격 줄 */
export const MILESTONE_LINES = P
