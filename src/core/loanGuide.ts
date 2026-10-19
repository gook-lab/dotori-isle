/**
 * 대출 상환과 다음 집 맡기기를 잇는 문구. ATM 대출 탭의 축하 카드가 이 문구를 쓴다.
 * 빚이 0이 된 순간 다음 집이 있으면 그 이름을 알려 주고, 가장 큰 집이면 다음 집 얘기를 하지 않는다.
 */

import { homeDef, nextStage, type HomeStage } from './home'
import { josa } from './items'

/** 빚이 없을 때 한 줄. 텐트 단계는 원래 빚이 없고, 작은 집 이상에서 빚이 0 이면 다 갚은 것이다. */
export function loanClearedLine(stage: HomeStage): string {
  const nxt = nextStage(stage)
  if (stage === 0) return nxt ? `갚을 대출이 없어요. 집 상담에서 다음 집(${nxt.name})을 맡길 수 있어요 🏡` : '갚을 대출이 없어요.'
  if (!nxt) return '🎉 대출을 다 갚았어요! 가장 큰 집에서 편하게 지내요 🏡'
  return `🎉 대출을 다 갚았어요! 집 상담에서 다음 집(${nxt.name})을 맡길 수 있어요 🏡`
}

/** 빚이 남아 있을 때 한 줄. 다 갚으면 다음 집을 맡길 수 있는 단계일 때만 알려 주고, 가장 큰 집이면 null 이다. */
export function loanPayoffLine(stage: HomeStage): string | null {
  return nextStage(stage) ? '다 갚으면 다음 집을 맡길 수 있어요.' : null
}

/** 입력한 금액을 실제로 갚을 금액: 남은 대출과 가진 돈(지갑 또는 통장)을 넘지 않는다. 넘은 만큼은 조용히 줄지 않고 버튼에 보인다. */
export function payableNow(amount: number, loan: number, available: number): number {
  return Math.max(0, Math.min(amount, loan, available))
}

/**
 * 가장 큰 집에서 빚도 없을 때 집 상담 창 아래에 두는 계속할 거리 한 줄.
 * 다음 별은 점수 줄이 이미 보여 주므로 여기서는 섬 가꾸기 기부와 외관 칠하기를 고른다.
 */
export function homeTopLine(giftOpen: boolean): string {
  return giftOpen ? '섬 가꾸기에 마일을 기부해 보세요. 마을회관 접수대에서 해요' : '외관은 언제든 다시 칠할 수 있어요. 집 꾸미기 점수로 다음 별을 노려 봐요'
}

/**
 * 목표 줄 아래에 붙는 집 한 줄. 짓는 중이면 완성 날, 빚이 남았으면 갚는 곳, 다음 집이 있으면 맡기는 곳.
 * 텐트(빚 없음)는 "다 갚았어요" 없이 맡기는 곳만 알려 주고, 집 상담이 아직 잠겨 있으면 null 이다.
 * 할 일이 없으면 null.
 */
export function homeNextLine(stage: HomeStage, loan: number, order: { to: HomeStage } | null = null, homeOpen = true): string | null {
  if (order) return `${homeDef(order.to).name} 짓는 중이에요. 내일 아침 완성돼요`
  if (loan > 0) return '대출은 도토리 상점 안 ATM에서 갚아요'
  const nxt = nextStage(stage)
  if (stage === 0) return nxt && homeOpen ? `집 상담에서 ${josa(nxt.name, '을', '를')} 맡길 수 있어요` : null
  return nxt ? `다 갚았어요. 집 상담에서 ${josa(nxt.name, '을', '를')} 맡길 수 있어요` : null
}
