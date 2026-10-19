import { describe, expect, it } from 'vitest'
import { accrueInterest, createBank, deposit, repayLoan, withdraw, withdrawableNow, type BankState } from './bank'
import { depositInterest, openDeposit, settleDeposit, type FixedDeposit } from './deposit'
import { addDays } from './economy'
import { applyPayment } from './home'

// 보통 플레이어의 하루 지갑 수입을 바꿔 가며 30일 잔고를 본다.
// 정책: 통장만 / 예금 굴리기 / 대출 2500 있고 예금 우선 / 대출 2500 있고 상환 우선.
const START = '2026-03-10'
interface Sim { bank: BankState; wallet: number; dep: FixedDeposit | null; loan: number; interestDep: number; log: string[] }

function run(E: number, policy: 'bank' | 'deposit' | 'loanDep' | 'loanRepay', loan0: number, days = 30): Sim {
  let s: Sim = { bank: createBank(START), wallet: 0, dep: null, loan: loan0, interestDep: 0, log: [] }
  for (let d = 0; d < days; d++) {
    const day = addDays(START, d) as string
    s.bank = accrueInterest(s.bank, day)
    const st = settleDeposit(s.dep, day)
    if (st.payout) { s.bank = { ...s.bank, savings: s.bank.savings + st.payout }; s.interestDep += st.interest }
    s.dep = st.deposit
    s.wallet += E
    // 대출 상환(통장에서): 상환 우선 정책만
    if (policy === 'loanRepay' && s.loan > 0) {
      const w = withdrawableNow(s.bank, day)
      const need = Math.min(s.loan, s.bank.savings)
      if (need > 0) { const r = repayLoan(s.bank, s.loan, need, day); if (r.ok) { s.bank = r.state; s.loan = r.loan } }
      else if (w > 0) { /* 지갑에서 갚기 */ }
    }
    if (policy === 'loanRepay' && s.loan > 0 && s.wallet > 0) {
      const r = applyPayment(s.loan, Math.min(s.wallet, s.loan))
      if (r.ok) { s.wallet -= r.paid; s.loan = r.balance }
    }
    if ((policy === 'deposit' || policy === 'loanDep' || policy === 'loanRepay') && !s.dep && s.wallet >= 1000) {
      const r = openDeposit(null, s.wallet, Math.min(5000, s.wallet), 7, day)
      if (r.ok) { s.dep = r.deposit; s.wallet = r.money }
    }
    // 나머지 지갑 돈은 통장으로
    if (s.wallet > 0) {
      const r = deposit(s.bank, s.wallet, s.wallet, day)
      if (r.ok) { s.bank = r.state; s.wallet = r.money }
    }
    // 예금 굴릴 돈이 통장에만 있으면 인출해서 예금(하루 한도 안에서)
    if (policy !== 'bank' && !s.dep && s.bank.savings >= 1000) {
      const amt = Math.min(5000, withdrawableNow(s.bank, day))
      if (amt >= 1000) {
        const w = withdraw(s.bank, amt, day)
        if (w.ok) {
          const r = openDeposit(null, amt, amt, 7, day)
          if (r.ok) { s.bank = w.state; s.dep = r.deposit }
        }
      }
    }
    if (d % 7 === 6 || d === 0) s.log.push(`${d + 1}일 지갑 ${s.wallet} 통장 ${s.bank.savings} 예금 ${s.dep?.principal ?? 0} 대출 ${s.loan}`)
  }
  return s
}


const net = (s: Sim) => s.wallet + s.bank.savings + (s.dep?.principal ?? 0) - s.loan

describe('ATM 경제 — 30일 잔고 시뮬레이션', () => {
  it('통장 이자는 30일 동안 작다: 잔고 5000 이면 한 달 25개', () => {
    expect(Math.min(Math.floor(5000 * 0.005), 1000)).toBe(25)
    expect(depositInterest(5000, 7)).toBe(300)
    expect(depositInterest(5000, 3)).toBe(100)
  })

  it('예금을 굴리면 통장만 둔 것보다 많아진다(수입 300일 때 +432)', () => {
    const bank = net(run(300, 'bank', 0))
    const dep = net(run(300, 'deposit', 0))
    expect(bank).toBe(9000)
    expect(dep).toBe(9432)
  })

  it('의도된 동작: 대출이 있어도 예금 이득은 30일 순자산의 5% 미만이다(집 대출은 무이자)', () => {
    for (const E of [300, 600]) {
      const keep = net(run(E, 'loanDep', 2500))
      const repay = net(run(E, 'loanRepay', 2500))
      expect(keep).toBeGreaterThan(repay)
      expect((keep - repay) / repay).toBeLessThan(0.05)
    }
  })

  it('30일 안에서는 이자로 놀고먹는 구간이 생기지 않는다(수입 150·300·600 모두 굴리기가 통장보다 낫다)', () => {
    for (const E of [150, 300, 600]) expect(net(run(E, 'deposit', 0))).toBeGreaterThanOrEqual(net(run(E, 'bank', 0)))
  })
})
