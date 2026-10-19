/** 대화 구도 점 (x, z 는 바닥 위치, y 는 높이) */
export interface SightPoint {
  x: number
  z: number
  y: number
}

/** 얼굴 높이: 발 위 이만큼을 머리로 본다 */
export const TALK_EYE_HEIGHT = 1.2

const SAMPLES = 12
/** 지표가 시선보다 이만큼 낮아도 가린 것으로 본다(모서리 떨림 방지) */
const SIGHT_MARGIN = 0.1

/**
 * 카메라에서 두 얼굴까지 가는 시선이 땅(절벽·둑·언덕)에 가리는지 본다.
 * 시선을 여러 점으로 나눠 그 자리의 지표 높이가 시선 높이보다 높으면 가린 것이다.
 * 나무·집·주민 같은 물체는 호출하는 쪽(Player 의 blocksView)이 따로 본다.
 */
export function terrainBlocksSight(
  cam: SightPoint,
  faces: readonly SightPoint[],
  heightAt: (x: number, z: number) => number,
): boolean {
  return faces.some((f) => {
    for (let i = 1; i <= SAMPLES; i++) {
      // 얼굴 바로 앞은 대화 상대의 발밑 지형이라 빼고 본다.
      const k = (i / SAMPLES) * 0.9
      const x = cam.x + (f.x - cam.x) * k
      const z = cam.z + (f.z - cam.z) * k
      const sightY = cam.y + (f.y - cam.y) * k
      if (heightAt(x, z) > sightY + SIGHT_MARGIN) return true
    }
    return false
  })
}
