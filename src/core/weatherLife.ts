import { hashString } from './rng'

/** 우산 물건 id 와 펴 있을 때의 색 */
export const UMBRELLA_COLOR: Record<string, string> = {
  'umbrella-red': '#e46a52',
  'umbrella-blue': '#3f6fb5',
  'umbrella-yellow': '#f0c24a',
}

/** 주머니에서 처음 나오는 우산 id. 없으면 null. 주머니에 우산이 있으면 비를 막는다. */
export function carriedUmbrella(inventory: readonly { id: string; count: number }[]): string | null {
  const slot = inventory.find((s) => s.count > 0 && s.id in UMBRELLA_COLOR)
  return slot ? slot.id : null
}

/** 비 오는 날 주민이 처마 밑으로 피하는 시간 칸(ms). 칸마다 한 번 정한다. */
export const SHELTER_SLOT_MS = 10 * 60_000
/** 우산 없이 이만큼(초) 비를 맞으면 몸이 젖는다 */
export const WET_SECONDS = 30
/** 재채기 한 번이 나는 시간 칸(초)과 그 안에서 재채기하는 길이 */
const SNEEZE_SLOT = 30
const SNEEZE_LEN = 0.8

/** 이 주민이 지금 비를 피하는 중인가. 비가 아니면 항상 아니다. 칸마다 4분의 1 정도가 피한다. */
export function sheltersNow(id: string, rain: boolean, nowMs: number): boolean {
  if (!rain) return false
  const slot = Math.floor(nowMs / SHELTER_SLOT_MS)
  return hashString(`shelter:${id}:${slot}`) % 4 === 0
}

/** 집 앞 처마 밑 자리: 집 가운데에서 섬 가장자리 쪽으로, 처마 끝(약 1.43)보다 조금 바깥에 선다 */
export function shelterSpot(home: { x: number; z: number }, houseR: number): { x: number; z: number } {
  const d = Math.hypot(home.x, home.z) || 1
  const r = houseR - 0.25
  return { x: home.x + (home.x / d) * r, z: home.z + (home.z / d) * r }
}

/** 처마 밑 주민이 바라보는 방향(라디안): 집을 등지고 바깥을 본다 */
export function shelterFacing(home: { x: number; z: number }, spot: { x: number; z: number }): number {
  return Math.atan2(spot.x - home.x, spot.z - home.z)
}

/** 우산 없이 비를 맞은 시간이 기준을 넘었는지 */
export function isWet(rainSeconds: number): boolean {
  return rainSeconds >= WET_SECONDS
}

/** 몸이 젖은 색: 채도를 amount(0~1)만큼 빼서 회색 쪽으로 옮긴다. '#rrggbb' 가 아니면 그대로 둔다. */
export function desaturate(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  const mix = (c: number) => Math.round(c + (gray - c) * amount)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** 재채기가 시작한 뒤 지난 초(0.8초 동안). 재채기 중이 아니면 -1. 30초 칸마다 한 번, 칸 안의 정해진 때에 한다. */
export function sneezeAt(nowS: number): number {
  const slot = Math.floor(nowS / SNEEZE_SLOT)
  const offset = 8 + (hashString(`sneeze:${slot}`) % 14)
  const at = nowS - slot * SNEEZE_SLOT - offset
  return at >= 0 && at < SNEEZE_LEN ? at : -1
}

/** 젖은 동안 재채기 중인지 */
export function sneezing(nowS: number): boolean {
  return sneezeAt(nowS) >= 0
}

/** 눈 오는 날 하루 한 번 눈사람을 만드는 주민과 자리. 주민 목록 중 하나를 날짜로 고르고, 땅 위의 자리를 찾는다. */
export function snowmanBuilder(day: string, villagerIds: readonly string[], isLand: (x: number, z: number) => boolean): { villagerId: string; x: number; z: number } | null {
  if (villagerIds.length === 0) return null
  const h = hashString(`snowman:${day}`)
  const villagerId = villagerIds[h % villagerIds.length]
  for (let i = 0; i < 24; i++) {
    const a = ((h >> 3) + i * 0.7) % (Math.PI * 2)
    const r = 6 + ((h >> 7) + i) % 5
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (isLand(x, z)) return { villagerId, x, z }
  }
  return null
}

/** 눈사람 키: 아침엔 작고, 저녁이 되면 다 커 있다(0~1 진행도를 받는다) */
export function snowmanScale(progress: number): number {
  return 0.35 + 0.65 * Math.min(1, Math.max(0, progress))
}
