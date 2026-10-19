import type { TreeSpot } from './world'

/** 첫 나무 흔들기 안내: 첫 목표가 나무 흔들기인 동안만 보이고, 한 번 흔들면 사라진다. */
export function shakeHintOn(stats: Readonly<Record<string, number>>, questsDone: readonly string[]): boolean {
  return !((stats.shake ?? 0) > 0) && !questsDone.includes('welcome')
}

/** 첫 흔들기 뒤 떨어진 열매를 아직 한 개도 줍지 않았을 때 목표줄에 줍기를 덧붙인다. 하나라도 주우면 사라진다. */
export function pickUpHintOn(stats: Readonly<Record<string, number>>, questsDone: readonly string[], pocketFruit: number): boolean {
  return (stats.shake ?? 0) > 0 && !questsDone.includes('welcome') && pocketFruit === 0
}

/** 아직 흔들지 않은 열매나무를 가까운 순서로. 화면에서 찾을 후보를 고를 때 쓴다. */
export function fruitTreesByDistance(trees: readonly TreeSpot[], gone: readonly string[], x: number, z: number): TreeSpot[] {
  return trees
    .filter((t) => t.kind === 'fruit' && !gone.includes(t.id))
    .map((t) => ({ t, d: (t.x - x) ** 2 + (t.z - z) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .map((e) => e.t)
}

/** 2일차 아침 모카의 작은 부탁. 섬에 온 지 하루 지난 날에 한 번 준다. */
export const SHORE_QUEST = 'shore-day2'
/**
 * 2일차 조개 부탁을 넣을 때인가. 섬에 온 지 하루 이상 지났고, 아직 없고 끝내지도 않았을 때 한 번 넣는다.
 * 2일차에 못 열고 며칠 뒤 들어와도 빠지지 않게 '정확히 2일차'가 아니라 '2일차 이후'로 본다.
 */
export function shoreDue(daysSince: number, questsDone: readonly string[], quests: readonly { id: string }[]): boolean {
  return daysSince >= 1 && !questsDone.includes(SHORE_QUEST) && !quests.some((q) => q.id === SHORE_QUEST)
}
export const SHORE_LETTER = 'day2-mocha'
export const SHORE_LETTER_TEXT = '어제 고마웠어! 오늘은 바닷가에서 조개를 주워 볼래? 파도가 밀어 준 조개가 많을 거예요.'

/** 주간 편지 제목에 쓰는 요일 이름 (0 = 일요일) */
export const WEEKDAY_NAME = ['일', '월', '화', '수', '목', '금', '토']
