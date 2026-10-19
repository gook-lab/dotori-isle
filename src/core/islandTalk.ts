/**
 * 새로 생긴 섬 요소에 주민이 가끔 반응하는 한 줄. 해당 상태일 때만 화제 풀(chat.ts)에 들어간다.
 * 벽지·세트 완성·반짝이는 조약돌·가게 결산·계단·2차 시설. 성격마다 한 줄씩이라 같은 말을 되풀이하지 않는다.
 */

import type { Personality } from './chat'
import { josa } from './items'

export type IslandFlavor = 'wallpaper' | 'set' | 'pebble' | 'ledger' | 'stairs' | 'facility'

const LINES: Record<IslandFlavor, Record<Personality, string>> = {
  wallpaper: {
    cheery: '집 벽지 바꿨다며? 방이 훨씬 환해 보이더라!',
    shy: '…벽지 새로 했더라. 따뜻해 보여.',
    cool: '벽지 바꾼 거 봤어. 괜찮은 고르기네.',
    lazy: '벽지 새로 했대~ 방에서 뒹굴기 더 좋겠다~',
    sporty: '벽지 새로 했다고? 방이 확 달라 보이겠다!',
    grumpy: '흥, 벽지 바꿨더라. 나쁘진 않더라고.',
  },
  set: {
    cheery: '가구 세트 다 모았다며? 대단하다!',
    shy: '…세트 다 채웠대. 멋지더라.',
    cool: '가구 세트를 다 맞췄다니 꽤 하는데.',
    lazy: '세트 다 모았대~ 그거면 방에서 쉬기 딱이겠다~',
    sporty: '세트 완성! 다음엔 어떤 걸 모을 거야?',
    grumpy: '흥, 세트 다 맞췄다며. 인정은 해 줄게.',
  },
  pebble: {
    cheery: '비 그친 해변에서 반짝이는 조약돌 주웠어? 예쁘다!',
    shy: '…그 반짝이는 돌, 나도 한번 보고 싶어.',
    cool: '비 온 날 주운 그 돌, 값이 꽤 나가더라.',
    lazy: '비 그치고 주운 반짝이는 돌이래~ 팔아서 낮잠 값 해야지~',
    sporty: '비 온 뒤 해변에서 주웠구나! 나도 뛰어가서 찾아볼래!',
    grumpy: '흥, 반짝이는 돌 주웠다고? 좀 보여 줘 봐.',
  },
  ledger: {
    cheery: '가게 결산 편지 받았어? 이번 달 많이 팔았더라!',
    shy: '…가게 장부 정리됐대. 잘 팔았다던데.',
    cool: '결산 편지 봤어. 장사 꽤 하네.',
    lazy: '가게 결산이래~ 많이 팔았으면 낮잠 자도 되겠다~',
    sporty: '결산 나왔다! 이번 달 기록 한번 깨 보자!',
    grumpy: '흥, 결산 편지 봤어. 그럭저럭이더라.',
  },
  stairs: {
    cheery: '언덕에 계단이 놓였더라! 올라가기 훨씬 편해졌어!',
    shy: '…계단 생겨서 언덕 올라가기 쉬워졌어.',
    cool: '계단 생긴 덕에 언덕 길이 짧아졌더라.',
    lazy: '계단 생겨서 언덕 오르기 편해졌네~ 다행이다~',
    sporty: '계단이다! 언덕도 이제 전속력으로 뛰어오르자!',
    grumpy: '흥, 계단 놓은 건 잘했네. 계속 그렇게 해.',
  },
  facility: {
    cheery: '섬에 새 시설이 생겼다며? 산책하기 훨씬 좋아졌어!',
    shy: '…새 시설 들어왔더라. 섬이 한결 근사해진 것 같아.',
    cool: '섬에 시설이 하나 더 들어왔네. 짜임새가 있어.',
    lazy: '새 시설 생겼대~ 거기서 쉬면 딱 좋겠다~',
    sporty: '새 시설 들어왔다고? 섬 한 바퀴 뛰어서 돌아봐야겠다!',
    grumpy: '흥, 시설 들인 건 잘했네. 돈 쓴 값은 하더라.',
  },
}

/** 이 화제의 한 줄(성격별). */
export function islandTalkLine(flavor: IslandFlavor, personality: Personality): string {
  return LINES[flavor][personality]
}

/** 증축된 이웃 집 포치 얘기. 집 주인 이름을 받침에 맞게 붙인다. 성격마다 한 줄씩이다. */
const PORCH: Record<Personality, (name: string) => string> = {
  cheery: (n) => `${josa(n, '이', '가')} 집 현관에 차양을 달았더라! 비 와도 편하겠다!`,
  shy: (n) => `…${josa(n, '이', '가')} 현관에 차양을 달았대. 그늘이 생겨서 좋겠더라.`,
  cool: (n) => `${josa(n, '이', '가')} 집을 넓히고 현관에 차양까지 달았더라. 손을 꽤 댔네.`,
  lazy: (n) => `${josa(n, '이', '가')} 현관 차양 아래서 낮잠 자기 딱 좋대~ 부럽다~`,
  sporty: (n) => `${josa(n, '이', '가')} 집 현관에 차양을 달았다고? 나도 뛰어가서 구경해야지!`,
  grumpy: (n) => `흥, ${josa(n, '이', '가')} 집을 넓혔더라. 차양은 그럭저럭 쓸 만하던데.`,
}

/** 증축된 이웃 집 포치 얘기 한 줄(성격별). 집 주인 이름을 받는다. */
export function porchTalkLine(owner: string, personality: Personality): string {
  return PORCH[personality](owner)
}
