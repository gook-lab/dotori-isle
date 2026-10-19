import type { Season } from './season'
import { CANDY_PRICE } from './pumpkin'

export type ItemKind = 'fruit' | 'shell' | 'bug' | 'fish' | 'junk' | 'furniture' | 'material' | 'treasure' | 'seed' | 'ticket' | 'flower' | 'dish' | 'seafood'
export type TimeBand = 'any' | 'day' | 'night'

export interface ItemDef {
  id: string
  name: string
  icon: string
  kind: ItemKind
  price: number
  /** 한 칸에 쌓을 수 있는 개수 */
  stack: number
  /** 상점에서 살 때 값. 없으면 상점에 없는 물건 */
  buy?: number
}

export const ITEM_LIST: ItemDef[] = [
  { id: 'peach', name: '복숭아', icon: '🍑', kind: 'fruit', price: 20, stack: 10 },
  // 다른 섬 과일은 귀해서 더 비싸게 팔린다.
  { id: 'orange', name: '오렌지', icon: '🍊', kind: 'fruit', price: 100, stack: 10 },

  { id: 'conch', name: '소라껍데기', icon: '🐚', kind: 'shell', price: 30, stack: 10 },
  { id: 'scallop', name: '가리비', icon: '🦪', kind: 'shell', price: 40, stack: 10 },
  { id: 'starfish', name: '불가사리', icon: '⭐', kind: 'shell', price: 25, stack: 10 },
  { id: 'coral', name: '산호', icon: '🪸', kind: 'shell', price: 80, stack: 10 },
  // 비 오는 날 해변에 씻겨 오는 조약돌(core/rainStones.ts). 맑은 날 표에는 들지 않는다.
  { id: 'rain-pebble', name: '반짝이는 조약돌', icon: '🪨', kind: 'shell', price: 20, stack: 10 },
  // 잠수해서 잡는 해산물. 요리 재료로는 쓰지 않는다(생선·조개 칸과 따로 둔다).
  { id: 'urchin', name: '성게', icon: '🦔', kind: 'seafood', price: 60, stack: 10 },
  { id: 'octopus', name: '문어', icon: '🐙', kind: 'seafood', price: 150, stack: 10 },
  { id: 'abalone', name: '전복', icon: '🐚', kind: 'seafood', price: 200, stack: 10 },
  { id: 'lobster', name: '랍스터', icon: '🦞', kind: 'seafood', price: 320, stack: 10 },
  { id: 'sea-cucumber', name: '해삼', icon: '🥒', kind: 'seafood', price: 180, stack: 10 },

  { id: 'cabbage-white', name: '배추흰나비', icon: '🦋', kind: 'bug', price: 30, stack: 1 },
  { id: 'tide-crab', name: '게', icon: '🦀', kind: 'bug', price: 150, stack: 1 },
  { id: 'tide-starfish', name: '작은 불가사리', icon: '⭐', kind: 'bug', price: 100, stack: 1 },
  { id: 'swallowtail', name: '호랑나비', icon: '🦋', kind: 'bug', price: 90, stack: 1 },
  { id: 'honeybee', name: '꿀벌', icon: '🐝', kind: 'bug', price: 60, stack: 1 },
  { id: 'ladybug', name: '무당벌레', icon: '🐞', kind: 'bug', price: 50, stack: 1 },
  { id: 'firefly', name: '반딧불이', icon: '✨', kind: 'bug', price: 150, stack: 1 },
  { id: 'rhino-beetle', name: '장수풍뎅이', icon: '🪲', kind: 'bug', price: 220, stack: 1 },
  { id: 'snail', name: '달팽이', icon: '🐌', kind: 'bug', price: 120, stack: 1 },
  { id: 'cicada', name: '참매미', icon: '🦗', kind: 'bug', price: 140, stack: 1 },
  { id: 'red-dragonfly', name: '고추잠자리', icon: '🪽', kind: 'bug', price: 160, stack: 1 },

  { id: 'horse-mackerel', name: '전갱이', icon: '🐟', kind: 'fish', price: 40, stack: 1 },
  { id: 'mackerel', name: '고등어', icon: '🐟', kind: 'fish', price: 60, stack: 1 },
  { id: 'sea-bass', name: '농어', icon: '🐟', kind: 'fish', price: 100, stack: 1 },
  { id: 'pufferfish', name: '복어', icon: '🐡', kind: 'fish', price: 120, stack: 1 },
  { id: 'squid', name: '오징어', icon: '🦑', kind: 'fish', price: 90, stack: 1 },
  { id: 'red-snapper', name: '참돔', icon: '🐠', kind: 'fish', price: 250, stack: 1 },
  { id: 'hairtail', name: '갈치', icon: '🐟', kind: 'fish', price: 300, stack: 1 },
  { id: 'flounder', name: '도다리', icon: '🐟', kind: 'fish', price: 180, stack: 1 },
  { id: 'yellowtail', name: '방어', icon: '🐟', kind: 'fish', price: 320, stack: 1 },
  { id: 'killifish', name: '송사리', icon: '🐟', kind: 'fish', price: 30, stack: 1 },
  { id: 'crucian-carp', name: '붕어', icon: '🐟', kind: 'fish', price: 90, stack: 1 },
  { id: 'carp', name: '잉어', icon: '🐟', kind: 'fish', price: 300, stack: 1 },
  { id: 'catfish', name: '메기', icon: '🐟', kind: 'fish', price: 400, stack: 1 },
  { id: 'dace', name: '피라미', icon: '🐟', kind: 'fish', price: 60, stack: 1 },
  { id: 'sweetfish', name: '은어', icon: '🐟', kind: 'fish', price: 260, stack: 1 },
  { id: 'cherry-trout', name: '산천어', icon: '🐟', kind: 'fish', price: 380, stack: 1 },
  { id: 'empty-can', name: '빈 깡통', icon: '🥫', kind: 'junk', price: 5, stack: 1 },

  { id: 'flowerpot', name: '화분', icon: '🪴', kind: 'furniture', price: 30, stack: 1, buy: 120 },
  { id: 'chair', name: '나무 의자', icon: '🪑', kind: 'furniture', price: 50, stack: 1, buy: 200 },
  // 서랍장: 방에 놓고 E 로 열면 보관함 패널이 열린다
  { id: 'drawer', name: '서랍장', icon: '🗄️', kind: 'furniture', price: 80, stack: 1, buy: 240 },
  // 옷장: 방에 놓고 E 로 열면 옷장 패널(C 키와 같은 것)이 열린다
  { id: 'wardrobe', name: '옷장', icon: '🚪', kind: 'furniture', price: 120, stack: 1, buy: 480 },
  { id: 'mailbox', name: '우체통', icon: '📮', kind: 'furniture', price: 60, stack: 1, buy: 250 },
  // 낚시 대회 상품: 포인트로만 바꾼다(상점에서 사지 않고 팔 수도 없다)
  { id: 'tourney-trophy', name: '대회 트로피', icon: '🏆', kind: 'furniture', price: 0, stack: 1 },
  { id: 'tourney-fish', name: '물고기 모형', icon: '🐟', kind: 'furniture', price: 0, stack: 1 },
  { id: 'tourney-flag', name: '대회 깃발', icon: '🚩', kind: 'furniture', price: 0, stack: 1 },
  // 집 꾸미기 점수 최고 구간 보상(한정). 상점에는 없다(core/homeScore.ts LIMITED_ITEM)
  { id: 'house-plaque', name: '우리 집 현판', icon: '🪧', kind: 'furniture', price: 0, stack: 1 },
  // 이사 가는 주민이 작별 편지와 함께 남기는 액자(core/moving.ts)
  { id: 'photo-frame', name: '사진 액자', icon: '🖼️', kind: 'furniture', price: 0, stack: 1 },
  // 별자리 열두 개를 다 본 보상: 상점에서 팔지도 사지도 않는다. 밤에 은은하게 빛난다.
  { id: 'star-lamp', name: '별 모양 조명', icon: '⭐', kind: 'furniture', price: 0, stack: 1 },
  // 섬 꾸미기 위원회 별 등급 기념품(별 1~5). 상점에는 없고 편지 선물로만 받는다.
  { id: 'star-sprout', name: '별싹 화분', icon: '🌱', kind: 'furniture', price: 0, stack: 1 },
  { id: 'star-cushion', name: '별 방석', icon: '🧸', kind: 'furniture', price: 0, stack: 1 },
  { id: 'star-bell', name: '별 종', icon: '🔔', kind: 'furniture', price: 0, stack: 1 },
  { id: 'star-stand', name: '별빛 스탠드', icon: '🌟', kind: 'furniture', price: 0, stack: 1 },
  { id: 'star-trophy', name: '별 트로피', icon: '🏆', kind: 'furniture', price: 0, stack: 1 },
  // 마일 교환소(ATM) 전용: 상점에는 없고 마일로만 받는다(core/bank.ts ATM_PRODUCTS)
  { id: 'acorn-cushion', name: '도토리 방석', icon: '🌰', kind: 'furniture', price: 0, stack: 1 },
  { id: 'acorn-vase', name: '도토리 꽃병', icon: '🏺', kind: 'furniture', price: 0, stack: 1 },
  { id: 'acorn-lantern', name: '도토리 등불', icon: '🏮', kind: 'furniture', price: 0, stack: 1 },
  { id: 'table', name: '원목 탁자', icon: '🍽️', kind: 'furniture', price: 75, stack: 1, buy: 300 },
  { id: 'lamp', name: '버섯 램프', icon: '🍄', kind: 'furniture', price: 90, stack: 1, buy: 350 },
  { id: 'campfire', name: '모닥불', icon: '🔥', kind: 'furniture', price: 100, stack: 1, buy: 400 },
  // 집 안에 놓는 작은 화덕. E 로 요리 창을 연다.
  { id: 'stove', name: '작은 화덕', icon: '♨️', kind: 'furniture', price: 130, stack: 1, buy: 520 },
  { id: 'snowman', name: '눈사람 인형', icon: '⛄', kind: 'furniture', price: 150, stack: 1 },
  { id: 'telescope', name: '별 망원경', icon: '🔭', kind: 'furniture', price: 200, stack: 1 },
  // 서재 세트: 큰 가게 이상에서 진열한다. 스탠드는 밤에 불이 들어온다.
  { id: 'bookshelf', name: '책장', icon: '📚', kind: 'furniture', price: 110, stack: 1, buy: 440 },
  { id: 'reading-chair', name: '독서 의자', icon: '🛋️', kind: 'furniture', price: 95, stack: 1, buy: 380 },
  { id: 'floor-lamp', name: '스탠드', icon: '💡', kind: 'furniture', price: 85, stack: 1, buy: 340 },
  { id: 'globe', name: '지구본', icon: '🌍', kind: 'furniture', price: 140, stack: 1, buy: 560 },
  // 지하 작업실 세트: 지하실에 어울리는 작업 가구. 큰 가게 이상에서 진열한다.
  { id: 'workbench', name: '작업대', icon: '🛠️', kind: 'furniture', price: 120, stack: 1, buy: 480 },
  { id: 'tool-rack', name: '공구 벽걸이', icon: '🔧', kind: 'furniture', price: 70, stack: 1, buy: 280 },
  { id: 'storage-shelf', name: '저장 선반', icon: '📦', kind: 'furniture', price: 100, stack: 1, buy: 400 },
  { id: 'boiler', name: '보일러', icon: '🛢️', kind: 'furniture', price: 160, stack: 1, buy: 640 },
  // 정원 꾸미기 허가를 받으면 한 번에 스무 개가 주어진다. 상점에는 없다(core/fence.ts).
  { id: 'fence', name: '나무 울타리', icon: '🪵', kind: 'furniture', price: 0, stack: 20 },
  // 정원 꾸미기 허가 뒤 도토리로 사는 울타리(한 묶음 스무 개). 상점 목록에는 없다(core/fence.ts).
  { id: 'fence-white', name: '하얀 나무 울타리', icon: '🤍', kind: 'furniture', price: 0, stack: 20 },
  { id: 'fence-stone', name: '낮은 돌담', icon: '🪨', kind: 'furniture', price: 0, stack: 20 },
  // 정원 바닥 타일을 칠할 때 쓰는 가상 가구 id. 주머니에는 들지 않는다(core/gardenTiles.ts).
  { id: 'tile-gravel', name: '자갈 바닥', icon: '⚪', kind: 'material', price: 0, stack: 1 },
  { id: 'tile-brick', name: '벽돌 바닥', icon: '🧱', kind: 'material', price: 0, stack: 1 },
  { id: 'tile-deck', name: '나무 데크', icon: '🪵', kind: 'material', price: 0, stack: 1 },
  // 축제 전용 가구: 상점·제작에 없고 계절 축제를 끝내야 받는다
  { id: 'blossom-arch', name: '꽃 아치', icon: '🌸', kind: 'furniture', price: 0, stack: 1 },
  { id: 'paper-lantern', name: '종이 등불', icon: '🏮', kind: 'furniture', price: 0, stack: 1 },
  { id: 'harvest-scarecrow', name: '수확 허수아비', icon: '🎃', kind: 'furniture', price: 0, stack: 1 },
  { id: 'ice-sculpture', name: '얼음 조각', icon: '🧊', kind: 'furniture', price: 0, stack: 1 },

  { id: 'wood', name: '목재', icon: '🪵', kind: 'material', price: 20, stack: 30 },
  // 요리 재료. 덤불을 뒤적이면 가끔 나온다.
  { id: 'mushroom', name: '버섯', icon: '🍄', kind: 'material', price: 15, stack: 30 },
  // 송이는 값이 날마다 바뀌어 price 는 0 이고, 팔 때 core/songi.ts 의 시세로 값을 매긴다. 상한 송이는 값이 없다.
  { id: 'songi', name: '송이버섯', icon: '🍄', kind: 'material', price: 0, stack: 30 },
  { id: 'songi-spoiled', name: '상한 송이', icon: '🍂', kind: 'junk', price: 0, stack: 30 },
  { id: 'petal', name: '꽃잎', icon: '🌸', kind: 'material', price: 10, stack: 30 },
  // 요리 결과물. 가방에서 먹거나 주민에게 선물한다.
  { id: 'dish-fruit-pie', name: '과일 파이', icon: '🥧', kind: 'dish', price: 120, stack: 5 },
  { id: 'dish-grilled-fish', name: '생선구이', icon: '🍽️', kind: 'dish', price: 150, stack: 5 },
  { id: 'dish-clam-soup', name: '조개 수프', icon: '🥣', kind: 'dish', price: 110, stack: 5 },
  { id: 'dish-mushroom-skewer', name: '버섯 꼬치', icon: '🍢', kind: 'dish', price: 90, stack: 5 },
  { id: 'dish-acorn-cookie', name: '도토리 쿠키', icon: '🍪', kind: 'dish', price: 60, stack: 5 },
  { id: 'dish-petal-tea', name: '꽃잎 차', icon: '🍵', kind: 'dish', price: 70, stack: 5 },
  { id: 'stone', name: '돌멩이', icon: '🪨', kind: 'material', price: 15, stack: 30 },
  { id: 'iron', name: '철광석', icon: '🔩', kind: 'material', price: 80, stack: 30, buy: 240 },
  { id: 'gold', name: '금광석', icon: '🟡', kind: 'material', price: 400, stack: 30 },
  // 해안 동굴 벽에서 삽으로 캐는 광석. 상점에 비싸게 판다.
  { id: 'amber-stone', name: '호박석', icon: '🟠', kind: 'material', price: 150, stack: 30 },
  { id: 'amethyst', name: '자수정', icon: '🟣', kind: 'material', price: 240, stack: 30 },
  { id: 'moonstone', name: '월장석', icon: '⚪', kind: 'material', price: 340, stack: 30 },

  { id: 'fossil', name: '화석', icon: '🦴', kind: 'treasure', price: 300, stack: 1 },
  { id: 'ammonite', name: '암모나이트 화석', icon: '🌀', kind: 'treasure', price: 260, stack: 1 },
  { id: 'trilobite', name: '삼엽충 화석', icon: '🦐', kind: 'treasure', price: 320, stack: 1 },
  { id: 'fern-fossil', name: '고사리 화석', icon: '🌿', kind: 'treasure', price: 190, stack: 1 },
  { id: 'dino-footprint', name: '공룡 발자국 화석', icon: '🦶', kind: 'treasure', price: 420, stack: 1 },
  { id: 'amber-bug', name: '호박 속 벌레', icon: '🟠', kind: 'treasure', price: 380, stack: 1 },
  { id: 'acorn-pouch', name: '도토리 꾸러미', icon: '💰', kind: 'treasure', price: 150, stack: 1 },

  { id: 'flower-seed', name: '꽃씨', icon: '🌱', kind: 'seed', price: 10, stack: 10, buy: 40 },
  // 교배로만 피는 희귀색: 도감 '꽃' 칸에만 오른다(팔거나 줄 수 없다)
  { id: 'flower-sky', name: '하늘 꽃', icon: '🪻', kind: 'flower', price: 0, stack: 1 },
  { id: 'flower-rose', name: '자주 꽃', icon: '🌺', kind: 'flower', price: 0, stack: 1 },

  { id: 'recipe-card', name: '레시피 카드', icon: '📃', kind: 'treasure', price: 50, stack: 1 },
  { id: 'trip-ticket', name: '섬 여행 티켓', icon: '🎫', kind: 'ticket', price: 0, stack: 10 },
  // 해변에 떠밀려 온 유리병. 주우면 편지나 보물 지도 조각으로 바뀐다.
  { id: 'bottle', name: '유리병', icon: '🍾', kind: 'junk', price: 0, stack: 1 },
  // 우산: 주머니에 있으면 비를 막는다. 색은 셋.
  { id: 'umbrella-red', name: '빨간 우산', icon: '☂️', kind: 'material', price: 120, stack: 1, buy: 260 },
  { id: 'umbrella-blue', name: '파란 우산', icon: '☂️', kind: 'material', price: 120, stack: 1, buy: 260 },
  { id: 'umbrella-yellow', name: '노란 우산', icon: '☂️', kind: 'material', price: 120, stack: 1, buy: 260 },
  // 백화점 진열 가구. 놓을 수 있는 장식이라 가구 정의(놓기 모델 포함)로 둔다.
  // 등롱은 축제 가구 종이 등불(paper-lantern)과 같은 모습이지만 파는 물건이라 id 를 따로 쓴다.
  { id: 'basket', name: '대나무 바구니', icon: '🧺', kind: 'furniture', price: 45, stack: 1, buy: 90 },
  { id: 'wind-chime', name: '풍경', icon: '🎐', kind: 'furniture', price: 80, stack: 1, buy: 160 },
  // 벽에 거는 가구(core/wallHang.ts): 벽시계는 게임 시간을 가리킨다
  { id: 'wall-clock', name: '벽시계', icon: '🕰️', kind: 'furniture', price: 90, stack: 1, buy: 360 },
  { id: 'wall-shelf', name: '작은 벽 선반', icon: '🫙', kind: 'furniture', price: 50, stack: 1, buy: 200 },
  { id: 'lantern-hanging', name: '등롱', icon: '🏮', kind: 'furniture', price: 110, stack: 1, buy: 220 },
  { id: 'bonsai', name: '작은 분재', icon: '🌳', kind: 'furniture', price: 130, stack: 1, buy: 260 },
  // 도토리 ATM 마일리지 상품. 주머니에서 팔면 500 도토리(통장 입금은 없다).
  { id: 'acorn-coupon', name: '도토리 쿠폰', icon: '🎟️', kind: 'treasure', price: 500, stack: 10 },

  // 작업대에서 DIY 로 만드는 가구
  { id: 'log-stool', name: '통나무 의자', icon: '🥁', kind: 'furniture', price: 60, stack: 1 },
  { id: 'wooden-box', name: '나무 상자', icon: '📦', kind: 'furniture', price: 90, stack: 1 },
  { id: 'log-bench', name: '통나무 벤치', icon: '🛋️', kind: 'furniture', price: 120, stack: 1 },
  { id: 'stone-lantern', name: '돌 등불', icon: '🏮', kind: 'furniture', price: 150, stack: 1 },
  { id: 'iron-lamp', name: '철 가로등', icon: '💡', kind: 'furniture', price: 280, stack: 1 },
  { id: 'gold-acorn', name: '황금 도토리상', icon: '🏆', kind: 'furniture', price: 900, stack: 1 },
  // 섬 이야기 장 기념품: 정가가 없어서 상점·주문에는 나오지 않고, 장을 마친 위원회 편지로만 받는다
  { id: 'story-photo-frame', name: '첫날 사진 액자', icon: '🖼️', kind: 'furniture', price: 0, stack: 1 },
  { id: 'story-wreath', name: '이웃 환영 화환', icon: '💐', kind: 'furniture', price: 0, stack: 1 },
  { id: 'story-cake', name: '집들이 케이크 모형', icon: '🎂', kind: 'furniture', price: 0, stack: 1 },
  { id: 'story-garden', name: '꽃 정원 미니어처', icon: '🌸', kind: 'furniture', price: 0, stack: 1 },
  { id: 'story-trophy', name: '별점 트로피', icon: '🥇', kind: 'furniture', price: 0, stack: 1 },
  // 호박 등불 밤 행사 물건(core/pumpkin.ts). 사탕은 행사 주간 도토리 상점에서 판다.
  { id: 'candy', name: '호박 사탕', icon: '🍬', kind: 'material', price: CANDY_PRICE, stack: 20 },
  { id: 'pumpkin-lantern', name: '호박 등불', icon: '🎃', kind: 'furniture', price: 0, stack: 1 },
  { id: 'candy-basket', name: '사탕 바구니', icon: '🧺', kind: 'furniture', price: 0, stack: 1 },
  // 도토리 감사 장날 답례 가구(core/harvestFair.ts)
  { id: 'harvest-basket', name: '수확 바구니', icon: '🧺', kind: 'furniture', price: 0, stack: 1 },
  { id: 'acorn-garland', name: '도토리 화환', icon: '🌰', kind: 'furniture', price: 0, stack: 1 },
  // 첫눈 날 눈사람 완성 기념품(core/firstSnow.ts). 상점에는 없고 편지로만 받는다
  { id: 'first-snow-crystal', name: '첫눈 설화 장식', icon: '❄️', kind: 'furniture', price: 0, stack: 1 },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]))

export const SHOP_FURNITURE = ITEM_LIST.filter((d) => d.kind === 'furniture' && d.buy)
export const SHOP_SEEDS = ITEM_LIST.filter((d) => d.kind === 'seed' && d.buy)

/** 주머니에서 눌러 섬에 놓을 수 있는 종류 */
export const isPlaceable = (id: string) => ['furniture', 'seed'].includes(ITEMS[id]?.kind ?? '')

/** 불빛을 내는 가구. 밤에 주변을 밝힌다. */
/** 땅을 파서 나오는 화석 종. 도감과 전시관 화석 구역에 든다. */
export const FOSSIL_SPECIES = ['fossil', 'ammonite', 'trilobite', 'fern-fossil', 'dino-footprint', 'amber-bug']

export const GLOWING = new Set(['floor-lamp', 'lamp', 'campfire', 'stone-lantern', 'iron-lamp', 'paper-lantern', 'lantern-hanging', 'star-lamp', 'star-stand', 'acorn-lantern'])

export interface FishSpecies {
  id: string
  weight: number
  band: TimeBand
  /** 비 오는 날에만 나온다 */
  rain?: boolean
  /** 이 계절에만 나온다. 없으면 사계절 */
  seasons?: Season[]
  /** 물고기 그림자 크기 1(아주 작음)~5(아주 큼) */
  shadow?: number
  /** 사는 물. 없으면 바다 */
  habitat?: Habitat
}

export type Habitat = 'sea' | 'pond' | 'river'

export interface BugSpecies extends FishSpecies {
  /** 날개(몸) 색 */
  color: string
  glow?: boolean
  /** 날지 않고 땅을 기어 다닌다 */
  crawl?: boolean
}

export const FISH_TABLE: FishSpecies[] = [
  { id: 'horse-mackerel', weight: 5, band: 'any', shadow: 2 },
  { id: 'mackerel', weight: 4, band: 'any', shadow: 3 },
  { id: 'sea-bass', weight: 2, band: 'day', shadow: 4 },
  { id: 'pufferfish', weight: 2, band: 'night', shadow: 3 },
  { id: 'squid', weight: 2.5, band: 'night', shadow: 3 },
  { id: 'red-snapper', weight: 0.8, band: 'any', shadow: 4 },
  { id: 'empty-can', weight: 1.2, band: 'any', shadow: 2 },
  { id: 'hairtail', weight: 1.5, band: 'any', rain: true, shadow: 5 },
  { id: 'flounder', weight: 2, band: 'any', seasons: ['spring'], shadow: 3 },
  { id: 'yellowtail', weight: 1.5, band: 'any', seasons: ['winter'], shadow: 5 },
  { id: 'killifish', weight: 5, band: 'day', habitat: 'pond', shadow: 1 },
  { id: 'crucian-carp', weight: 5, band: 'any', habitat: 'pond', shadow: 2 },
  { id: 'carp', weight: 2, band: 'any', habitat: 'pond', shadow: 4 },
  { id: 'catfish', weight: 2, band: 'night', habitat: 'pond', shadow: 4 },
  { id: 'dace', weight: 5, band: 'any', habitat: 'river', shadow: 1 },
  { id: 'sweetfish', weight: 3, band: 'day', habitat: 'river', seasons: ['summer'], shadow: 2 },
  { id: 'cherry-trout', weight: 1.5, band: 'any', habitat: 'river', seasons: ['autumn', 'winter', 'spring'], shadow: 3 },
]

export const BUG_TABLE: BugSpecies[] = [
  { id: 'cabbage-white', weight: 5, band: 'day', color: '#fbfbf2' },
  { id: 'swallowtail', weight: 1.5, band: 'day', color: '#f4c542' },
  { id: 'honeybee', weight: 2.5, band: 'day', color: '#f0a020' },
  { id: 'ladybug', weight: 2.5, band: 'day', color: '#e2412f' },
  { id: 'firefly', weight: 4, band: 'night', color: '#d8ff7a', glow: true },
  { id: 'rhino-beetle', weight: 1.2, band: 'night', color: '#5b3a1e' },
  { id: 'snail', weight: 4, band: 'any', color: '#d9a066', rain: true, crawl: true },
  { id: 'cicada', weight: 4, band: 'day', color: '#6b8f5a', seasons: ['summer'] },
  { id: 'red-dragonfly', weight: 4, band: 'day', color: '#e2412f', seasons: ['autumn'] },
]

/** 바닷가 물웅덩이에 사는 생물. 섬 전체 벌레와 섞이지 않게 따로 둔다. 잠자리채로 잡는다. */
export const TIDE_TABLE: BugSpecies[] = [
  { id: 'tide-crab', weight: 4, band: 'any', color: '#e0623f', crawl: true },
  { id: 'tide-starfish', weight: 2, band: 'any', color: '#f0a33a', crawl: true },
]

export const SHELL_TABLE = [
  { id: 'conch', weight: 4 },
  { id: 'scallop', weight: 3 },
  { id: 'starfish', weight: 3 },
  { id: 'coral', weight: 1 },
]

const HABITAT_LABEL: Record<Habitat, string> = { sea: '바다', pond: '연못', river: '개울' }
const BAND_LABEL: Record<TimeBand, string | null> = { any: null, day: '낮', night: '밤' }
const SEASON_LABEL: Record<Season, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }

/**
 * 도감에 적는 찾는 법. "연못 · 밤 · 여름" 처럼 사는 곳(물고기), 시간, 계절, 비를 짧게 늘어놓는다.
 * 물고기·벌레가 아니면 null.
 */
export function dexHint(id: string): string | null {
  if (ITEMS[id]?.kind === 'flower') return '물 준 꽃 두 송이를 옆칸에 두면 밤에 가끔 피어요'
  if (ITEMS[id]?.kind === 'seafood') return '바다에서 거품을 찾아 잠수해서 잡아요'
  if (FOSSIL_SPECIES.includes(id)) return '땅을 파면 나와요'
  if (TIDE_TABLE.some((t) => t.id === id)) return '물웅덩이에서 잠자리채로 잡아요'
  const fish = FISH_TABLE.find((f) => f.id === id)
  const bug = BUG_TABLE.find((b) => b.id === id)
  const s = fish ?? bug
  if (!s) return null
  const parts: string[] = []
  if (fish) parts.push(HABITAT_LABEL[fish.habitat ?? 'sea'])
  const band = BAND_LABEL[s.band]
  if (band) parts.push(band)
  parts.push(s.seasons ? s.seasons.map((x) => SEASON_LABEL[x]).join('·') : '사계절')
  if (s.rain) parts.push('비 오는 날')
  return parts.join(' · ')
}

export function speciesFor<T extends { band: TimeBand; rain?: boolean; seasons?: Season[]; habitat?: Habitat }>(
  table: readonly T[],
  night: boolean,
  rain = false,
  season?: Season,
  habitat: Habitat = 'sea',
): T[] {
  const band = night ? 'night' : 'day'
  return table.filter(
    (s) =>
      (s.band === 'any' || s.band === band) &&
      (!s.rain || rain) &&
      (!s.seasons || (season && s.seasons.includes(season))) &&
      (s.habitat ?? 'sea') === habitat,
  )
}

export type ToolId = 'hand' | 'net' | 'rod' | 'shovel' | 'can' | 'axe' | 'ladder'

export const TOOLS: Record<ToolId, { name: string; icon: string; price: number; key: string }> = {
  hand: { name: '맨손', icon: '✋', price: 0, key: '1' },
  net: { name: '잠자리채', icon: '🥅', price: 150, key: '2' },
  rod: { name: '낚싯대', icon: '🎣', price: 150, key: '3' },
  shovel: { name: '삽', icon: '🪏', price: 200, key: '4' },
  can: { name: '물뿌리개', icon: '🚿', price: 150, key: '5' },
  axe: { name: '도끼', icon: '🪓', price: 250, key: '6' },
  // 절벽 앞에서 E 를 누르면 그 너머 평지로 오르내린다.
  ladder: { name: '사다리', icon: '🪜', price: 120, key: '7' },
}

export const TOOL_ORDER: ToolId[] = ['hand', 'net', 'rod', 'shovel', 'can', 'axe', 'ladder']

/** 재료 값을 아이콘과 수량으로 보여 준다. 예: 🪵6 🪨4 🔩1 */
export function costLabel(cost: Record<string, number>): string {
  return Object.entries(cost).map(([id, n]) => `${ITEMS[id].icon}${n}`).join(' ')
}

/** 받침 유무로 을/를·이/가 같은 조사를 고른다. */
export function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return word + without
  return word + (code % 28 === 0 ? without : withBatchim)
}
