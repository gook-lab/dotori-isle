import { useMemo } from 'react'
import { countOf, type Slot } from '../core/inventory'
import { nearestAfterGoals, type AfterGoal } from '../core/afterStory'
import { afterProgressOf } from '../game/afterProgress'
import { ITEMS, type ToolId } from '../core/items'
import { MAIN_QUESTS, questProgress, type GoalProgress, type QuestDef } from '../core/quests'
import { VILLAGERS } from '../core/villagers'
import { questBoard, useGame } from '../game/store'

/** HUD 목표줄과 미니맵 마커가 같이 쓰는 지금 할 일. 퀘스트 수첩(J)과 같은 계산을 쓴다. */
export interface Objective {
  quest: QuestDef
  /** 아직 덜 채운 첫 목표(다 채웠으면 첫 목표) */
  goal: GoalProgress
  /** 목표를 다 채워 보상을 받을 수 있는 상태 */
  ready: boolean
}

type BoardInput = Parameters<typeof questBoard>[0]

/**
 * 이야기 퀘스트 중 지금 보여줄 것. 받을 보상이 있으면 그걸 먼저 고른다.
 * 섬 이야기 현재 장의 퀘스트(focus)가 있으면 그쪽을 먼저 고른다.
 * 꽃 피우기처럼 며칠 걸리는 목표(slow)는 바로 할 수 있는 목표가 있으면 뒤로 민다.
 */
export function activeObjective(s: BoardInput, focus: readonly string[] = []): Objective | null {
  const main = questBoard(s).filter((q) => !q.def.id.startsWith('daily:'))
  const ready = main.find((q) => q.done)
  const open = main.flatMap((q) => {
    const goal = questProgress(q.def, s.stats, q.baseline).find((p) => p.current < p.goal.target)
    return goal ? [{ def: q.def, goal }] : []
  })
  if (ready) {
    const progress = questProgress(ready.def, s.stats, ready.baseline)
    return { quest: ready.def, goal: progress.find((p) => p.current < p.goal.target) ?? progress[0], ready: true }
  }
  const pick = open.find((c) => focus.includes(c.def.id) && !c.goal.goal.slow) ?? open.find((c) => !c.goal.goal.slow) ?? open[0]
  return pick ? { quest: pick.def, goal: pick.goal, ready: false } : null
}

/** 도구를 여는 방법. 퀘스트 보상으로 주는 도구는 그 퀘스트 이름을, 나머지는 상점 가격을 알려 준다. */
export function unlockHint(id: ToolId, price: number): string {
  const q = MAIN_QUESTS.find((m) => m.reward.tools?.includes(id))
  if (q) return `‘${q.title}’ 퀘스트를 깨면 열려요`
  return `상점에서 도토리 ${price.toLocaleString()}개에 살 수 있어요`
}

/** 집 짓기 재료 가운데 아직 모자란 것. 다 있으면 빈 배열이다. */
export function houseShortfall(villagerId: string, inventory: readonly Slot[]): { id: string; have: number; need: number }[] {
  const v = VILLAGERS.find((x) => x.id === villagerId)
  if (!v) return []
  return Object.entries(v.cost)
    .map(([id, need]) => ({ id, have: countOf(inventory, id), need }))
    .filter((m) => m.have < m.need)
}

/**
 * 집 짓기 목표줄 글. 모자란 재료만 `🪵2/6` 꼴로 보여 주고, 다 있으면 준비 완료를 알린다.
 * 집을 짓는 데 뭐가 더 필요한지 목표줄만 봐도 알 수 있게 하려는 것이다.
 */
export function houseLine(villagerId: string, inventory: readonly Slot[]): string {
  const name = VILLAGERS.find((x) => x.id === villagerId)?.name ?? ''
  const short = houseShortfall(villagerId, inventory)
  if (!short.length) return `🏠 ${name} 집 짓기 · 재료 준비 완료`
  return `🏠 ${name} 집 · ${short.map((m) => `${ITEMS[m.id].icon}${m.have}/${m.need}`).join(' ')}`
}

/** 할 일 목표가 없을 때 HUD 한 줄. 다음에 열릴 기능이 있으면 그것을, 없으면 휴대폰에서 할 일을 볼 수 있다고 알린다. */
export function idleObjectiveLine(nextHint: string | null): string {
  return nextHint ?? '📱 휴대폰(`)에서 오늘 할 일과 섬 살림을 볼 수 있어요'
}

/**
 * 섬 이야기를 마친 뒤의 다음 목표 세 개(HUD 목표 줄과 퀘스트 수첩이 같이 쓴다).
 * 5장을 마치기 전에는 빈 배열이다.
 */
export function useAfterGoals(): AfterGoal[] {
  const storyChapter = useGame((s) => s.storyChapter ?? 0)
  const shopTier = useGame((s) => s.shop.tier)
  const dex = useGame((s) => s.dex)
  const islandStars = useGame((s) => s.rating.stars)
  const homeStage = useGame((s) => s.home.stage)
  const homeFurniture = useGame((s) => s.homeFurniture)
  const wallPhoto = useGame((s) => s.wallPhoto)
  const placed = useGame((s) => s.placed)
  const gardenTiles = useGame((s) => s.gardenTiles)
  return useMemo(
    () => nearestAfterGoals(afterProgressOf({ storyChapter, shop: { tier: shopTier }, dex, rating: { stars: islandStars }, home: { stage: homeStage }, homeFurniture, wallPhoto, placed, gardenTiles })),
    [storyChapter, shopTier, dex, islandStars, homeStage, homeFurniture, wallPhoto, placed, gardenTiles],
  )
}
