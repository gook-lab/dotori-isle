import { ITEMS, josa } from './items'

/** 잡았을 때 주인공이 외치는 한마디. 말장난 반, 감탄 반. */
const QUIPS: Record<string, string> = {
  'horse-mackerel': '전갱이 잡았다! 전에 갱신한 기록보다 크다!',
  mackerel: '고등어 잡았다! 등이 파랗게 반짝반짝!',
  'sea-bass': '농어 잡았다! 농담 아니고 진짜야!',
  pufferfish: '복어 잡았다! 복 들어오는 소리~',
  squid: '오징어 잡았다! 다리가 몇 개더라… 아무튼 많다!',
  'red-snapper': '참돔 잡았다! 참 좋은 날이야!',
  'empty-can': '빈 깡통… 그래도 바다가 깨끗해졌어!',
  hairtail: '갈치 잡았다! 비 오는 날의 은빛 선물!',
  flounder: '도다리 잡았다! 봄바람 타고 왔구나!',
  yellowtail: '방어 잡았다! 방어력이 올라가는 기분!',
  killifish: '송사리 잡았다! 작아도 눈이 반짝반짝!',
  'crucian-carp': '붕어 잡았다! 붕어빵 먹고 싶어진다!',
  carp: '잉어 잡았다! 비단처럼 반짝이는 비늘!',
  catfish: '메기 잡았다! 수염이 근사하다!',
  dace: '피라미 잡았다! 개울에서 쌩쌩 달리던 녀석!',
  sweetfish: '은어 잡았다! 수박 향이 난다더니 진짜네?',
  'cherry-trout': '산천어 잡았다! 맑은 물에만 산다지!',
  'cabbage-white': '배추흰나비 잡았다! 하늘하늘 귀여워!',
  swallowtail: '호랑나비 잡았다! 호랑이처럼 줄무늬가 멋져!',
  honeybee: '꿀벌 잡았다! 꿀은… 안 주는구나.',
  ladybug: '무당벌레 잡았다! 점이 몇 개인지 세어 볼까?',
  firefly: '반딧불이 잡았다! 손 안이 반짝반짝해!',
  'rhino-beetle': '장수풍뎅이 잡았다! 뿔이 늠름해!',
  snail: '달팽이 잡았다! 천천히 가도 괜찮아.',
  cicada: '참매미 잡았다! 맴맴, 여름이다!',
  'red-dragonfly': '고추잠자리 잡았다! 가을이 빨갛게 익었네!',
}

export function catchQuip(itemId: string): string {
  const def = ITEMS[itemId]
  return QUIPS[itemId] ?? `${josa(def?.name ?? '무언가', '을', '를')} 잡았다!`
}
