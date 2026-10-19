import { withTic } from './chat'
import type { DayPart } from './clock'
import { FISH_TABLE, ITEMS, josa } from './items'
import { byWater, isWalkable, ISLAND_R, normDist } from './island'
import { doorOrder, pickDoorRot } from './doorFacing'
import { flatWithin } from './tiers'
import type { WearTaste } from './villagerWear'
import { hashString, mulberry32 } from './rng'
import { seasonFor } from './season'
import { weatherFor } from './weather'
import { blockedByFixedProps, blockedByProps, SHOP, SPAWN, TREES } from './world'
import { villagerRoomSpot, type RoomSpot } from './villagerRoom'

/** 섬 주민. 집 근처를 어슬렁거리고, 하루에 한 번 부탁을 한다. */

export type Species = 'cat' | 'rabbit' | 'penguin' | 'mole' | 'hedgehog' | 'bear' | 'squirrel' | 'chestnut' | 'otter'

export interface VillagerDef {
  id: string
  name: string
  species: Species
  body: string
  accent: string
  /** 말끝에 붙는 버릇 */
  tic: string
  /** 호감도 단계마다 주는 선물(가구) */
  gifts: string[]
  /** 집을 지어줘야 이사 오는 새 이웃 */
  newcomer?: boolean
  /** 집 짓는 데 드는 재료 */
  cost: Record<string, number>
  /** 옷 입맛: 좋아하는 색 계열과 옷 종류(core/villagerWear.ts). 없으면 옷 취향을 따지지 않는다. */
  wearTaste?: WearTaste
  /** 말 대신 외침과 몸짓으로 이야기한다 */
  voice?: 'shout' | 'tiny'
  /** 여행 섬에 놀러 와 있는 손님. 초대하면 도토리섬에 집터가 생긴다. */
  guest?: boolean
}

export interface Villager extends VillagerDef {
  home: { x: number; z: number }
  /** 집 중심. 산책 원 밖에 있어 집과 주민이 겹치지 않는다. */
  house: { x: number; z: number; rot: number }
  seed: number
}

const BASIC_COST = { wood: 6, stone: 4, iron: 1 }
const NEWCOMER_COST = { wood: 10, stone: 8, iron: 3 }
const GUEST_COST = { wood: 8, stone: 6, iron: 2 }
const guest = { newcomer: true, guest: true, cost: GUEST_COST } as const

const DEFS: VillagerDef[] = [
  { id: 'mocha', name: '모카', species: 'cat', body: '#d9a066', accent: '#f6d36b', tic: '냥', gifts: ['flowerpot', 'lamp', 'telescope'], cost: BASIC_COST, wearTaste: { tone: 'warm' } },
  { id: 'bomi', name: '봄이', species: 'rabbit', body: '#f4f0ea', accent: '#ff9fb5', tic: '깡총', gifts: ['chair', 'mailbox', 'snowman'], cost: BASIC_COST, wearTaste: { tone: 'pale' } },
  { id: 'pengdol', name: '펭돌', species: 'penguin', body: '#2f3640', accent: '#7fb8e6', tic: '뒤뚱', gifts: ['table', 'campfire', 'telescope'], cost: BASIC_COST, wearTaste: { tone: 'cool', kind: 'shirt' } },
  { id: 'guriguri', name: '구리구리', species: 'mole', body: '#8a7f8f', accent: '#ffcf70', tic: '구리', gifts: ['lamp', 'campfire', 'telescope'], newcomer: true, cost: NEWCOMER_COST, wearTaste: { tone: 'pale' } },
  { id: 'dongri', name: '동그리', species: 'hedgehog', body: '#f2d7b6', accent: '#9bd59a', tic: '동글', gifts: ['flowerpot', 'chair', 'snowman'], newcomer: true, cost: NEWCOMER_COST, wearTaste: { tone: 'fresh' } },
  // 솜이 삼총사. 처음부터 섬에 산다.
  { id: 'somi', name: '솜이', species: 'bear', body: '#b5e8d5', accent: '#fff4df', tic: '…', gifts: ['flowerpot', 'log-stool', 'lamp'], cost: BASIC_COST, wearTaste: { tone: 'pale', kind: 'shirt' }, voice: 'tiny' },
  { id: 'soda', name: '소다', species: 'cat', body: '#3fb3a8', accent: '#2a7f78', tic: '~', gifts: ['chair', 'campfire', 'telescope'], cost: BASIC_COST, wearTaste: { tone: 'cool' } },
  { id: 'bori', name: '보리', species: 'squirrel', body: '#c99a5b', accent: '#4a2e18', tic: '~해줘!', gifts: ['flowerpot', 'snowman', 'gold-acorn'], cost: BASIC_COST, wearTaste: { tone: 'cool' } },
  { id: 'maro', name: '마로', species: 'chestnut', body: '#8a5a3b', accent: '#6f9a3c', tic: ' 후아', gifts: ['campfire', 'table', 'log-bench'], cost: BASIC_COST, wearTaste: { tone: 'warm', kind: 'shirt' } },
  { id: 'coco', name: '코코', species: 'otter', body: '#7f8f9c', accent: '#bfe3f2', tic: ' 훗', gifts: ['iron-lamp', 'telescope', 'stone-lantern'], cost: BASIC_COST, wearTaste: { kind: 'swim' } },
  { id: 'yuja', name: '유자', species: 'rabbit', body: '#f2b93b', accent: '#7fb84a', tic: ' 얍', gifts: ['table', 'stone-lantern', 'snowman'], cost: BASIC_COST, wearTaste: { tone: 'warm' }, voice: 'shout' },
  // 여행 섬 손님들. 갈 때마다 몇 명이 무작위로 놀러 와 있다. 목록 맨 뒤에 두어야 기존 주민 집 자리가 바뀌지 않는다.
  { id: 'sora', name: '소라', species: 'penguin', body: '#5b7fa6', accent: '#ffd166', tic: ' 뽀', gifts: ['lamp', 'snowman', 'telescope'], ...guest },
  { id: 'toto', name: '토토', species: 'rabbit', body: '#c9c3bd', accent: '#9bd5f0', tic: ' 토', gifts: ['chair', 'flowerpot', 'log-bench'], ...guest },
  { id: 'kongi', name: '콩이', species: 'hedgehog', body: '#b98a5e', accent: '#ffb3c1', tic: ' 콩', gifts: ['flowerpot', 'lamp', 'stone-lantern'], ...guest },
  { id: 'mimi', name: '미미', species: 'cat', body: '#fff4f0', accent: '#ff9fb5', tic: ' 미야', gifts: ['table', 'iron-lamp', 'telescope'], ...guest },
  { id: 'gomdol', name: '곰돌', species: 'bear', body: '#a0714f', accent: '#7fc8a9', tic: ' 곰', gifts: ['campfire', 'log-stool', 'log-bench'], ...guest },
  { id: 'darami', name: '다람', species: 'squirrel', body: '#e0a46b', accent: '#f7e08a', tic: ' 쪼르', gifts: ['flowerpot', 'chair', 'gold-acorn'], ...guest },
  { id: 'bamtol', name: '밤톨', species: 'chestnut', body: '#c98a52', accent: '#6b8e4e', tic: ' 톨', gifts: ['campfire', 'table', 'stone-lantern'], ...guest },
  { id: 'chumbung', name: '첨벙', species: 'otter', body: '#7d6450', accent: '#ffcf70', tic: ' 첨벙', gifts: ['iron-lamp', 'campfire', 'telescope'], ...guest },
]

export const WANDER_R = 2.4
export const HOUSE_R = 1.7
export const HOUSE_GAP = WANDER_R + 2.5
/** 주민 집 현관 문은 본체 로컬 +z 쪽에 있다(Houses.tsx). 문 앞까지 이 거리를 본다. */
export const VILLAGER_DOOR_D = 1.3

/** 주민 집 문 앞이 걸을 수 있는 평평한 땅이고 소품에 막히지 않는지 */
export function villagerDoorOpen(hx: number, hz: number, rot: number): boolean {
  const dx = hx + Math.sin(rot) * VILLAGER_DOOR_D
  const dz = hz + Math.cos(rot) * VILLAGER_DOOR_D
  return isWalkable(dx, dz) && flatWithin(dx, dz, 0.5) && !blockedByFixedProps(dx, dz, 0.5)
}

function pickHomes(): Villager[] {
  const rng = mulberry32(hashString('villagers-v2'))
  const out: Villager[] = []
  const clear = (x: number, z: number, r: number) =>
    !TREES.some((t) => Math.hypot(t.x - x, t.z - z) < r + 1.2) &&
    !blockedByProps(x, z, r) &&
    Math.hypot(x - SHOP.x, z - SHOP.z) > r + 4 &&
    // 연못·개울과 그 둑은 피한다.
    !byWater(x, z, r) &&
    !byWater(x, z, r * 0.5)

  for (let attempt = 0; attempt < 20000 && out.length < DEFS.length; attempt++) {
    const x = (rng() * 2 - 1) * ISLAND_R * 0.7
    const z = (rng() * 2 - 1) * ISLAND_R * 0.7
    if (normDist(x, z) > 0.64) continue
    // 돌아다니는 원 안에 나무·상점·바위가 없어야 몸이 겹치지 않는다.
    // 산책 마당은 한 단(티어) 위에 평평하게 있어야 주민이 절벽을 넘지 않는다.
    if (!clear(x, z, WANDER_R + 0.6) || !flatWithin(x, z, WANDER_R)) continue
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5) continue
    if (out.some((v) => Math.hypot(v.home.x - x, v.home.z - z) < WANDER_R * 2 + 1.5 || Math.hypot(v.house.x - x, v.house.z - z) < HOUSE_GAP)) continue

    const a0 = rng() * Math.PI * 2
    for (let k = 0; k < 8; k++) {
      const a = a0 + (k / 8) * Math.PI * 2
      const hx = x + Math.cos(a) * HOUSE_GAP
      const hz = z + Math.sin(a) * HOUSE_GAP
      if (normDist(hx, hz) > 0.72 || !clear(hx, hz, HOUSE_R + 0.5) || !flatWithin(hx, hz, HOUSE_R)) continue
      if (Math.hypot(hx - SPAWN.x, hz - SPAWN.z) < 4) continue
      if (out.some((v) => Math.hypot(v.home.x - hx, v.home.z - hz) < HOUSE_GAP || Math.hypot(v.house.x - hx, v.house.z - hz) < HOUSE_R * 2 + 2)) continue
      // 현관은 마당 방향에 가장 가까운 남·동·서 가운데, 문 앞이 걸을 수 있는 쪽을 본다(doorFacing.ts).
      const yard = Math.atan2(x - hx, z - hz)
      const rot = pickDoorRot(doorOrder(yard), (r) => villagerDoorOpen(hx, hz, r))
      if (rot === null) continue
      out.push({ ...DEFS[out.length], home: { x, z }, house: { x: hx, z: hz, rot }, seed: rng() * 100 })
      break
    }
  }
  return out
}

export const VILLAGERS = pickHomes()

/** 집 마당·집터 주변. 가구·꽃·장식이 들어가면 안 되는 자리다. */
export function reservedByHomes(x: number, z: number, pad = 0): boolean {
  return VILLAGERS.some(
    (v) => Math.hypot(x - v.home.x, z - v.home.z) < WANDER_R + pad || Math.hypot(x - v.house.x, z - v.house.z) < HOUSE_R + 0.6 + pad,
  )
}

export function blockedByHouses(x: number, z: number, built: readonly string[], pad = 0): boolean {
  return VILLAGERS.some((v) => built.includes(v.id) && Math.hypot(x - v.house.x, z - v.house.z) < HOUSE_R + pad)
}

/** 주민마다 따로 흐르는 시계 t 로 위치를 정한다. 대화 중에는 그 시계를 멈춘다. */
export function villagerPosition(v: Villager, t: number): { x: number; z: number; facing: number } {
  const s = v.seed
  // 두 축 진폭을 0.7R 로 두면 대각선에서도 반경 R 을 넘지 않는다.
  const at = (k: number) => ({
    x: v.home.x + (Math.sin(k * 0.21 + s) * 0.55 + Math.sin(k * 0.07 + s * 3) * 0.15) * WANDER_R,
    z: v.home.z + Math.sin(k * 0.16 + s * 2) * 0.7 * WANDER_R,
  })
  const a = at(t)
  const b = at(t + 0.1)
  return { ...a, facing: Math.atan2(b.x - a.x, b.z - a.z) }
}

const LEVELS = [0, 3, 8, 15]

export function friendshipLevel(points: number): number {
  let lv = 0
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]) lv = i
  return lv
}

export function nextLevelAt(points: number): number | null {
  return LEVELS.find((p) => p > points) ?? null
}

const REQUEST_POOL = [
  'peach',
  'conch',
  'scallop',
  'starfish',
  'cabbage-white',
  'honeybee',
  'ladybug',
  ...FISH_TABLE.filter((f) => f.band === 'any' && ITEMS[f.id].kind === 'fish').map((f) => f.id),
]

/** 오늘 구할 수 있는 물건만 부탁한다. 비 오는 날 생선은 비 올 때, 제철 생선은 그 계절에만. */
function requestPoolFor(day: string): string[] {
  const rain = weatherFor(day) === 'rain'
  const season = seasonFor(day)
  return REQUEST_POOL.filter((id) => {
    const f = FISH_TABLE.find((x) => x.id === id)
    return !f || ((!f.rain || rain) && (!f.seasons || f.seasons.includes(season)))
  })
}

/** 그날의 부탁. 날짜와 주민으로 정해진다. */
export function dailyRequest(villagerId: string, day: string): string {
  const rng = mulberry32(hashString(`req:${villagerId}:${day}`))
  const pool = requestPoolFor(day)
  return pool[Math.floor(rng() * pool.length)]
}

export interface TalkContext {
  firstToday: boolean
  level: number
  night: boolean
  request: string
  requestDone: boolean
  hasItem: boolean
  /** 오늘 이 주민과 몇 번째 이야기인지. 두 번째부터 인사말을 바꿔 가며 쓴다. */
  nth?: number
  /** 지금 하루 중 어느 때인지. 인사말과 졸린 소리를 이 시간에 맞춘다. 없으면 night 를 쓴다. */
  part?: DayPart
  /** 친한 정도 점수. 호감도 단계 상한(15) 이후에도 점수에 따라 말이 달라진다. */
  points?: number
  /** 지금 주민 집 안(방)에서 말을 거는지. 집에는 새벽과 밤에만 주민이 있어서 그때만 집 대사를 쓴다. */
  inHouse?: boolean
  /** 지금 시각(시). 집 안에서 주민이 있는 자리를 고르는 데 쓴다. */
  hour?: number
}

/** 밤인지. part 가 있으면 시계 기준(20시~)을 따른다. */
const isNightCtx = (c: TalkContext) => (c.part ? c.part === 'night' : !!c.night)

/** 시간대별 인사. 밤 인사는 시계가 밤일 때만 쓴다. */
const TIME_HELLO: Partial<Record<DayPart, string>> = {
  dawn: '이 시간에 벌써 일어났어? 하늘이 보랏빛이야',
  morning: '좋은 아침이야! 잘 잤어?',
  evening: '노을 봤어? 하늘이 주황색이야',
  night: '이 시간에 산책이야? 별이 예쁘다',
}

/** 순번이나 시간 같은 값으로 목록에서 한 줄을 고른다. 같은 조건이면 늘 같은 줄이 나온다. */
const at = <T,>(xs: readonly T[], n: number): T => xs[((n % xs.length) + xs.length) % xs.length]

/** 외치는 주민(유자)의 인사. 시간대·친한 정도·다시 만남에 따라 골라 쓴다. */
const SHOUT_HELLO = {
  sleepy: ['…뿌우우. (졸린 눈으로 하품한다)', '…으아암. (이불을 질질 끌고 나온다)', '…얍… (꾸벅꾸벅 존다)'],
  again: ['헤에?! (또 왔냐는 듯 귀를 쫑긋)', '얍! (제자리에서 깡충)', '와햐! (손을 번쩍 든다)', '헤에? 또? (귀를 세우고 빤히 본다)', '얍얍! (꼬리를 씰룩씰룩)', '와햐~ (두 발로 콩콩 뛴다)'],
  dawn: ['(하늘을 올려다보며) 얍…?', '와햐… 이른 아침이다!'],
  morning: ['좋은 아침! 얍!', '(기지개를 쭉 켠다) 와햐아~'],
  evening: ['(노을을 보며 깡충) 얍~', '해가 빨갛다! 와햐!'],
  close: ['와햐아아!! (반가워서 주위를 한 바퀴 뛴다)', '얍얍!! (두 팔을 벌리고 달려온다)', '와햐!! 너다!! (귀가 쫑긋 선다)'],
  first: ['얍!', '(손을 번쩍 들며) 얍!'],
}

/** 외치는 주민의 대사. 말은 짧은 외침뿐이고 무엇을 원하는지는 괄호 속 몸짓으로 알려준다. */
function shoutLines(c: TalkContext): string[] {
  const item = ITEMS[c.request]
  const n = c.nth ?? 0
  const hello = isNightCtx(c) ? at(SHOUT_HELLO.sleepy, n)
    : !c.firstToday ? at(SHOUT_HELLO.again, n)
    : c.part === 'dawn' ? at(SHOUT_HELLO.dawn, n)
    : c.part === 'morning' ? at(SHOUT_HELLO.morning, n)
    : c.part === 'evening' ? at(SHOUT_HELLO.evening, n)
    : c.level >= 2 ? at(SHOUT_HELLO.close, n) : at(SHOUT_HELLO.first, n)
  const icon = item.icon
  if (c.requestDone) return [hello, at([`(배를 두드리며 ${icon}) 얍~♪`, `(입가를 쓱쓱 닦는다) 와햐~♪`, '(배를 통통 두드린다) 얍얍, 맛있었다!'], n)]
  if (c.hasItem) return [hello, at([`(${josa(item.name, '을', '를')} 보고 눈이 반짝) 와햐!! 와햐!!`, `(${icon} 쪽으로 코를 킁킁) 와햐!`, '(뛰어오르며) 와햐!! 그거 줘!!'], n)]
  const want = josa(item.name, '이', '가')
  return [hello, at([`(${icon} ${want} 그려진 그림을 들고 폴짝폴짝) 얍! 얍!`, `(${icon} 그림을 머리 위로 흔든다) 헤에? ${item.name}!`, `(${icon} ${want} 그려진 그림을 가리키며 빙글) 와햐! 찾아 줘!`], n)]
}

/** 수줍어서 말을 거의 못 하는 주민(솜이)의 인사. 짧은 소리와 몸짓으로 이야기한다. */
const TINY_HELLO = {
  sleepy: ['…(졸린 눈을 비비며) 우…', '…히잉… (이불 속으로 쏙)', '…(꾸벅, 고개를 떨군다)'],
  again: ['…(작게 손을 흔든다)', '…응! (또 만나서 기쁜 얼굴)', '우웅… (수줍게 웃는다)', '…(귀를 살짝 흔든다)', '히잉… (고개를 살짝 숙인다)', '…응… (조용히 옆으로 다가온다)'],
  dawn: ['…(이른 아침 하늘을 올려다본다)', '히잉… 벌써 일어났어?'],
  morning: ['…좋은 아침. (작게 손을 든다)', '(기지개를 살짝 켠다) …응.'],
  evening: ['(노을을 보며 조용히 웃는다) …응', '…노을이 예뻐. (눈을 가늘게 뜬다)'],
  close: ['우응…! (반가워서 볼이 빨개진다)', '(두 손을 모으고 폴짝) 우응…!', '…보고 싶었어. (살짝 안긴다)'],
  first: ['…응!', '…(살짝 고개를 든다)'],
}

/** 수줍어서 말을 거의 못 하는 주민(솜이). 짧은 소리와 몸짓으로 이야기한다. */
function tinyLines(c: TalkContext): string[] {
  const item = ITEMS[c.request]
  const n = c.nth ?? 0
  const hello = isNightCtx(c) ? at(TINY_HELLO.sleepy, n)
    : !c.firstToday ? at(TINY_HELLO.again, n)
    : c.part === 'dawn' ? at(TINY_HELLO.dawn, n)
    : c.part === 'morning' ? at(TINY_HELLO.morning, n)
    : c.part === 'evening' ? at(TINY_HELLO.evening, n)
    : c.level >= 2 ? at(TINY_HELLO.close, n) : at(TINY_HELLO.first, n)
  const icon = item.icon
  if (c.requestDone) return [hello, at([`(${icon} 생각에 꼭 끌어안는 시늉을 한다) …우웅!`, `(${josa(item.name, '을', '를')} 쓰다듬으며) …고마워… 히잉`, '(조용히 웃으며 고개를 꾸벅) …우웅.'], n)]
  if (c.hasItem) return [hello, at([`(${josa(item.name, '을', '를')} 보고 눈이 반짝반짝) 응…! 응…!`, `(${icon} 쪽으로 살금살금 다가간다) …${item.name}…?`, '(두 손을 모으고 기다린다) …줄 수 있어…?'], n)]
  const want = josa(item.name, '이', '가')
  return [hello, at([`(${icon} ${want} 그려진 쪽지를 내민다) …우웅…`, `(${icon} 쪽지를 내밀며 눈치를 본다) …${item.name}…?`, `(${icon} 쪽지를 접었다 폈다) …${item.name}… 찾으면 줄래?`], n)]
}

const AGAIN = ['또 왔네? 심심했구나', '또 만났다!', '어, 또 보네! 무슨 일이야?', '오늘 자주 보네!']

/** 집 안에서 말을 걸 때의 인사. 주민이 있는 자리(책장 앞·침대·창가)에 따라 다르다. 침대에 누워 있으면 졸린 말투다. */
export const HOUSE_HELLO: Readonly<Record<RoomSpot, string>> = {
  reading: '어서 와. 이 시간에 내 방까지 찾아오다니',
  bed: '…으음, 졸려. 이불 속이라 일어나기 힘들어',
  window: '창밖이 벌써 밝아. 이 시간에 집에 들어와 줘서 고마워',
}

/** 집 안에서 나누는 화제 한 줄. 방 가구(러그·책장·서랍장·창)에 맞춘다. 순번으로 고른다. */
export const HOUSE_TOPIC = [
  '이 러그는 할머니가 짜 주신 거야. 발이 따뜻하지?',
  '책장 맨 위 칸은 내 보물 자리야. 몰래 보기다?',
  '서랍장에 답장 쓰다 만 편지가 있어. 나중에 같이 볼래?',
  '창밖 별이 잘 보여. 여기서 보는 밤이 제일 좋아',
]

export function talkLines(v: VillagerDef, c: TalkContext): string[] {
  if (v.voice === 'shout') return shoutLines(c)
  if (v.voice === 'tiny') return tinyLines(c)
  const say = (line: string) => withTic(line, v.tic)
  const timed = c.part ? TIME_HELLO[c.part] : undefined
  // 집 안에서는 새벽·밤 인사와 집 화제 한 줄을 먼저 한다
  const houseNow = !!c.inHouse && (c.part === 'dawn' || isNightCtx(c))
  const spot: RoomSpot = c.hour !== undefined ? villagerRoomSpot(c.hour) : c.part === 'dawn' ? 'window' : 'reading'
  const houseHello = houseNow ? HOUSE_HELLO[spot] : undefined
  const hello = houseHello ?? (!c.firstToday && c.level > 0
    ? AGAIN.concat(timed ?? []).at((c.nth ?? 0) % (AGAIN.length + (timed ? 1 : 0)))!
    : c.level === 0
      ? isNightCtx(c) ? TIME_HELLO.night! : `안녕! 나는 ${v.name}. 이 섬에서 지내고 있어`
      : timed ?? (c.level === 1 ? '왔구나! 오늘도 반가워' : closeHello(c.points)))
  const lines = [say(hello)]
  if (houseNow) lines.push(say(at(HOUSE_TOPIC, c.nth ?? 0)))
  const item = ITEMS[c.request]
  if (c.requestDone) lines.push(say(`아까 준 ${item.name}, 정말 고마웠어!`))
  else if (c.hasItem) lines.push(say(`앗, ${josa(item.name, '을', '를')} 갖고 있구나! 나한테 줄 수 있어?`))
  else lines.push(`${withTic(`오늘은 ${josa(item.name, '이', '가')} 꼭 갖고 싶어`, v.tic).replace(/[.!]$/, '')}… 찾으면 줄래?`)
  return lines
}

/** 아주 친한 주민의 인사. 점수가 50, 90을 넘으면 더 가까운 말을 한다. */
function closeHello(points = 0): string {
  if (points >= 90) return '너는 이제 내 제일 친한 친구야!'
  if (points >= 50) return '우리 정말 친해진 것 같아. 그치?'
  return '너랑 이야기하는 게 제일 좋아!'
}

export type Mood = 'happy' | 'surprised' | 'sad' | 'calm'

/** 대사 한 줄에서 표정을 고른다. 놀람이 기쁨보다, 기쁨이 시무룩보다 먼저다. */
export function moodOf(line: string): Mood {
  if (/[?？]!|!!|헉|앗|헤에\?|뭐|엥/.test(line)) return 'surprised'
  if (/고마워|좋아|기뻐|와아|와햐|헤헤|♪|최고|반가워|훗|후아|캬/.test(line)) return 'happy'
  if (/…|미안|흑|힘들|슬퍼|아쉽/.test(line)) return 'sad'
  return 'calm'
}

/** 집을 지어 준 주민은 밤이 깊으면 집에 들어간다. 들어가는 시각은 주민마다 20~22시로 다르다. */
export function isHomeAt(v: Villager, hour: number, built: readonly string[]): boolean {
  if (!built.includes(v.id)) return false
  return hour >= 20 + (Math.floor(v.seed) % 3) || hour < 6
}
