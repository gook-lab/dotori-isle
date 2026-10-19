import { currentHour } from '../core/clock'
import { SONGI_BUNDLE, SONGI_BUNDLE_PRICE, SONGI_FROM, SONGI_TO, songiBundlesLeft, songiOpen, songiQuote, songiWeekOf, songiWeekQuotes } from '../core/songi'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 일요일 아침에 떠돌이 상인이 와서 송이를 묶음으로 판다. 그 주 시세표도 함께 보여 준다. */
export function SongiPanel() {
  const day = useGame((s) => s.day)
  const money = useGame((s) => s.money)
  const buy = useGame((s) => s.songiBuy)
  const buySongi = useGame((s) => s.buySongi)
  const hour = currentHour()
  const week = songiWeekOf(day)
  if (week === null) return null
  const sunday = new Date(`${day}T00:00:00Z`).getUTCDay() === 0
  const open = songiOpen(day, hour)
  const left = songiBundlesLeft(buy ?? null, week)
  const am = songiQuote(day, true)
  const pm = songiQuote(day, false)
  // 시세표는 월요일 오전부터 토요일 오후까지 열두 칸
  const table = songiWeekQuotes(week)
  const names = ['월', '화', '수', '목', '금', '토']
  return (
    <Modal title="송이 상인">
      {sunday && !open && <p className="note">송이 상인은 일요일 아침 {SONGI_FROM}시부터 {SONGI_TO}시까지만 있어요.</p>}
      {!sunday && <p className="note">송이는 일요일 아침에만 사요. 월~토에는 상점에서 시세대로 팔아요.</p>}
      {sunday && open && (
        <div className="songi-buy">
          <p className="note">
            송이버섯 {SONGI_BUNDLE}개 한 묶음에 도토리 {SONGI_BUNDLE_PRICE.toLocaleString()}개. 이번 주 남은 묶음 {left}개예요. 다음 일요일이 되면 남은 송이는 상해요.
          </p>
          <button className="primary" disabled={left < 1 || money < SONGI_BUNDLE_PRICE} onClick={() => buySongi(1)}>
            한 묶음 사기 · 🌰 {SONGI_BUNDLE_PRICE.toLocaleString()}
          </button>
        </div>
      )}
      <p className="note">{am === null || pm === null ? '일요일에는 시세가 없어요' : `오늘 시세 · 오전 🌰 ${am} · 오후 🌰 ${pm}`}</p>
      <ul className="songi-table" aria-label="이번 주 송이 시세">
        {names.map((name, d) => (
          <li key={name}>
            <span>{name}</span>
            <span>오전 🌰 {table[d * 2]}</span>
            <span>오후 🌰 {table[d * 2 + 1]}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
