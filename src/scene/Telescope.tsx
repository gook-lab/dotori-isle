import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { heightAt } from '../core/island'
import { seasonFor } from '../core/season'
import { constellationOf, skyDir, skyViewSpread, type SkyPt, TELESCOPE } from '../core/stars'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { type Batch, Merge, shape, useMerged, xf } from './batching'

/** 하늘 돔 반지름. 카메라 가까이 있는 가상의 구면에 별을 놓는다. */
const DOME_R = 70

/** 망원경 몸체: 삼각대 셋과 금동색 경통. 전망 벤치 옆에 바다 쪽을 향한다. */
function buildScope(b: Batch) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    b.add(shape(THREE.CylinderGeometry, 0.04, 0.04, 1.1, 6), xf([Math.sin(a) * 0.22, 0.5, Math.cos(a) * 0.22], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]), '#6b4528', { outline: 0.05 })
  }
  // 경통: 삼각대 위에서 하늘 쪽으로 기울어진다
  b.add(shape(THREE.CylinderGeometry, 0.1, 0.12, 0.9, 10), xf([0, 1.2, 0.05], [-0.9, 0, 0]), '#c9a55a', { outline: 0.05 })
  b.add(shape(THREE.CylinderGeometry, 0.16, 0.16, 0.14, 10), xf([0, 1.2, 0.05], [-0.9, 0, 0]), '#8f7438', { outline: 0.04 })
  b.add(shape(THREE.CylinderGeometry, 0.05, 0.05, 0.22, 8), xf([0, 1.5, -0.16], [-0.9, 0, 0]), '#5a4a35', { outline: 0.04 })
}

/** 별 점과 후광에 쓰는 둥근 빛 무늬. 가장자리로 갈수록 옅어진다. */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.8)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(c)
}

/** 별자리 이름 글씨. 작게 쓰고 투명 배경에 그린다. */
function nameTexture(name: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const g = c.getContext('2d')
  if (g) {
    g.font = '600 52px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // 옅은 글로: 같은 글씨를 흐린 빛으로 먼저 두껍게 깔고 그 위에 밝은 글씨를 올린다
    g.fillStyle = 'rgba(200, 225, 255, 0.9)'
    g.shadowColor = 'rgba(170, 210, 255, 0.9)'
    g.shadowBlur = 16
    g.fillText(name, 256, 48)
    g.shadowBlur = 0
    g.fillStyle = 'rgba(245, 250, 255, 1)'
    g.fillText(name, 256, 48)
  }
  return new THREE.CanvasTexture(c)
}

/** 한 점에서 다음 점으로 선을 긋는 데 걸리는 시간(초) */
const SEG_TIME = 0.6
/** 다 그린 뒤 이름이 떠오르는 시간(초) */
const NAME_FADE = 1.5

/**
 * 망원경 옆에 서서 보는 별자리. 점은 둥근 빛에 후광을 얹고, 선은 0.6초씩 점에서 점으로 차례로 그린다.
 * 다 그리면 별자리 아래 하늘에 이름이 1.5초 동안 떠오른다. 하늘 돔에 놓인 오버레이다.
 */
function StarChart() {
  const day = useGame((s) => s.day)
  const size = useThree((s) => s.size)
  const chart = useMemo(() => constellationOf(day, seasonFor(day)), [day])
  const group = useRef<THREE.Group>(null)
  const started = useRef<number | null>(null)
  const tex = useMemo(() => glowTexture(), [])
  const nameTex = useMemo(() => nameTexture(chart.name), [chart])
  const core = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(chart.points.length * 3).fill(0), 3))
    return g
  }, [chart])
  const coreMat = useMemo(() => new THREE.PointsMaterial({ map: tex, color: '#fff8e0', size: 13, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false }), [tex])
  const glowMat = useMemo(() => new THREE.PointsMaterial({ map: tex, color: '#bfe0ff', size: 40, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }), [tex])
  // 선 버퍼는 한 번만 만들고 값만 바꾼다(프레임마다 새로 만들면 일부 선이 안 그려졌다)
  const lineBuf = useMemo(() => new Float32Array(chart.links.length * 6), [chart])
  const lineGeo = useMemo(() => new LineSegmentsGeometry().setPositions(lineBuf), [chart, lineBuf])
  const lineMat = useMemo(() => new LineMaterial({ color: 0xbfe3ff, linewidth: 2, transparent: true, depthTest: false, depthWrite: false }), [])
  // 선 조각은 프레임마다 늘어나므로 처음 잰 경계 구로 자르면 안 된다
  const lines = useMemo(() => {
    const l = new LineSegments2(lineGeo, lineMat)
    l.frustumCulled = false
    return l
  }, [lineGeo, lineMat])
  const labelMat = useMemo(() => new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false, depthWrite: false }), [nameTex])
  const label = useMemo(() => new THREE.Sprite(labelMat), [labelMat])
  const corePts = useMemo(() => new THREE.Points(core, coreMat), [core, coreMat])
  const glowPts = useMemo(() => new THREE.Points(core, glowMat), [core, glowMat])
  useEffect(() => () => {
    core.dispose()
    coreMat.dispose()
    glowMat.dispose()
    lineGeo.dispose()
    lineMat.dispose()
    labelMat.dispose()
    nameTex.dispose()
    tex.dispose()
  }, [core, coreMat, glowMat, lineGeo, lineMat, labelMat, nameTex, tex])
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const on = runtime.telescope && runtime.skyCam > 0.5
    g.visible = on
    if (!on) {
      started.current = null
      return
    }
    if (started.current === null) started.current = clock.elapsedTime
    const t = clock.elapsedTime - started.current
    const k = Math.min(1, (runtime.skyCam - 0.5) * 2)
    const p = runtime.player
    const spread = skyViewSpread(size.width / size.height)
    const at = (pt: SkyPt) => {
      const [dx, dy, dz] = skyDir(pt, p.facing, spread)
      return [p.x + dx * DOME_R, p.y + dy * DOME_R, p.z + dz * DOME_R] as const
    }
    const pos = core.attributes.position as THREE.BufferAttribute
    chart.points.forEach((pt, i) => pos.setXYZ(i, ...at(pt)))
    pos.needsUpdate = true
    // 선: 링크마다 0.6초씩, 앞 선이 끝나야 다음 선이 시작한다
    let drawn = 0
    chart.links.forEach(([a, b], i) => {
      const f = Math.min(1, Math.max(0, (t - i * SEG_TIME) / SEG_TIME))
      const A = chart.points[a]
      const B = chart.points[b]
      // 아직 안 그린 선은 길이 0 으로 둔다
      const end = f > 0 ? ([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f] as SkyPt) : A
      if (f > 0) drawn++
      lineBuf.set(at(A), i * 6)
      lineBuf.set(at(end), i * 6 + 3)
    })
    ;(lineGeo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true
    lines.visible = drawn > 0
    lineMat.resolution.set(size.width, size.height)
    lineMat.opacity = 0.6 * k
    coreMat.opacity = k
    glowMat.opacity = 0.35 * k
    // 다 그린 뒤 별자리 아래 하늘에 이름이 떠오른다
    const allDrawn = chart.links.length * SEG_TIME
    const nameK = Math.min(1, Math.max(0, (t - allDrawn) / NAME_FADE))
    label.visible = nameK > 0
    labelMat.opacity = nameK * k
    const cx = chart.points.reduce((a, q) => a + q[0], 0) / chart.points.length
    const cy = Math.min(...chart.points.map((q) => q[1])) - 0.2
    label.position.set(...at([cx, cy]))
    label.scale.set(14, 2.6, 1)
  })
  return (
    <group ref={group} visible={false} renderOrder={20}>
      <primitive object={glowPts} />
      <primitive object={corePts} />
      <primitive object={lines} />
      <primitive object={label} />
    </group>
  )
}

/** 전망 벤치 옆 망원경과 밤하늘 오버레이 */
export function Telescope() {
  const scope = useMerged(buildScope, [])
  const y = heightAt(TELESCOPE.x, TELESCOPE.z)
  return (
    <>
      <group position={[TELESCOPE.x, y, TELESCOPE.z]} rotation={[0, TELESCOPE.rot, 0]}>
        <Merge g={scope} />
      </group>
      <StarChart />
    </>
  )
}
