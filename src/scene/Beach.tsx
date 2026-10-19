import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { beachDecor } from '../core/beach'
import { heightAt, radiusAt } from '../core/island'
import { Merge, mul, shape, useMerged, xf } from './batching'

const SEGS = 260

/** 밀물·썰물 선: 물가에서 젖은 모래 띠가 파도 거품과 같은 속도로 들고 난다. 모래 위에만 그린다. */
export function Tide() {
  const geo = useMemo(() => {
    const pos: number[] = []
    const shore: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= SEGS; i++) {
      const th = (i / SEGS) * Math.PI * 2
      const r = radiusAt(th)
      for (const rr of [r - 1.0, r + 0.04]) {
        const x = Math.cos(th) * rr
        const z = Math.sin(th) * rr
        pos.push(x, heightAt(x, z) + 0.03, z)
        shore.push(r)
      }
    }
    for (let i = 0; i < SEGS; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1))
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uWet: { value: new THREE.Color('#948058') } },
        vertexShader: /* glsl */ `
          attribute float aShore;
          varying vec2 vXZ;
          varying float vShore;
          varying float vY;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vXZ = wp.xz;
            vShore = aShore;
            vY = wp.y;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uWet;
          varying vec2 vXZ;
          varying float vShore;
          varying float vY;
          void main() {
            float s = length(vXZ) - vShore;
            // 젖은 선: 파도가 밀려왔다 빠지는 주기(거품과 같은 0.35)로 물가 쪽 모래를 오간다
            float th = atan(vXZ.y, vXZ.x);
            float tide = -0.42 + 0.3 * sin(uTime * 0.35 + th * 1.7);
            float wet = smoothstep(tide - 0.2, tide + 0.1, s) * (1.0 - smoothstep(-0.05, 0.03, s));
            // 풀밭 위 절벽 쪽은 젖지 않는다
            wet *= 1.0 - smoothstep(0.18, 0.3, vY);
            // 젖은 모래 가장자리에 밝은 물거품 줄을 한 겹 얹는다
            float edge = (1.0 - smoothstep(0.0, 0.035, abs(s - tide))) * step(0.0, wet);
            float a = wet * 0.4;
            if (a < 0.01) discard;
            vec3 col = mix(uWet, vec3(1.0), edge * 0.5);
            gl_FragColor = vec4(col, a + edge * 0.15);
          }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return <mesh geometry={geo} material={mat} renderOrder={1} />
}

/** 떠밀려 온 나무토막과 해초 무더기. 한 덩어리로 굳히고 그림자는 드리우지 않는다. */
export function Driftwood() {
  const spots = useMemo(() => beachDecor(), [])
  const g = useMerged(
    (b) => {
      for (const s of spots) {
        const base = [s.x, heightAt(s.x, s.z), s.z] as [number, number, number]
        if (s.kind === 'log') {
          const M = xf(base, [0, s.rot, 0], s.scale)
          b.add(shape(THREE.CylinderGeometry, 0.2, 0.24, 1.6, 10), mul(M, xf([0, 0.2, 0], [0, 0, Math.PI / 2])), '#a7896a', { cast: false, outline: 0.05 })
        } else {
          // 해초: 납작한 뭉치 두세 개를 겹쳐 놓는다
          const M = xf(base, [0, s.rot, 0], s.scale)
          b.add(shape(THREE.ConeGeometry, 0.3, 0.42, 6), mul(M, xf([0, 0.1, 0], [0.15, 0, 0], [1, 1, 0.5])), '#3f7d4a', { cast: false })
          b.add(shape(THREE.ConeGeometry, 0.22, 0.34, 6), mul(M, xf([0.2, 0.08, 0.1], [0.1, 0.6, 0.2], [1, 1, 0.5])), '#5a9a52', { cast: false })
        }
      }
    },
    [spots],
  )
  return <Merge g={g} />
}
