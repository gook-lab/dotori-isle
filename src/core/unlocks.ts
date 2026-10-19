import { devParam } from './devParam'
/**
 * 기능 열림 순서. 새 기능은 조건(퀘스트·날짜·도감·가게 단계)을 채우면 한 번만 편지로 알리고 연다.
 * 첫날에는 노점·기본 퀘스트·가방·옷장·도감·마일리지만 열려 있다. 나머지는 퀘스트와 날짜가 함께 맞아야 열려
 * 첫 2주에 걸쳐 나뉘어 나온다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { addDays, dayIndex } from './economy'
import { MUSEUM_DEX } from './museum'
import { isMarketDay } from './market'
import { shopTierFor, type ShopStats } from './shopTiers'
import type { Letter } from './letters'

export interface UnlockCtx {
  day: string
  islandStart: string | null
  questsDone: readonly string[]
  dexCount: number
  stats: ShopStats
}

export type SystemId = 'atm' | 'infra' | 'ladder' | 'home' | 'photo' | 'museum' | 'shop-1' | 'shop-2' | 'market'

export interface SystemDef {
  id: SystemId
  name: string
  /** 아직 안 열렸을 때 목표줄에 쓰는 한 줄(해요체) */
  hint: string
  open: (c: UnlockCtx) => boolean
  /** 열리는 날 편지 본문(해요체) */
  intro: string
}

/** 날짜 기준: 섬에 온 지 며칠째인지. 시작 날이 없으면 0 으로 본다. */
export function daysSinceStart(c: Pick<UnlockCtx, 'day' | 'islandStart'>): number {
  if (!c.islandStart) return 0
  const a = dayIndex(c.islandStart)
  const b = dayIndex(c.day)
  return a === null || b === null ? 0 : Math.max(0, b - a)
}

/** 저장 상태에서 열림 조건만 골라 만든다. 가게 통계는 store 와 같게 earn·spent 를 쓴다. */
export function ctxOf(s: {
  day: string
  islandStart: string | null
  questsDone: readonly string[]
  dex: Record<string, number>
  stats: Record<string, number>
}): UnlockCtx {
  return {
    day: s.day,
    islandStart: s.islandStart,
    questsDone: s.questsDone,
    dexCount: Object.keys(s.dex).length,
    stats: { sold: s.stats.earn ?? 0, spent: s.stats.spent ?? 0, questsDone: s.questsDone },
  }
}

const done = (c: UnlockCtx, id: string) => c.questsDone.includes(id)

/** 섬에 온 뒤 장날(토요일)이 한 번이라도 지났는지. 한 번 열리면 그 뒤로는 계속 열려 있다. */
export function marketSeen(c: UnlockCtx): boolean {
  if (!c.islandStart) return isMarketDay(c.day)
  const n = daysSinceStart(c)
  for (let i = 0; i <= n; i++) {
    const k = addDays(c.islandStart, i)
    if (k && isMarketDay(k)) return true
  }
  return false
}

/** 열림 순서대로 적은 목록. 목표줄은 여기서 아직 안 열린 첫 기능을 고른다. */
export const SYSTEMS: readonly SystemDef[] = [
  {
    id: 'atm',
    name: '도토리 ATM',
    hint: '‘땅속 보물 찾기’ 퀘스트를 깨면 도토리 상점 안 ATM 을 쓸 수 있어요',
    open: (c) => done(c, 'dig'),
    intro: '도토리 상점 안에 도토리 ATM 이 생겼어요. 통장에 도토리를 맡기고 찾을 수 있고, 집 대출도 여기서 갚아요.',
  },
  {
    id: 'infra',
    name: '섬 정비 안내판',
    hint: '‘꽃밭 가꾸기’ 퀘스트를 깨고 이틀이 지나면 섬 정비를 맡길 수 있어요',
    open: (c) => done(c, 'garden') && daysSinceStart(c) >= 2,
    intro: '섬 정비 안내판이 생겼어요. 다리와 계단을 맡기면 다음 날 아침에 지어져요. 맡긴 것은 철거해서 절반을 돌려받을 수 있어요.',
  },
  {
    id: 'ladder',
    name: '사다리',
    hint: '‘꽃밭 가꾸기’ 퀘스트를 깨고 나흘이 지나면 상점에서 사다리를 살 수 있어요',
    open: (c) => done(c, 'garden') && daysSinceStart(c) >= 4,
    intro: '상점에서 사다리를 살 수 있게 됐어요. 절벽 가장자리에서 위아래로 오르내릴 수 있어요.',
  },
  {
    id: 'home',
    name: '집 상담',
    hint: '‘집 지을 재료’ 퀘스트를 깨고 사흘이 지나면 광장 간판에서 집 상담을 할 수 있어요',
    open: (c) => done(c, 'materials') && daysSinceStart(c) >= 3,
    intro: '집 상담 창구가 생겼어요. 광장 간판 앞에서 E 를 누르면 집을 짓는 이야기를 들을 수 있어요.',
  },
  {
    id: 'photo',
    name: '사진 모드',
    hint: '‘활짝 핀 꽃’ 퀘스트를 깨고 닷새가 지나면 사진 모드가 열려요',
    open: (c) => done(c, 'blossom') && daysSinceStart(c) >= 5,
    intro: '사진 모드가 열렸어요. P 키나 메뉴에서 섬 풍경을 찍어 저장할 수 있어요.',
  },
  {
    id: 'museum',
    name: '자연사 전시관',
    hint: `도감에 ${MUSEUM_DEX}종을 올리면 광장에 자연사 전시관이 서요`,
    open: (c) => c.dexCount >= MUSEUM_DEX,
    intro: '도감이 열 종을 넘어서 자연사 전시관이 서요. 학예사 올롱에게 물고기·벌레·바닷가 생물·화석을 한 개씩 기증해 보세요.',
  },
  {
    id: 'shop-1',
    name: '가게 키우기',
    hint: '상점을 가게로 키울 수 있으려면 도토리 1,000개를 팔고 ‘집 지을 재료’ 퀘스트를 깨야 해요',
    open: (c) => shopTierFor(c.stats) >= 1,
    intro: '노점을 가게로 키울 수 있어요. 도토리 1,500개가 들고, 공사하는 하루 동안 문을 닫아요. 물뿌리개도 이때부터 키울 수 있어요.',
  },
  {
    id: 'shop-2',
    name: '큰 가게 키우기',
    hint: '가게를 큰 가게로 키우려면 도토리 1만 개를 팔고 ‘새 이웃 구리구리’ 퀘스트를 깨야 해요',
    open: (c) => shopTierFor(c.stats) >= 2,
    intro: '가게를 큰 가게로 키울 수 있어요. 도토리 6,000개가 들고, 매일 진열하는 가구 종류가 크게 늘어요.',
  },
  {
    id: 'market',
    name: '장터',
    hint: '토요일 아침에 광장 장터가 열려요',
    open: (c) => marketSeen(c),
    intro: '오늘은 장날이에요! 광장 가판대에 오늘만 나온 물건이 있어요. 한 번씩 구경해 보세요.',
  },
]

/** 목록 순서가 곧 열림 순서다. 다른 기능과 겹치지 않게 위에서부터 본다. */
export const SYSTEM_IDS: readonly SystemId[] = SYSTEMS.map((s) => s.id)

export const systemOpen = (id: SystemId, c: UnlockCtx): boolean => SYSTEMS.find((s) => s.id === id)!.open(c)

/** 지금 열린 기능 가운데 아직 편지로 알리지 않은 것 */
export function newlyOpened(c: UnlockCtx, introduced: readonly string[]): SystemDef[] {
  return SYSTEMS.filter((s) => !introduced.includes(s.id) && s.open(c))
}

/** 편지함에 넣을 소개 편지 한 통 */
export function introLetter(s: SystemDef, day: string): Letter {
  return { id: `intro-${s.id}`, from: 'committee', fromName: '섬 가꾸기 위원회', day, text: `${s.name} 소식이에요. ${s.intro}`, gift: null, read: false, claimed: false }
}

/** 아직 안 열린 기능 가운데 순서상 가장 앞선 것. 모두 열렸으면 null. */
export function nextUnlock(c: UnlockCtx): SystemDef | null {
  return SYSTEMS.find((s) => !s.open(c)) ?? null
}

/** 목표줄 대체 글: 다음에 열릴 기능을 가리킨다. */
export function nextUnlockHint(c: UnlockCtx): string | null {
  const n = nextUnlock(c)
  return n ? `다음에 열려요 · ${n.name}: ${n.hint}` : null
}

/** 아직 잠긴 기능이면 그 정의(이름·이유)를 돌려준다. 열렸으면 null. 잠긴 시설 앞 안내에 쓴다. */
export function lockedSystem(id: SystemId, c: UnlockCtx): SystemDef | null {
  const s = SYSTEMS.find((x) => x.id === id)
  return s && !s.open(c) ? s : null
}

/** 개발 확인용 잠금 풀기: 개발 빌드에서 ?unlock=<id> 로 해당 기능을 연다. */
export const devUnlocked = (id: string) => devParam('unlock') === id
