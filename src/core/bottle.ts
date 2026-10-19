/**
 * 유리병 편지, 표류 소포, 보물 지도.
 *
 * 매일 해변에 유리병이 한 개 떠밀려 온다. 병을 주우면 먼 섬 누군가의 편지가 나오고,
 * 서른 편지 가운데 열은 보물 지도 조각이다. 가끔(하루 0~2개) 소포도 떠밀려 오는데, 열면 재료나 가구가 나온다.
 * 지도는 목표 칸 좌표를 id 에 담은 주머니 아이템이라 저장 필드를 늘리지 않는다.
 * 지도를 든 채 목표 근처에서 삽으로 파면 상자가 나온다.
 */
import { ITEMS, type ItemDef } from './items'
import { blockedByScenery } from './scenery'
import { dayIndex } from './economy'
import { groundAt, isWalkable, islandDist } from './island'
import { reservedByHomes } from './villagers'
import { blockedByProps } from './world'
import { hashString } from './rng'

/** 목표 칸에서 이 거리 안에 가면 땅에 반짝임이 보인다 */
export const GLINT_RADIUS = 3
/** 삽으로 파려면 목표 칸에서 이 거리 안이어야 한다 */
export const TREASURE_REACH = 1.4
/** 보물 상자에서 나오는 도토리 */
export const TREASURE_MONEY = 1000

/** 편지 서른 종. 뒤에 덧붙인 것이라 예전 병의 편지 번호는 그대로다. 보물 지도 조각은 index % 3 === 2 인 열이다. */
export const LETTERS: readonly string[] = [
  '바다 건너 작은 섬에서 보내요. 오늘도 파도 소리가 시끄러워서 잠이 안 와요. 그곳은 잘 지내고 있나요?',
  '나는 등대지기예요. 이 병을 던진 날은 안개가 짙었어요. 혹시 누가 주우면 안부만 전해 주세요.',
  '여기 보물 지도 조각을 함께 넣어요. 저는 가져갈 수 없어서 떠밀어 보내요. 그 섬에 묻어 주세요.',
  '복숭아가 너무 많이 열려서 나눠 주고 싶어요. 언젠가 같이 먹으러 가요.',
  '우리 섬에는 새 다리가 놓였어요. 건너오는 배가 생기면 소식 전할게요.',
  '어제 큰 물고기를 낚았는데 아무도 믿지 않아요. 이 병 속 편지로라도 자랑할게요.',
  '친구를 기다리며 병을 띄워요. 그쪽 바다에도 이런 병이 떠다니나요?',
  '섬 한가운데 땅을 파다 보면 가끔 반짝이는 걸 만나요. 저도 그렇게 하나를 찾았어요. 행운을 빌어요.',
  '바람이 세게 불던 날, 지붕 위로 나뭇잎이 날아갔어요. 그쪽은 무사했기를 바라요.',
  '가을 숲에서 송이버섯을 땄어요. 향이 좋아서 바구니에 가득 담았어요. 일요일 아침 상인이 오면 같이 사러 가요.',
  '별이 쏟아지는 밤이었어요. 이 병이 그쪽 해변에 닿으면 밤하늘이 얼마나 예쁜지 알려 주세요.',
  '작은 상점을 열었어요. 도토리로 살 수 있는 것이 많지만, 제일 좋은 건 함께 나누는 거예요.',
  // 12~29: index % 3 === 2 인 자리(14, 17, … 29)는 지도 조각이라 글은 보이지 않는다. 글은 그래도 채워 둔다.
  '오늘 아침 처음으로 배에 등불을 켜 봤어요. 멀리서도 보이면 좋겠어요.',
  '우리 마을 빵집 아저씨가 새 빵을 구웠어요. 소금 맛이 나는 바다빵이에요. 한번 드셔 보실래요?',
  '여기 지도 조각이 있어요. 낡은 종이에 붉은 점이 찍혀 있는데, 그 자리를 파 보라고 적혀 있었어요.',
  '비 오는 날엔 아이들이 조개를 주우러 나가요. 그쪽 해변에도 조개가 많이 떠밀려 오나요?',
  '그대에게 전하오. 지난 병에 답장이 돌아와 기뻤소. 다음 병에도 섬 소식을 실어 보내리다.',
  '할아버지가 남긴 지도 조각이에요. 나무 아래를 파라고 적혀 있었어요. 행운을 빌어요.',
  '저희 섬에는 밤마다 반딧불이가 날아요. 그쪽 밤하늘에도 반짝이는 게 있나요?',
  '텃밭에 토마토가 달기 시작했어요. 달콤한 걸 좋아하시나요? 다음에 한 바구니 보내 드릴게요.',
  '지도 조각을 하나 더 넣어요. 섬 어딘가에 숨겨진 상자를 찾아 주세요.',
  '며칠째 파도가 높아 배가 못 떠요. 그래도 이 병은 잘 떠가고 있으니 걱정 마세요.',
  '얼마 전 낡은 나무배를 고쳤어요. 다음에 타러 오세요. 노는 두 개 준비해 둘게요.',
  '이 조각은 물에 젖어 반쯤 지워졌어요. 그래도 목표 자리는 알아볼 수 있을 거예요.',
  '누군가 이 병을 주우면 웃어 주세요. 저는 지금 여기서 혼자 웃고 있어요.',
  '바다 밑에 예쁜 산호가 있대요. 언젠가 같이 보러 가고 싶어요. 약속해요.',
  '보물 지도 조각이에요. 두 조각을 맞춰 보고 싶었는데, 한 조각만 먼저 보내요.',
  '섬 축제 때 불꽃놀이를 했어요. 하늘이 온통 알록달록했는데, 그쪽에도 불꽃이 올랐나요?',
  '마을 도서관에 바다 이야기 책이 들어왔어요. 읽다 보니 그쪽 생각이 났어요.',
  '마지막 조각이에요. 표시된 땅을 파면 뭔가 반짝일 거예요. 기대해 주세요!',
]

/** 편지 id 는 letter-N, 지도는 map-x-z */
export const letterId = (index: number) => `letter-${index}`
export const isMapLetter = (index: number) => index % 3 === 2

/** 편지 가운데 하나를 고른다(병마다 정해진 씨앗으로). 지도 조각이면 true 를 함께 돌려준다. */
export function letterFor(seed: string): { index: number; map: boolean; text: string } {
  const index = (hashString(`letter:${seed}`) >>> 0) % LETTERS.length
  return { index, map: isMapLetter(index), text: LETTERS[index] }
}

/** 이 날 해변에 병이 떠밀려 오는가. 날짜가 있으면 매일 한 개다. */
export function bottleDay(day: string): boolean {
  return dayIndex(day) !== null
}

/** 표류 소포 목록: 목재·돌·꽃씨·철광석, 드물게 등불. 열면 이 가운데 하나가 든다. */
export const PARCEL_TABLE: readonly [string, number][] = [
  ['wood', 3],
  ['stone', 3],
  ['flower-seed', 4],
  ['iron', 2],
  ['paper-lantern', 1],
]

/** 이 날 떠밀려 오는 소포 수: 0개 40%, 1개 40%, 2개 20% */
export function parcelCount(day: string): number {
  return [0, 0, 1, 1, 2][(hashString(`parcel-count:${day}`) >>> 0) % 5]
}

/** 소포를 열면 나오는 것. 소포마다 정해진 씨앗으로 고른다. */
export function parcelContents(seed: string): { itemId: string; count: number } {
  const [itemId, count] = PARCEL_TABLE[(hashString(`parcel:${seed}`) >>> 0) % PARCEL_TABLE.length]
  return { itemId, count }
}

/** 지도 아이템 id 에 목표 칸을 담는다 */
export const mapId = (x: number, z: number) => `map-${x}-${z}`

/** 지도 id 에서 목표 칸을 꺼낸다. 지도가 아니면 null. */
export function parseMapId(id: string): { x: number; z: number } | null {
  const m = /^map-(-?\d+)-(-?\d+)$/.exec(id)
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null
}

/** 목표로 쓸 수 있는 땅 칸: 잔디 위, 섬 안쪽, 길·건물·가구·나무·주민 자리는 뺀다. 2칸 간격으로 본다. */
export function treasureCandidates(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let x = -40; x <= 40; x += 2) {
    for (let z = -40; z <= 40; z += 2) {
      if (islandDist(x, z) > 0.7) continue
      if (groundAt(x, z) !== 'grass' || !isWalkable(x, z)) continue
      if (blockedByProps(x, z, 1) || blockedByScenery(x, z, 0.8) || reservedByHomes(x, z, 0.8)) continue
      out.push({ x, z })
    }
  }
  return out
}

/** 씨앗으로 후보 가운데 하나를 고른다. 후보가 없으면 null. */
export function pickTreasure(seed: string, candidates: readonly { x: number; z: number }[]): { x: number; z: number } | null {
  if (candidates.length === 0) return null
  return candidates[(hashString(`treasure:${seed}`) >>> 0) % candidates.length]
}

/** 목표 칸 근처인가 */
export function nearTreasure(px: number, pz: number, t: { x: number; z: number }, reach: number): boolean {
  return Math.hypot(px - t.x, pz - t.z) < reach
}

/** 보물 상자의 내용: 도토리 1000 또는 희귀 가구 하나. 씨앗으로 고른다. */
export function treasureReward(seed: string, furniture: readonly string[]): { money: number } | { item: string } {
  const h = hashString(`reward:${seed}`) >>> 0
  if (h % 2 === 0 || furniture.length === 0) return { money: TREASURE_MONEY }
  return { item: furniture[(h >>> 1) % furniture.length] }
}

/** 지도 아이템 정의를 ITEMS 에 등록한다. 저장된 주머니를 불러올 때와 새 지도를 만들 때 부른다. */
export function registerMapItem(id: string): void {
  if (!parseMapId(id) || ITEMS[id]) return
  const def: ItemDef = { id, name: '보물 지도', icon: '🗺️', kind: 'material', price: 0, stack: 1 }
  ITEMS[id] = def
}

/** 표류 소포 아이템 정의를 등록한다(주울 때 이름을 쓴다). */
export function registerParcelItem(): void {
  if (ITEMS.parcel) return
  ITEMS.parcel = { id: 'parcel', name: '표류 소포', icon: '📦', kind: 'junk', price: 0, stack: 1 }
}
registerParcelItem()

/** 편지 아이템 정의를 등록한다(서른 종, 한 번만). */
export function registerLetterItems(): void {
  LETTERS.forEach((_, i) => {
    const id = letterId(i)
    if (!ITEMS[id]) ITEMS[id] = { id, name: '편지', icon: '✉️', kind: 'junk', price: 0, stack: 1 }
  })
}
registerLetterItems()
