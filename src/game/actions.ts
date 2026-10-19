import { nearTreasure, parseMapId, TREASURE_REACH } from '../core/bottle'
import { isIndoor } from './indoor'
import { bugPosition, getLayout, nearestFish, type BugSpawn, type DigSpot, type ShellSpawn } from '../core/daily'
import type { Plant } from '../core/garden'
import { castAtShadow, castEmpty, pressFishing, type FishingEvent } from '../core/fishing'
import { groundAt, heightAt, waterLevelAt } from '../core/island'
import { costLabel, GLOWING, ITEMS, josa, TOOLS } from '../core/items'
import { furnitureUse, placeBlocker, placementCell, seatHeightOf, type Placed, type WallDir } from '../core/placement'
import { isWallItem, wallSpot } from '../core/wallHang'
import { crowdHour, FIREWORK_BENCH, festivalOn } from '../core/festivals'
import { VISIT_TALK_REACH } from '../core/visits'
import { BUBBLE_REACH, bubbleSpots, isShore } from '../core/diving'
import { ROOM_SPOT, villagerRoomSpot } from '../core/villagerRoom'
import { ATTIC, CAVE_CHEST, CAVE_NODES, CAVE_ROOM, exitOf, HALL_OBJECTS, HALL_ROOM, HOME_MOVES, HOME_ROOM, HOME_ROOM_SIZES, type HomeFloor, inRoomArea, MUSEUM_ROOM, ROOM_EXIT, ROOM_FLOOR, roomCenter, roomWalkable, SHOP_OBJECTS, SHOP_ROOM } from '../core/interior'
import { HALL_DOOR_R, HALL_SITE } from '../core/hall'
import { NEW_ISLAND_GIFT, receptionLabel } from '../core/islandGift'
import { caveOpen, caveSpot, chestDue, minesLeft } from '../core/cave'
import { balloonPosition, balloonProgress, BALLOON_R } from '../core/wind'
import { dayIndex } from '../core/economy'
import { CURATOR_NAME, MUSEUM_SITE, museumOpen } from '../core/museum'
import { BED_TOP, homeUse, homeUseLabel, homeUseLine, HOME_BED_R, HOME_WINDOWS, HOME_WINDOW_R, nearestWithin, roomLabel, roomLine, villagerRoomTargets, windowLine, type HomeUse, type RoomTarget } from '../core/furnitureActions'
import { floorOpen, hasAttic, homeBed, homeChest, homePlaceBlocker, homeRoomFull, HOME_SITE } from '../core/home'
import { pickStowTarget } from '../core/homeStow'
import { upgradeState } from '../core/shopTiers'
import { DISPLAY_REACH, DISPLAY_SPOTS, displayLabel, displayStock, isSoldOut, LIMITED_SPOT, limitedShelf } from '../core/shopDisplay'
import type { TripGuest } from '../core/guests'
import { HOUSE_R, isHomeAt, VILLAGERS, villagerPosition, type Mood, type Villager } from '../core/villagers'
import { doorInFront, keepOutOfDoor } from '../core/doorGuard'
import { DOCK_TALK_R, DOCKS, MAILBOX, ROCKS, SHOP_DOOR, STALL, TREES, WORKBENCH, type Dock, type RockSpot, type TreeSpot } from '../core/world'
import { fireflyNearest, fireflyOn, replacedByFireflies } from '../core/fireflies'
import { BUSHES, canWalk, type ScenerySpot } from '../core/scenery'
import { weatherFor } from '../core/weather'
import { isMeteorNight, meteorHours } from '../core/skyEvents'
import { canAreaLabel, canCells, canDir, canTargets, type CanLevel } from '../core/watering'
import { burst, impactAt, IMPACT_AT, now, rippleAt, runtime, startAct } from './runtime'
import { play } from './sfx'
import { CHOPS_PER_TREE, HITS_PER_ROCK, useGame, type GroundItem } from './store'
import { canDigAt, type Hole } from '../core/holes'
import { treeState } from '../core/trees'
import { isMarketDay, MARKET_SITE } from '../core/market'
import { SONGI_SITE } from '../core/songiSite'
import { songiOpen } from '../core/songi'
import { climbSpot, type ClimbSpot } from '../core/ladder'
import { VIEWPOINT } from '../core/viewpoint'
import { bridgeSpots, INFRA_BOARD, stairSpots, type InfraSpot } from '../core/infra'
import { ctxOf, lockedSystem, systemOpen, type UnlockCtx } from '../core/unlocks'
import { QUESTS } from '../core/quests'
import { ANNOUNCER_R, announcerSpot, canJoin, tourneyWindow } from '../core/tourney'
import { currentHour } from '../core/clock'
import { shopGuestIds, shopGuestSpot } from '../core/shopGuest'
import { constellationOf, nearTelescope, telescopeOpen } from '../core/stars'
import { frozenAt, kickAcorn, leafPiles } from '../core/seasonal'
import { seasonFor } from '../core/season'
import { PATH_NAME, pathCellsOf, pathSpotOk, decodePaths, type PathKind } from '../core/paths'
import { decodeGarden, gardenStats, gardenTileBlocker, GARDEN_KIND_OF_ITEM, GARDEN_TILE_NAME, isGardenItem } from '../core/gardenTiles'
import { frameFloor, frameHung, scoreGainOf } from '../core/homeScore'
import { PLATEAUS, plateauRimAt } from '../core/tiers'
import { SPOUT } from '../core/waters'
import { canDiscover, discoveryNear, outcomeOf, type DiscoverySpot } from '../core/discoveries'

/** 플레이어 주변에서 E 키로 할 수 있는 일 하나. 같은 함수가 안내 문구와 실행을 함께 결정한다. */
export type Action =
  | { kind: 'pickup'; label: string; item: GroundItem }
  | { kind: 'shell'; label: string; shell: ShellSpawn }
  | { kind: 'shop'; label: string; clerk?: string }
  | { kind: 'shop-enter'; label: string }
  | { kind: 'shop-leave'; label: string }
  | { kind: 'shop-guest'; label: string; id: string }
  /** 계산대 앞 진열대 물건. 샀는지 여부와 가까운 점원을 함께 든다. */
  | { kind: 'shop-display'; label: string; itemId: string; clerk: string; sold: boolean; weekly?: boolean }
  | { kind: 'bug'; label: string; bug: BugSpawn; species: string }
  | { kind: 'firefly'; label: string; index: number }
  | { kind: 'shake'; label: string; tree: TreeSpot }
  | { kind: 'rustle'; label: string; bush: ScenerySpot }
  | { kind: 'cast'; label: string; x: number; z: number }
  /** 가을 낙엽더미 차기: 바스락 효과, 가끔 도토리 */
  | { kind: 'kick'; label: string; pile: { id: string; x: number; z: number } }
  /** 섬 곳곳의 발견거리: 하루 한 번 E 로 찾아본다 */
  | { kind: 'discover'; label: string; spot: DiscoverySpot }
  | { kind: 'stargaze'; label: string; on: boolean }
  | { kind: 'enter'; label: string; villager: Villager }
  | { kind: 'leave'; label: string }
  | { kind: 'reel'; label: string }
  | { kind: 'talk'; label: string; villager: Villager }
  | { kind: 'stow'; label: string; placed: Placed }
  | { kind: 'use'; label: string; placed: Placed; use: 'sit' | 'light' | 'stars' }
  | { kind: 'stand'; label: string }
  | { kind: 'place'; label: string; x: number; z: number; ok: boolean }
  | { kind: 'build'; label: string; villager: Villager }
  | { kind: 'chop'; label: string; tree: TreeSpot }
  /** 그루터기 파내기 */
  | { kind: 'stump'; label: string; tree: TreeSpot }
  /** 구멍 메우기 */
  | { kind: 'fill'; label: string; hole: Hole }
  /** 빈 그물 휘두르기: 안내 없이 휘두르기만 한다 */
  | { kind: 'swing'; label: string }
  | { kind: 'hit'; label: string; rock: RockSpot }
  | { kind: 'dig'; label: string; spot: DigSpot | null; x: number; z: number }
  | { kind: 'treasure'; label: string; mapId: string }
  /** 물 주기. plants 는 이번에 적실 꽃(없으면 빈 배열), area 는 물뿌리개 단계 */
  | { kind: 'water'; label: string; plants: Plant[]; area: CanLevel }
  | { kind: 'workbench'; label: string }
  /** 절벽 위 전망 벤치에 앉는다(바다 쪽을 본다) */
  | { kind: 'viewpoint'; label: string }
  /** 섬 정비 안내판: 패널을 열거나, 자리 고르기를 그만둔다 */
  | { kind: 'infra-board'; label: string }
  /** 섬 정비: 고른 자리 가장 가까이에서 맡긴다 */
  | { kind: 'infra-commit'; label: string; spot: InfraSpot }
  /** 길 깔기: 바라보는 칸에 길을 놓거나(ok) 같은 칸의 길을 걷는다(remove) */
  | { kind: 'paint'; label: string; x: number; z: number; ok: boolean; paint: PathKind }
  /** 폭포 앞에서 물소리를 듣는다. 자리를 옮기거나 앉지 않는 한 줄짜리 행동이다 */
  | { kind: 'spout'; label: string }
  | { kind: 'pelican'; label: string; dock: Dock }
  | { kind: 'stall'; label: string }
  /** 토요일 장터 가판대 */
  | { kind: 'market'; label: string }
  | { kind: 'songi'; label: string }
  /** 여름 축제 밤, 진행 천막 뒤 벤치에 앉아 불꽃 구경 */
  | { kind: 'watch'; label: string }
  | { kind: 'tourney-join'; label: string }
  | { kind: 'tourney-exchange'; label: string }
  /** 유성우 밤, 앉은 자리에서 소원 빌기 */
  | { kind: 'wish'; label: string }
  | { kind: 'mail'; label: string }
  /** 내 집 현관으로 들어가기 */
  | { kind: 'home-door'; label: string }
  /** 집 상담 간판: 다음 집 짓기 */
  | { kind: 'home-sign'; label: string }
  /** 아직 잠긴 시설 앞: E 를 누르면 잠긴 이유(hint)를 토스트로 알려 준다 */
  | { kind: 'locked'; label: string; hint: string }
  | { kind: 'atm'; label: string }
  /** 집 방 안: 나가기·보관함·놓기·가구 넣기 */
  | { kind: 'home-leave'; label: string }
  | { kind: 'home-climb'; label: string }
  /** 옆방 문·지하 계단: 가는 자리(to)로 옮겨 간다 */
  | { kind: 'home-move'; label: string; to: HomeFloor }
  | { kind: 'storage'; label: string }
  | { kind: 'closet'; label: string }
  | { kind: 'home-place'; label: string; x: number; z: number; ok: boolean; wall?: WallDir }
  | { kind: 'home-stow'; label: string; placed: Placed }
  /** 집들이 방문객에게 말 걸기 */
  | { kind: 'visit-talk'; label: string }
  /** 수영복으로 바다에 들어간다 */
  | { kind: 'swim-in'; label: string }
  /** 수영 중 거품 자리에서 잠수한다 */
  | { kind: 'dive'; label: string; key: string }
  /** 방 가구로 앉기 · 불 켜고 끄기. R 로 넣는다. */
  | { kind: 'home-use'; label: string; placed: Placed; use: 'sit' | 'light' }
  /** 방 가구의 그 밖의 쓰임(차, 잎 쓰다듬기, 열어 보기 등). R 로 넣는다. */
  | { kind: 'home-act'; label: string; placed: Placed; use: HomeUse }
  /** 침대에 눕는다. 밤이면 푹 자고 하루 한 번 마일리지를 받는다. */
  | { kind: 'home-bed'; label: string }
  /** 창가에서 바깥을 본다 */
  | { kind: 'home-window'; label: string }
  /** 주민 방 물건: 앉기·불 켜고 끄기·살펴보기. 주민 방 물건은 넣을 수 없다. */
  | { kind: 'room-act'; label: string; villager: Villager; target: RoomTarget; off: boolean }
  /** E 를 눌러도 아무 일은 안 일어나고 안내만 띄운다 */
  | { kind: 'hint'; label: string }
  /** 학예사 올롱과 이야기하기: 기증 창을 연다 */
  | { kind: 'curator'; label: string }
  /** 전시관 문 앞에서 들어가기 */
  | { kind: 'museum-enter'; label: string }
  | { kind: 'cave-enter'; label: string }
  | { kind: 'cave-leave'; label: string }
  | { kind: 'balloon-catch'; label: string }
  | { kind: 'cave-mine'; label: string; node: number }
  | { kind: 'cave-chest'; label: string }
  /** 전시관 방 안에서 나가기 */
  | { kind: 'museum-leave'; label: string }
  /** 마을회관 문 앞에서 들어가기, 방 안에서 나가기 */
  | { kind: 'hall-enter'; label: string }
  | { kind: 'hall-leave'; label: string }
  /** 마을회관 방 안: 게시판(오늘의 할 일), 마이크 책상(마을 방송 다시 듣기), 접수대 */
  | { kind: 'hall-board'; label: string }
  | { kind: 'hall-mic'; label: string }
  | { kind: 'hall-reception'; label: string }
  /** 사다리로 절벽을 오르내린다 */
  | { kind: 'climb'; label: string; spot: ClimbSpot }

const PICK_R = 1.4
const BUG_R = 2.1
const TREE_R = 2
const BUSH_R = 1.55
const SHOP_R = 2.4
const HOME_DOOR_R = 1.2
const HOME_SIGN_R = 1.6
/** 잠긴 시설 앞 안내 글. E 를 누르면 이유가 토스트로 뜬다. */
const lockedLabel = (name: string) => `${name} · 아직 잠겨 있어요`
const CURATOR_R = 1.9
const MUSEUM_DOOR_R = 1.4
const CHEST_R = 1.6
const CAST_DIST = 3.4
export const TALK_R = 1.9
const STOW_R = 1.3
const PLOT_R = 2.9
const ROCK_R = 1.9
const DIG_R = 1.3
/** 구멍·그루터기를 손이 닿는 거리(반지름) */
const HOLE_REACH = 1
const PLANT_R = 1.4
/** 삽·물뿌리개가 닿는 앞쪽 거리 */
const REACH = 0.9

/** 이사 오지 않은 새 이웃은 섬에 없다. 여행 섬에 놀러 온 손님은 그 여행 동안만 있다. */
export const presentVillagers = (houses: readonly string[], visiting: readonly TripGuest[] = useGame.getState().tripGuests) =>
  VILLAGERS.filter((v) => !v.newcomer || houses.includes(v.id) || visiting.some((g) => g.id === v.id))

/** 놀러 온 손님은 여행 섬의 자기 자리를 집 마당 삼아 어슬렁거린다. */
const visitingSpot = (v: Villager) => (v.guest && !useGame.getState().houses.includes(v.id) ? useGame.getState().tripGuests.find((g) => g.id === v.id) : undefined)

/** 집터가 섬에 보이는지. 손님 집터는 초대한 뒤에만 생긴다. */
export const hasPlot = (v: Villager, recruits: readonly string[]) => !v.guest || recruits.includes(v.id)

/**
 * 주민이 지금 서 있는 곳. 밤에 집에 들어간 주민은 자기 방 안을 서성이고, 아니면 섬을 산책한다.
 * 렌더·충돌·대화가 모두 이 값을 본다.
 */
/** 여름 축제 밤에만 쓸 수 있는 벤치 자리(광장 기준). 다른 날이나 낮이면 null. */
function festivalWatchSpot(day: string, night: boolean): { x: number; z: number } | null {
  const fest = festivalOn(day)
  if (!MARKET_SITE || !fest || fest.season !== 'summer' || !night) return null
  return { x: MARKET_SITE.x + FIREWORK_BENCH.x, z: MARKET_SITE.z + FIREWORK_BENCH.z }
}

/** 축제 날 저녁 시간대에 주민이 어슬렁거릴 광장 둘레 자리. 축제가 아니면 null. */
function festivalPlazaSpot(v: Villager): { x: number; z: number } | null {
  if (!MARKET_SITE || !festivalOn(useGame.getState().day) || !crowdHour(currentHour())) return null
  const a = v.seed * 2.3
  const r = 4.2 + ((v.seed * 7.13) % 1) * 1
  return { x: MARKET_SITE.x + Math.cos(a) * r, z: MARKET_SITE.z + Math.sin(a) * r }
}

export function villagerAt(v: Villager, houses: readonly string[]): { x: number; z: number; facing: number; home: boolean } {
  const r = villagerAtRaw(v, houses)
  // 플레이어 집 현관 앞 원 밖으로 밀어낸다(주민이 문 앞을 막지 않게)
  if (!HOME_SITE || r.home) return r
  return { ...r, ...keepOutOfDoor(r, HOME_SITE.door) }
}

function villagerAtRaw(v: Villager, houses: readonly string[]): { x: number; z: number; facing: number; home: boolean } {
  const t = runtime.vclock[v.id] ?? 0
  if (isHomeAt(v, currentHour(), houses)) {
    // 집 안에서는 시간대에 맞는 자리에 있다(책장 앞·침대·창가). 자리는 정해져 있어 말 걸 때 흔들리지 않는다.
    const c = roomCenter(VILLAGERS.indexOf(v))
    const spot = ROOM_SPOT[villagerRoomSpot(currentHour())]
    return { x: c.x + spot.x, z: c.z + spot.z, facing: spot.facing, home: true }
  }
  // 축제 날 저녁에는 광장 둘레로 모인다(장터 자리 바깥쪽 고리)
  const plaza = festivalPlazaSpot(v)
  if (plaza) return { ...villagerPosition({ ...v, home: plaza }, t), home: false }
  const spot = visitingSpot(v)
  if (spot) return { ...villagerPosition({ ...v, home: spot }, t), home: false }
  return { ...villagerPosition(v, t), home: false }
}

/** 지은 집의 현관 앞(문에서 한 걸음 나온 자리) */
export function houseDoor(v: Villager, step = HOUSE_R + 0.6): { x: number; z: number } {
  return { x: v.house.x + Math.sin(v.house.rot) * step, z: v.house.z + Math.cos(v.house.rot) * step }
}

const dist2 = (ax: number, az: number, bx: number, bz: number) => (ax - bx) ** 2 + (az - bz) ** 2

/** 바라보는 쪽 반원 안에 있는지. 바로 등 뒤의 물건은 앞이 아니다. */
/** 폭포 앞에서 보는 줄. 한 번에 하나씩 무작위로 고른다. */
const SPOUT_LINES = ['물소리가 시원해요', '물방울이 튀어 얼굴이 시원해요', '폭포가 쏴아 소리를 내요']

const inFront = (p: { x: number; z: number; facing: number }, t: { x: number; z: number }) => (t.x - p.x) * Math.sin(p.facing) + (t.z - p.z) * Math.cos(p.facing) > 0

/** 첫 목표(나무 흔들기)를 채우기 전에는 옷 가판대 E 를 띄우지 않는다. 시작 자리에서 나무 대신 가판대가 먼저 잡혔다. */
const stallOpen = (stats: Readonly<Record<string, number>>) => (stats.shake ?? 0) >= (QUESTS.welcome?.goals.find((g) => g.stat === 'shake')?.target ?? 0)

/**
 * 마주 보고 선 가판대·장터·상점·전시관 문. 주민이 옆에 서 있어도 이쪽이 먼저 잡히게 쓴다.
 * 가까이 있고 앞을 보고 있어야 한다. 없으면 null.
 */
export function facedFixture(p: { x: number; z: number; facing: number }, s: { day: string; dex: Record<string, number>; shop: Parameters<typeof upgradeState>[0]; stats: Readonly<Record<string, number>> }): Action | null {
  const near = (t: { x: number; z: number }, r: number) => dist2(p.x, p.z, t.x, t.z) < r * r && inFront(p, t)
  if (stallOpen(s.stats) && near(STALL, 2.1)) return { kind: 'stall', label: '옷 가판대 구경하기' }
  if (MARKET_SITE && isMarketDay(s.day) && near(MARKET_SITE, 2.1)) return { kind: 'market', label: '장터 가판대 구경하기' }
  if (SONGI_SITE && songiOpen(s.day, currentHour()) && near(SONGI_SITE, 2.1)) return { kind: 'songi', label: '송이 상인에게 말 걸기' }
  if (near(SHOP_DOOR, SHOP_R)) {
    const closed = upgradeState(s.shop, s.day).status === 'closed'
    return { kind: 'shop-enter', label: closed ? '상점 공사 중 · 들어가 구경하기' : '도토리 상점 들어가기' }
  }
  if (MUSEUM_SITE && museumOpen(s.dex) && near(MUSEUM_SITE.door, MUSEUM_DOOR_R)) return { kind: 'museum-enter', label: '자연사 전시관 들어가기' }
  if (HALL_SITE && near(HALL_SITE.door, HALL_DOOR_R)) return { kind: 'hall-enter', label: '마을회관 들어가기' }
  return null
}

/**
 * 찌가 떨어질 곳. 앞으로 물이 처음 나오는 곳을 찾고, 물이 이어지면 조금 더 멀리 던진다.
 * 바다·연못·개울 어디서나 같고, 좁은 개울에서도 건너편 둑으로 넘어가지 않는다.
 */
export function castSpot(x: number, z: number, facing: number): { x: number; z: number } | null {
  if (groundAt(x, z) === 'water') return null
  const sx = Math.sin(facing)
  const sz = Math.cos(facing)
  for (let d = 0.9; d <= CAST_DIST; d += 0.2) {
    if (groundAt(x + sx * d, z + sz * d) !== 'water') continue
    let far = d
    while (far + 0.2 <= d + 1.6 && groundAt(x + sx * (far + 0.2), z + sz * (far + 0.2)) === 'water') far += 0.2
    const at = d + (far - d) * 0.6
    return { x: x + sx * at, z: z + sz * at }
  }
  return null
}

/** 오늘 이 나무에서 더 얻을 게 없는지 */
export const treeSpent = (chopped: Record<string, number>, id: string) => (chopped[id] ?? 0) >= CHOPS_PER_TREE
/** 오늘 이 바위를 다 깼는지 */
export const rockSpent = (rockHits: Record<string, number>, id: string) => (rockHits[id] ?? 0) >= HITS_PER_ROCK

/** 터치 화면 안내: 키 이름 대신 화면 버튼 이름을 쓴다(📦 넣기 버튼, ↻ 돌리기 버튼). 키보드 안내는 그대로 R 이다. */
function touchLabel(label: string): string {
  return label.replace('R 넣기', '📦 넣기').replace('R 돌리기', '↻ 돌리기').replace('R 소원 빌기', '↻ 소원 빌기')
}

/** 지금 E 로 할 수 있는 일과 그 안내 문구. opts.touch 이면 안내를 화면 버튼 기준으로 쓴다. */
export function findAction(opts: { touch?: boolean } = {}): Action | null {
  const a = findActionRaw(opts)
  return a && opts.touch ? { ...a, label: touchLabel(a.label) } : a
}

function findActionRaw(opts: { touch?: boolean }): Action | null {
  const s = useGame.getState()
  // 수영 중엔 잠수만 할 수 있다. 도구와 물건은 쓸 수 없다.
  if (runtime.swim) return findSwimAction()
  if (s.wear.outfit === 'swim-suit' && isShore(runtime.player.x, runtime.player.z) && !runtime.dive) return { kind: 'swim-in', label: '바다에 들어가기' }
  // 기능 열림 조건(집 상담·ATM·섬 정비 안내판)은 이 값으로 본다
  const ctx = ctxOf(s)
  const p = runtime.player
  const f = runtime.fishing
  // 나무가 서 있는지: 베어 넘긴 나무는 흔들 수도 벨 수도 없다.
  const standing = (t: TreeSpot) => treeState(t.id, s.felled, s.day) === 'tree'

  // 사다리로 오르내리는 동안에는 E 안내를 띄우지 않는다.
  if (runtime.climb) return null
  // 섬 정비 자리 고르기 중: 안내판 앞이면 그만두기, 아니면 가장 가까운 자리에서 맡기기
  if (runtime.infraMode) {
    if (dist2(p.x, p.z, INFRA_BOARD.x, INFRA_BOARD.z) < 1.5 * 1.5) return { kind: 'infra-board', label: '정비 자리 고르기 그만두기' }
    const spot = nearestInfraSpot(p.x, p.z)
    runtime.infraTarget = spot
    if (spot) return { kind: 'infra-commit', label: `여기에 ${spot.kind === 'bridge' ? '다리' : '계단'} 맡기기`, spot }
    return { kind: 'hint', label: '자리 가까이 가 보세요' }
  }
  // 길 깔기 중에는 E 가 바라보는 칸에만 쓰인다(다른 행동은 잠시 접는다)
  if (runtime.paintMode) {
    const c = placementCell(p.x, p.z, p.facing)
    const remove = decodePaths(s.infra.paths).some((t) => t.x === c.x && t.z === c.z)
    const ok = remove || pathSpotOk(c.x, c.z, s.placed, { felled: s.felled, day: s.day, holes: s.holes })
    runtime.paintTarget = { x: c.x, z: c.z, ok, remove }
    const label = remove ? '길 걷어내기' : ok ? `${PATH_NAME[runtime.paintMode]} 놓기` : '여기엔 길을 놓을 수 없어요'
    return { kind: 'paint', label, x: c.x, z: c.z, ok, paint: runtime.paintMode }
  }
  if (f.phase === 'wait' || f.phase === 'cast') return { kind: 'reel', label: '찌가 쏙 들어가면 당겨요' }
  // 불꽃 벤치는 주변에 모인 주민 말 걸기보다 먼저 잡는다(벤치 근처가 광장 한가운데라서)
  const watch = festivalWatchSpot(s.day, s.night)
  if (watch && !runtime.seat && dist2(p.x, p.z, watch.x, watch.z) < 2.2 * 2.2) return { kind: 'watch', label: '불꽃 구경하기' }
  // 낚시 대회 진행자: 대회 시간에만 서 있고, 판이 도는 동안은 말을 걸지 않는다
  const announcer = announcerSpot()
  if (announcer && tourneyWindow(s.day, currentHour()) && !runtime.tourney && dist2(p.x, p.z, announcer.x, announcer.z) < ANNOUNCER_R * ANNOUNCER_R) {
    if (canJoin(s.tourney, s.day, currentHour(), false)) return { kind: 'tourney-join', label: '낚시 대회 참가하기' }
    return { kind: 'tourney-exchange', label: '대회 포인트 바꾸기' }
  }
  if (f.phase === 'bite') return { kind: 'reel', label: '지금 당겨요!' }
  if (f.phase === 'reel') return null
  // 유성우 밤에 앉아 있으면 E 로 소원을 빈다(하루에 한 번)
  // 유성우 밤 소원은 바깥에 서 있을 때 E 로 빈다. 앉은 자리에서는 R 로도 빌 수 있다고 알려 준다.
  if (runtime.seat) return { kind: 'stand', label: wishOpen() ? '일어나기 · R 소원 빌기' : '일어나기' }
  // 집 방 안에서는 방 물건만 고른다. 바깥 섬의 주민·상점은 문을 나서야 닿는다.
  if (s.inHome) return findHomeAction(opts)
  if (s.inHall) return findHallAction()
  if (s.inShop) return findShopAction(ctx)
  if (s.inMuseum) return findMuseumAction()
  if (s.inCave) return findCaveAction()

  if (s.placing) {
    // 손가락으로 찍은 칸이 있으면 그 칸을, 없으면 바라보는 앞 칸을 쓴다
    const c = s.placeCell ?? placementCell(p.x, p.z, p.facing)
    // 정원 바닥은 길 판정 대신 고리·평지 판정을 쓴다. 같은 종류가 깔린 칸이면 걷어내기가 된다.
    if (isGardenItem(s.placing)) {
      const kind = GARDEN_KIND_OF_ITEM[s.placing]
      const tiles = decodeGarden(s.gardenTiles)
      const same = tiles.some((t) => t.x === c.x && t.z === c.z && t.kind === kind)
      if (!same && gardenTileBlocker(c.x, c.z, HOME_SITE, s.placed, tiles, { felled: s.felled, day: s.day, holes: s.holes, paths: pathCellsOf(s.infra.paths) })) return null
      return { kind: 'place', label: same ? '바닥 걷어내기' : `${GARDEN_TILE_NAME[kind]} 깔기`, ...c, ok: true }
    }
    // 놓을 수 없으면 E 안내는 띄우지 않는다. 이유는 놓기 중 알약(PlaceHint)이 한 번만 보여 준다.
    const why = placeBlocker(c.x, c.z, s.placed, [], { felled: s.felled, day: s.day, holes: s.holes, paths: pathCellsOf(s.infra.paths) })
    if (why) return null
    const seed = ITEMS[s.placing].kind === 'seed'
    return { kind: 'place', label: seed ? '여기에 심기' : '여기에 놓기', ...c, ok: true }
  }

  const layout = getLayout(s.day)
  // 바위는 오늘 다 깨지 않은 것을 먼저 고른다. 다 깬 바위만 남았으면 그 사실을 알린다.
  const rocksNear = ROCKS.filter((r) => dist2(p.x, p.z, r.x, r.z) < ROCK_R * ROCK_R)
  const openRock = rocksNear.find((r) => !rockSpent(s.rockHits, r.id)) ?? null
  const doneRock = !openRock && rocksNear.length > 0
  // 삽·도끼로 살아 있는 바위 앞에 서 있으면 바닥의 돌멩이나 집터보다 바위 두드리기가 먼저다.
  const frontRock = (s.tool === 'shovel' || s.tool === 'axe') && openRock && inFront(p, openRock) ? openRock : null
  // 도끼로 마주 본 나무도 같다. 벨 때 떨어진 목재가 발밑에 있어도 다음 E 는 도끼질로 이어진다.
  const frontTree = s.tool === 'axe' && TREES.some((t) => dist2(p.x, p.z, t.x, t.z) < TREE_R * TREE_R && standing(t) && inFront(p, t))
  // 물뿌리개 없이 마른 꽃 곁에 서면 물을 주라고 알려 준다.
  const thirsty = (s.tool === 'hand' || s.tool === 'shovel' || s.tool === 'axe') && s.plants.some((pl) => !pl.watered && dist2(p.x, p.z, pl.x, pl.z) < PLANT_R * PLANT_R)
  const thirstyHint: Action = { kind: 'hint', label: `${TOOLS.can.name}(${TOOLS.can.key})로 물을 줘요` }

  let best: Action | null = null
  let bestD = PICK_R * PICK_R
  for (const item of s.ground) {
    const d = dist2(p.x, p.z, item.x, item.z)
    if (d < bestD) [best, bestD] = [{ kind: 'pickup', label: `${ITEMS[item.itemId].name} 줍기`, item }, d]
  }
  for (const shell of layout.shells) {
    if (s.collected.includes(shell.id)) continue
    const d = dist2(p.x, p.z, shell.x, shell.z)
    if (d < bestD) [best, bestD] = [{ kind: 'shell', label: `${ITEMS[shell.itemId].name} 줍기`, shell }, d]
  }
  // 부두 앞에서 줍기 대상이 있으면 펠리와 말하기가 먼저다. 줍는 것이 훨씬 가깝고 바라보는 쪽에 있을 때만 줍는다.
  const dock = DOCKS.find((d) => dist2(p.x, p.z, d.x, d.z) < DOCK_TALK_R * DOCK_TALK_R)
  if (best && dock && !frontRock && !frontTree) {
    const at = best.kind === 'pickup' ? best.item : best.kind === 'shell' ? best.shell : null
    const clearlyCloser = !!at && bestD < dist2(p.x, p.z, dock.x, dock.z) * 0.25 && inFront(p, at)
    if (!clearlyCloser) return { kind: 'pelican', label: '펠리와 이야기하기', dock }
  }
  if (best && !frontRock && !frontTree) return best

  // 현관 앞에서 문을 보고 있으면 집 들어가기가 주민 대화보다 먼저다
  if (HOME_SITE && doorInFront(p, HOME_SITE.door, HOME_DOOR_R)) return { kind: 'home-door', label: '내 집 들어가기' }
  // 주민 집 현관도 같은 규칙: 지은 집 문 앞에서 문을 보고 있으면 들어가기가 먼저다
  for (const v of VILLAGERS) {
    if (!s.houses.includes(v.id)) continue
    const door = houseDoor(v)
    if (doorInFront(p, door, 1.2)) return { kind: 'enter', label: `${v.name}네 집 들어가기`, villager: v }
  }

  // 주민과 가구가 가까이 있을 때 고정 순서로 고르면 한쪽이 늘 가려진다. 더 가까운 쪽을 고른다.
  let near: Action | null = null
  let nearD = Infinity
  for (const v of presentVillagers(s.houses).filter((x) => !shopGuestsNow().includes(x.id))) {
    const vp = villagerAt(v, s.houses)
    const d = dist2(p.x, p.z, vp.x, vp.z)
    if (d < TALK_R * TALK_R && d < nearD) [near, nearD] = [{ kind: 'talk', label: `${josa(v.name, '과', '와')} 이야기하기`, villager: v }, d]
  }
  for (const placed of s.placed) {
    const d = dist2(p.x, p.z, placed.x, placed.z)
    if (d < STOW_R * STOW_R && d < nearD) [near, nearD] = [furnitureAction(placed), d]
  }
  // 주민은 옆에 그냥 서 있고 마주 보고 선 것이 가판대·상점 문이면 그쪽을 먼저 고른다. 주민을 보고 있으면 대화가 이긴다.
  if (near?.kind === 'talk' && !inFront(p, villagerAt(near.villager, s.houses))) {
    const faced = facedFixture(p, s)
    if (faced) return faced
  }
  if (near) return near

  // 집 안: 문 앞에서 나간다. 집 밖: 지은 집 현관 앞에서 들어간다.
  if (s.inside) {
    const i = VILLAGERS.findIndex((v) => v.id === s.inside)
    const c = roomCenter(i)
    if (dist2(p.x, p.z, c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z) < 1.3 * 1.3) return { kind: 'leave', label: '밖으로 나가기' }
    return findRoomAction(VILLAGERS[i], c)
  }
  for (const v of VILLAGERS) {
    if (!s.houses.includes(v.id)) continue
    const door = houseDoor(v)
    if (dist2(p.x, p.z, door.x, door.z) < 1.2 * 1.2) return { kind: 'enter', label: `${v.name}네 집 들어가기`, villager: v }
  }

  // 떠 있는 바람 풍선: 아래에 서서 잠자리채로 잡는다
  const prog = balloonProgress(s.day, currentHour())
  if (prog !== null && runtime.balloonCaught !== s.day) {
    const b = balloonPosition(prog)
    if (dist2(p.x, p.z, b.x, b.z) < BALLOON_R * BALLOON_R) {
      if (s.tool !== 'net') return { kind: 'hint', label: '잠자리채를 들고 와야 풍선을 잡을 수 있어요' }
      return { kind: 'balloon-catch', label: '잠자리채로 풍선 잡기' }
    }
  }

  // 해안 동굴 입구: 밀물이면 물에 잠겨 못 들어간다
  const cave = caveSpot()
  const dCave = dist2(p.x, p.z, cave.x, cave.z)
  if (dCave < 2.2 * 2.2) {
    if (caveOpen(currentHour())) return { kind: 'cave-enter', label: '해안 동굴 들어가기' }
    // 밀물이면 입구 앞 1.5 안에서만 안내한다
    if (dCave < 1.5 * 1.5) return { kind: 'hint', label: '밀물이라 동굴 입구가 물에 잠겼어요' }
  }
  // 내 집 현관·집 상담 간판·ATM 은 상점 문보다 먼저 본다. 셋 다 상점 문과 멀리 떨어져 있어 겹치지 않는다.
  if (HOME_SITE) {
    if (dist2(p.x, p.z, HOME_SITE.door.x, HOME_SITE.door.z) < HOME_DOOR_R * HOME_DOOR_R) return { kind: 'home-door', label: '내 집 들어가기' }
    if (systemOpen('home', ctx) && dist2(p.x, p.z, HOME_SITE.sign.x, HOME_SITE.sign.z) < HOME_SIGN_R * HOME_SIGN_R) return { kind: 'home-sign', label: '집 상담하기' }
    const homeLock = lockedSystem('home', ctx)
    if (homeLock && dist2(p.x, p.z, HOME_SITE.sign.x, HOME_SITE.sign.z) < HOME_SIGN_R * HOME_SIGN_R) return { kind: 'locked', label: lockedLabel(homeLock.name), hint: homeLock.hint }
  }
  // 전시관은 도감에 열 종이 오른 뒤에만 선다. 학예사는 문 오른쪽에 있다.
  if (MUSEUM_SITE && museumOpen(s.dex)) {
    if (dist2(p.x, p.z, MUSEUM_SITE.curator.x, MUSEUM_SITE.curator.z) < CURATOR_R * CURATOR_R) return { kind: 'curator', label: `${josa(CURATOR_NAME, '과', '와')} 이야기하기` }
    if (dist2(p.x, p.z, MUSEUM_SITE.door.x, MUSEUM_SITE.door.z) < MUSEUM_DOOR_R * MUSEUM_DOOR_R) return { kind: 'museum-enter', label: '자연사 전시관 들어가기' }
  }
  if (HALL_SITE && dist2(p.x, p.z, HALL_SITE.door.x, HALL_SITE.door.z) < HALL_DOOR_R * HALL_DOOR_R) return { kind: 'hall-enter', label: '마을회관 들어가기' }
  if (dist2(p.x, p.z, SHOP_DOOR.x, SHOP_DOOR.z) < SHOP_R * SHOP_R) {
    // 공사 중에는 문 앞에서 공사 안내를 한다. E 를 누르면 구경만 할 수 있다.
    const closed = upgradeState(s.shop, s.day).status === 'closed'
    return { kind: 'shop-enter', label: closed ? '상점 공사 중 · 들어가 구경하기' : '도토리 상점 들어가기' }
  }
  if (dist2(p.x, p.z, WORKBENCH.x, WORKBENCH.z) < 2 * 2) return { kind: 'workbench', label: '작업대에서 만들기' }
  if (dist2(p.x, p.z, VIEWPOINT.x, VIEWPOINT.z) < 1.4 * 1.4) return { kind: 'viewpoint', label: '벤치에 앉기' }
  if (systemOpen('infra', ctx) && dist2(p.x, p.z, INFRA_BOARD.x, INFRA_BOARD.z) < 1.5 * 1.5) return { kind: 'infra-board', label: '섬 정비 안내판 보기' }
  const infraLock = lockedSystem('infra', ctx)
  if (infraLock && dist2(p.x, p.z, INFRA_BOARD.x, INFRA_BOARD.z) < 1.5 * 1.5) return { kind: 'locked', label: lockedLabel(infraLock.name), hint: infraLock.hint }
  if (dist2(p.x, p.z, (SPOUT.a[0] + SPOUT.b[0]) / 2, (SPOUT.a[1] + SPOUT.b[1]) / 2) < 2.2 * 2.2) return { kind: 'spout', label: '폭포 바라보기' }
  if (stallOpen(s.stats) && dist2(p.x, p.z, STALL.x, STALL.z) < 2.1 * 2.1) return { kind: 'stall', label: '옷 가판대 구경하기' }
  if (MARKET_SITE && isMarketDay(s.day) && dist2(p.x, p.z, MARKET_SITE.x, MARKET_SITE.z) < 2.1 * 2.1) return { kind: 'market', label: '장터 가판대 구경하기' }
  if (SONGI_SITE && songiOpen(s.day, currentHour()) && dist2(p.x, p.z, SONGI_SITE.x, SONGI_SITE.z) < 2.1 * 2.1) return { kind: 'songi', label: '송이 상인에게 말 걸기' }
  if (dist2(p.x, p.z, MAILBOX.x, MAILBOX.z) < 1.5 * 1.5) {
    const unread = s.letters.filter((l) => !l.read).length
    return { kind: 'mail', label: unread ? `편지 ${unread}통 읽기` : '편지함 열기' }
  }

  for (const dock of DOCKS) {
    if (dist2(p.x, p.z, dock.x, dock.z) < DOCK_TALK_R * DOCK_TALK_R) return { kind: 'pelican', label: '펠리와 이야기하기', dock }
  }

  if (frontRock) return { kind: 'hit', label: '바위 두드리기', rock: frontRock }

  for (const v of VILLAGERS) {
    if (s.houses.includes(v.id) || !hasPlot(v, s.recruits) || dist2(p.x, p.z, v.house.x, v.house.z) > PLOT_R * PLOT_R) continue
    return { kind: 'build', label: `${v.name}의 집 짓기 · ${costLabel(v.cost)}`, villager: v }
  }

  const ax = p.x + Math.sin(p.facing) * REACH
  const az = p.z + Math.cos(p.facing) * REACH
  // 나무 흔들기·덤불 뒤적이기는 어떤 도구를 들어도 된다. 삽·물뿌리개의 빈 동작이 이걸 가리지 않게 미리 찾아 둔다.
  // 오늘 이미 흔든 나무(열매·소나무)는 뺀다. 안내가 죽은 나무에 머물지 않고 다음 나무로 넘어간다.
  const shakeTree = TREES.find((t) => dist2(p.x, p.z, t.x, t.z) < TREE_R * TREE_R && standing(t) && !s.shaken.includes(t.id))
  const rustleBush = shakeTree ? undefined : BUSHES.find((b) => dist2(p.x, p.z, b.x, b.z) < BUSH_R * BUSH_R)
  const shakeOrRustle: Action | null = shakeTree
    ? { kind: 'shake', label: shakeTree.kind === 'pine' ? '소나무 흔들기' : '나무 흔들기', tree: shakeTree }
    : rustleBush
      ? { kind: 'rustle', label: '덤불 뒤적이기', bush: rustleBush }
      : null

  if (s.tool === 'shovel') {
    // 보물 지도의 목표 자리 근처에서 삽으로 판다
    for (const slot of s.inventory) {
      const t = parseMapId(slot.id)
      if (t && (nearTreasure(ax, az, t, TREASURE_REACH) || nearTreasure(p.x, p.z, t, TREASURE_REACH))) return { kind: 'treasure', label: '보물 파기', mapId: slot.id }
    }
    if (openRock) return { kind: 'hit', label: '바위 두드리기', rock: openRock }
    // 손이 닿는 곳(앞) 또는 발밑에 있는 그루터기·구멍·보물 자리를 고른다.
    const near = (x: number, z: number, r: number) => dist2(ax, az, x, z) < r * r || dist2(p.x, p.z, x, z) < r * r
    const stump = TREES.find((t) => treeState(t.id, s.felled, s.day) === 'stump' && near(t.x, t.z, HOLE_REACH))
    if (stump) return { kind: 'stump', label: '그루터기 파내기', tree: stump }
    const hole = s.holes.find((h) => near(h.x, h.z, HOLE_REACH))
    if (hole) return { kind: 'fill', label: '구멍 메우기', hole }
    const spot = layout.digs.find((d) => !s.dug.includes(d.id) && dist2(ax, az, d.x, d.z) < DIG_R * DIG_R) ?? null
    if (spot) return { kind: 'dig', label: '반짝이는 자리 파기', spot, x: spot.x, z: spot.z }
    if (shakeOrRustle) return shakeOrRustle
    if (doneRock) return { kind: 'hint', label: '오늘은 다 캤어요' }
    if (thirsty) return thirstyHint
    // 빈 땅은 어디서나 판다. 구멍을 팔 수 없는 자리(물·길·집·가구·주민 곁)면 안내 없이 넘어간다.
    const canDig = canDigAt(ax, az, {
      placed: s.placed,
      plants: s.plants,
      houses: s.houses,
      holes: s.holes,
      felled: s.felled,
      day: s.day,
      villagers: presentVillagers(s.houses).map((v) => villagerAt(v, s.houses)),
    }, { x: p.x, z: p.z })
    if (canDig) return { kind: 'dig', label: '땅 파기', spot: null, x: ax, z: az }
  }

  if (s.tool === 'axe') {
    if (openRock) return { kind: 'hit', label: '바위 두드리기', rock: openRock }
    const trees = TREES.filter((t) => dist2(p.x, p.z, t.x, t.z) < TREE_R * TREE_R && standing(t))
    // 덜 벤 나무를 먼저 고르고, 다 벤 나무도 더 베어 넘길 수 있게 '베어 넘기기' 동작을 준다.
    const tree = trees.find((t) => !treeSpent(s.chopped, t.id)) ?? trees[0]
    if (tree) return { kind: 'chop', label: treeSpent(s.chopped, tree.id) ? '나무 베어 넘기기' : '나무 베기', tree }
    // 곁에 덤불이 있으면 안내 대신 아래에서 덤불 뒤적이기를 고르게 둔다.
    if (doneRock && !rustleBush) return { kind: 'hint', label: '오늘은 다 캤어요' }
  }

  if (s.tool === 'can' && s.canLevel > 1) {
    // 넓은·큰 물뿌리개는 바라보는 정사각형 안의 꽃을 한꺼번에 적신다. 마른 꽃이 있으면 그 꽃들만 고른다.
    const plants = canTargets(s.plants, p.x, p.z, p.facing, s.canLevel)
    if (!plants.length && shakeOrRustle) return shakeOrRustle
    if (plants.length && plants.every((pl) => pl.watered) && weatherFor(s.day) === 'rain') return { kind: 'hint', label: '비가 와서 촉촉해요' }
    const dry = plants.some((pl) => !pl.watered)
    return { kind: 'water', label: plants.length ? `${dry ? '물 주기' : '물 더 주기'}${canAreaLabel(s.canLevel)}` : '', plants, area: s.canLevel }
  }

  if (s.tool === 'can') {
    // 꽃은 1 칸 간격으로 촘촘해서 앞에 물 준 꽃이 있어도 옆에 마른 꽃이 닿기도 한다. 안 준 꽃을 먼저 고른다.
    const inReach = (pl: Plant) => dist2(p.x, p.z, pl.x, pl.z) < PLANT_R * PLANT_R || dist2(ax, az, pl.x, pl.z) < PLANT_R * PLANT_R
    const dry = s.plants.filter((pl) => !pl.watered && inReach(pl))
    const pool = dry.length ? dry : s.plants.filter(inReach)
    let plant: Plant | null = null
    let pd = Infinity
    for (const pl of pool) {
      const d = dist2(ax, az, pl.x, pl.z)
      if (d < pd) [plant, pd] = [pl, d]
    }
    // 비가 와서 이미 젖은 꽃에는 물을 또 줄 일이 없다. 누를 일 없는 안내만 띄운다.
    if (!plant && shakeOrRustle) return shakeOrRustle
    if (plant?.watered && weatherFor(s.day) === 'rain') return { kind: 'hint', label: '비가 와서 촉촉해요' }
    return { kind: 'water', label: plant ? (plant.watered ? '물 더 주기' : '꽃에 물 주기') : '', plants: plant ? [plant] : [], area: 1 }
  }

  if (s.tool === 'net') {
    const night = s.night
    const t = now()
    // 여름 밤엔 풀의 구슬 반딧불이 대신 떠도는 반딧불이를 잡는다(두 번 보이지 않게)
    const glowOn = fireflyOn(seasonFor(s.day), currentHour(), weatherFor(s.day))
    for (const bug of layout.bugs) {
      if (s.caught.includes(bug.id)) continue
      if (replacedByFireflies(night ? bug.night : bug.day, glowOn)) continue
      const [bx, , bz] = bugPosition(bug, t, night)
      if (dist2(p.x, p.z, bx, bz) < BUG_R * BUG_R) {
        return { kind: 'bug', label: '잠자리채 휘두르기', bug, species: night ? bug.night : bug.day }
      }
    }
    if (glowOn) {
      const index = fireflyNearest(p.x, p.z, BUSHES, runtime.fireflyGone, t, BUG_R)
      if (index !== null) return { kind: 'firefly', label: '잠자리채 휘두르기', index }
    }
  }

  // 사다리를 든 채 바라보는 쪽에 절벽이 있으면 그 너머로 오르내린다. 나무·덤불 안내보다 먼저다.
  if (s.tool === 'ladder') {
    const climb = climbSpot(p.x, p.z, p.facing)
    if (climb) return { kind: 'climb', label: climb.up ? '사다리로 올라가기' : '사다리로 내려가기', spot: climb }
  }
  if (shakeOrRustle) return shakeOrRustle
  if (thirsty) return thirstyHint
  // 맨손으로 바위 옆에 서면 아무 반응이 없어 헷갈린다. 필요한 도구나 다 깼다는 사실을 알려 준다.
  if (rocksNear.length && s.tool === 'hand') return { kind: 'hint', label: openRock ? '삽이나 도끼가 필요해요 · 상점에서 살 수 있어요' : '오늘은 다 캤어요' }

  // 가을엔 낙엽더미 옆에서 E 로 찬다(짧은 간격은 쉰다)
  if (seasonFor(s.day) === 'autumn' && !s.inside && !s.inHome) {
    const pile = leafPiles().find((q) => dist2(p.x, p.z, q.x, q.z) < 1.1 * 1.1)
    if (pile && now() - (runtime.kickedAt[pile.id] ?? -99) > 1.2) return { kind: 'kick', label: '낙엽 차기', pile }
  }
  // 섬 곳곳의 발견거리: 집 밖에서 하루 한 번씩
  if (!isIndoor(s)) {
    const spot = discoveryNear(p.x, p.z)
    if (spot && canDiscover(runtime.discovered[spot.id], s.day)) return { kind: 'discover', label: spot.label, spot }
  }
  // 전망 벤치 옆 망원경: 맑은 밤에만 하늘을 올려다본다
  if (!s.inside && !s.inHome && nearTelescope(p.x, p.z)) {
    if (runtime.telescope) return { kind: 'stargaze', label: '망원경에서 내려오기', on: false }
    if (telescopeOpen(currentHour(), weatherFor(s.day))) return { kind: 'stargaze', label: '망원경으로 별 보기', on: true }
    return { kind: 'hint', label: '맑은 밤 8시부터 4시 전에 볼 수 있어요' }
  }
  if (s.tool === 'rod' && !s.inside && !s.inHome) {
    const spot = castSpot(p.x, p.z, p.facing)
    // 꽁꽁 언 작은 연못에는 낚싯줄이 안 들어간다
    if (spot && frozenAt(spot.x, spot.z, s.day)) return { kind: 'hint', label: '연못이 꽁꽁 얼었어요. 봄에 다시 와요' }
    if (spot) return { kind: 'cast', label: '낚싯대 던지기', ...spot }
  }

  // 잠자리채는 벌레가 없어도 휘두를 수 있다. 안내 문구는 띄우지 않는다.
  if (s.tool === 'net') return { kind: 'swing', label: '' }

  // 유성우 밤에 바깥에 서서 아무것도 없을 때만 소원을 빌 수 있다(하루에 한 번). 앉은 자리의 일어나기는 그대로 둔다.
  if (wishOpen()) return { kind: 'wish', label: '별똥별에 소원 빌기' }

  return null
}

/** 집 점수 미리보기 값을 칸·가구·집 상태가 같으면 다시 계산하지 않는다(프롬프트는 자주 다시 그려진다). */
let gainMemo: { furn: unknown; placed: unknown; tiles: unknown; photo: unknown; item: string; floor: number; stage: number; x: number; z: number; gain: number } | null = null
function placeGainOf(s: ReturnType<typeof useGame.getState>, cell: { x: number; z: number }, item: string): number {
  const m = gainMemo
  if (m && m.furn === s.homeFurniture && m.placed === s.placed && m.tiles === s.gardenTiles && m.photo === s.wallPhoto && m.item === item && m.floor === s.homeFloor && m.stage === s.home.stage && m.x === cell.x && m.z === cell.z) return m.gain
  const base = { stage: s.home.stage, furniture: s.homeFurniture, framed: frameHung(!!s.wallPhoto, s.homeFurniture), framedFloor: frameFloor(!!s.wallPhoto, s.homeFurniture), garden: gardenStats(s.placed, decodeGarden(s.gardenTiles), HOME_SITE) }
  const gain = scoreGainOf(base, { itemId: item, x: cell.x, z: cell.z, floor: s.homeFloor })
  gainMemo = { furn: s.homeFurniture, placed: s.placed, tiles: s.gardenTiles, photo: s.wallPhoto, item, floor: s.homeFloor, stage: s.home.stage, x: cell.x, z: cell.z, gain }
  return gain
}

/** 집 방 안에서 E 가 하는 일. 놓기 중이면 칸에 놓고, 아니면 나가기·보관함·가구 넣기 순서다. */
function findHomeAction(opts: { touch?: boolean } = {}): Action | null {
  const s = useGame.getState()
  const p = runtime.player
  const c = roomCenter(HOME_ROOM)
  const lx = p.x - c.x
  const lz = p.z - c.z
  if (s.homePlacing && isWallItem(s.homePlacing)) {
    // 벽에 거는 물건: 벽을 보고 선 칸에서 그 벽 면에 건다
    const spot = wallSpot(lx, lz, p.facing, s.home.stage, s.homeFloor, s.homeFurniture)
    return { kind: 'home-place', label: spot.why ?? `${ITEMS[s.homePlacing].name} 걸기`, x: spot.x, z: spot.z, ok: !spot.why, wall: spot.dir }
  }
  if (s.homePlacing) {
    // 방 칸은 1칸 격자라 바라보는 칸을 정수로 맞춘다.
    // 손가락으로 찍은 칸이 있으면 그 칸을, 없으면 바라보는 칸을 쓴다
    const cell = s.homePlaceCell ?? placementCell(lx, lz, p.facing)
    const blocked = homePlaceBlocker(cell.x, cell.z, s.home.stage, s.homeFurniture, s.homeFloor)
    // 칸이 전부 찼으면 칸마다 이유를 말하는 대신 방이 찼다고 한 번에 알려 준다
    const why = blocked && homeRoomFull(s.home.stage, s.homeFurniture, s.homeFloor) ? '방이 가득 찼어요. 가구를 넣거나 방을 넓혀요' : blocked
    const name = ITEMS[s.homePlacing].name
    const turn = opts.touch ? '↻ 돌리기' : 'R 돌리기'
    // 놓으면 집 점수가 오르는 만큼 붙여 알려 준다(0이면 생략)
    const gain = why ? 0 : placeGainOf(s, cell, s.homePlacing)
    return { kind: 'home-place', label: why ? why : `${name} 놓기 · ${turn}${gain > 0 ? ` · 점수 +${gain}` : ''}`, x: cell.x, z: cell.z, ok: !blocked }
  }
  const stage = s.home.stage
  const size = HOME_ROOM_SIZES[stage]
  // 다락방 사다리: 방바닥 쪽 발끝에서는 올라가고, 다락 쪽 끝에서는 내려간다
  if (hasAttic(stage)) {
    const up = s.homeFloor === 0
    if (dist2(lx, lz, ATTIC.ladderX, up ? ATTIC.ladderFootZ : ATTIC.climbZ) < 1.3 * 1.3) return { kind: 'home-climb', label: up ? '다락으로 올라가기' : '방바닥으로 내려가기' }
  }
  // 방문객이 바로 앞에 있으면 그 사람과 이야기한다(가구보다 먼저). 방문객은 본채에만 온다.
  const vp = runtime.visitPos
  if (s.homeFloor < 2 && runtime.visit && vp && dist2(lx, lz, vp.x, vp.z) < VISIT_TALK_REACH * VISIT_TALK_REACH) return { kind: 'visit-talk', label: '방문객과 이야기하기' }
  // 보관함·침대·창·방 가구 가운데 가장 가까운 것 하나. 같은 거리 규칙이라 겹쳐도 한쪽이 가려지지 않는다.
  let best: Action | null = null
  let bd = Infinity
  const pick = (d: number, a: Action) => {
    if (d < bd) [best, bd] = [a, d]
  }
  // 옆방 문·지하 계단·나가는 문도 같은 거리 규칙에 든다. 보관함 앞에 서도 가까운 문이 먼저 잡히지 않게 한다.
  for (const m of HOME_MOVES) {
    if (m.from !== s.homeFloor || !floorOpen(stage, m.to)) continue
    const d = dist2(lx, lz, m.at.x, m.at.z)
    if (d < 1.3 * 1.3) pick(d, { kind: 'home-move', label: m.label, to: m.to })
  }
  // 나가는 문은 본채 방바닥에만 있다(옆방·지하실에서는 본채로 먼저 돌아간다)
  const exit = exitOf(size)
  const exitD = dist2(lx, lz, exit.x, exit.z)
  if (s.homeFloor === 0 && exitD < 1.3 * 1.3) pick(exitD, { kind: 'home-leave', label: '밖으로 나가기' })
  // 침대와 보관함은 방바닥에만 있다. 다락에서는 가구만 고른다.
  if (s.homeFloor === 0) {
    const chest = homeChest(stage)
    const chestD = dist2(lx, lz, chest.x, chest.z)
    if (chestD < CHEST_R * CHEST_R) pick(chestD, { kind: 'storage', label: '보관함 열기' })
    const bed = homeBed(stage)
    const bedD = dist2(lx, lz, bed.x, bed.z)
    if (bedD < HOME_BED_R * HOME_BED_R) pick(bedD, { kind: 'home-bed', label: '침대에 눕기' })
  }
  // 창은 본채 벽에만 있다. 옆방·지하실에는 본채 창 자리가 없다.
  for (const w of s.homeFloor < 2 ? HOME_WINDOWS : []) {
    const d = dist2(lx, lz, w.x, w.z)
    if (d < HOME_WINDOW_R * HOME_WINDOW_R) pick(d, { kind: 'home-window', label: '창밖 보기' })
  }
  // 가장 가까운 가구 하나. 방금 놓은 가구는 3초 동안 한 칸 더 먼 거리에서도 먼저 잡힌다(homeStow). 나가는 문보다도 먼저 잡혀 E 가 방을 나가지 않는다.
  const near = pickStowTarget(s.homeFurniture, lx, lz, s.homeFloor, runtime.justPlaced, performance.now())
  if (near) pick(near.id === runtime.justPlaced?.id ? 0 : dist2(lx, lz, near.x, near.z), homeFurnitureAction(near))
  return best
}

/** 방 가구의 E 행동. 앉기·불빛은 home-use, 나머지 쓰임은 home-act, 쓰임이 없으면 넣기다. */
function homeFurnitureAction(placed: Placed): Action {
  const name = ITEMS[placed.itemId].name
  // 서랍장은 E 로 보관함을 연다(가방 ↔ 보관함 옮기기는 보관함 패널에서)
  if (placed.itemId === 'drawer') return { kind: 'storage', label: `${name} 열기` }
  // 옷장은 E 로 옷장 패널을 연다(C 키와 같은 패널이며 상점 구매 없이 입어 보기만 한다)
  if (placed.itemId === 'wardrobe') return { kind: 'closet', label: `${name} 열기` }
  const use = homeUse(placed.itemId)
  if (!use) return { kind: 'home-stow', label: `${name} 넣기`, placed }
  if (use === 'sit' || use === 'light') return { kind: 'home-use', label: `${homeUseLabel(use, name, placed.off)} · R 넣기`, placed, use }
  return { kind: 'home-act', label: `${homeUseLabel(use, name)} · R 넣기`, placed, use }
}

/** 전시관 방 안에서 E 가 하는 일. 나가는 문 앞에서만 나간다. */
/** 동굴 방 안: 입구 쪽 문 앞에 서면 나갈 수 있다 */
function findCaveAction(): Action | null {
  const p = runtime.player
  const c = roomCenter(CAVE_ROOM)
  if (dist2(p.x, p.z, c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z) < 1.3 * 1.3) return { kind: 'cave-leave', label: '밖으로 나가기' }
  const s = useGame.getState()
  const node = CAVE_NODES.findIndex((n) => dist2(p.x, p.z, c.x + n.x, c.z + n.z) < 1.3 * 1.3)
  if (node >= 0) {
    if (s.tool !== 'shovel') return { kind: 'hint', label: '삽을 들고 와야 광석을 캘 수 있어요' }
    if (minesLeft(s.day, s.cave) <= 0) return { kind: 'hint', label: '오늘은 광석을 다 캤어요' }
    return { kind: 'cave-mine', label: '삽으로 광석 캐기', node }
  }
  if (dist2(p.x, p.z, c.x + CAVE_CHEST.x, c.z + CAVE_CHEST.z) < 1.2 * 1.2) {
    if (!chestDue(dayIndex(s.day) ?? 0, s.cave.chestWeek)) return { kind: 'hint', label: '이번 주 상자는 이미 열었어요' }
    return { kind: 'cave-chest', label: '상자 열기' }
  }
  return null
}

/** 마을회관 방 안: 나가는 문, 게시판, 마이크 책상, 접수대 순으로 가까운 것 하나를 고른다. */
function findHallAction(): Action | null {
  const p = runtime.player
  const c = roomCenter(HALL_ROOM)
  if (dist2(p.x, p.z, c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z) < 1.3 * 1.3) return { kind: 'hall-leave', label: '밖으로 나가기' }
  const at = (o: { x: number; z: number; r: number }) => dist2(p.x, p.z, c.x + o.x, c.z + o.z) < (o.r + 0.5) * (o.r + 0.5)
  if (at(HALL_OBJECTS.board)) return { kind: 'hall-board', label: '게시판 보기' }
  if (at(HALL_OBJECTS.mic)) return { kind: 'hall-mic', label: '마이크 책상 · 오늘 마을 방송 듣기' }
  if (at(HALL_OBJECTS.reception)) {
    const st = useGame.getState()
    return { kind: 'hall-reception', label: receptionLabel(st.islandGift ?? NEW_ISLAND_GIFT, st.day) }
  }
  return null
}

/** 도토리 상점 안: 점원 두 마리는 상점 패널을, ATM 은 통장 패널을 연다. 나가는 문 앞에서는 밖으로 나간다. */
/** 지금 상점에 와 있는 손님 id. 바깥 주민을 숨기는 쪽과 상점 안 그리기가 같은 답을 쓴다. */
export function shopGuestsNow(): string[] {
  const s = useGame.getState()
  return shopGuestIds(s.day, currentHour(), presentVillagers(s.houses).map((v) => v.id))
}

/** 진열대 앞에서 E: 가장 가까운 자리의 물건을 바로 산다. 자리 밖이면 null. */
function findDisplayAction(c: { x: number; z: number }): Action | null {
  const s = useGame.getState()
  const p = runtime.player
  const stock = displayStock(upgradeState(s.shop, s.day).tier, s.day)
  let pick = -1
  let bestD = DISPLAY_REACH * DISPLAY_REACH
  for (let i = 0; i < DISPLAY_SPOTS.length; i++) {
    const d = dist2(p.x, p.z, c.x + DISPLAY_SPOTS[i].x, c.z + DISPLAY_SPOTS[i].z)
    if (stock[i] && d < bestD) {
      bestD = d
      pick = i
    }
  }
  // 주간 한정 받침대: 가까우면 바닥 진열보다 먼저 본다. 이번 주에 샀으면 빈 받침대라 아무것도 없다.
  const lim = limitedShelf(upgradeState(s.shop, s.day).tier, s.day, s.weeklyBuy)
  const limD = dist2(p.x, p.z, c.x + LIMITED_SPOT.x, c.z + LIMITED_SPOT.z)
  if (lim.entry && !lim.bought && limD < DISPLAY_REACH * DISPLAY_REACH && (pick < 0 || limD < bestD)) {
    let clerk = SHOP_OBJECTS.clerks[0]
    for (const k of SHOP_OBJECTS.clerks) if (dist2(LIMITED_SPOT.x, LIMITED_SPOT.z, k.x, k.z) < dist2(LIMITED_SPOT.x, LIMITED_SPOT.z, clerk.x, clerk.z)) clerk = k
    return { kind: 'shop-display', label: displayLabel(lim.entry, false), itemId: lim.entry.itemId, clerk: clerk.id, sold: false, weekly: true }
  }
  if (pick < 0) return null
  const e = stock[pick]
  const spot = DISPLAY_SPOTS[pick]
  // 점원은 자리와 가까운 쪽이 답한다. 왼쪽 자리는 가람, 오른쪽은 나루 앞이다.
  let clerk = SHOP_OBJECTS.clerks[0]
  for (const k of SHOP_OBJECTS.clerks) if (dist2(spot.x, spot.z, k.x, k.z) < dist2(spot.x, spot.z, clerk.x, clerk.z)) clerk = k
  const sold = isSoldOut(s.shopLog, s.day, e.itemId)
  return { kind: 'shop-display', label: displayLabel(e, sold), itemId: e.itemId, clerk: clerk.id, sold }
}

function findShopAction(ctx: UnlockCtx): Action | null {
  const p = runtime.player
  const c = roomCenter(SHOP_ROOM)
  if (dist2(p.x, p.z, c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z) < 1.3 * 1.3) return { kind: 'shop-leave', label: '밖으로 나가기' }
  // 진열대는 손님보다 먼저 본다. 손님이 옆에 서 있어도 물건을 집어 살 수 있게 한다.
  const display = findDisplayAction(c)
  if (display) return display
  const guests = shopGuestsNow()
  for (let i = 0; i < guests.length; i++) {
    const g = shopGuestSpot(i, now())
    const v = VILLAGERS.find((x) => x.id === guests[i])
    if (v && dist2(p.x, p.z, c.x + g.x, c.z + g.z) < 1.6 * 1.6) return { kind: 'shop-guest', label: `${v.name}에게 말 걸기`, id: v.id }
  }
  for (const k of SHOP_OBJECTS.clerks) {
    if (dist2(p.x, p.z, c.x + k.x, c.z + k.z) < 1.8 * 1.8) return { kind: 'shop', label: `${k.id === 'garam' ? '가람' : '나루'}에게 상점 보기`, clerk: k.id }
  }
  const a = SHOP_OBJECTS.atm
  if (systemOpen('atm', ctx) && dist2(p.x, p.z, c.x + a.x, c.z + a.z) < 1.8 * 1.8) return { kind: 'atm', label: '도토리 ATM 이용하기' }
  const atmLock = lockedSystem('atm', ctx)
  if (atmLock && dist2(p.x, p.z, c.x + a.x, c.z + a.z) < 1.8 * 1.8) return { kind: 'locked', label: lockedLabel(atmLock.name), hint: atmLock.hint }
  return null
}

function findMuseumAction(): Action | null {
  const p = runtime.player
  const c = roomCenter(MUSEUM_ROOM)
  if (dist2(p.x, p.z, c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z) < 1.3 * 1.3) return { kind: 'museum-leave', label: '밖으로 나가기' }
  return null
}

/** 주민 방 물건은 한 번만 계산해 둔다. 프레임마다 목록을 새로 만들지 않게 한다. */
const roomTargetCache = new Map<string, RoomTarget[]>()
/** 누운 몸의 가운데를 침대 가운데에 맞추려고 발 쪽으로 미는 거리 */
const LIE_FOOT = 0.55
function roomTargetsOf(v: Villager): RoomTarget[] {
  let list = roomTargetCache.get(v.id)
  if (!list) {
    list = villagerRoomTargets(v.gifts)
    roomTargetCache.set(v.id, list)
  }
  return list
}

/** 수영 중 E 가 하는 일: 가장 가까운 거품 자리에서 잠수한다. 거품이 없으면 아무 일도 없다. */
function findSwimAction(): Action | null {
  const s = useGame.getState()
  const p = runtime.player
  let best: { key: string; d: number } | null = null
  for (const b of bubbleSpots(s.day)) {
    const key = `${b.x},${b.z}`
    if (runtime.dived.day === s.day && runtime.dived.keys.includes(key)) continue
    const d = Math.hypot(p.x - b.x, p.z - b.z)
    if (d <= BUBBLE_REACH && (!best || d < best.d)) best = { key, d }
  }
  return best ? { kind: 'dive', label: '잠수하기', key: best.key } : null
}

/** 주민 방 안에서 E 가 하는 일. 방 물건 가운데 가장 가까운 것 하나다. 바깥 섬 목록은 쓰지 않는다. */
function findRoomAction(v: Villager, c: { x: number; z: number }): Action | null {
  const s = useGame.getState()
  const p = runtime.player
  const t = nearestWithin(roomTargetsOf(v), p.x - c.x, p.z - c.z)
  if (!t) return null
  const off = s.roomLampsOff.includes(`${v.id}/${t.id}`)
  return { kind: 'room-act', label: roomLabel(t, off), villager: v, target: t, off }
}

/** R 키로 넣을 수 있는 가장 가까운 방 가구. 방금 놓은 가구는 3초 동안 먼저 잡는다(homeStow). */
export function nearestHomePlaced(): Placed | null {
  const s = useGame.getState()
  const c = roomCenter(HOME_ROOM)
  return pickStowTarget(s.homeFurniture, runtime.player.x - c.x, runtime.player.z - c.z, s.homeFloor, runtime.justPlaced, performance.now())
}

const USE_LABEL = { sit: (n: string) => `${n}에 앉기`, light: (n: string, off?: boolean) => `${n} ${off ? '켜기' : '끄기'}`, stars: () => '망원경으로 별 보기' }

/** 앉기·불 켜고 끄기·별 보기가 되는 가구는 E 로 쓰고 R 로 넣는다. 나머지는 E 로 바로 넣는다. */
function furnitureAction(placed: Placed): Action {
  const name = ITEMS[placed.itemId].name
  const use = furnitureUse(placed.itemId, GLOWING)
  if (!use) return { kind: 'stow', label: `${name} 넣기`, placed }
  return { kind: 'use', label: `${USE_LABEL[use](name, placed.off)} · R 넣기`, placed, use }
}

/** R 키로 넣을 수 있는 가장 가까운 가구 */
export function nearestPlaced(): Placed | null {
  const s = useGame.getState()
  const p = runtime.player
  let best: Placed | null = null
  let bd = STOW_R * STOW_R
  for (const x of s.placed) {
    const d = dist2(p.x, p.z, x.x, x.z)
    if (d < bd) [best, bd] = [x, d]
  }
  return best
}

/** 앉은 자리에서 가구 앞쪽으로 한 걸음 내려선다. */
/** 지금 소원을 빌 수 있는지: 유성우 밤, 밤 시간, 바깥이고 오늘 아직 안 빌었을 때 */
export function wishOpen(): boolean {
  const s = useGame.getState()
  return !isIndoor(s) && isMeteorNight(s.day, weatherFor(s.day)) && meteorHours(currentHour()) && s.wishNight !== s.day
}

/** 하늘을 올려다보며 기다리기 시작한다. 별똥별이 지나가면 소원이 이루어진다(SkyEvents). 오늘 이미 빌었으면 알리기만 한다. */
export function startWish() {
  const s = useGame.getState()
  if (s.wishNight === s.day) return s.makeWish()
  runtime.wishing = true
  return s.notify('하늘을 올려다봐요. 별똥별이 떨어지면 소원을 빌어요')
}

export function standUp() {
  const seat = runtime.seat
  if (!seat) return
  const p = runtime.player
  runtime.seat = null
  // 방 안에서 앉은 자리는 방 걸을 칸으로, 섬에서는 섬 걸을 칸으로 본다.
  const walkable = inRoomArea(seat.x) ? (x: number, z: number) => roomWalkable(x, z, 0) : canWalk
  for (const step of [0.85, 1.2, -0.85, 1.6]) {
    const x = seat.x + Math.sin(seat.facing) * step
    const z = seat.z + Math.cos(seat.facing) * step
    if (walkable(x, z)) {
      p.x = x
      p.z = z
      return
    }
  }
}

export function onFishingEvent(ev: FishingEvent | null) {
  if (!ev) return
  const s = useGame.getState()
  if (ev.type === 'nothing') return s.notify('입질이 없네요. 물고기 그림자 가까이 던져 봐요')
  // 낚거나 놓친 그림자는 오늘 다시 나오지 않는다.
  const f = runtime.fishing
  const lureId = f.phase === 'idle' ? undefined : f.lure?.id
  if (ev.type === 'caught') {
    // 주머니가 꽉 차 못 받았으면 그림자를 남겨 다시 노릴 수 있게 하고, 낚은 듯한 물보라도 내지 않는다.
    if (!s.catchFish(ev.fishId)) return
    if (lureId) s.fishGone(lureId)
    if (f.phase !== 'idle') {
      burst({ kind: 'splash', x: f.x, y: (waterLevelAt(f.x, f.z) ?? 0) + 0.1, z: f.z })
      rippleAt(f.x, f.z, 1.8)
    }
    play('splash')
    return
  }
  if (lureId) s.fishGone(lureId)
  s.notify(ev.early ? '너무 빨랐어요. 물고기가 놀라 도망갔어요' : '놓쳤어요… 다른 그림자를 노려봐요')
}

export function runAction(a: Action) {
  const s = useGame.getState()
  switch (a.kind) {
    case 'pickup':
      return s.pickGround(a.item.id)
    case 'treasure':
      return s.digTreasure(a.mapId)
    case 'shell':
      return s.collectShell(a.shell)
    case 'shop':
      // 점원은 말풍선을 띄운 뒤 상점 패널을 연다
      if (a.clerk) return s.talkClerk(a.clerk)
      return s.openPanel('shop')
    case 'shop-guest':
      return s.talkShopGuest(a.id)
    case 'shop-display':
      if (a.sold) return s.notify('오늘 이 물건은 품절이에요. 내일 다시 와요')
      return s.buyDisplay(a.itemId, a.clerk, a.weekly)
    case 'shop-enter':
      return s.enterShop()
    case 'shop-leave':
      return s.leaveShop()
    case 'bug':
      startAct('swing')
      play('swish')
      return s.catchBug(a.bug, a.species)
    case 'firefly':
      startAct('swing')
      play('swish')
      return s.catchFirefly(a.index)
    case 'shake':
      // 손이 줄기를 잡는 순간 흔들림·잎이 떨어진다.
      startAct('shake')
      impactAt(IMPACT_AT.shake, () => {
        play('swish')
        runtime.shake = { id: a.tree.id, t: 0 }
        burst({ kind: 'leaves', x: a.tree.x, y: heightAt(a.tree.x, a.tree.z) + 2.2, z: a.tree.z })
      }, false)
      return s.shakeTree(a.tree)
    case 'rustle':
      startAct('shake')
      play('swish')
      runtime.shake = { id: a.bush.id, t: 0 }
      burst({ kind: 'leaves', x: a.bush.x, y: heightAt(a.bush.x, a.bush.z) + 0.7, z: a.bush.z })
      return s.shakeBush(a.bush)
    case 'chop':
      // 도끼날이 박히는 순간에 소리·칩·흔들림이 같이 터진다. 흔들림은 그때부터 0 에서 시작한다.
      // 다 벤 나무도 같은 동작을 한다. 넘어가는 한 번은 store 가 쓰러뜨린다.
      startAct('chop')
      impactAt(IMPACT_AT.chop, () => {
        play('chop')
        runtime.shake = { id: a.tree.id, t: 0 }
        burst({ kind: 'chips', x: a.tree.x, y: heightAt(a.tree.x, a.tree.z) + 0.6, z: a.tree.z })
      })
      return s.chopTree(a.tree)
    case 'hit':
      if (rockSpent(s.rockHits, a.rock.id)) return s.hitRock(a.rock)
      startAct('hit')
      impactAt(IMPACT_AT.hit, () => {
        play('thud')
        runtime.shake = { id: a.rock.id, t: 0 }
        burst({ kind: 'sparks', x: a.rock.x, y: heightAt(a.rock.x, a.rock.z) + 0.6, z: a.rock.z })
      })
      return s.hitRock(a.rock)
    case 'dig':
      startAct('dig')
      impactAt(IMPACT_AT.dig, () => {
        play('dig')
        burst({ kind: 'dirt', x: a.x, y: heightAt(a.x, a.z) + 0.1, z: a.z })
      })
      // 보물 자리면 보상과 함께 구멍이 남고, 아니면 아무 땅이나 구멍을 판다.
      if (a.spot) return s.dig(a.spot)
      return void s.digHole(a.x, a.z)
    case 'stump':
      startAct('dig')
      impactAt(IMPACT_AT.dig, () => {
        play('dig')
        burst({ kind: 'dirt', x: a.tree.x, y: heightAt(a.tree.x, a.tree.z) + 0.1, z: a.tree.z })
      })
      return s.digStump(a.tree)
    case 'fill':
      startAct('dig')
      impactAt(IMPACT_AT.dig, () => {
        burst({ kind: 'dirt', x: a.hole.x, y: heightAt(a.hole.x, a.hole.z) + 0.1, z: a.hole.z })
      })
      return s.fillHole(a.hole.id)
    case 'swing': {
      // 빈 그물은 휘두르기만 한다. 끝에 작은 먼지가 일어 헛손질이 아니라는 걸 보여 준다.
      startAct('swing')
      play('swish')
      const p = runtime.player
      const x = p.x + Math.sin(p.facing) * REACH
      const z = p.z + Math.cos(p.facing) * REACH
      impactAt(IMPACT_AT.swing, () => burst({ kind: 'puff', x, y: heightAt(x, z) + 0.5, z }), false)
      return
    }
    case 'water': {
      const p = runtime.player
      // 1 칸은 옆 화분을 골랐으면 그쪽으로 돌아서 뿌린다(물줄기가 엉뚱한 데로 가지 않게). 넓은 것은 바라보는 쪽으로 뿌린다.
      if (a.area === 1 && a.plants[0]) p.facing = Math.atan2(a.plants[0].x - p.x, a.plants[0].z - p.z)
      const cells = canCells(p.x, p.z, p.facing, a.area)
      // 넓은 통은 칸 범위가 정한 상하좌우 방향으로 뿌린다. 1 칸은 돌아선 쪽 그대로다.
      const d = canDir(p.facing)
      const dir = a.area === 1 ? p.facing : Math.atan2(d.x, d.z)
      runtime.waterFx = { level: a.area, cells, dir, t0: now() }
      startAct('water')
      play('water')
      // 물줄기가 바닥에 닿는 순간 칸마다 물방울이 튄다.
      impactAt(IMPACT_AT.water, () => cells.forEach((c) => burst({ kind: 'splash', x: c.x, y: heightAt(c.x, c.z) + 0.1, z: c.z })), false)
      s.waterPlants(a.plants.map((pl) => pl.id))
      return
    }
    case 'workbench':
      return s.openPanel('craft')
    case 'climb':
      // 사다리 오르내리기: 몸이 절벽 면을 따라 올라가는 동안 Player 가 자세와 위치를 맡는다.
      // 출발 높이는 지금 서 있는 자리의 지형 높이로 다시 잰다(순간이동 직후 p.y 가 아직 옛 값일 수 있다).
      runtime.climb = { t: 0, from: { x: runtime.player.x, y: heightAt(runtime.player.x, runtime.player.z), z: runtime.player.z }, to: a.spot.to, up: a.spot.up }
      return play('thud')
    case 'pelican':
      return s.talkPelican(a.dock)
    case 'stall':
      return s.openCloset(true)
    case 'market':
      play('pop')
      return s.openPanel('market')
    case 'songi':
      play('pop')
      return s.openPanel('songi')
    case 'wish':
      return startWish()
    case 'tourney-join':
      return s.startTourney()
    case 'tourney-exchange':
      play('talk')
      return s.openPanel('tourney')
    case 'watch': {
      // 벤치 자리: 천막 뒤에서 광장 쪽을 보고 앉는다. 걸으면 일어난다.
      const spot = festivalWatchSpot(s.day, s.night)
      if (!spot) return
      runtime.fishing = { phase: 'idle' }
      runtime.seat = { id: 'festival-bench', x: spot.x, z: spot.z, y: heightAt(spot.x, spot.z) + 0.74, facing: 0 }
      return s.watchFireworks()
    }
    case 'mail':
      play('pop')
      return s.openPanel('mail')
    case 'home-door':
      return s.enterHome()
    case 'home-sign':
      return s.openPanel('home')
    case 'locked':
      return s.notify(a.hint)
    case 'atm':
      play('pop')
      return s.openPanel('atm')
    case 'infra-board':
      play('pop')
      if (runtime.infraMode) {
        cancelInfra()
        return s.notify('정비 자리 고르기를 그만뒀어요')
      }
      return s.openPanel('infra')
    case 'stargaze': {
      runtime.telescope = a.on
      if (!a.on) return
      const c = constellationOf(s.day, seasonFor(s.day))
      // 처음 본 별자리는 기록 토스트만 띄우고, 다시 본 날은 보여요 토스트를 띄운다
      if (s.seeConstellation(c.id)) return
      return s.notify(`오늘 밤 하늘에 ${c.name} 자리가 보여요`)
    }
    case 'kick': {
      runtime.kickedAt[a.pile.id] = now()
      runtime.kickedDay[a.pile.id] = s.day
      burst({ kind: 'foliage', x: a.pile.x, y: heightAt(a.pile.x, a.pile.z) + 0.3, z: a.pile.z })
      if (kickAcorn(a.pile.id, s.day)) {
        useGame.setState({ money: useGame.getState().money + 1 })
        return s.notify('낙엽 속에서 도토리를 찾았어요 🌰 1')
      }
      return s.notify('바스락, 낙엽이 흩어졌어요')
    }
    case 'discover': {
      const o = outcomeOf(a.spot.id, Math.random())
      if (o.cost && useGame.getState().money < o.cost) return s.notify('소원을 빌려면 도토리가 있어야 해요')
      runtime.discovered[a.spot.id] = s.day
      useGame.setState({ money: useGame.getState().money - (o.cost ?? 0) + (o.acorns ?? 0) })
      play(o.sound)
      // 물수제비: 튈 때마다 물결이 한 칸씩 바다 쪽으로 퍼진다
      const n = Math.hypot(a.spot.x, a.spot.z) || 1
      for (let i = 0; i < (o.bounces ?? 0); i++) {
        const d = 1 + i * 1.3
        setTimeout(() => rippleAt(a.spot.x + (a.spot.x / n) * d, a.spot.z + (a.spot.z / n) * d, 0.8), 250 * i)
      }
      // 메아리: 외친 뒤 조금씩 줄어들며 돌아온다
      for (let i = 0; i < (o.echoes ?? 0); i++) setTimeout(() => play('pop'), 450 * (i + 1))
      return s.notify(o.text)
    }
    case 'paint':
      if (!a.ok) return s.notify('여기엔 길을 놓을 수 없어요')
      return s.paintPath(a.x, a.z, a.paint)
    case 'infra-commit': {
      const t = a.spot
      const ok = t.kind === 'bridge' ? s.commissionBridge(t.x, t.z, t.rot) : s.commissionStair(t.plateau, t.ang)
      if (ok) cancelInfra()
      return
    }
    case 'viewpoint':
      // 벤치 자리: 몸을 좌판 위에 앉히고 바다 쪽을 본다. 걸으면 일어난다.
      runtime.fishing = { phase: 'idle' }
      runtime.seat = { id: 'viewpoint', x: VIEWPOINT.x, z: VIEWPOINT.z, y: heightAt(VIEWPOINT.x, VIEWPOINT.z) + 0.74, facing: VIEWPOINT.rot }
      play('pop')
      return s.notify('섬이 한눈에 보여요')
    case 'spout':
      // 폭포 앞에서 잠깐 물소리를 듣는다. 카메라는 그대로 둔다.
      return s.notify(SPOUT_LINES[Math.floor(Math.random() * SPOUT_LINES.length)])
    case 'home-leave':
      return s.leaveHome()
    case 'home-climb':
      return s.climbHome()
    case 'home-move':
      return s.moveHomeArea(a.to)
    case 'storage':
      play('pop')
      return s.openPanel('storage')
    case 'closet':
      return s.openCloset(false)
    case 'home-place':
      return a.ok ? s.placeInHome(a.x, a.z, a.wall) : s.notify('여기엔 놓을 수 없어요')
    case 'home-stow':
      return s.pickUpHome(a.placed.id)
    case 'swim-in':
      return s.startSwim()
    case 'dive':
      return s.diveAt(a.key)
    case 'visit-talk':
      return s.talkVisitor()
    case 'home-use': {
      const pl = a.placed
      if (a.use === 'light') return s.toggleHomeLight(pl.id)
      // 방 가구의 좌표는 방 가운데 기준이라 월드 좌표로 바꿔 앉는다.
      const c = roomCenter(HOME_ROOM)
      const x = c.x + pl.x
      const z = c.z + pl.z
      runtime.seat = { id: pl.id, x, z, y: heightAt(x, z) + seatHeightOf(pl.itemId), facing: (pl.rot * Math.PI) / 2 }
      runtime.fishing = { phase: 'idle' }
      return s.sat(pl.itemId)
    }
    case 'home-act':
      return playHomeUse(a.use, a.placed)
    case 'home-bed':
      return lieDown()
    case 'home-window':
      return lookOut()
    case 'room-act':
      return roomUse(a.villager, a.target, a.off)
    case 'curator':
      play('talk')
      return s.openPanel('museum')
    case 'museum-enter':
      return s.enterMuseum()
    case 'museum-leave':
      return s.leaveMuseum()
    case 'hall-enter':
      return s.enterHall()
    case 'hall-leave':
      return s.leaveHall()
    case 'hall-board':
      play('talk')
      return s.openPanel('quest')
    case 'hall-mic':
      play('chime')
      return s.replayNews()
    case 'hall-reception':
      play('talk')
      // 접수대에서는 섬 가꾸기 기부를 받는다(게시판은 할 일을 보여 준다)
      return s.openPanel('gift')
    case 'cave-enter':
      return s.enterCave()
    case 'cave-leave':
      return s.leaveCave()
    case 'cave-mine':
      return s.mineCave(a.node)
    case 'balloon-catch':
      return s.catchBalloon()
    case 'cave-chest':
      return s.openCaveChest()
    case 'hint':
      return s.notify(a.label)
    case 'build': {
      const ok = s.build(a.villager)
      if (ok) {
        pushOutOfHouse(a.villager)
        startAct('build')
        runtime.builtAt[a.villager.id] = now()
        const h = a.villager.house
        burst({ kind: 'dust', x: h.x, y: heightAt(h.x, h.z) + 0.2, z: h.z })
        burst({ kind: 'confetti', x: h.x, y: heightAt(h.x, h.z) + 3, z: h.z })
      }
      return
    }
    case 'cast':
    {
      const near = nearestFish(getLayout(s.day).fish, s.caught, a.x, a.z, now())
      runtime.fishing = near
        ? castAtShadow(a.x, a.z, Math.random, { id: near.f.id, fishId: s.night ? near.f.night : near.f.day, x: near.x, z: near.z })
        : castEmpty(a.x, a.z)
    }
      play('swish')
      return
    case 'talk':
      return s.talkTo(a.villager)
    case 'enter':
      return s.enterHouse(a.villager.id)
    case 'leave':
      return s.leaveHouse()
    case 'stow':
      return s.pickUpPlaced(a.placed.id)
    case 'stand':
      return standUp()
    case 'use': {
      const pl = a.placed
      if (a.use === 'light') return s.toggleLight(pl.id)
      if (a.use === 'stars') {
        runtime.player.facing = Math.atan2(pl.x - runtime.player.x, pl.z - runtime.player.z)
        return s.stargaze()
      }
      // 의자는 등받이 반대쪽(가구의 +z)을 보고 앉는다.
      runtime.seat = { id: pl.id, x: pl.x, z: pl.z, y: heightAt(pl.x, pl.z) + seatHeightOf(pl.itemId), facing: (pl.rot * Math.PI) / 2 }
      runtime.fishing = { phase: 'idle' }
      return s.sat(pl.itemId)
    }
    case 'place':
      return a.ok ? s.placeAt(a.x, a.z) : s.notify('여기엔 놓을 수 없어요')
    case 'reel': {
      const [next, ev] = pressFishing(runtime.fishing)
      runtime.fishing = next
      return onFishingEvent(ev)
    }
  }
}

/** 막 지은 집 안에 서 있으면 갇히므로 현관 앞(집이 바라보는 쪽)으로 옮긴다. */
function pushOutOfHouse(v: Villager) {
  const p = runtime.player
  const h = v.house
  if (Math.hypot(p.x - h.x, p.z - h.z) > HOUSE_R + 0.5) return
  for (const extra of [1, 1.5, 2.2, 3]) {
    const x = h.x + Math.sin(h.rot) * (HOUSE_R + extra)
    const z = h.z + Math.cos(h.rot) * (HOUSE_R + extra)
    if (canWalk(x, z)) {
      p.x = x
      p.z = z
      p.facing = h.rot + Math.PI
      return
    }
  }
}

/** 방 안 날씨·계절·밤낮. 창밖 보기와 망원경이 같이 쓴다. */
function homeContext() {
  const s = useGame.getState()
  return { weather: weatherFor(s.day), season: seasonFor(s.day), night: s.night }
}

/** 방 가구 쓰임 연출. 몸동작은 여기서 고르고, 흔들림은 reactFx 를 읽는 가구가 맡는다. */
function playHomeUse(use: HomeUse, pl: Placed) {
  const s = useGame.getState()
  const c = roomCenter(HOME_ROOM)
  const x = c.x + pl.x
  const z = c.z + pl.z
  const y = heightAt(x, z)
  const react = () => {
    runtime.reactFx = { id: pl.id, use, t0: now() }
  }
  switch (use) {
    case 'tea':
      // 찻잔 위로 김이 세 번 오른다
      startAct('sip')
      impactAt(0.4, () => [0, 0.12, 0.24].forEach((dy, i) => burst({ kind: 'puff', x: x + (i - 1) * 0.05, y: y + 0.85 + dy, z })), false)
      break
    case 'pet':
      startAct('pat')
      impactAt(0.25, () => {
        react()
        burst({ kind: 'leaves', x, y: y + 1, z })
      }, false)
      break
    case 'poke':
      startAct('pat')
      impactAt(0.25, () => {
        react()
        play('pop')
      }, false)
      break
    case 'open':
      startAct('pick')
      impactAt(0.2, () => {
        react()
        play('open')
      }, false)
      break
    case 'polish':
      startAct('wipe')
      impactAt(0.5, () => {
        play('success')
        burst({ kind: 'sparks', x, y: y + 1, z })
      }, false)
      break
    case 'scope':
      startAct('peek')
      play('pop')
      break
    case 'mail':
      play('pop')
      return s.openPanel('mail')
    case 'cook':
      // 화덕 앞에서 E 를 누르면 요리 창이 열린다
      return s.openPanel('cook')
    case 'read':
      // 책장 앞에 서서 한 권을 꺼내 본다
      startAct('peek')
      impactAt(0.3, () => play('pop'), false)
      break
    case 'spin':
      // 지구본을 손으로 밀면 반응 연출이 돌림판을 돌린다
      startAct('pat')
      impactAt(0.25, () => {
        react()
        play('pop')
      }, false)
      break
    case 'work':
      // 작업대를 망치로 두드리고 불꽃이 튄다
      startAct('build')
      impactAt(0.4, () => {
        play('success')
        burst({ kind: 'sparks', x, y: y + 1, z })
      }, false)
      break
    case 'stock':
      // 선반의 바구니를 집어 제자리에 놓는다
      startAct('pick')
      impactAt(0.3, () => play('open'), false)
      break
    case 'warm':
      // 보일러 옆에서 손을 쬐면 온기가 김처럼 오른다
      startAct('sip')
      impactAt(0.4, () => [0, 0.12, 0.24].forEach((dy, i) => burst({ kind: 'puff', x: x + (i - 1) * 0.05, y: y + 1.2 + dy, z })), false)
      break
    case 'sit':
    case 'light':
      return
  }
  const line = homeUseLine(use, ITEMS[pl.itemId].name, homeContext(), pl.itemId)
  if (line) s.notify(line)
}

/** 창가에 서서 바깥을 본다. 날씨와 계절에 따라 한 줄이 바뀐다. */
function lookOut() {
  startAct('peek')
  play('pop')
  useGame.getState().notify(windowLine(homeContext()))
}

/**
 * 침대에 눕는다. 머리는 뒷벽 쪽(facing 0 의 반대), 발은 문 쪽이다. 누운 몸은 자리에서 머리 쪽으로 1.1 길어서
 * 발 쪽으로 0.55 밀어 두면 몸통 가운데가 침대 가운데에 놓인다. 잠 보너스는 nap 이 정한다.
 */
function lieDown() {
  const c = roomCenter(HOME_ROOM)
  runtime.fishing = { phase: 'idle' }
  const bed = homeBed(useGame.getState().home.stage)
  runtime.seat = { id: 'bed', x: c.x + bed.x, z: c.z + bed.z + LIE_FOOT, y: BED_TOP, facing: 0, lie: true }
  return useGame.getState().nap()
}

/** 주민 방 물건 쓰기. 앉으면 자리를 잡고, 불빛은 켜고 끄며, 살펴보면 주민이 아끼는 물건이라고 한다. */
function roomUse(v: Villager, t: RoomTarget, off: boolean) {
  const s = useGame.getState()
  const c = roomCenter(VILLAGERS.indexOf(v))
  const react = (mood: Mood) => {
    runtime.react = { id: v.id, mood, t0: now() }
  }
  if (t.use === 'sit') {
    runtime.seat = { id: `${v.id}/${t.id}`, x: c.x + t.x, z: c.z + t.z, y: t.seatY ?? ROOM_FLOOR, facing: t.facing ?? 0 }
    runtime.fishing = { phase: 'idle' }
    if (t.item) s.sat(t.item)
    react('surprised')
    return s.notify(roomLine(v, t))
  }
  if (t.use === 'light') {
    s.toggleRoomLamp(`${v.id}/${t.id}`)
    play('pop')
    react('happy')
    // 방금 꺼져 있던 불을 켰으면 off 가 참이다.
    return s.notify(roomLine(v, t, off))
  }
  startAct('look')
  react('happy')
  s.notify(roomLine(v, t))
}

/** 자리 고르기를 시작한다: 패널을 닫고 맡길 수 있는 자리 목록을 만든다. */
export function startInfra(kind: 'bridge' | 'stair') {
  const s = useGame.getState()
  runtime.infraSpots = kind === 'bridge' ? bridgeSpots(s.infra).map((b) => ({ kind: 'bridge' as const, ...b })) : stairSpots(s.infra).map((t) => ({ kind: 'stair' as const, plateau: t.plateau, ang: t.ang, ...stairXZ(t.plateau, t.ang) }))
  runtime.infraMode = kind
  runtime.infraTarget = null
  s.openPanel(null)
  if (!runtime.infraSpots.length) {
    cancelInfra()
    s.notify('지금은 놓을 수 있는 자리가 없어요')
    return
  }
  s.notify('맡길 자리 가까이 가면 빨간 표시가 나타나요')
}

/** 길 깔기를 시작한다: 패널을 닫고 바라보는 칸을 E 로 깐다. 허가가 있어야 한다. */
export function startPaint(kind: PathKind) {
  const s = useGame.getState()
  if (!s.infra.permit) return s.notify('먼저 길 공사 허가를 받아야 해요')
  runtime.paintMode = kind
  runtime.paintTarget = null
  s.openPanel(null)
  s.notify(`${PATH_NAME[kind]} 깔기 · E 로 놓고 같은 칸에서 E 로 걷어요 · Esc 로 그만둬요`)
}

/** 길 깔기를 그만둔다 */
export function cancelPaint() {
  runtime.paintMode = null
  runtime.paintTarget = null
}

/** 자리 고르기를 그만둔다 */
export function cancelInfra() {
  runtime.infraMode = null
  runtime.infraTarget = null
  runtime.infraSpots = []
}

/** 계단 자리의 월드 좌표(절벽 가장자리) */
function stairXZ(plateau: number, ang: number) {
  const p = PLATEAUS[plateau]
  const r = plateauRimAt(p, ang)
  return { x: p.x + Math.cos(ang) * r, z: p.z + Math.sin(ang) * r }
}

/** 고른 자리 목록에서 가장 가까운 것(8 안) */
function nearestInfraSpot(x: number, z: number): InfraSpot | null {
  let best: InfraSpot | null = null
  let bd = 8 * 8
  for (const sp of runtime.infraSpots) {
    const d = dist2(x, z, sp.x, sp.z)
    if (d < bd) {
      bd = d
      best = sp
    }
  }
  return best
}
