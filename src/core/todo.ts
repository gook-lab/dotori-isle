import { birthdaysOn } from './birthdays'
import { isMarketDay, weekdayOf } from './market'
import { sentToday, type OutLetter } from './mail'
import { isMeteorNight, meteorHours } from './skyEvents'
import { TOURNEY_CLOSE_HOUR, TOURNEY_OPEN_HOUR, TOURNEY_WEEKDAY } from './tourney'
import { dayIndex } from './economy'
import type { Weather } from './weather'

/** 해낸 항목 하나당 주는 마일리지 */
export const TODO_REWARD = 10
/** 하루에 받을 수 있는 마일리지 상한 */
export const TODO_DAY_CAP = 50

export type TodoId = 'fish' | 'bug' | 'market' | 'birthday' | 'letter-read' | 'letter-send' | 'tourney' | 'water' | 'dig' | 'meteor' | 'talk'

/** 항목 왼쪽에 붙는 아이콘 */
export const TODO_ICON: Record<TodoId, string> = {
  fish: '🐟',
  bug: '🦋',
  market: '🛍️',
  birthday: '🎂',
  'letter-read': '📬',
  'letter-send': '✉️',
  tourney: '🏁',
  water: '💧',
  dig: '🦴',
  meteor: '🌠',
  talk: '💬',
}

/** 저장하는 값: 정산한 날, 그날 정산한 항목, 그날 받은 마일리지, 그날 잡은 물고기와 벌레 수 */
export interface TodoState {
  day: string | null
  settled: TodoId[]
  miles: number
  fish: number
  bug: number
}

export const NEW_TODO: TodoState = { day: null, settled: [], miles: 0, fish: 0, bug: 0 }

const TODO_IDS: readonly TodoId[] = ['fish', 'bug', 'market', 'birthday', 'letter-read', 'letter-send', 'tourney', 'water', 'dig', 'meteor', 'talk']

/** 날이 바뀌면 이 값으로 새로 시작한다 */
export const freshTodo = (day: string): TodoState => ({ day, settled: [], miles: 0, fish: 0, bug: 0 })
const count = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0)

export function sanitizeTodo(raw: unknown): TodoState {
  if (!raw || typeof raw !== 'object') return NEW_TODO
  const p = raw as Partial<TodoState>
  const day = typeof p.day === 'string' && dayIndex(p.day) !== null ? p.day : null
  const settled = Array.isArray(p.settled) ? p.settled.filter((x): x is TodoId => TODO_IDS.includes(x)) : []
  const miles = typeof p.miles === 'number' && Number.isFinite(p.miles) ? Math.min(TODO_DAY_CAP, Math.max(0, Math.floor(p.miles))) : 0
  return { day, settled, miles, fish: count(p.fish), bug: count(p.bug) }
}

export interface TodoItem {
  id: TodoId
  title: string
  done: boolean
  /** 아직 할 수 없는 때(예: 밤 전). 흐리게 보여 주고 완료로 치지 않는다. */
  later?: boolean
}

/** 오늘의 할 일을 만드는 데 쓰는 상태. 저장된 값만 모아 둔다. */
export interface TodoCtx {
  day: string
  /** 지금 시각(시). 별똥별 소원은 저녁 이후에만 빈다. */
  hour: number
  weather: Weather
  villagerIds: readonly string[]
  nameOf: (id: string) => string
  giftDay: Readonly<Record<string, string>>
  talked: readonly string[]
  marketBought: readonly string[]
  tourneyLastDay: string | null
  wishNight: string | null
  plantCount: number
  plantsDry: number
  /** 오늘 땅에 묻힌 보물 id 와 이미 판 id */
  digIds: readonly string[]
  dug: readonly string[]
  /** 오늘 잡은 물고기와 벌레 수 */
  fishToday: number
  bugToday: number
  letters: readonly { day: string; read: boolean }[]
  outLetters: readonly OutLetter[]
}

const MAX_ITEMS = 7

/** 오늘 할 수 있는 일을 모은다. 조건에 맞는 것만 넣고, 많으면 MAX_ITEMS 에서 끊는다. */
export function todayTodos(c: TodoCtx): TodoItem[] {
  const items: TodoItem[] = []
  const add = (id: TodoId, title: string, done: boolean) => items.push({ id, title, done })
  add('fish', '낚시로 물고기 한 마리 잡기', c.fishToday > 0)
  add('bug', '벌레 한 마리 잡기', c.bugToday > 0)
  if (isMarketDay(c.day)) add('market', '장터에서 물건 하나 사기', c.marketBought.some((k) => k.startsWith(`${c.day}:`)))
  const birthdays = birthdaysOn(c.villagerIds, c.day)
  if (birthdays.length) {
    const names = birthdays.map(c.nameOf).join(', ')
    add('birthday', `${names}에게 생일 선물하기`, birthdays.every((id) => c.giftDay[id] === c.day))
  }
  const mail = c.letters.filter((l) => l.day === c.day)
  if (mail.length) add('letter-read', '우체통에서 오늘 온 편지 읽기', mail.every((l) => l.read))
  if (weekdayOf(c.day) === TOURNEY_WEEKDAY) add('tourney', `낚시 대회 참가 (${TOURNEY_OPEN_HOUR}~${TOURNEY_CLOSE_HOUR}시, 진행자 앞)`, c.tourneyLastDay === c.day)
  if (c.plantCount) add('water', '꽃에 물 주기', c.plantsDry === 0)
  if (c.digIds.length) add('dig', '땅에 묻힌 화석 파기', c.digIds.every((id) => c.dug.includes(id)))
  if (isMeteorNight(c.day, c.weather)) {
    const night = meteorHours(c.hour)
    items.push({ id: 'meteor', title: night ? '밤하늘 별똥별에 소원 빌기 (밖에서 E)' : '오늘 밤 소원 빌기 (20시부터)', done: night && c.wishNight === c.day, later: !night })
  }
  add('talk', '주민 한 명과 이야기하기', c.talked.length > 0)
  add('letter-send', '주민에게 편지 한 통 보내기', sentToday(c.outLetters, c.day))
  return items.slice(0, MAX_ITEMS)
}

/** 이미 정산한 항목과 오늘 받은 마일리지를 기준으로, 이번에 새로 줄 항목을 고른다. */
export function rewardTodos(items: readonly TodoItem[], settled: readonly TodoId[], milesToday: number): { settle: TodoId[]; miles: number } {
  const fresh = items.filter((i) => i.done && !settled.includes(i.id)).map((i) => i.id)
  const room = Math.max(0, Math.floor((TODO_DAY_CAP - milesToday) / TODO_REWARD))
  const paid = fresh.slice(0, room)
  return { settle: fresh, miles: paid.length * TODO_REWARD }
}
