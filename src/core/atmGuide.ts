/**
 * ATM 창의 기본 탭과 마일리지 안내 한 줄. 처음 어디부터 볼지는 첫 열기 토스트(firstHints)가 한 번 말한다.
 * 탭은 잠기지 않으니 잠금 문구는 두지 않는다(ATM 자체는 퀘스트로 열린다).
 */

export type AtmTab = 'io' | 'loan' | 'miles' | 'deposit'

/** 열 때 기본 탭: 빚이 있으면 대출 갚기, 그 밖에는 입출금이다. */
export function atmDefaultTab(loan: number): AtmTab {
  return loan > 0 ? 'loan' : 'io'
}

/** 마일리지 탭의 쌓이는 곳 한 줄. 업적·오늘의 할 일·주간 목표가 마일을 준다. */
export const ATM_MILES_SOURCE = '업적·오늘의 할 일·주간 목표로 마일이 쌓여요'
