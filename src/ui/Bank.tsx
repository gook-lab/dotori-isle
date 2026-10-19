import { useState } from 'react'
import { accrueInterest, ATM_PRODUCTS, couponsLeft, INTEREST_PERIOD_DAYS, INTEREST_RATE, interestCap, nextInterest, perkCount, savingsCap, withdrawableNow, withdrawLimit } from '../core/bank'
import { DEPOSIT_MAX, DEPOSIT_TERMS, depositInterest } from '../core/deposit'
import { dayDiff } from '../core/economy'
import { loanClearedLine, loanPayoffLine, payableNow } from '../core/loanGuide'
import { ATM_MILES_SOURCE, atmDefaultTab, type AtmTab } from '../core/atmGuide'
import { formatMiles } from '../core/miles'
import { depositState, repayLabel, withdrawState } from '../core/atmInput'
import { CountUp } from './countUp'
import { EMPTY_LOAN_HISTORY, type LoanHistory } from '../core/loanHistory'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 입력칸의 숫자. 비었거나 잘못된 값은 0 이고, 0 은 store 가 "금액은 1 이상" 안내로 되돌린다. */
const amountOf = (v: string) => Math.floor(Number(v.replace(/,/g, '')) || 0)

/** 입력칸에는 숫자만 두고, 보여 줄 때만 천 단위 쉼표를 찍는다. */
const withCommas = (digits: string) => (digits ? Number(digits).toLocaleString() : '')

/** 금액 입력과 빠른 칩. 칩은 입력칸만 채우고(0 이면 비운다), 실제 실행은 버튼이 한다.
 * Enter 는 버튼이 하나로 정해지는 곳(대출 갚기)에서만 받는다. 넣기·빼기는 같은 칸을 같이 써서 Enter 로 고르지 않는다. */
function AmountRow({ value, onChange, chips, onEnter }: { value: string; onChange: (v: string) => void; chips: { label: string; value: number }[]; onEnter?: () => void }) {
  return (
    <div className="amount">
      <input inputMode="numeric" placeholder="금액" value={withCommas(value)} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }} aria-label="금액" />
      <div className="chips">
        {chips.map((c) => (
          <button key={c.label} className="chip" disabled={c.value < 1} onClick={() => onChange(String(c.value))}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 입출금: 통장 잔고와 하루 인출 한도를 보여 주고, 넣기·빼기를 한다. */
function IoTab() {
  const money = useGame((s) => s.money)
  const bankRaw = useGame((s) => s.bank)
  const day = useGame((s) => s.day)
  const deposit = useGame((s) => s.bankDeposit)
  const withdraw = useGame((s) => s.bankWithdraw)
  const [raw, setRaw] = useState('')
  // 이자는 열 때 계산해서 보여 준다. 실제로 붙는 건 날짜가 넘어갈 때 syncClock 이 맞춘다.
  const bank = accrueInterest(bankRaw, day)
  const nxt = nextInterest(bankRaw, day)
  const cap = savingsCap(bank)
  const used = bank.withdrawnDay === day ? bank.withdrawnToday : 0
  const left = Math.max(0, withdrawLimit(bank) - used)
  // 실제로 뺄 수 있는 돈은 잔고와 오늘 한도 중 작은 쪽이다
  const out = withdrawableNow(bank, day)
  const amount = amountOf(raw)
  // 넣기는 지갑과 통장 한도, 빼기는 잔고와 오늘 남은 한도 안에서만 켜진다
  const depositBtn = depositState(amount, money, Math.max(0, cap - bank.savings))
  const withdrawBtn = withdrawState(amount, out, bank.savings, left)
  return (
    <>
      <ul className="stat-rows">
        <li>
          <span>통장 잔고</span>
          <strong>🌰 <CountUp value={bank.savings} /></strong>
        </li>
        <li>
          <span>통장 한도</span>
          <strong>🌰 {cap.toLocaleString()}</strong>
        </li>
        <li>
          <span>오늘 뺄 수 있는 돈</span>
          <strong>🌰 {out.toLocaleString()}</strong>
        </li>
      </ul>
      <p className="note">
        {INTEREST_PERIOD_DAYS}일마다 {(INTEREST_RATE * 100).toFixed(1)}%가 붙어요 (한 번에 최대 {interestCap(bank).toLocaleString()}개). 인출은 하루 한도가 있어요.
      </p>
      <p className="note">
        다음 이자 {nxt?.days ?? INTEREST_PERIOD_DAYS}일 뒤 · {nxt && nxt.amount > 0 ? `약 도토리 ${nxt.amount.toLocaleString()}개` : '지금은 붙을 이자가 없어요'}
      </p>
      <AmountRow
        value={raw}
        onChange={setRaw}
        chips={[
          { label: '1,000', value: 1000 },
          { label: '지갑 전부', value: Math.min(money, Math.max(0, cap - bank.savings)) },
          { label: '오늘 최대', value: out },
        ]}
      />
      <footer className="two">
        <button className="primary" disabled={!depositBtn.ok} onClick={() => runAmount(deposit, amount, () => setRaw(''))}>
          {depositBtn.label}
        </button>
        <button className="primary" disabled={!withdrawBtn.ok} onClick={() => runAmount(withdraw, amount, () => setRaw(''))}>
          {withdrawBtn.label}
        </button>
      </footer>
    </>
  )
}

/** 넣기·빼기·갚기 한 번. 실제로 상태가 바뀌었을 때만 입력칸을 비운다(실패하면 입력을 그대로 둔다). */
function runAmount(act: (n: number) => void, n: number, clear: () => void) {
  const before = useGame.getState()
  act(n)
  const after = useGame.getState()
  if (after.money !== before.money || after.bank !== before.bank || after.home !== before.home) clear()
}

/** 대출 갚기: 주머니 도토리나 통장 잔고로 집 빚을 갚는다. */
/** 대출 상환 기록: 지금까지 갚은 금액 / 총 대출, 최근 상환 3건(날짜·금액·낸 곳) */
function LoanHistoryBlock({ history }: { history: LoanHistory }) {
  if (history.borrowed === 0) return null
  return (
    <div className="loan-history" aria-label="대출 상환 기록">
      <p>
        지금까지 갚은 금액 <strong>🌰 {history.paid.toLocaleString()}</strong> / 총 대출 <strong>🌰 {history.borrowed.toLocaleString()}</strong>
      </p>
      {history.recent.length === 0 && <p className="note">이전 상환 기록은 없어요</p>}
      {history.recent.length > 0 && (
        <ul className="stat-rows">
          {history.recent.map((p, i) => (
            <li key={`${p.day}-${i}`}>
              <span>{p.day.slice(5)} · {p.from === 'pocket' ? '지갑' : '통장'}에서</span>
              <strong>🌰 {p.amount.toLocaleString()}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LoanTab() {
  const loan = useGame((s) => s.home.loan)
  const history = useGame((s) => s.loanHistory ?? EMPTY_LOAN_HISTORY)
  const stage = useGame((s) => s.home.stage)
  const money = useGame((s) => s.money)
  const savings = useGame((s) => s.bank.savings)
  const day = useGame((s) => s.day)
  const bankRaw = useGame((s) => s.bank)
  const fromPocket = useGame((s) => s.repayFromPocket)
  const fromSavings = useGame((s) => s.repayFromSavings)
  const [raw, setRaw] = useState('')
  const pending = accrueInterest(bankRaw, day).savings
  const amount = amountOf(raw)
  // 입력은 남은 대출과 가진 돈 안에서만 갚는다. 넘친 만큼은 조용히 줄지 않고 버튼 문구에 실제 금액으로 보인다.
  const pocketPay = payableNow(amount, loan, money)
  const savingsPay = payableNow(amount, loan, savings)
  const payLabel = (pay: number, src: string, have: number) => repayLabel(pay, amount, loan, src, have)
  const payoff = loanPayoffLine(stage)
  // 텐트 단계는 갚을 빚이 처음부터 없다. 다 갚은 뒤에는 축하 카드로 바뀐다(창은 닫히지 않는다).
  if (loan === 0 && stage === 0) return <><p className="empty">{loanClearedLine(stage)}</p><LoanHistoryBlock history={history} /></>
  if (loan === 0) return <><div className="home-block atm-cleared" role="status"><p>{loanClearedLine(stage)}</p></div><LoanHistoryBlock history={history} /></>
  return (
    <>
      <ul className="stat-rows">
        <li>
          <span>남은 대출</span>
          <strong>🌰 <CountUp value={loan} /></strong>
        </li>
        <li>
          <span>지갑</span>
          <strong>🌰 <CountUp value={money} /></strong>
        </li>
        <li>
          <span>통장</span>
          <strong>🌰 <CountUp value={pending} /></strong>
        </li>
      </ul>
      {payoff && <p className="note">{payoff}</p>}
      <LoanHistoryBlock history={history} />
      <AmountRow
        value={raw}
        onChange={setRaw}
        chips={[{ label: '전부', value: loan }]}
        onEnter={() => { if (pocketPay >= 1) runAmount(fromPocket, pocketPay, () => setRaw('')) }}
      />
      <footer className="two">
        <button className="primary" disabled={pocketPay < 1} onClick={() => runAmount(fromPocket, pocketPay, () => setRaw(''))}>
          {payLabel(pocketPay, '지갑', money)}
        </button>
        <button className="primary" disabled={savingsPay < 1} onClick={() => runAmount(fromSavings, savingsPay, () => setRaw(''))}>
          {payLabel(savingsPay, '통장', savings)}
        </button>
      </footer>
    </>
  )
}

/** 마일리지 상품: 도토리 쿠폰과 ATM 한도 늘리기 */
function MilesTab() {
  const miles = useGame((s) => s.miles)
  const bank = useGame((s) => s.bank)
  const day = useGame((s) => s.day)
  const buy = useGame((s) => s.buyAtm)
  const left = couponsLeft(bank, day)
  return (
    <>
      <p className="note">{ATM_MILES_SOURCE} → 쿠폰으로 바꿔 도토리 상점에 팔 수 있어요</p>
      <div className="miles-balance">
        🏅 <strong>{formatMiles(miles)}</strong>
      </div>
      <ul className="buy-list">
        {ATM_PRODUCTS.map((p) => {
          const done = p.id === 'savings-cap' ? bank.capUpgrades : p.id === 'withdraw-limit' ? bank.limitUpgrades : perkCount(bank, p.id)
          const maxed = p.max !== null && done >= p.max
          const short = miles < p.cost
          // 쿠폰 상품은 하루 장 수 상한을 함께 본다(묶음이 남은 장 수보다 많으면 못 산다)
          const coupons = p.id === 'coupon' ? 1 : p.grant?.itemId === 'acorn-coupon' ? p.grant.count : 0
          const capped = coupons > left
          return (
            <li key={p.id}>
              <span className="big">{p.icon}</span>
              <span className="name">
                {p.name}
                <small className="note">
                  {p.note}
                  {p.max !== null && ` · ${done}/${p.max}`}
                  {coupons > 0 && ` · 오늘 ${left}장 남았어요`}
                </small>
              </span>
              <button className="primary" disabled={maxed || short || capped} onClick={() => buy(p.id)}>
                {maxed ? '최대예요' : short ? `${formatMiles(p.cost)} 필요해요` : capped ? (left === 0 ? <>내일 다시<br />살 수 있어요</> : `오늘 ${left}장만 남았어요`) : formatMiles(p.cost)}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="note">
        통장 한도 {savingsCap(bank).toLocaleString()} · 하루 인출 {withdrawLimit(bank).toLocaleString()}
      </p>
    </>
  )
}

/** 정기 예금: 한 건만 맡는다. 맡긴 건이 있으면 현황과 중도 해지, 없으면 기간과 금액을 고른다. */
function DepositTab() {
  const money = useGame((s) => s.money)
  const dep = useGame((s) => s.deposit)
  const day = useGame((s) => s.day)
  const open = useGame((s) => s.depositOpen)
  const brk = useGame((s) => s.depositBreak)
  const [raw, setRaw] = useState('')
  const [days, setDays] = useState(DEPOSIT_TERMS[0].days)
  if (dep) {
    const left = Math.max(0, dayDiff(day, dep.due) ?? 0)
    return (
      <>
        <ul className="stat-rows">
          <li>
            <span>맡긴 돈</span>
            <strong>🌰 {dep.principal.toLocaleString()}</strong>
          </li>
          <li>
            <span>만기 때 받을 이자</span>
            <strong>🌰 {depositInterest(dep.principal, dep.days).toLocaleString()}</strong>
          </li>
          <li>
            <span>만기</span>
            <strong>
              {dep.due.slice(5, 7)}월 {dep.due.slice(8)}일 아침 · {left === 0 ? '오늘' : `${left}일 남음`}
            </strong>
          </li>
        </ul>
        <p className="note">만기 날 아침에 원금과 이자가 통장에 들어가요. 통장에 들어간 돈은 입출금 탭에서 빼면 지갑으로 와요. 중도에 해지하면 원금만 통장으로 돌아와요.</p>
        <button className="primary deposit-action" onClick={() => brk()}>
          중도 해지 · 원금 도토리 {dep.principal.toLocaleString()}개만 통장으로
        </button>
      </>
    )
  }
  const amount = amountOf(raw)
  const term = DEPOSIT_TERMS.find((t) => t.days === days) ?? DEPOSIT_TERMS[0]
  const tooMuch = amount > DEPOSIT_MAX
  const short = amount > money
  const ok = amount >= 1 && !tooMuch && !short
  return (
    <div className="deposit-form">
      <p className="note">한 번에 한 건만 맡길 수 있어요. 맡기는 순간 지갑에서 빠지고, 만기 날 아침에 통장으로 들어와요.</p>
      <div className="deposit-terms" role="group" aria-label="예금 기간">
        {DEPOSIT_TERMS.map((t) => (
          <button key={t.days} className="deposit-term" aria-pressed={days === t.days} onClick={() => setDays(t.days)}>
            <strong>{t.days}일</strong>
            <small>이자 {Math.round(t.rate * 100)}% · 이자는 {t.cap.toLocaleString()}까지</small>
          </button>
        ))}
      </div>
      <AmountRow value={raw} onChange={setRaw} chips={[{ label: '500', value: 500 }, { label: '1,000', value: 1000 }, { label: '최대', value: DEPOSIT_MAX }]} />
      <p className="note">
        {tooMuch
          ? `예금은 한 번에 도토리 ${DEPOSIT_MAX.toLocaleString()}개까지 맡길 수 있어요`
          : short
            ? '가진 도토리보다 많아요'
            : amount >= 1
              ? `맡기면 만기 때 도토리 ${(amount + depositInterest(amount, term.days)).toLocaleString()}개를 받아요 (이자 ${depositInterest(amount, term.days).toLocaleString()}개)`
              : `지갑에 도토리 ${money.toLocaleString()}개 있어요`}
      </p>
      <button className="primary deposit-action" disabled={!ok} onClick={() => open(amount, days)}>
        {term.days}일 예금 맡기기
      </button>
    </div>
  )
}

export function AtmPanel() {
  const loan = useGame((s) => s.home.loan)
  const [tab, setTab] = useState<AtmTab>(() => atmDefaultTab(loan))
  const money = useGame((s) => s.money)
  const miles = useGame((s) => s.miles)
  return (
    <Modal title="도토리 ATM" tall>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'io'} onClick={() => setTab('io')}>
          입출금
        </button>
        <button role="tab" aria-selected={tab === 'loan'} onClick={() => setTab('loan')}>
          대출 갚기
        </button>
        <button role="tab" aria-selected={tab === 'miles'} onClick={() => setTab('miles')}>
          마일리지 상품
        </button>
        <button role="tab" aria-selected={tab === 'deposit'} onClick={() => setTab('deposit')}>
          정기 예금
        </button>
        <span className="wallet">
          지갑 🌰 {money.toLocaleString()} · 🏅 {formatMiles(miles)}
        </span>
      </div>
      <div className="tab-body">{tab === 'io' ? <IoTab /> : tab === 'loan' ? <LoanTab /> : tab === 'miles' ? <MilesTab /> : <DepositTab />}</div>
    </Modal>
  )
}
