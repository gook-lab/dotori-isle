import { useEffect, useMemo, useState } from 'react'
import { currentHour } from '../core/clock'
import { eventsOn, monthCells, shiftMonth, tomorrowAlert, yearMonthOf, type CalendarCtx, type CalendarEvent } from '../core/calendar'
import { weatherFor } from '../core/weather'
import { VILLAGERS } from '../core/villagers'
import { useGame } from '../game/store'
import { Modal } from './Panels'

export const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 달력(월간·휴대폰 앱)이 같이 쓰는 날씨·주민·이사 정보. 화면마다 따로 만들지 않는다. */
export function useCalendarCtx(): CalendarCtx {
  const today = useGame((s) => s.day)
  const moveTalk = useGame((s) => s.moveTalk)
  const arrivals = useGame((s) => s.arrivals)
  const outLetters = useGame((s) => s.outLetters)
  return useMemo(
    () => ({
      today,
      weatherOn: weatherFor,
      villagers: VILLAGERS,
      moveTalk,
      arrivals,
      outLetters,
      nameOf: (id: string) => VILLAGERS.find((v) => v.id === id)?.name ?? '주민',
    }),
    [today, moveTalk, arrivals, outLetters],
  )
}

/** 내일 행사 점 배지: 저녁 18시 이후 내일 행사가 있고, 오늘 달력 앱을 아직 안 열었을 때만 첫 행사 이름을 준다. 15초마다 시각을 다시 읽는다. */
export function useTomorrowAlert(): { name: string; count: number } | null {
  const ctx = useCalendarCtx()
  const opened = useGame((s) => s.calendarOpenedDay)
  const [hour, setHour] = useState(() => currentHour())
  useEffect(() => {
    const id = setInterval(() => setHour(currentHour()), 15_000)
    return () => clearInterval(id)
  }, [])
  return useMemo(() => (opened === ctx.today ? null : tomorrowAlert(ctx.today, hour, ctx)), [opened, ctx, hour])
}

/** 시즌 이벤트 달력: 한 달을 7열로 보여 주고, 칸을 누르면 그날 일정을 아래에 한 줄씩 보여 준다. */
export function CalendarPanel() {
  const ctx = useCalendarCtx()
  const today = ctx.today
  const [ym, setYm] = useState(() => yearMonthOf(today))
  const [sel, setSel] = useState<string>(today)
  const cells = useMemo(() => monthCells(ym.year, ym.month), [ym])
  const selEvents: CalendarEvent[] = sel ? eventsOn(sel, ctx) : []
  const move = (step: number) => setYm((cur) => shiftMonth(cur.year, cur.month, step))
  return (
    <Modal title="시즌 달력" tall>
      <div className="cal-head">
        <button aria-label="이전 달" onClick={() => move(-1)}>
          ‹
        </button>
        <b>
          {ym.year}년 {ym.month}월
        </b>
        <button aria-label="다음 달" onClick={() => move(1)}>
          ›
        </button>
      </div>
      <div className="cal-grid cal-week" aria-hidden>
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid" aria-label={`${ym.month}월 달력`}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="cal-cell empty" aria-hidden />
          // 칸에는 아이콘 최대 2개만 두고, 나머지는 +N 으로 줄인다. 생일은 항상 🎂 로 통일한다.
          const icons = [...new Set(eventsOn(d, ctx).map((e) => e.icon))]
          const past = d < today
          const cls = ['cal-cell', d === today ? 'today' : '', d === sel ? 'sel' : '', past ? 'past' : ''].filter(Boolean).join(' ')
          return (
            <button key={d} className={cls} aria-pressed={d === sel} aria-label={`${Number(d.slice(8))}일`} onClick={() => setSel(d)}>
              <span className="cal-num">{Number(d.slice(8))}</span>
              <span className="cal-icons">
                {icons.slice(0, 2).join('')}
                {icons.length > 2 ? `+${icons.length - 2}` : ''}
              </span>
            </button>
          )
        })}
      </div>
      <h3 className="cal-day-title">{sel === today ? `오늘 (${Number(sel.slice(8))}일)` : `${Number(sel.slice(5, 7))}월 ${Number(sel.slice(8))}일`}</h3>
      {selEvents.length === 0 ? (
        <p className="note">아무 일도 없어요</p>
      ) : (
        <ul className="cal-list">
          {selEvents.map((e, i) => (
            <li key={`${e.kind}${i}`}>
              <span aria-hidden>{e.icon}</span> {e.label}
            </li>
          ))}
        </ul>
      )}
      <p className="note">✨ 별똥별은 맑은 날 밤에 올 수 있어요. 정확한 밤은 그날 저녁에 알 수 있어요.</p>
    </Modal>
  )
}
