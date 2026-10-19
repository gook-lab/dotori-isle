import type { ReactNode } from 'react'
import { Chibi, type Motion, type Pose } from './Chibi'
import { RACCOON_LOOK } from './raccoon'
import { Toon } from './toon'

const TAIL_RINGS = 5

/**
 * 너구리 점원 한 마리. 안(상점 실내)과 바깥(공사·재개장 연출)이 같은 얼굴과 꼬리를 쓰도록 한 곳에 묶는다.
 * 눈가 마스크는 두 눈을 가로지르는 검은 띠이고, 꼬리는 몸 뒤쪽에서 위로 굽는 줄무늬 고리 다섯 개다.
 * children 은 Chibi 의 손 자리에 붙는다(망치 같은 소품).
 */
export function RaccoonClerk({ id, seed, motion, pose, children }: { id: string; seed: number; motion: () => Motion; pose?: () => Pose | null; children?: ReactNode }) {
  const look = RACCOON_LOOK[id] ?? RACCOON_LOOK.garam
  return (
    <group>
      <Chibi look={look} motion={motion} pose={pose} seed={seed}>
        {children}
      </Chibi>
      {/* 눈가 마스크: 눈 바로 뒤에 깔려 흰 하이라이트만 도드라진다 */}
      <mesh position={[0, 1.07, 0.428]}>
        <boxGeometry args={[0.66, 0.13, 0.03]} />
        <Toon color="#2b2320" />
      </mesh>
      {/* 꼬리 */}
      <group position={[0, 0.5, -0.45]} rotation={[0.5, 0, 0]}>
        {Array.from({ length: TAIL_RINGS }, (_, i) => (
          <mesh key={i} position={[0, i * 0.16, -i * 0.04]}>
            <cylinderGeometry args={[0.16, 0.14, 0.16, 12]} />
            <Toon color={i % 2 === 0 ? '#8a7560' : '#2b2320'} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
