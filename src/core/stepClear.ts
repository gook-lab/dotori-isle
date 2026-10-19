/**
 * 계단 자리에 걸친 플레이어 물건·길·정원 타일을 고른다. 저장을 읽을 때 한 번 정리한다(store 의 migrateSave).
 * 가구·시설은 주머니로 돌릴 목록으로, 길과 정원 타일은 그 칸만 지운 새 문자열로 돌려준다.
 */
import { decodeGarden, encodeGarden } from './gardenTiles'
import { decodePaths, encodePaths } from './paths'
import type { Placed } from './placement'
import { onStepSpot } from './tiers'

export interface StepClearResult {
  /** 계단 자리 밖에 남는 가구 */
  placed: Placed[]
  /** 계단 자리에서 걷어낸 가구(주머니로 돌려준다) */
  back: Placed[]
  pathsRaw: string
  gardenRaw: string
  pathsCleared: number
  gardenCleared: number
}

export function clearStepSpots(placed: readonly Placed[], pathsRaw: string, gardenRaw: string): StepClearResult {
  const keep: Placed[] = []
  const back: Placed[] = []
  for (const p of placed) (onStepSpot(p.x, p.z) ? back : keep).push(p)
  const paths = decodePaths(pathsRaw)
  const pathKeep = paths.filter((t) => !onStepSpot(t.x, t.z))
  const garden = decodeGarden(gardenRaw)
  const gardenKeep = garden.filter((t) => !onStepSpot(t.x, t.z))
  return {
    placed: keep,
    back,
    pathsRaw: paths.length === pathKeep.length ? pathsRaw : encodePaths(pathKeep),
    gardenRaw: garden.length === gardenKeep.length ? gardenRaw : encodeGarden(gardenKeep),
    pathsCleared: paths.length - pathKeep.length,
    gardenCleared: garden.length - gardenKeep.length,
  }
}
