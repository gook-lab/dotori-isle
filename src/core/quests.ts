import { hashString, mulberry32 } from './rng'
import { costLabel, ITEMS, TOOLS, type ToolId } from './items'
import { VILLAGERS } from './villagers'
import { formatMiles } from './miles'

/**
 * 퀘스트. 목표는 통계 카운터(stats)로 잰다. 대부분은 퀘스트를 받은 뒤 늘어난 양만 세고,
 * absolute 목표(집 짓기처럼 한 번 일어나면 끝인 일)는 누적값을 본다.
 */

export interface Goal {
  stat: string
  target: number
  label: string
  absolute?: boolean
  /** 하루에 한 번씩 쌓이는 목표. 이 말로 "어떻게 하면 되는지"를 함께 보여 준다. 바로 할 수 있는 목표가 있으면 그쪽을 먼저 띄운다. */
  slow?: string
}

export interface Reward {
  money?: number
  items?: [string, number][]
  tools?: ToolId[]
  recipes?: string[]
  miles?: number
}

/** 보상 한 줄 조각: 돈·도구·물건·레시피·마일. 보상 받기 줄과 받은 뒤 토스트가 같이 쓴다. */
export function rewardParts(r: Reward): string[] {
  return [
    r.money ? `🌰 ${r.money}` : '',
    ...(r.tools ?? []).map((t) => `${TOOLS[t].name}`),
    ...(r.items ?? []).map(([i, n]) => `${ITEMS[i].icon}${ITEMS[i].name}${n > 1 ? ` ×${n}` : ''}`),
    ...(r.recipes ?? []).map((x) => `📃${ITEMS[x].name} 레시피`),
    r.miles ? `🏅 ${formatMiles(r.miles)}` : '',
  ].filter(Boolean)
}

export interface QuestDef {
  id: string
  title: string
  giver: string
  story: string
  goals: Goal[]
  reward: Reward
  next?: string[]
}

/** 집 짓는 재료. 주민마다 다르니 주민 정의에서 읽는다. */
export const houseCost = (id: string) => costLabel(VILLAGERS.find((v) => v.id === id)!.cost)

/** 철광석이 어디서 나는지. 집 재료 설명마다 붙여 모자랄 때 갈 곳을 알려 준다. */
const IRON_HINT = ' 철광석은 바위를 두드리면 나와요. 가게가 생기면 상점에서도 살 수 있어요.'
const build = (id: string, name: string, next?: string[]): QuestDef => ({
  id: `home-${id}`,
  title: `${name}의 집`,
  giver: name,
  story: `${name}에게 아늑한 집을 지어 줘요. 재료는 ${houseCost(id)} 이면 돼요. 집터에서 바로 지어져요.${IRON_HINT}`,
  goals: [{ stat: `build:${id}`, target: 1, label: `${name}의 집 짓기`, absolute: true }],
  reward: { money: 300 },
  next,
})

export const MAIN_QUESTS: QuestDef[] = [
  {
    id: 'welcome',
    title: '섬 생활 시작',
    giver: '모카',
    story: '도토리섬에 온 걸 환영해요! 나무를 흔들고 떨어진 열매를 주워 상점에 팔아 봐요.',
    goals: [
      { stat: 'shake', target: 3, label: '나무 흔들기' },
      { stat: 'earn', target: 100, label: '도토리 벌기' },
    ],
    reward: { money: 100, tools: ['shovel'] },
    next: ['dig'],
  },
  {
    id: 'dig',
    title: '땅속 보물 찾기',
    giver: '펭돌',
    story: '삽으로 반짝이는 자리를 파고, 바위도 두드려 보세요. 뭔가 나올지도 몰라요!',
    goals: [
      { stat: 'dig', target: 2, label: '반짝이는 자리 파기' },
      { stat: 'rock', target: 3, label: '바위 두드리기' },
    ],
    reward: { tools: ['can'], items: [['flower-seed', 5]], recipes: ['stone-lantern'] },
    next: ['garden'],
  },
  {
    id: 'garden',
    title: '꽃밭 가꾸기',
    giver: '봄이',
    story: '꽃씨를 심고 물을 주면 하루하루 자라요. 같이 꽃밭을 만들어 볼까요?',
    goals: [
      { stat: 'plant', target: 3, label: '꽃씨 심기' },
      { stat: 'water', target: 3, label: '물 주기' },
    ],
    reward: { tools: ['axe'], recipes: ['log-bench'] },
    next: ['materials', 'blossom'],
  },
  {
    id: 'blossom',
    title: '활짝 핀 꽃',
    giver: '봄이',
    story: '꽃은 사흘 동안 매일 물을 줘야 활짝 펴요. 꽃 세 송이를 피워 주세요.',
    goals: [{ stat: 'bloom', target: 3, label: '꽃 피우기', slow: '매일 물 주기' }],
    reward: { items: [['lamp', 1]], recipes: ['iron-lamp'] },
  },
  {
    id: 'materials',
    title: '집 지을 재료',
    giver: '모카',
    story: '다들 집이 없어서 마당에서 지내요. 도끼로 목재를 모으고, 바위에서 돌과 철광석을 캐 주실래요?',
    goals: [
      { stat: 'chop', target: 10, label: '목재 모으기' },
      { stat: 'rock', target: 6, label: '바위에서 돌 캐기' },
    ],
    reward: { money: 200, items: [['trip-ticket', 1]] },
    next: ['home-mocha', 'home-bomi', 'home-pengdol'],
  },
  build('mocha', '모카', ['newcomer-guriguri']),
  build('bomi', '봄이', ['newcomer-dongri']),
  build('pengdol', '펭돌'),
  {
    id: 'newcomer-guriguri',
    title: '새 이웃 구리구리',
    giver: '섬 안내판',
    story: `땅속을 좋아하는 두더지 구리구리가 이사 올 집을 찾고 있대요. 재료는 ${houseCost('guriguri')} 이면 돼요.${IRON_HINT}`,
    goals: [{ stat: 'build:guriguri', target: 1, label: '구리구리의 집 짓기', absolute: true }],
    reward: { money: 500, items: [['telescope', 1]] },
  },
  {
    id: 'newcomer-dongri',
    title: '새 이웃 동그리',
    giver: '섬 안내판',
    story: `동글동글 고슴도치 동그리가 꽃이 많은 섬에 살고 싶대요. 재료는 ${houseCost('dongri')} 이면 돼요.${IRON_HINT}`,
    goals: [{ stat: 'build:dongri', target: 1, label: '동그리의 집 짓기', absolute: true }],
    reward: { money: 500, items: [['snowman', 1]] },
  },
  // 2일차 아침에 모카가 주는 작은 부탁. 날짜가 맞을 때 store 가 편지와 함께 한 번 넣는다(core/guide.ts).
  {
    id: 'shore-day2',
    title: '바닷가 조개 줍기',
    giver: '모카',
    story: '어제 고마웠어! 오늘은 바닷가에서 조개를 주워 볼래? 파도가 밀어 준 조개가 많을 거예요.',
    goals: [{ stat: 'shell', target: 3, label: '조개 줍기' }],
    reward: { money: 100 },
  },
]

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(MAIN_QUESTS.map((q) => [q.id, q]))
export const FIRST_QUEST = 'welcome'

const DAILY_POOL: Omit<QuestDef, 'id'>[] = [
  { title: '벌레 관찰', giver: '오늘의 부탁', story: '잠자리채로 벌레 두 마리를 잡아요.', goals: [{ stat: 'bug', target: 2, label: '벌레 잡기' }], reward: { money: 120 } },
  { title: '바다 낚시', giver: '오늘의 부탁', story: '물고기 두 마리를 낚아요.', goals: [{ stat: 'fish', target: 2, label: '물고기 낚기' }], reward: { money: 120 } },
  { title: '열매 수확', giver: '오늘의 부탁', story: '나무 세 그루를 흔들어요.', goals: [{ stat: 'shake', target: 3, label: '나무 흔들기' }], reward: { money: 100 } },
  { title: '꽃에 물 주기', giver: '오늘의 부탁', story: '꽃 세 송이에 물을 줘요.', goals: [{ stat: 'water', target: 3, label: '물 주기' }], reward: { money: 100 } },
  { title: '바위 캐기', giver: '오늘의 부탁', story: '바위를 세 번 두드려요.', goals: [{ stat: 'rock', target: 3, label: '바위 두드리기' }], reward: { money: 100 } },
  { title: '이웃 인사', giver: '오늘의 부탁', story: '주민 세 명과 이야기해요.', goals: [{ stat: 'talk', target: 3, label: '주민과 이야기하기' }], reward: { money: 100 } },
  { title: '부탁 들어주기', giver: '오늘의 부탁', story: '주민의 부탁을 하나 들어 줘요.', goals: [{ stat: 'give', target: 1, label: '부탁 들어주기' }], reward: { money: 150 } },
  { title: '목재 손질', giver: '오늘의 부탁', story: '도끼로 목재를 네 개 모아요.', goals: [{ stat: 'chop', target: 4, label: '목재 모으기' }], reward: { money: 120 } },
]

/** 그날의 일일 퀘스트 두 개. 같은 날이면 늘 같다. */
export function dailyQuests(day: string): QuestDef[] {
  const rng = mulberry32(hashString(`quest:${day}`))
  const a = Math.floor(rng() * DAILY_POOL.length)
  let b = Math.floor(rng() * (DAILY_POOL.length - 1))
  if (b >= a) b++
  return [a, b].map((i, k) => ({ ...DAILY_POOL[i], id: `daily:${day}:${k}`, reward: { ...DAILY_POOL[i].reward, miles: 100 } }))
}

export interface GoalProgress {
  goal: Goal
  current: number
}

export function questProgress(q: QuestDef, stats: Record<string, number>, baseline: Record<string, number>): GoalProgress[] {
  return q.goals.map((goal) => {
    const total = stats[goal.stat] ?? 0
    const gained = goal.absolute ? total : total - (baseline[goal.stat] ?? 0)
    return { goal, current: Math.max(0, Math.min(goal.target, gained)) }
  })
}

export function isComplete(q: QuestDef, stats: Record<string, number>, baseline: Record<string, number>): boolean {
  return questProgress(q, stats, baseline).every((p) => p.current >= p.goal.target)
}
