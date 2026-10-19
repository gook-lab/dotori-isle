/**
 * 섬 이야기: 다섯 장으로 나뉜 메인 줄기. 장의 목표는 기존 퀘스트·기능 열림·통계·별점을 그대로 쓴다.
 * 저장은 "몇 장을 마쳤는지"(storyChapter) 하나뿐이다. 나머지는 지금 상태에서 다시 계산하므로
 * 예전 저장도 이미 채운 조건만큼 자동으로 넘어간다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */
import { ctxOf, systemOpen, type SystemId, type UnlockCtx } from './unlocks'

export type StoryGoal =
  | { kind: 'quest'; id: string; label: string }
  | { kind: 'stat'; stat: string; target: number; label: string; alt?: string }
  | { kind: 'system'; id: SystemId; label: string }
  | { kind: 'stars'; target: number; label: string }

export interface StoryReward {
  money?: number
  miles?: number
}

export interface StoryChapter {
  no: number
  title: string
  /** 장을 마쳤을 때 위원회 편지 끝 문장(해요체) */
  letter: string
  goals: StoryGoal[]
  reward: StoryReward
  /** 기념 가구 하나. 위원회 편지의 선물 칸으로 같이 온다(items.ts 의 story-*). */
  gift: string
}

export interface StoryCtx {
  unlock: UnlockCtx
  stats: Readonly<Record<string, number>>
  stars: number
}

/** 저장 상태(또는 그 일부)에서 장 계산 입력을 만든다 */
export function storyCtxOf(s: {
  day: string
  islandStart: string | null
  questsDone: readonly string[]
  dex: Record<string, number>
  stats: Record<string, number>
  rating: { stars: number }
}): StoryCtx {
  return { unlock: ctxOf(s), stats: s.stats, stars: s.rating.stars }
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    no: 1,
    title: '섬에 오다',
    letter: '섬 생활이 몸에 익었네요. 이제 이웃들을 맞이할 차례예요.',
    goals: [
      { kind: 'quest', id: 'welcome', label: '섬 생활 시작' },
      { kind: 'quest', id: 'dig', label: '땅속 보물 찾기' },
      { kind: 'quest', id: 'garden', label: '꽃밭 가꾸기' },
    ],
    reward: { money: 200 },
    gift: 'story-photo-frame',
  },
  {
    no: 2,
    title: '이웃 맞이',
    letter: '새 이웃들이 섬에 정착했어요. 다음은 집 이야기를 들어 볼까요.',
    goals: [
      { kind: 'quest', id: 'newcomer-guriguri', label: '새 이웃 구리구리 (모카 집 짓기부터)' },
      { kind: 'quest', id: 'newcomer-dongri', label: '새 이웃 동그리 (봄이 집 짓기부터)' },
      { kind: 'quest', id: 'shore-day2', label: '바닷가 조개 줍기' },
    ],
    reward: { money: 300, miles: 100 },
    gift: 'story-wreath',
  },
  {
    no: 3,
    title: '내 집 마련',
    letter: '마을 주민들이 모두 집을 가졌어요. 이제 섬 전체를 가꿀 차례예요.',
    goals: [
      { kind: 'quest', id: 'home-mocha', label: '모카의 집' },
      { kind: 'quest', id: 'home-bomi', label: '봄이의 집' },
      { kind: 'quest', id: 'home-pengdol', label: '펭돌의 집' },
    ],
    reward: { money: 500 },
    gift: 'story-cake',
  },
  {
    no: 4,
    title: '섬 꾸미기',
    letter: '꽃이 피고 전시관도 섰어요. 섬이 점점 우리 모습을 닮아 가네요.',
    goals: [
      { kind: 'stat', stat: 'bloom', target: 3, alt: 'blossom', label: '활짝 핀 꽃 (사흘 동안 매일 물 주기)' },
      { kind: 'system', id: 'museum', label: '자연사 전시관 열기 (도감 10종)' },
      { kind: 'stat', stat: 'plant', target: 10, label: '꽃씨 열 번 심기' },
    ],
    reward: { money: 300, miles: 200 },
    gift: 'story-garden',
  },
  {
    no: 5,
    title: '별점 섬',
    letter: '섬이 별점 세 개를 받았어요. 여기까지 함께 와 줘서 고마워요!',
    goals: [
      { kind: 'stars', target: 3, label: '섬 별점 세 개' },
      { kind: 'system', id: 'market', label: '장터 구경하기 (토요일 장)' },
    ],
    reward: { money: 1000, miles: 300 },
    gift: 'story-trophy',
  },
]

/**
 * 목표는 다 채웠지만 퀘스트 보상을 아직 받지 않아 장이 못 넘어간 상태.
 * 장의 퀘스트 목표는 보상을 받아야 완료되므로, 받을 수 있는(claimable) 퀘스트 id 로 이 상태를 본다.
 */
export function storyAwaitingClaim(ch: StoryChapter, c: StoryCtx, claimable: readonly string[]): boolean {
  if (storyProgress(ch, c).done) return false
  return ch.goals.every((g) => {
    if (g.kind === 'quest') return c.unlock.questsDone.includes(g.id) || claimable.includes(g.id)
    return goalCurrent(g, c) >= (g.kind === 'stat' || g.kind === 'stars' ? g.target : 1)
  })
}

/** 장이 넘어갈 때 띄울 배너 글 순서. from 장을 마친 뒤 from+1 장부터 차례로 넣는다(여러 장이 한꺼번에 넘어갈 때). */
export function storyBannerTexts(from: number, to: number): string[] {
  const out: string[] = []
  for (let k = from + 1; k <= to; k++) {
    const ch = STORY_CHAPTERS[k]
    out.push(ch ? `${ch.no}장 · ${ch.title}` : '섬 이야기를 모두 마쳤어요')
  }
  return out
}

/** 저장값을 믿을 수 있는 장 수로 고친다. 없거나 이상하면 0 */
export function cleanStoryChapter(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= STORY_CHAPTERS.length ? v : 0
}

/** 목표 하나의 현재값(0..target). 퀘스트·기능은 0 또는 1 로 본다. */
export function goalCurrent(g: StoryGoal, c: StoryCtx): number {
  switch (g.kind) {
    case 'quest':
      return c.unlock.questsDone.includes(g.id) ? 1 : 0
    case 'system':
      return systemOpen(g.id, c.unlock) ? 1 : 0
    case 'stat':
      // 대체 퀘스트를 이미 끝냈으면(예전 저장) 통계와 상관없이 다 채운 것으로 본다
      if (g.alt && c.unlock.questsDone.includes(g.alt)) return g.target
      return Math.min(g.target, c.stats[g.stat] ?? 0)
    case 'stars':
      return Math.min(g.target, c.stars)
  }
}

const goalTarget = (g: StoryGoal): number => (g.kind === 'stat' || g.kind === 'stars' ? g.target : 1)

export interface StoryGoalProgress {
  label: string
  current: number
  target: number
}

/** 장의 목표 진행과 완료 여부 */
export function storyProgress(ch: StoryChapter, c: StoryCtx): { goals: StoryGoalProgress[]; done: boolean } {
  const goals = ch.goals.map((g) => ({ label: g.label, current: goalCurrent(g, c), target: goalTarget(g) }))
  return { goals, done: goals.every((p) => p.current >= p.target) }
}

/** 지금 장의 퀘스트 id. 목표줄이 이 퀘스트부터 고른다. */
export function chapterQuestIds(cleared: number): string[] {
  return (currentChapter(cleared)?.goals ?? []).flatMap((g) => (g.kind === 'quest' ? [g.id] : []))
}

/** 지금 진행 중인 장. 다 마쳤으면 null. */
export function currentChapter(cleared: number): StoryChapter | null {
  return STORY_CHAPTERS[cleared] ?? null
}

/** 조건을 채운 장을 차례로 넘긴 뒤의 마친 장 수. 여러 장이 한꺼번에 채워져도 한 번에 센다. */
export function storyClearedCount(cleared: number, c: StoryCtx): number {
  let n = cleared
  while (n < STORY_CHAPTERS.length && storyProgress(STORY_CHAPTERS[n], c).done) n++
  return n
}

/** from 장(포함)부터 to 장(앞)까지 마친 장들의 보상 합 */
export function storyRewards(from: number, to: number): Required<StoryReward> {
  return STORY_CHAPTERS.slice(from, to).reduce(
    (acc, ch) => ({ money: acc.money + (ch.reward.money ?? 0), miles: acc.miles + (ch.reward.miles ?? 0) }),
    { money: 0, miles: 0 },
  )
}

/** 에필로그 연출 길이(밀리초). 5장을 모두 마치면 한 번 튼다. */
export const EPILOGUE_MS = 5000

/**
 * 에필로그 단계. 0.8초 만에 거의 까맣게 덮였다가(0.9), 1.5초에 반투명(0.45)으로 걷히며 섬 하늘 카메라가 비친다.
 * 1초부터 4초까지 끝 글이 떠 있고, 4.5초부터 완전히 밝아지며 5초에 끝난다.
 * dark 는 화면을 덮는 정도(0~1), text 는 글의 보임 정도(0~1)다.
 */
export function epilogueStage(ms: number): { dark: number; text: number; done: boolean } {
  const done = ms >= EPILOGUE_MS
  let dark: number
  if (ms < 800) dark = (0.9 * ms) / 800
  else if (ms < 1500) dark = 0.9 - (0.45 * (ms - 800)) / 700
  else if (ms < 4500) dark = 0.45
  else dark = (0.45 * Math.max(0, EPILOGUE_MS - ms)) / 500
  const fadeIn = Math.min(1, Math.max(0, (ms - 1000) / 300))
  const fadeOut = Math.min(1, Math.max(0, (4000 - ms) / 300))
  return { dark: done ? 0 : dark, text: Math.min(fadeIn, fadeOut), done }
}
