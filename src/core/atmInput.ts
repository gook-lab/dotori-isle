/**
 * ATM 금액 입력의 버튼 문구와 켜짐 상태. 입출금·대출 갚기 버튼이 지금 상황에서 할 수 있는 일을 한 줄로 말한다.
 * 금액과 잔액만 보는 순수 함수다. 실제 규칙은 store 의 action(bank·loan)이 다시 확인한다.
 */

export interface ButtonState {
  ok: boolean
  label: string
}

/** 넣기 버튼: 지갑이 비었거나 금액이 지갑·통장 한도를 넘으면 막는다. */
export function depositState(amount: number, money: number, room: number): ButtonState {
  if (money < 1) return { ok: false, label: '지갑이 비어 있어요' }
  if (amount < 1) return { ok: false, label: '넣을 금액 고르기' }
  if (amount > money) return { ok: false, label: '가진 도토리보다 많아요' }
  if (amount > room) {
    return { ok: false, label: room < 1 ? '통장 한도가 꽉 찼어요' : `통장에는 ${room.toLocaleString()}개까지 넣을 수 있어요` }
  }
  return { ok: true, label: `${amount.toLocaleString()} 넣기` }
}

/** 빼기 버튼: 통장이 비었거나 오늘 한도를 다 썼거나 금액이 오늘 뺄 수 있는 양을 넘으면 막는다. */
export function withdrawState(amount: number, out: number, savings: number, left: number): ButtonState {
  if (savings < 1) return { ok: false, label: '통장이 비어 있어요' }
  if (left < 1) return { ok: false, label: '오늘은 다 뺐어요' }
  if (amount < 1) return { ok: false, label: '뺄 금액 고르기' }
  if (amount > out) return { ok: false, label: `${out.toLocaleString()}개까지만 뺄 수 있어요` }
  return { ok: true, label: `${amount.toLocaleString()} 빼기` }
}

/**
 * 대출 갚기 버튼 문구. pay 는 실제로 갚을 수 있는 양(잔액·대출 안에서 줄인 값), have 는 그 출처가 가진 돈이다.
 * 금액을 아직 안 골랐어도 출처가 비었으면 "돈이 없어요"를 먼저 말한다.
 */
export function repayLabel(pay: number, amount: number, loan: number, src: string, have: number): string {
  if (amount < 1) return have < 1 ? `${src} 돈이 없어요` : `${src}에서 갚을 금액 고르기`
  if (pay < 1) return `${src} 돈이 없어요`
  if (pay === amount) return `${pay.toLocaleString()} 갚기`
  return `${pay.toLocaleString()} 갚기 · ${pay === loan ? '남은 대출 전부' : `${src} 전부`}`
}
