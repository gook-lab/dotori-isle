import type { TodayTalk } from './chat'
import { hashString } from './rng'
import { bottleDay } from './bottle'
import { currentChapter } from './story'
import { isRecapDay } from './weekRecap'
import { songiMood } from './shopRoom'
import { dailyStock, upgradeState, type ShopState } from './shopTiers'
import { milestoneOf, type MilestoneInput } from './milestoneTalk'

/**
 * 주민 수다에 쓸 오늘 섬 소식. 게임 상태에서 이미 있는 데이터만 모아 화제 조건(TodayTalk)으로 바꾼다.
 * 저장하지 않는 순수 함수라 같은 상태면 같은 결과가 나온다.
 */

export interface TodayInput {
  day: string
  hour: number
  shop: ShopState
  /** 오늘 아침 방송 줄(없을 수 있다) */
  news: readonly string[] | null
  /** 마친 섬 이야기 장 수 */
  storyChapter: number
  /** 섬 이야기를 다 보고 에필로그까지 끝났다 */
  storyDone: boolean
  /** 지난 일요일 이번 주 소식 줄(없으면 빈 목록) */
  weekRecap: readonly string[]
  /** 호박 등불 밤(저녁)인가 */
  pumpkinNight?: boolean
  harvestFair?: boolean
  /** 오늘이 그 해 첫눈 날 */
  firstSnow?: boolean
  /** 플레이어 생일이다 */
  playerBirthday?: boolean
  /** 경제 이정표 입력(상점·대출·증축·섬 가꾸기·계절 주간). 없으면 이정표 화제는 없다. */
  milestone?: MilestoneInput
}

/** 방송 줄 하나를 고른다. 첫 줄은 날씨라서 빼고, 나머지 중 날마다 하나를 고른다. 이모지 머리글은 뗀다. */
export function broadcastQuote(news: readonly string[], day: string): string | undefined {
  const rest = news.slice(1)
  if (rest.length === 0) return undefined
  return rest[hashString(`broadcast:${day}`) % rest.length].replace(/^\S+\s/, '')
}

export function todayTalk(s: TodayInput): TodayTalk {
  const status = upgradeState(s.shop, s.day)
  const closed = status.status === 'closed'
  const stock = closed ? [] : dailyStock(status.tier, s.day)
  const t: TodayTalk = {}
  // 상점은 문이 닫혔거나 오늘 진열이 있을 때만 화제가 된다
  if (closed || stock.length > 0) {
    const sale = stock.find((e) => e.flash)?.name ?? stock.find((e) => e.sale)?.name ?? null
    t.shop = { closed, sale }
  }
  const quote = s.news ? broadcastQuote(s.news, s.day) : undefined
  if (quote) t.broadcast = quote
  if (songiMood(s.day, s.hour) === 'high') t.songiHigh = true
  const chapter = currentChapter(s.storyChapter)
  if (chapter) t.story = { no: chapter.no, title: chapter.title }
  if (s.storyDone) t.storyDone = true
  if (s.pumpkinNight) t.pumpkin = true
  if (s.harvestFair) t.harvest = true
  if (s.firstSnow) t.firstSnow = true
  if (s.playerBirthday) t.playerBirthday = true
  // 이번 주 소식은 일요일에만 화제가 된다
  if (isRecapDay(s.day) && s.weekRecap.length > 0) {
    t.weekQuote = s.weekRecap[hashString(`week-quote:${s.day}`) % s.weekRecap.length].replace(/^\S+\s/, '')
  }
  if (bottleDay(s.day)) t.bottle = true
  if (s.milestone) {
    const kind = milestoneOf(s.milestone)
    if (kind) t.milestone = { kind, day: s.day }
  }
  return t
}
