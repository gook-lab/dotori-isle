/**
 * 가구와 방 물건이 E 로 하는 일: 쓰임 고르기, 안내 글, 반응 대사, 잠 보너스 규칙.
 * 순수 로직이라 React·Three 에 의존하지 않는다. 씬은 여기서 고른 쓰임에 맞춰 자세와 흔들림을 고른다.
 *
 * 내 방 가구는 모두 E 로 쓰고 R 로 넣는다. 주민 방 물건은 넣을 수 없어 E 로만 쓴다.
 */

import { withTic } from './chat'
import { SEAT_HEIGHT } from './placement'
import { GLOWING, ITEMS, josa } from './items'
import { HOME_SETS } from './homeScore'
import { ROOM_FLOOR, ROOM_FURNITURE } from './interior'
import type { Season } from './season'
import type { Weather } from './weather'
import type { VillagerDef } from './villagers'

/** 내 방 가구 하나가 E 로 하는 일. */
export type HomeUse = 'sit' | 'light' | 'tea' | 'pet' | 'open' | 'poke' | 'polish' | 'scope' | 'mail' | 'wave' | 'chill' | 'cook' | 'read' | 'spin' | 'work' | 'stock' | 'warm'

export const HOME_USE: Record<string, HomeUse> = {
  chair: 'sit',
  // 서랍장은 E 가 보관함을 여는 일이라 'open' 쓰임으로 둔다(실제 열기는 actions.ts 가 보관함 패널로 보낸다)
  drawer: 'open',
  // 옷장도 E 가 옷장 패널을 여는 일이라 'open' 쓰임이다(actions.ts 가 옷장 패널로 보낸다)
  wardrobe: 'open',
  'log-stool': 'sit',
  'log-bench': 'sit',
  table: 'tea',
  flowerpot: 'pet',
  'wooden-box': 'open',
  snowman: 'poke',
  'gold-acorn': 'polish',
  telescope: 'scope',
  mailbox: 'mail',
  // 축제 전용 가구
  'blossom-arch': 'pet',
  'harvest-scarecrow': 'wave',
  'ice-sculpture': 'chill',
  // 낚시 대회 상품
  'tourney-trophy': 'polish',
  'tourney-fish': 'poke',
  // 서재 세트
  bookshelf: 'read',
  'reading-chair': 'sit',
  'floor-lamp': 'light',
  globe: 'spin',
  // 지하 작업실 세트
  workbench: 'work',
  'tool-rack': 'work',
  'storage-shelf': 'stock',
  boiler: 'warm',
  'tourney-flag': 'wave',
  'house-plaque': 'polish',
  // 별 등급 기념품
  'star-sprout': 'pet',
  'star-cushion': 'sit',
  'star-bell': 'wave',
  'star-stand': 'light',
  'star-trophy': 'polish',
  // 마일 교환소(ATM) 섬 고유 가구
  'acorn-cushion': 'sit',
  'acorn-vase': 'poke',
  'acorn-lantern': 'light',
  'photo-frame': 'polish',
  'wall-clock': 'poke',
  'wall-shelf': 'stock',
  stove: 'cook',
  // 백화점 가구
  basket: 'open',
  'wind-chime': 'poke',
  bonsai: 'pet',
  // 섬 이야기 장 기념품(story-*)
  'story-photo-frame': 'polish',
  'story-wreath': 'wave',
  'story-cake': 'tea',
  'pumpkin-lantern': 'polish',
  'candy-basket': 'wave',
  'harvest-basket': 'wave',
  'acorn-garland': 'polish',
  'first-snow-crystal': 'wave',
  'story-garden': 'pet',
  'story-trophy': 'polish',
}

/** 불빛 가구는 켜고 끈다. 나머지는 위 표에서 찾고, 없으면 null(R 로만 넣는다). */
export function homeUse(itemId: string): HomeUse | null {
  if (GLOWING.has(itemId)) return 'light'
  return HOME_USE[itemId] ?? null
}

/** 미리보기 밑에 붙이는 짧은 쓰임 한 줄. 쓰임 표(HOME_USE)와 세트 표(HOME_SETS)에서 가져온다. */
const USE_NOTE: Record<HomeUse, string> = {
  sit: '앉을 수 있어요',
  light: '불을 켜고 끌 수 있어요',
  tea: '차 한 잔을 놓을 수 있어요',
  pet: '물을 주고 쓰다듬을 수 있어요',
  open: '열어서 물건을 넣을 수 있어요',
  poke: '살짝 건드려 볼 수 있어요',
  polish: '닦아 줄 수 있어요',
  scope: '창밖을 볼 수 있어요',
  mail: '편지를 받을 수 있어요',
  wave: '손을 흔들 수 있어요',
  chill: '쉬어 갈 수 있어요',
  cook: '요리할 수 있어요',
  read: '책을 읽을 수 있어요',
  spin: '돌려 볼 수 있어요',
  work: '일할 수 있어요',
  stock: '물건을 채울 수 있어요',
  warm: '몸을 녹일 수 있어요',
}

/** 가구 미리보기 아래 한 줄: 쓰임 + 세트. 쓰임도 세트도 없으면 null이다. 밤에 켜지는 가구는 그 말을 쓴다. */
export function furnitureNote(itemId: string): string | null {
  const use = homeUse(itemId)
  const useText = use ? (GLOWING.has(itemId) ? '밤에 불이 켜져요' : USE_NOTE[use]) : null
  const set = HOME_SETS.find((x) => x.items.includes(itemId))
  const parts = [useText, set ? `세트: ${set.name}` : null].filter((x): x is string => !!x)
  return parts.length ? parts.join(' · ') : null
}

/** 가구 쓰임의 E 안내 글. 불빛 가구는 지금 상태에 따라 켜기·끄기로 바뀐다. */
export function homeUseLabel(use: HomeUse, name: string, off = false): string {
  switch (use) {
    case 'sit':
      return `${name}에 앉기`
    case 'light':
      return `${name} ${off ? '켜기' : '끄기'}`
    case 'tea':
      return `${name}에서 차 한 잔`
    case 'pet':
      return `${name} 잎 쓰다듬기`
    case 'open':
      return `${name} 열어 보기`
    case 'poke':
      return `${name} 톡 건드리기`
    case 'polish':
      return `${name} 반짝 닦기`
    case 'scope':
      return `${josa(name, '으로', '로')} 창밖 보기`
    case 'mail':
      return `${name}에서 편지 확인`
    case 'wave':
      return `${name} 팔 흔들기`
    case 'chill':
      return `${name} 손으로 쓸기`
    case 'cook':
      return `${name}에서 요리하기`
    case 'read':
      return `${name}에서 책 고르기`
    case 'spin':
      return `${name} 빙글 돌려 보기`
    case 'work':
      return `${name}에서 손보기`
    case 'stock':
      return `${name} 정리하기`
    case 'warm':
      return `${name} 앞에서 몸 녹이기`
  }
}

/** 창가에서 보는 날씨·계절 한 줄. 비·눈이 먼저고, 밤이면 달빛, 맑은 낮은 계절 풍경이다. */
export function windowLine(ctx: { weather: Weather; season: Season; night: boolean }): string {
  if (ctx.weather === 'rain') return '빗방울이 창을 톡톡 두드려요'
  if (ctx.weather === 'snow') return '눈이 소복소복 내려요'
  if (ctx.night) return '달빛이 바다에 길게 드리워요'
  if (ctx.weather === 'cloudy') return '구름이 천천히 흘러가요'
  return SUNNY_VIEW[ctx.season]
}

const SUNNY_VIEW: Record<Season, string> = {
  spring: '벚꽃잎이 바람에 날려요',
  summer: '바다가 반짝반짝 빛나요',
  autumn: '단풍잎이 창가를 스쳐요',
  winter: '눈밭이 햇살에 반짝여요',
}

/**
 * 가구 하나를 E 로 쓸 때 나오는 한 줄. 씬 쪽 연출은 종류에 따라 따로 고른다.
 * 우체통은 편지함 패널이 열리니 한 줄을 띄우지 않는다(null).
 */
/**
 * 같은 쓰임이라도 가구마다 따로 줄이 필요한 것. 쓰임별 공통 줄을 쓰면 다른 가구 얘기가 나오므로 여기서 먼저 고른다.
 * 공통 줄을 쓰는 가구는 homeUseLine 안의 쓰임별 줄로 충분한 것뿐이다(furnitureActions.test.ts 가 막는다).
 */
export const ITEM_USE_LINE: Record<string, string> = {
  workbench: '나무 조각을 사포로 매끈하게 다듬었어요. 손끝에 나무 향이 남아요',
  'tool-rack': '망치와 톱을 제자리에 가지런히 걸었어요. 공구가 한결 정리됐어요',
  'tourney-fish': '물고기 모형을 톡 건드렸더니 꼬리가 살랑 흔들려요',
  'wind-chime': '풍경을 톡 건드렸더니 맑은 소리가 울려요',
  'tourney-trophy': '트로피를 반짝 닦았어요. 금빛 손잡이가 환하게 빛나요',
  'house-plaque': '현판의 먼지를 털었어요. 글씨가 또렷해졌어요',
  'star-sprout': '별싹 화분에 물을 주었더니 줄기 끝의 별이 반짝 빛나요',
  'star-cushion': '별 방석에 앉았어요. 푹신한 별이 등을 받쳐 줘요',
  'star-bell': '별 종을 울렸어요. 딸랑 맑은 소리가 별 모양 추를 따라 퍼져요',
  'star-stand': '별빛 스탠드를 켰다 껐다 해요. 갓의 별이 노랗게 빛나요',
  'star-trophy': '별 트로피를 닦았어요. 꼭대기 별이 더 반짝거려요',
  'acorn-cushion': '도토리 방석에 앉았어요. 통통한 방석이 등을 받쳐 줘요',
  'acorn-vase': '도토리 꽃병을 톡 건드렸어요. 안에서 마른 나뭇잎이 사각사각 움직여요',
  'acorn-lantern': '도토리 등불을 켰다 껐다 해요. 갓 아래 따뜻한 빛이 번져요',
  'photo-frame': '액자 유리를 닦았어요. 사진이 더 선명해 보여요',
  'wall-clock': '벽시계의 도토리 추를 살짝 밀었어요. 시계가 제 시간을 똑딱 가리켜요',
  'wall-shelf': '선반 위 병들을 가지런히 옮겼어요. 빈 자리가 금세 채워져요',
  'story-photo-frame': '첫날 사진을 살살 닦았어요. 그날의 웃음이 떠올라요',
  'story-trophy': '별점 트로피를 닦았어요. 별들이 반짝 빛나요',
  'tourney-flag': '깃발을 흔들었더니 바람에 펄럭여요',
  'story-wreath': '화환을 흔들었더니 꽃잎이 살랑 떨어져요',
  'story-cake': '케이크 모형 옆에서 따끈한 차를 한 모금 마셨어요. 크림 향이 나요',
  'pumpkin-lantern': '호박 등불의 그을음을 살살 닦았어요. 촛불이 한결 따뜻해 보여요',
  'candy-basket': '사탕 바구니를 살랑 흔들었더니 달콤한 냄새가 퍼져요',
  'harvest-basket': '수확 바구니를 살랑 흔들었더니 곡식 냄새가 퍼져요',
  'acorn-garland': '도토리 화환의 먼지를 살살 털어 냈어요. 가을빛이 한결 살아나요',
  'first-snow-crystal': '설화 장식을 살랑 흔들었더니 차가운 빛이 반짝여요',
  basket: '바구니를 살짝 들여다봤어요. 안이 아늑하게 비어 있어요',
  'blossom-arch': '꽃 아치를 쓰다듬었더니 꽃잎이 살랑살랑 흩날려요',
  bonsai: '분재 가지를 살살 쓰다듬었더니 잎이 한들한들해요',
  'story-garden': '미니어처 꽃밭을 쓰다듬었더니 꽃잎이 살랑 흔들려요',
}

export function homeUseLine(use: HomeUse, name: string, ctx: { weather: Weather; season: Season; night: boolean }, itemId?: string): string | null {
  if (itemId && ITEM_USE_LINE[itemId]) return ITEM_USE_LINE[itemId]
  switch (use) {
    case 'tea':
      return `${name}에서 따끈한 차를 한 모금 마셨어요. 김이 모락모락 올라와요`
    case 'pet':
      return '잎을 살살 쓰다듬었더니 꽃이 살랑살랑 흔들려요'
    case 'open':
      return '뚜껑을 열어 봤어요. 안이 아늑하게 비어 있어요'
    case 'poke':
      return '톡 건드렸더니 눈사람이 뒤뚱뒤뚱해요'
    case 'wave':
      return '팔을 흔들었더니 참새들이 후다닥 날아가요'
    case 'chill':
      return '차가운 얼음을 쓸었더니 빛이 반짝 튀어요'
    case 'polish':
      return '반짝반짝 닦았더니 황금 도토리가 더 빛나요'
    case 'scope':
      return windowLine(ctx)
    case 'mail':
    case 'cook':
      return null
    case 'read':
      return '책 한 권을 꺼내 읽었어요. 페이지가 바스락 넘어가요'
    case 'spin':
      return '지구본을 빙글 돌렸더니 바다와 산이 차례로 지나가요'
    case 'work':
      return '공구를 하나씩 집어 들고 손질했어요. 나무 냄새가 나요'
    case 'stock':
      return '물건을 가지런히 정리했어요. 자리가 한결 넉넉해졌어요'
    case 'warm':
      return '따끈한 온기가 올라와 손이 금세 녹았어요'
    case 'sit':
    case 'light':
      return null
  }
}

/** 잠을 자는 시간: 밤 10시부터 아침 5시 전까지 */
export const isSleepHour = (hour: number) => hour >= 22 || hour < 5
/** 하루 처음 밤에 누우면 주는 마일리지 */
export const NAP_MILES = 10

/** 밤에 누웠고, 오늘 아직 잠 보너스를 받지 않았는지 */
export function napBonus(napDay: string | null, day: string, hour: number): boolean {
  return isSleepHour(hour) && napDay !== day
}

/** 침대에 누웠을 때 한 줄. 밤이면 푹 잔 것이고, 보너스가 있으면 마일리지를 알린다. */
export function napLine(sleep: boolean, bonus: boolean): string {
  if (!sleep) return '잠깐 누워서 쉬었어요. 밤에 누우면 푹 잘 수 있어요'
  if (!bonus) return '푹 잤어요'
  return '푹 잤어요. 기분 좋게 일어났어요!'
}

/** 내 방 침대와 창, 보관함의 자리(방 가운데 기준). 가구 칸과 같은 좌표다. */
export const HOME_WINDOWS = [
  { x: -2.6, z: -3.2 },
  { x: 2.2, z: -3.2 },
] as const
export const HOME_WINDOW_R = 1.4
export const HOME_BED_R = 1.5
/** 침대 누운 면의 높이(방 바닥이 아니라 월드 높이). 주민 방 침대도 같다. */
export const BED_TOP = 0.6

/** 주민 방 물건 하나가 E 로 하는 일. */
export type RoomUse = 'sit' | 'light' | 'look'

export interface RoomTarget {
  id: string
  use: RoomUse
  /** 안내 글과 대사에 쓰는 이름 */
  name: string
  /** 방 가운데 기준 자리 */
  x: number
  z: number
  /** 닿는 거리 */
  r: number
  /** sit: 앉을 때 바라보는 방향(라디안)과 앉는 면 높이(월드) */
  facing?: number
  seatY?: number
  /** sit: 앉았을 때 세는 가구 id. 침대 가장자리처럼 가구 이름이 없으면 생략한다. */
  item?: string
}

const DECOR_NAME: Record<string, string> = { dresser: '서랍장', shelf: '책장', plant: '화분', table: '탁자' }

/** 주민 방에서 E 로 쓸 수 있는 물건들. 의자·침대 가장자리는 앉고, 불빛 선물은 켜고 끄고, 나머지는 살펴본다. */
export function villagerRoomTargets(gifts: readonly string[]): RoomTarget[] {
  const at = (id: string) => ROOM_FURNITURE.find((f) => f.id === id)!
  const table = at('table')
  const bed = at('bed')
  const out: RoomTarget[] = []
  // 탁자 양옆 통나무 의자. 앉으면 탁자 쪽을 본다.
  for (const sd of [-1, 1]) {
    const x = table.x + sd * 1.05
    const z = table.z
    out.push({
      id: `stool${sd < 0 ? 0 : 1}`,
      use: 'sit',
      name: ITEMS['log-stool'].name,
      x,
      z,
      r: 1,
      facing: Math.atan2(table.x - x, table.z - z),
      seatY: ROOM_FLOOR + SEAT_HEIGHT['log-stool'],
      item: 'log-stool',
    })
  }
  // 침대 긴 쪽 가장자리. 방 안쪽을 보고 걸터앉는다.
  out.push({ id: 'bed-edge', use: 'sit', name: '침대 가장자리', x: bed.x, z: bed.z + 0.7, r: 1.1, facing: Math.PI, seatY: BED_TOP })
  // 선물로 받은 물건. 불빛이면 켜고 끈다.
  gifts.forEach((item, k) => {
    const def = ITEMS[item]
    const g = at(`gift${k}`)
    if (!def || !g) return
    out.push({ id: `gift${k}`, use: GLOWING.has(item) ? 'light' : 'look', name: def.name, x: g.x, z: g.z, r: 1 })
  })
  // 방 장식은 살펴보기만 한다.
  for (const id of ['dresser', 'shelf', 'plant', 'table']) {
    const f = at(id)
    out.push({ id, use: 'look', name: DECOR_NAME[id], x: f.x, z: f.z, r: 1.3 })
  }
  return out
}

/** 주민 방 물건의 E 안내 글. 불빛은 지금 꺼져 있으면 켜기, 켜져 있으면 끄기다. */
export function roomLabel(t: RoomTarget, lampOff = false): string {
  if (t.use === 'sit') return `${t.name}에 앉기`
  if (t.use === 'light') return `${t.name} ${lampOff ? '켜기' : '끄기'}`
  return `${t.name} 살펴보기`
}

/**
 * 주민 방에서 물건을 쓸 때 나오는 한 줄. 살펴보기는 "구리구리가 아끼는 …예요" 꼴이고,
 * 앉기와 불빛은 주민이 말투 버릇으로 한마디 한다. lampOn 은 방금 켠 뒤의 상태다.
 */
export function roomLine(v: Pick<VillagerDef, 'name' | 'tic'>, t: RoomTarget, lampOn = false): string {
  if (t.use === 'look') return `${josa(v.name, '이', '가')} 아끼는 ${josa(t.name, '이에요', '예요')}`
  if (t.use === 'sit') return `${v.name}: ${withTic('거기 앉으면 편하죠', v.tic)}`
  return `${v.name}: ${withTic(lampOn ? '불을 켜니 방이 따뜻해졌어요' : '불을 끄니 방이 조용해졌어요', v.tic)}`
}

/** 가장 가까운 대상 하나. 각 대상이 가진 닿는 거리 안에 있는 것만 본다. */
export function nearestWithin<T extends { x: number; z: number; r: number }>(list: readonly T[], x: number, z: number): T | null {
  let best: T | null = null
  let bd = Infinity
  for (const t of list) {
    const d = Math.hypot(t.x - x, t.z - z)
    if (d < t.r && d < bd) [best, bd] = [t, d]
  }
  return best
}
