import { gestureChat, pickChat, rememberTopic, type ChatContext } from './chat'
import { dayPart } from './clock'
import { friendshipLevel, VILLAGERS, type Villager } from './villagers'
import { seasonFor } from './season'
import { mulberry32 } from './rng'
import { todayTalk } from './todayTalk'
import { isPumpkinNight } from './pumpkin'
import { isHarvestFairDay } from './harvestFair'
import { isFirstSnowDay } from './firstSnow'
import { weatherFor } from './weather'
import { isRecapDay } from './weekRecap'
import { birthdayChatDue, isBirthday } from './birthdays'
import type { ShopState, ShopTier } from './shopTiers'
import { newsFor } from '../game/news'
import { WEARS } from './wardrobe'

/**
 * 주민 수다 시뮬레이션: 새 저장으로 여러 날 동안 주민들에게 말을 거는 흐름을 흉내 낸다.
 * 날씨·계절·행사·상점 단계·친한 정도가 날짜에 따라 바뀌고, 화제 기억(recent)은 주민마다 따로 쌓인다.
 * 실제 게임 흐름(store.ts 의 말 걸기)과 같은 순수 함수를 쓰고, 상태는 이 함수 안에만 둔다.
 */

/** 주민 수다 한 번의 기록 */
export interface TalkRecord {
  day: string
  hour: number
  villager: string
  topic: string
  lines: string[]
}

export interface SimOptions {
  /** 시작 날짜(YYYY-MM-DD) */
  start: string
  days: number
  seed: number
  /** 하루에 한 주민과 말하는 횟수의 최소·최대 */
  perDay?: [number, number]
}

const SHOUT = ['얍!', '와햐!', '헤에?!', '얍얍!']
const TOOLS = ['hand', 'rod', 'net', 'shovel', 'axe', 'can']
const HATS = WEARS.filter((w) => w.slot === 'hat').map((w) => w.id)
const OUTFITS = WEARS.filter((w) => w.slot === 'outfit').map((w) => w.id)
const WEEK_RECAP = ['물고기 3마리를 낚았어요.', '꽃에 물을 다섯 번 줬어요.', '도토리를 1,200개 모았어요.']
const TALK_HOURS = [8, 10, 12, 14, 16, 18, 20]

const dayAfter = (start: string, n: number): string => {
  const [y, m, d] = start.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 날짜가 흐르면서 상점이 한 단계씩 올라간다고 본다(8일마다 한 단계, 최고 3단계) */
const shopOn = (i: number): ShopState => ({ tier: Math.min(3, Math.floor(i / 8)) as ShopTier, order: null })

export function simulateTalks(opts: SimOptions): TalkRecord[] {
  const rng = mulberry32(opts.seed)
  const residents: Villager[] = VILLAGERS.filter((v) => !v.newcomer && !v.guest)
  const [lo, hi] = opts.perDay ?? [2, 3]
  const recent: Record<string, string[]> = {}
  const points: Record<string, number> = {}
  const answered: Record<string, string[]> = {}
  const birthdayDone: string[] = []
  const talkedToday = new Set<string>()
  const out: TalkRecord[] = []
  for (let i = 0; i < opts.days; i++) {
    const day = dayAfter(opts.start, i)
    const shop = shopOn(i)
    const home = { stage: 0 as const, loan: 0, order: null }
    const news = newsFor({ day, houses: [], shop, home })
    for (const v of residents) {
      const count = lo + Math.floor(rng() * (hi - lo + 1))
      const hours = Array.from({ length: count }, () => TALK_HOURS[Math.floor(rng() * TALK_HOURS.length)]).sort((a, b) => a - b)
      for (const hour of hours) {
        const key = `${day}:${v.id}`
        const today = todayTalk({ day, hour, shop, news, storyChapter: 2, storyDone: i >= 25, weekRecap: isRecapDay(day) ? WEEK_RECAP : [], pumpkinNight: isPumpkinNight(day, hour), harvestFair: isHarvestFairDay(day), firstSnow: isFirstSnowDay(day, weatherFor) })
        const ctx: ChatContext = {
          v,
          hour,
          part: dayPart(hour),
          weather: weatherFor(day),
          season: seasonFor(day),
          level: friendshipLevel(points[v.id] ?? 0),
          hat: i % 5 === 0 && HATS.length ? HATS[(i + v.id.length) % HATS.length] : null,
          outfit: OUTFITS[(i + v.id.length) % OUTFITS.length],
          tool: TOOLS[i % TOOLS.length],
          pocket: i % 3 === 0 ? ['mackerel'] : i % 4 === 1 ? ['peach'] : [],
          home: hour === 20 && i % 6 === 0,
          wornGift: i % 7 === 3 ? { id: OUTFITS[(i + v.id.length) % OUTFITS.length], taste: 'like' } : undefined,
          others: residents.filter((o) => o.id !== v.id).map((o) => ({ id: o.id, name: o.name })),
          recent: recent[v.id] ?? [],
          answered: answered[key] ?? [],
          allowAsk: true,
          today: { ...today, birthday: isBirthday(v.id, day) },
          birthdayDue: birthdayChatDue(v.id, day, !talkedToday.has(key), birthdayDone),
        }
        const chat = v.voice ? gestureChat(ctx, rng, SHOUT) : pickChat(ctx, rng)
        recent[v.id] = rememberTopic(recent[v.id] ?? [], chat.topic)
        talkedToday.add(key)
        if (chat.topic === 'birthday-talk') birthdayDone.push(key)
        if (chat.ask) answered[key] = [...(answered[key] ?? []), chat.topic]
        points[v.id] = (points[v.id] ?? 0) + 2
        out.push({ day, hour, villager: v.id, topic: chat.topic, lines: chat.lines })
      }
    }
  }
  return out
}

export interface TalkStats {
  talks: number
  lines: number
  /** 같은 주민에게 같은 줄이 사흘 안에 다시 나온 횟수 */
  repeat3: number
  /** 같은 주민에게 같은 줄이 이레 안에 다시 나온 횟수 */
  repeat7: number
  /** 화제별 등장 비율(0~1) */
  share: Record<string, number>
  /** 한 번도 나오지 않은 화제 */
  unseen: string[]
}

const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / 864e5

/** 시뮬레이션 기록을 같은 줄 반복과 화제 비율로 나눈다 */
export function analyzeTalks(records: readonly TalkRecord[], topicIds: readonly string[]): TalkStats {
  const lastSeen = new Map<string, number>()
  const topics: Record<string, number> = {}
  let lines = 0
  let repeat3 = 0
  let repeat7 = 0
  for (const r of records) {
    topics[r.topic] = (topics[r.topic] ?? 0) + 1
    for (const line of r.lines) {
      lines++
      const k = `${r.villager}|${line}`
      const prev = lastSeen.get(k)
      if (prev !== undefined) {
        const gap = dayNumber(r.day) - prev
        if (gap <= 3) repeat3++
        if (gap <= 7) repeat7++
      }
      lastSeen.set(k, dayNumber(r.day))
    }
  }
  const share: Record<string, number> = {}
  for (const [t, n] of Object.entries(topics)) share[t] = n / records.length
  return {
    talks: records.length,
    lines,
    repeat3,
    repeat7,
    share,
    unseen: topicIds.filter((t) => !topics[t]),
  }
}
