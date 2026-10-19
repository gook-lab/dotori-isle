import { useFrame, type RootState } from '@react-three/fiber'
import { isIndoor } from '../game/indoor'
import { useGame } from '../game/store'

/**
 * 바깥 섬 전용 매 프레임 작업. 집·상점·전시관·동굴 안에서는 가려진 섬 바깥을 계산하지 않는다.
 * 가려진 그룹도 useFrame 은 돌기 때문에, 실내에서는 여기서 일찍 돌아온다.
 */
export function useOutdoorFrame(cb: (state: RootState, delta: number) => void): void {
  useFrame((state, delta) => {
    if (isIndoor(useGame.getState())) return
    cb(state, delta)
  })
}
