import { useEffect, useMemo, useRef, useState } from 'react'
import { balloonPosition, balloonProgress } from '../core/wind'
import { announcerSpot, tourneyWindow } from '../core/tourney'
import { currentHour } from '../core/clock'
import { caveSpot } from '../core/cave'
import { bubbleSpots } from '../core/diving'
import { builtBridges, builtStairs } from '../core/infra'
import { isMarketDay, MARKET_SITE } from '../core/market'
import { lighthouseSpot } from '../core/lighthouse'
import { ISLAND_R, heightAt, radiusAt } from '../core/island'
import { PLATEAUS, plateauRimAt } from '../core/tiers'
import { PONDS, STREAM, STREAM_W } from '../core/waters'
import { DOCKS, SHOP_DOOR } from '../core/world'
import { HOME_SITE } from '../core/home'
import { MUSEUM_SITE } from '../core/museum'
import { HALL_SITE } from '../core/hall'
import { VIEWPOINT } from '../core/viewpoint'
import { VILLAGERS } from '../core/villagers'
import { hasPlot } from '../game/actions'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 지도 이미지의 한 변(픽셀). 한 번만 그려 캐시한다. */
const RES = 360
/** 지도가 덮는 범위: 섬 반지름 바깥까지 바다를 조금 보여 준다 */
const E = ISLAND_R + 5
/** 화면에 그리는 한 변(픽셀). 내부 좌표이고 CSS 로 폭에 맞춘다. */
const D = 480
/** 아이콘 반경(11)과 캔버스 가장자리 사이 여백(8)을 합친 값 */
const EDGE = 19
/** 두 번째 단계 확대율 */
const ZOOM = 2.2

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const SEA = hex('#4fb8c8')
const SAND = hex('#e8d7a8')
const GRASS = hex('#86cc6e')
const HILL = hex('#78b35e')
const HIGH = hex('#5f9a4d')
const POND = '#4fa8d8'

/** 한 점의 지형 색: 바다, 모래, 풀, 언덕 단 순서로 높이를 본다 */
function colorAt(x: number, z: number): [number, number, number] {
  if (Math.hypot(x, z) > radiusAt(Math.atan2(z, x))) return SEA
  const h = heightAt(x, z)
  if (h < 0) return SEA
  if (h < 0.5) return SAND
  if (h > 3) return HIGH
  if (h > 1.2) return HILL
  return GRASS
}

let baseCanvas: HTMLCanvasElement | null = null
/** 지형 색 지도. 처음 열 때 한 번만 그리고 그 뒤로는 같은 그림을 쓴다. */
function base(): HTMLCanvasElement {
  if (baseCanvas) return baseCanvas
  const c = document.createElement('canvas')
  c.width = c.height = RES
  const g = c.getContext('2d')
  if (!g) return c
  const img = g.createImageData(RES, RES)
  for (let py = 0; py < RES; py++) {
    for (let px = 0; px < RES; px++) {
      const x = ((px + 0.5) / RES) * 2 * E - E
      const z = ((py + 0.5) / RES) * 2 * E - E
      const [r, gg, b] = colorAt(x, z)
      const i = (py * RES + px) * 4
      img.data[i] = r
      img.data[i + 1] = gg
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // 연못과 개울은 위에 덧그린다
  const s = RES / (2 * E)
  const tx = (x: number) => (x + E) * s
  g.fillStyle = POND
  for (const p of PONDS) {
    g.beginPath()
    g.arc(tx(p.x), tx(p.z), p.r * s, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = POND
  g.lineCap = 'round'
  g.lineWidth = STREAM_W * s * 2
  g.beginPath()
  STREAM.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))))
  g.stroke()
  baseCanvas = c
  return c
}

interface Mark {
  id: string
  x: number
  z: number
  icon: string
  name: string
}

type View = { zoom: number; cx: number; cz: number }

/** 지도 한 장 그리기: 캐시된 지형을 보기 범위만큼 잘라 채우고, 아이콘과 내 위치를 얹는다. */
function drawMap(ctx: CanvasRenderingContext2D, v: View, marks: Mark[], p: { x: number; z: number; facing: number }) {
  const span = (2 * E) / v.zoom
  const x0 = Math.min(Math.max(v.cx - span / 2, -E), E - span)
  const z0 = Math.min(Math.max(v.cz - span / 2, -E), E - span)
  const k = D / span
  const s = RES / (2 * E)
  ctx.fillStyle = `rgb(${SEA.join(',')})`
  ctx.fillRect(0, 0, D, D)
  ctx.drawImage(base(), (x0 + E) * s, (z0 + E) * s, span * s, span * s, 0, 0, D, D)
  ctx.font = '15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const m of marks) {
    // 바다 가장자리 표식이 캔버스 밖으로 잘리지 않게, 아이콘 반경에 8px 여백을 두고 안으로 민다
    const px = Math.min(Math.max((m.x - x0) * k, EDGE), D - EDGE)
    const py = Math.min(Math.max((m.z - z0) * k, EDGE), D - EDGE)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(px, py, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6b4528'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#2b1d12'
    ctx.fillText(m.icon, px, py + 1)
  }
  // 내 위치: 바라보는 쪽으로 향한 삼각형(지도 화살표와 같은 방향)
  const px = (p.x - x0) * k
  const py = (p.z - z0) * k
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(-p.facing)
  ctx.fillStyle = '#e4572e'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 14)
  ctx.lineTo(-8, 4)
  ctx.lineTo(8, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  return { x0, z0, k }
}

/** 정적인 장소: 상점·집·부두 같은 곳. 상태가 바뀔 때만 다시 만든다. */
function staticMarks(
  houses: string[],
  recruits: string[],
  infra: Parameters<typeof builtBridges>[0],
  day: string,
): Mark[] {
  const out: Mark[] = []
  out.push({ id: 'shop', x: SHOP_DOOR.x, z: SHOP_DOOR.z, icon: '🏪', name: '도토리 상점' })
  if (MUSEUM_SITE) out.push({ id: 'museum', x: MUSEUM_SITE.x, z: MUSEUM_SITE.z, icon: '🏛️', name: '자연사 전시관' })
  if (HALL_SITE) out.push({ id: 'hall', x: HALL_SITE.x, z: HALL_SITE.z, icon: '📻', name: '마을회관' })
  out.push({ id: 'view', x: VIEWPOINT.x, z: VIEWPOINT.z, icon: '🔭', name: '전망대' })
  const lh = lighthouseSpot()
  out.push({ id: 'lighthouse', x: lh.x, z: lh.z, icon: '🗼', name: '등대' })
  const cv = caveSpot()
  out.push({ id: 'cave', x: cv.x, z: cv.z, icon: '🪨', name: '해안 동굴' })
  for (const d of DOCKS) if (d.id === 'home') out.push({ id: 'dock-home', x: d.x, z: d.z, icon: '⚓', name: '부두' })
  if (HOME_SITE) out.push({ id: 'home', x: HOME_SITE.x, z: HOME_SITE.z, icon: '🏠', name: '내 집' })
  for (const v of VILLAGERS) {
    if (!(hasPlot(v, recruits) || houses.includes(v.id))) continue
    out.push({ id: `house-${v.id}`, x: v.house.x, z: v.house.z, icon: '🏡', name: `${v.name}네 집` })
  }
  builtBridges(infra, day).forEach((b) => out.push({ id: b.id, x: b.x, z: b.z, icon: '🌉', name: '다리' }))
  builtStairs(infra, day).forEach((st) => {
    const pl = PLATEAUS[st.plateau]
    const r = plateauRimAt(pl, st.ang)
    out.push({ id: st.id, x: pl.x + Math.cos(st.ang) * r, z: pl.z + Math.sin(st.ang) * r, icon: '🪜', name: '계단' })
  })
  bubbleSpots(day).forEach((b, i) => out.push({ id: `bubble-${i}`, x: b.x, z: b.z, icon: '🫧', name: '잠수 거품' }))
  return out
}

/** 오늘 이벤트 위치: 풍선, 대회 진행자, 장터. 날짜와 시각으로 매번 확인한다. */
function eventMarks(day: string, hour: number): Mark[] {
  const out: Mark[] = []
  const prog = balloonProgress(day, hour)
  if (prog !== null && runtime.balloonCaught !== day) {
    const b = balloonPosition(prog)
    out.push({ id: 'balloon', x: b.x, z: b.z, icon: '🎈', name: '풍선 선물' })
  }
  if (tourneyWindow(day, hour)) {
    const a = announcerSpot()
    if (a) out.push({ id: 'host', x: a.x, z: a.z, icon: '🎤', name: '대회 진행자' })
  }
  if (MARKET_SITE && isMarketDay(day)) out.push({ id: 'market', x: MARKET_SITE.x, z: MARKET_SITE.z, icon: '🎪', name: '장터' })
  return out
}

/** 섬 전체 지도 창. N 키나 미니맵으로 연다. 한 번 누르면 확대, 다시 누르면 섬 전체로 돌아간다. */
export function WorldMap() {
  const houses = useGame((s) => s.houses)
  const recruits = useGame((s) => s.recruits)
  const infra = useGame((s) => s.infra)
  const day = useGame((s) => s.day)
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef<View>({ zoom: 1, cx: 0, cz: 0 })
  const lastMarks = useRef<Mark[]>([])
  const pinch = useRef<number | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [label, setLabel] = useState<string>('내 위치')
  const fixed = useMemo(() => staticMarks(houses, recruits, infra, day), [houses, recruits, infra, day])

  useEffect(() => {
    view.current.zoom = zoomed ? ZOOM : 1
  }, [zoomed])

  useEffect(() => {
    const c = canvas.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const draw = () => {
      const p = runtime.player
      const v = view.current
      // 확대한 동안은 내 위치를 따라가고, 섬 전체에서는 가운데를 본다
      if (v.zoom > 1) {
        v.cx = p.x
        v.cz = p.z
      } else {
        v.cx = 0
        v.cz = 0
      }
      const dyn = eventMarks(useGame.getState().day, currentHour())
      lastMarks.current = [...fixed, ...dyn]
      drawMap(g, v, lastMarks.current, p)
    }
    draw()
    const id = setInterval(draw, 200)
    return () => clearInterval(id)
  }, [fixed, zoomed])

  // 누른 자리에서 가장 가까운 아이콘의 이름을 보여 준다
  const pick = (clientX: number, clientY: number) => {
    const c = canvas.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * D
    const py = ((clientY - rect.top) / rect.height) * D
    const span = (2 * E) / view.current.zoom
    const x0 = Math.min(Math.max(view.current.cx - span / 2, -E), E - span)
    const z0 = Math.min(Math.max(view.current.cz - span / 2, -E), E - span)
    const k = D / span
    let best: Mark | null = null
    let bestD = 22 * (D / rect.width)
    for (const m of lastMarks.current) {
      const d = Math.hypot((m.x - x0) * k - px, (m.z - z0) * k - py)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    setLabel(best ? `${best.icon} ${best.name}` : '내 위치')
  }

  return (
    <Modal title="섬 지도">
      <div className="worldmap">
        <canvas
          ref={canvas}
          width={D}
          height={D}
          role="img"
          aria-label="섬 지도"
          onClick={(e) => pick(e.clientX, e.clientY)}
          onWheel={(e) => setZoomed(e.deltaY < 0)}
          onTouchStart={(e) => {
            if (e.touches.length === 2) pinch.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
          }}
          onTouchMove={(e) => {
            if (e.touches.length !== 2 || pinch.current === null) return
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
            // 두 손가락이 충분히 벌어지면 확대, 충분히 모이면 섬 전체로 돌아간다
            if (d > pinch.current * 1.25) {
              setZoomed(true)
              pinch.current = d
            } else if (d < pinch.current * 0.8) {
              setZoomed(false)
              pinch.current = d
            }
          }}
          onTouchEnd={() => {
            pinch.current = null
          }}
        />
        <p className="worldmap-label" aria-live="polite">{label}</p>
        <p className="worldmap-hint">아이콘을 누르면 이름이 보여요 · 휠이나 두 손가락으로 {zoomed ? '섬 전체' : '확대'}</p>
      </div>
    </Modal>
  )
}
