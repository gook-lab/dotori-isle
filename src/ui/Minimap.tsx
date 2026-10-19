import { HALL_SITE } from '../core/hall'
import { isIndoor } from '../game/indoor'
import { useEffect, useMemo, useRef } from 'react'
import { BLOOM, type Plant } from '../core/garden'
import { getLayout } from '../core/daily'
import { ISLAND_R, onTrip, radiusAt, TRIP, tripRadiusAt } from '../core/island'
import { PLATEAUS, plateauOutline, plateauRimAt } from '../core/tiers'
import { builtBridges, builtStairs } from '../core/infra'
import { decodePaths, type PathKind } from '../core/paths'
import { isMarketDay, MARKET_SITE } from '../core/market'
import { VILLAGERS } from '../core/villagers'
import { PONDS, STREAM, STREAM_W } from '../core/waters'
import { DOCKS, ROCKS, SHOP, SHOP_DOOR, TREES } from '../core/world'
import { HOME_SITE } from '../core/home'
import { treeState, type Felled } from '../core/trees'
import { hasPlot, presentVillagers, rockSpent, treeSpent } from '../game/actions'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import type { Slot } from '../core/inventory'
import { houseShortfall, activeObjective } from './objective'

const SIZE = 140

/**
 * 목표 종류별로 찾을 곳. 오늘 이미 턴 나무·판 자리·물 준 꽃·다 깬 바위는 빼서 마커가 빈 곳을 가리키지 않게 한다.
 * 꽃씨는 자리가 정해진 게 아니라 마커를 달지 않는다. 꽃 피우기는 아직 안 마른 꽃을 가리킨다.
 */
function goalSpots(stat: string, t: { day: string; dug: string[]; shaken: string[]; plants: Plant[]; chopped: Record<string, number>; rockHits: Record<string, number>; felled: Felled; inventory: readonly Slot[] }): { x: number; z: number }[] {
  // 베어 넘긴 나무는 흔들 수도 벨 수도 없으니 마커를 달지 않는다.
  const standing = (x: { id: string }) => treeState(x.id, t.felled, t.day) === 'tree'
  if (stat === 'shake') return TREES.filter((x) => x.kind !== 'pine' && standing(x) && !t.shaken.includes(x.id))
  if (stat === 'chop') return TREES.filter((x) => x.kind === 'pine' && standing(x) && !treeSpent(t.chopped, x.id))
  if (stat === 'rock') return ROCKS.filter((r) => !rockSpent(t.rockHits, r.id))
  if (stat === 'dig') return getLayout(t.day).digs.filter((d) => !t.dug.includes(d.id))
  if (stat === 'water') return t.plants.filter((p) => !p.watered)
  if (stat === 'bloom') return t.plants.filter((p) => !p.watered && p.stage < BLOOM)
  if (stat === 'earn') return [SHOP_DOOR]
  if (stat.startsWith('build:')) {
    const id = stat.slice('build:'.length)
    const v = VILLAGERS.find((x) => x.id === id)
    if (!v) return []
    // 재료가 모자라면 그걸 얻을 곳을 가리킨다. 돌·철광석은 바위, 목재는 서 있는 나무.
    const missing = houseShortfall(id, t.inventory).map((m) => m.id)
    if (missing.includes('stone') || missing.includes('iron')) return ROCKS.filter((r) => !rockSpent(t.rockHits, r.id))
    if (missing.includes('wood')) return TREES.filter((x) => standing(x) && !treeSpent(t.chopped, x.id))
    return [v.house]
  }
  return []
}

function outline(cx: number, cz: number, radius: (a: number) => number): string {
  const pts: string[] = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const r = radius(a)
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cz + Math.sin(a) * r).toFixed(1)}`)
  }
  return pts.join(' ')
}

/**
 * 왼쪽 위 미니맵. 지금 있는 섬의 윤곽과 상점·부두·주민 집, 내 위치와 방향을 보여준다.
 * 내 위치는 React 상태가 아니라 프레임마다 SVG 속성을 직접 바꾼다.
 */
/** 길 종류별 지도 색: 흙·돌·벽돌 */
const PATH_MAP: Record<PathKind, string> = { dirt: '#cfa872', stone: '#d8d3c4', brick: '#b8553c' }

export function Minimap() {
  const houses = useGame((s) => s.houses)
  const recruits = useGame((s) => s.recruits)
  const tripGuests = useGame((s) => s.tripGuests)
  const quests = useGame((s) => s.quests)
  const stats = useGame((s) => s.stats)
  const day = useGame((s) => s.day)
  const infra = useGame((s) => s.infra)
  const pathTiles = useMemo(() => decodePaths(infra.paths), [infra.paths])
  const dailyBase = useGame((s) => s.dailyBase)
  const dailyClaimed = useGame((s) => s.dailyClaimed)
  const dug = useGame((s) => s.dug)
  const shaken = useGame((s) => s.shaken)
  const plants = useGame((s) => s.plants)
  const chopped = useGame((s) => s.chopped)
  const felled = useGame((s) => s.felled)
  const rockHits = useGame((s) => s.rockHits)
  const inventory = useGame((s) => s.inventory)
  // 상점 크기와 집 단계는 저장 상태를 따라 바뀌므로 구독해 다시 그린다.
  const shopTier = useGame((s) => s.shop.tier)
  const homeStage = useGame((s) => s.home.stage)
  // 집 안이나 상점에 있으면 섬 위의 목표는 보이지 않는다.
  const indoors = useGame((s) => isIndoor(s) || s.panel === 'shop')
  const me = useRef<SVGGElement>(null)
  const mark = useRef<SVGGElement>(null)
  const obj = useMemo(
    () => activeObjective({ quests, stats, day, dailyBase, dailyClaimed }),
    [quests, stats, day, dailyBase, dailyClaimed],
  )
  const spots = useMemo(
    () => (obj && !obj.ready && !indoors ? goalSpots(obj.goal.goal.stat, { day, dug, shaken, plants, chopped, rockHits, felled, inventory }) : []),
    [obj, indoors, day, dug, shaken, plants, chopped, rockHits, felled, inventory],
  )
  const svg = useRef<SVGSVGElement>(null)
  const homeShape = useMemo(() => outline(0, 0, radiusAt), [])
  const tripShape = useMemo(() => outline(TRIP.x, TRIP.z, tripRadiusAt), [])
  // 언덕은 티어마다 한 단 진하게 칠하고, 가장자리 윤곽선을 따로 그린다.
  const tierShapes = useMemo(
    () => PLATEAUS.map((p) => ({ id: p.id, high: p.top > 3, points: plateauOutline(p, 0).map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ') })),
    [],
  )

  useEffect(() => {
    let id = 0
    let trip: boolean | null = null
    const tick = () => {
      const p = runtime.player
      me.current?.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.z.toFixed(2)}) rotate(${(-p.facing * 180) / Math.PI})`)
      const now = onTrip(p.x)
      if (now !== trip && svg.current) {
        trip = now
        const r = now ? TRIP.r * 1.3 : ISLAND_R * 1.22
        const cx = now ? TRIP.x : 0
        svg.current.setAttribute('viewBox', `${cx - r} ${-r} ${r * 2} ${r * 2}`)
      }
      // 같은 섬에서 가장 가까운 목표에 마커를 단다
      let best: { x: number; z: number } | null = null
      let bestD = Infinity
      for (const t of spots) {
        if (onTrip(t.x) !== now) continue
        const d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2
        if (d < bestD) {
          bestD = d
          best = t
        }
      }
      if (mark.current) {
        if (best) mark.current.setAttribute('transform', `translate(${best.x.toFixed(2)} ${best.z.toFixed(2)})`)
        mark.current.setAttribute('visibility', best ? 'visible' : 'hidden')
      }
      id = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(id)
  }, [spots])

  const builtHomes = presentVillagers(houses, tripGuests)
  return (
    <svg ref={svg} className="minimap" width={SIZE} height={SIZE} aria-label="섬 지도 열기" onClick={() => useGame.getState().openPanel('map')}>
      <polygon points={homeShape} className="mm-sand" />
      <polygon points={homeShape} className="mm-grass" transform="scale(0.8)" />
      {/* 언덕 티어: 평지를 한 단 진하게, 절벽 가장자리는 어두운 선으로 */}
      <g transform="scale(0.8)">
        {tierShapes.map((t) => (
          <polygon key={t.id} points={t.points} className={t.high ? 'mm-tier2' : 'mm-tier1'} />
        ))}
      </g>
      <polygon points={tripShape} className="mm-sand" />
      <polygon points={tripShape} className="mm-grass" transform={`translate(${TRIP.x * 0.2} ${TRIP.z * 0.2}) scale(0.8)`} />
      {/* 연못과 개울 */}
      <polyline points={STREAM.map(([x, z]) => `${x},${z}`).join(' ')} className="mm-water" strokeWidth={STREAM_W * 2} fill="none" />
      {PONDS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.z} r={p.r} className="mm-water" />
      ))}
      <rect key={`shop-${shopTier}`} x={SHOP.x - SHOP.w / 2} y={SHOP.z - SHOP.d / 2} width={SHOP.w} height={SHOP.d} rx={0.8} className="mm-shop" />
      {/* 마을회관: 파란 건물 블록. 이름은 전체 지도에서 본다 */}
      {HALL_SITE && (
        <rect x={HALL_SITE.x - 1.6} y={HALL_SITE.z - 1.3} width={3.2} height={2.6} rx={0.6} fill="#3e6e8a">
          <title>마을회관</title>
        </rect>
      )}
      {/* 장터 가판대: 토요일에만 선다. 빨간 차양 줄무늬 천막 모양(글자 크기와 맞춰 2배로 그린다) */}
      {MARKET_SITE && isMarketDay(day) && (
        <g transform={`translate(${MARKET_SITE.x} ${MARKET_SITE.z}) scale(2)`}>
          <title>장터</title>
          <rect x={-1.1} y={-0.7} width={2.2} height={1.4} rx={0.3} fill="#fff6e0" stroke="#b5452f" strokeWidth={0.35} />
          <path d="M-1.3 -0.7 L1.3 -0.7 L1.1 -1.6 L-1.1 -1.6 Z" fill="#e46a52" />
          <path d="M-0.55 -0.7 L-0.4 -1.6 M0.55 -0.7 L0.4 -1.6" stroke="#fff6e0" strokeWidth={0.3} />
        </g>
      )}
      {/* 길 깔기: 칸마다 옅은 색 한 칸. 종류 색은 지도에서 흐리게 본다 */}
      {pathTiles.map((t) => (
        <rect key={`${t.x},${t.z}`} x={t.x - 0.5} y={t.z - 0.5} width={1} height={1} fill={PATH_MAP[t.kind]} opacity={0.5} />
      ))}
      {/* 섬 정비로 지은 다리(개울 위 널판)와 계단(절벽 가장자리 디딤돌) */}
      {builtBridges(infra, day).map((b) => (
        <rect key={b.id} x={-2} y={-0.6} width={4} height={1.2} transform={`translate(${b.x} ${b.z}) rotate(${(Math.atan2(Math.cos(b.rot), Math.sin(b.rot)) * 180) / Math.PI})`} fill="#b77d4b" stroke="#5a3a20" strokeWidth={0.3} />
      ))}
      {builtStairs(infra, day).map((st) => {
        const p = PLATEAUS[st.plateau]
        const r = plateauRimAt(p, st.ang)
        return <rect key={st.id} x={-1.3} y={-0.4} width={2.6} height={0.8} transform={`translate(${p.x + Math.cos(st.ang) * r} ${p.z + Math.sin(st.ang) * r}) rotate(${(st.ang * 180) / Math.PI})`} fill="#c4bcab" stroke="#5a4a38" strokeWidth={0.3} />
      })}
      {HOME_SITE && (
        <circle key={`home-${homeStage}`} cx={HOME_SITE.x} cy={HOME_SITE.z} r={1.8} fill="#f2c14e" stroke="#6b4528" strokeWidth={0.5}>
          <title>내 집</title>
        </circle>
      )}
      {VILLAGERS.filter((v) => hasPlot(v, recruits) || houses.includes(v.id)).map((v) => (
        <circle
          key={v.id}
          cx={v.house.x}
          cy={v.house.z}
          r={houses.includes(v.id) ? 2 : 1.4}
          fill={houses.includes(v.id) ? v.accent : 'none'}
          stroke={builtHomes.includes(v) ? v.accent : '#b7a88c'}
          strokeWidth={0.8}
        >
          <title>{v.name}의 집</title>
        </circle>
      ))}
      {DOCKS.map((d) => (
        <text key={d.id} x={d.x} y={d.z} className="mm-icon" textAnchor="middle" dominantBaseline="middle" fontSize={TRIP.r * 0.35}>
          ⚓
        </text>
      ))}
      {/* 지금 목표가 있는 곳: 펄스 원 */}
      <g ref={mark} visibility="hidden" pointerEvents="none">
        <circle r={3} className="mm-quest-ring" />
        <circle r={1.4} className="mm-quest-dot" />
      </g>
      <g ref={me}>
        <circle r={2.2} className="mm-me" />
        <path d="M0 4.6 L-1.6 1.8 L1.6 1.8 Z" className="mm-me" />
      </g>
    </svg>
  )
}
