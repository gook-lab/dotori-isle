import * as THREE from 'three'
import { TIDE_POOLS } from '../core/tidepool'
import { heightAt } from '../core/island'
import { Merge, mul, shape, useMerged, xf } from './batching'

/** 남쪽 바닷가 물웅덩이: 얕은 물 원반과 둘레 바위. 한 덩어리로 굳히고 그림자는 드리우지 않는다. */
export function TidePools() {
  const merged = useMerged(
    (b) => {
      for (const p of TIDE_POOLS) {
        const y = heightAt(p.x, p.z)
        // 물 원반: 모래 위에 얇게 깔린다
        b.add(shape(THREE.CircleGeometry, p.r, 20), xf([p.x, y + 0.03, p.z], [-Math.PI / 2, 0, 0]), '#5fb3ad', { cast: false, unlit: true })
        // 둘레 바위 여덟 개
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.2
          const rx = p.x + Math.cos(a) * p.r * 1.02
          const rz = p.z + Math.sin(a) * p.r * 1.02
          const M = xf([rx, heightAt(rx, rz) + 0.05, rz], [0, a, 0], [0.22, 0.14, 0.2])
          b.add(shape(THREE.DodecahedronGeometry, 1, 0), mul(M), k % 2 ? '#8d8a80' : '#a39f92', { cast: false, outline: 0.08 })
        }
      }
    },
    [],
  )
  return <Merge g={merged} />
}
