import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { currentHour, timeLabel } from '../core/clock'
import { TOOL_ORDER } from '../core/items'
import { phoneApps, type PhoneTarget } from '../core/phone'
import { ctxOf, devUnlocked, SYSTEMS, systemOpen } from '../core/unlocks'
import { weatherFor, WEATHER_INFO } from '../core/weather'
import { lifeRows, weekLedger, type LedgerSlot, type LifeRow } from '../core/life'
import { frameFloor, frameHung, scoreHome, starsOf } from '../core/homeScore'
import { decodeGarden, gardenStats } from '../core/gardenTiles'
import { HOME_SITE } from '../core/home'
import { addDays } from '../core/economy'
import { weekdayOf } from '../core/market'
import { tomorrowLine, upcomingEvents } from '../core/calendar'
import { useCalendarCtx, useTomorrowAlert, WEEK } from './Calendar'
import { weeklyLeft, weeklyOpen } from '../core/weekly'
import { questBoard, useGame } from '../game/store'
import { isTouchDevice } from './device'

const FOCUSABLE = 'button:not([disabled])'
/** 아이콘을 누른 뒤 패널이 열리기까지의 짧은 눌림 연출 시간 */
const PRESS_MS = 100

/** 앱을 누르면 기존 패널을 그대로 연다. 사진은 사진 모드를, 옷장은 옷장을 연다. */
function runApp(id: PhoneTarget) {
  const s = useGame.getState()
  // 단축키·알림은 휴대폰 안 화면이라 여기로 오지 않는다
  if (id === 'help' || id === 'notices' || id === 'life' || id === 'calendar') return
  if (id === 'photo') {
    s.openPanel(null)
    return s.setPhoto(true)
  }
  if (id === 'album') return s.setAlbumOpen(true)
  if (id === 'closet') return s.openCloset(false)
  s.openPanel(id)
}

/** 섬 살림 줄을 누르면 가는 곳. 상점과 ATM 은 도토리 상점 안이라 토스트로 안내한다. */
function openLife(row: LifeRow) {
  const s = useGame.getState()
  if (row.target === 'shop') return s.notify('🏪 도토리 상점은 섬 안에 있어요. 상점 문 앞에서 E 를 눌러요')
  if (row.target === 'atm') return s.notify('🏧 도토리 상점 안 ATM 에서 볼 수 있어요')
  if (row.target === 'home') return s.openPanel('home')
  return s.openPanel('quest')
}

/** 키 목록. 예전 하단 도움말 줄과 같은 내용을 한곳에 모은다. */
function shortcutRows(): { keys: string; what: string }[] {
  return [
    { keys: 'WASD · 방향키', what: '걸어요' },
    { keys: 'Shift', what: '달려요' },
    { keys: 'E · Space', what: '행동해요(줍기·대화·흔들기)' },
    { keys: `1~${TOOL_ORDER.length}`, what: '도구를 바로 골라요' },
    { keys: 'Q', what: '도구를 차례로 바꿔요' },
    { keys: 'R', what: '가구를 돌리고 집어요' },
    { keys: 'I', what: '주머니' },
    { keys: 'Tab', what: '도감' },
    { keys: 'J', what: '미션' },
    { keys: 'M', what: '마일리지' },
    { keys: 'C', what: '옷장' },
    { keys: 'P', what: '사진 모드' },
    { keys: '`', what: '휴대폰 열고 닫기' },
    { keys: '휠', what: '화면 확대·축소' },
    { keys: 'Esc', what: '패널과 휴대폰 닫기' },
  ]
}

/** 터치 기기에서 쓰는 조작 안내 */
function touchRows(): { keys: string; what: string }[] {
  return [
    { keys: '왼쪽 조이스틱', what: '걸어요' },
    { keys: 'E 버튼', what: '행동해요' },
    { keys: '⇄ 버튼', what: '도구를 바꿔요' },
    { keys: '📱 버튼', what: '휴대폰을 열어요' },
  ]
}

/** 화면 오른쪽 아래의 휴대폰 버튼. 터치에서는 예전 메뉴 버튼 자리에 놓인다. */
export function PhoneButton() {
  const open = useGame((s) => s.openPanel)
  const alert = useTomorrowAlert()
  return (
    <button type="button" className="phone-button touch-hide" onClick={() => open('phone')} aria-label="휴대폰 열기" title="휴대폰 (`)">
      <span aria-hidden="true">📱</span>
      {alert && <span className="badge badge-dot" role="img" aria-label={tomorrowLine(alert.name)} />}
    </button>
  )
}

/** 휴대폰 기기: 상태줄, 앱 격자(또는 단축키 화면), 아래 홈 바. 열리면 첫 앱으로 포커스가 가고, Tab 은 기기 안에서만 돈다. */
export function PhonePanel() {
  const day = useGame((s) => s.day)
  const islandStart = useGame((s) => s.islandStart)
  const questsDone = useGame((s) => s.questsDone)
  const dex = useGame((s) => s.dex)
  const stats = useGame((s) => s.stats)
  const quests = useGame((s) => s.quests)
  const dailyBase = useGame((s) => s.dailyBase)
  const dailyClaimed = useGame((s) => s.dailyClaimed)
  const ledger = useGame((s) => s.ledger)
  const weekly = useGame((s) => s.weekly ?? null)
  const storyChapter = useGame((s) => s.storyChapter ?? 0)
  const [screen, setScreen] = useState<'home' | 'help' | 'notices' | 'life' | 'calendar'>('home')
  const calendarAlert = useTomorrowAlert()
  const noticeLog = useGame((s) => s.noticeLog)
  const noticeSeen = useGame((s) => s.noticeSeen)
  const [pressed, setPressed] = useState<PhoneTarget | null>(null)
  const timer = useRef<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const ctx = ctxOf({ day, islandStart, questsDone, dex, stats })
  const inHome = useGame((s) => s.inHome)
  const apps = phoneApps({ photoOpen: devUnlocked('photo') || systemOpen('photo', ctx), sunday: new Date(`${day}T00:00:00Z`).getUTCDay() === 0, inHome })
  // 카메라가 잠겼을 때 보여 줄 열리는 조건(해요체 한 줄)
  const cameraHint = SYSTEMS.find((x) => x.id === 'photo')?.hint ?? ''
  // 안 본 알림 수: 알림 앱을 연 뒤에 생긴 것
  const unseen = noticeLog.filter((n) => n.id > noticeSeen).length
  // 미션 앱에는 받을 보상 수를 붙인다(예전 수첩 버튼과 같은 셈)
  const ready = useMemo(() => questBoard({ quests, stats, day, dailyBase, dailyClaimed }).filter((q) => q.done).length, [quests, stats, day, dailyBase, dailyClaimed])
  // 미션 배지는 받을 보상 수만 센다. 이번 주 목표가 남았으면 숫자 없이 점만 찍는다.
  const weeklyPending = useMemo(() => weeklyOpen(storyChapter) && weeklyLeft(weekly, day, stats) > 0, [storyChapter, weekly, day, stats])
  // 열기 전 자리를 기억해 두었다가 닫히면 돌려준다
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => back?.focus?.()
  }, [])
  // 화면이 바뀌면 그 화면의 첫 버튼으로 옮긴다(앱 격자는 첫 앱, 단축키는 뒤로 가기)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(screen === 'home' ? '.phone-app' : '.phone-back')?.focus()
  }, [screen])
  // Tab 은 기기 안의 버튼만 돌고, Shift+Tab 은 거꾸로 돈다
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1
    items[next].focus()
  }
  // 기기가 닫히면 눌림 연출이 남아 있어도 패널을 열지 않는다
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])
  // 알림 화면이 떠 있는 동안 새로 온 알림도 본 것으로 친다
  useEffect(() => {
    if (screen !== 'notices') return
    const last = noticeLog[noticeLog.length - 1]
    if (last && last.id > noticeSeen) useGame.setState({ noticeSeen: last.id })
  }, [screen, noticeLog, noticeSeen])
  // 단축키·알림은 기기 안에서 화면을 바꾸고, 잠긴 앱은 열리지 않는다. 나머지는 아이콘이 살짝 눌렸다가 패널이 열린다
  const press = (id: PhoneTarget) => {
    if (pressed) return
    if (id === 'help' || id === 'notices' || id === 'life' || id === 'calendar') return setScreen(id)
    if (apps.find((a) => a.id === id)?.locked) return
    setPressed(id)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setPressed(null)
      runApp(id)
    }, PRESS_MS)
  }
  const rows = isTouchDevice() ? touchRows() : shortcutRows()
  // 섬 살림: 상점·집·통장·이번 주 목표를 한 화면에 모은다(화면을 열 때마다 새로 읽는다)
  const shopTier = useGame((s) => s.shop.tier)
  const homeStage = useGame((s) => s.home.stage)
  const loan = useGame((s) => s.home.loan)
  const homeFurniture = useGame((s) => s.homeFurniture)
  const wallPhoto = useGame((s) => !!s.wallPhoto)
  const placedHere = useGame((s) => s.placed)
  const gardenTiles = useGame((s) => s.gardenTiles)
  const bank = useGame((s) => s.bank)
  const deposit = useGame((s) => s.deposit ?? null)
  const lifeStats = useGame((s) => s.stats)
  const lifeMoney = useGame((s) => s.money)
  const lifeDailyMoney = useGame((s) => s.dailyMoney ?? null)
  const lifeQuests = useGame((s) => s.questsDone)
  const lifeBase = useGame((s) => s.dailyBase)
  const lifeHouse = useGame((s) => s.houseExpand ?? null)
  const homeNow = useMemo(
    () => scoreHome({ stage: homeStage, furniture: homeFurniture, framed: frameHung(wallPhoto, homeFurniture), framedFloor: frameFloor(wallPhoto, homeFurniture), garden: gardenStats(placedHere, decodeGarden(gardenTiles), HOME_SITE) }),
    [homeStage, homeFurniture, wallPhoto, placedHere, gardenTiles],
  )
  const life = screen === 'life'
    ? lifeRows({
        day,
        shopTier,
        shopStats: { sold: lifeStats.earn ?? 0, spent: lifeStats.spent ?? 0, questsDone: lifeQuests },
        homeStage,
        homeGrade: { total: homeNow.total, stars: starsOf(homeNow.total) },
        loan,
        bank,
        deposit,
        weekly,
        houseExpand: lifeHouse,
        storyChapter,
        stats: lifeStats,
        dailyBase: lifeBase,
        money: lifeMoney,
        dailyMoney: lifeDailyMoney,
      })
    : []
  const weekSlots = screen === 'life' ? weekLedger(ledger ?? [], day, lifeStats, lifeBase) : []
  const hour = currentHour()
  const weather = WEATHER_INFO[weatherFor(day)]
  return (
    <div className="phone" role="dialog" aria-label="휴대폰" ref={ref} onKeyDown={onKey}>
      <div className="phone-screen">
        <div className="phone-status" aria-hidden="true">
          <span>{timeLabel(hour)}</span>
          <span className="phone-weather" title={weather.label}>
            {weather.icon}
          </span>
          <span className="phone-battery" />
        </div>
        {screen === 'home' ? (
          <>
            <ul className="phone-grid">
              {apps.map((a) => (
                <li key={a.id}>
                  <button type="button" className="phone-app" onClick={() => press(a.id)} aria-label={a.locked ? `${a.name} 잠김` : a.name}>
                    <span className={`phone-tile phone-tile-${a.id} ${pressed === a.id ? 'is-pressed' : ''} ${a.locked ? 'is-locked' : ''}`} aria-hidden="true">
                      {a.locked ? '🔒' : a.icon}
                      {a.id === 'quest' && ready > 0 && <span className="badge">{ready}</span>}
                      {a.id === 'quest' && weeklyPending && <span className="badge badge-dot" role="img" aria-label="이번 주 목표가 남았어요" />}
                      {a.id === 'notices' && unseen > 0 && <span className="badge">{unseen}</span>}
                      {a.id === 'calendar' && calendarAlert && <span className="badge badge-dot" role="img" aria-label={tomorrowLine(calendarAlert.name)} />}
                    </span>
                    <span className="phone-name">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {apps.some((a) => a.locked) && <p className="phone-lock-line">🔒 카메라는 {cameraHint}</p>}
          </>
        ) : (
          <div className="phone-help">
            <button type="button" className="phone-back" onClick={() => setScreen('home')} aria-label="뒤로 가기">
              ← 뒤로
            </button>
            {screen === 'calendar' ? (
              <CalendarApp />
            ) : screen === 'life' ? (
              <>
                <h2 className="phone-help-title">섬 살림</h2>
                <ul className="phone-life">
                  {life.map((row) => {
                    const body = (
                      <>
                        <span className="phone-life-title">{row.title}</span>
                        {row.line && <span className="phone-life-line">{row.line}</span>}
                        {row.bars.map((b) => (
                          <span key={b.label} className="phone-life-bar">
                            <span className="phone-life-label">
                              {b.label} {Math.min(b.have, b.need).toLocaleString()}/{b.need.toLocaleString()}
                            </span>
                            <span className="phone-bar" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, Math.round((b.have / Math.max(1, b.need)) * 100))}%` }} />
                            </span>
                          </span>
                        ))}
                      </>
                    )
                    return (
                      <li key={row.title}>
                        {row.target === 'flow' ? (
                          <>
                            <div className="phone-life-row">{body}</div>
                            {row.line.includes('그 밖에') && <p className="phone-flow-note">ⓘ 받은·쓴 것은 상점 거래만 세요. 그 밖은 퀘스트 보상·공사비 등 나머지 순액이에요.</p>}
                            <WeekLedger slots={weekSlots} />
                          </>
                        ) : (
                          <button type="button" className="phone-life-row" onClick={() => openLife(row)}>
                            {body}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : screen === 'help' ? (
              <>
                <h2 className="phone-help-title">단축키</h2>
                <dl className="phone-keys">
                  {rows.map((r) => (
                    <div key={r.keys}>
                      <dt>
                        <kbd>{r.keys}</kbd>
                      </dt>
                      <dd>{r.what}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <h2 className="phone-help-title">알림</h2>
                {noticeLog.length === 0 ? (
                  <p className="phone-empty">아직 알림이 없어요</p>
                ) : (
                  <ol className="phone-notes">
                    {[...noticeLog].reverse().map((n) => (
                      <li key={n.id}>
                        <span className="phone-note-time">{timeLabel(n.at)}</span>
                        <span className="phone-note-text">{n.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        )}
        <div className="phone-home-row">
          <button type="button" className="phone-home" onClick={() => useGame.getState().openPanel(null)} aria-label="휴대폰 닫기">
            <span className="phone-home-bar" aria-hidden="true" />
          </button>
          <span className="phone-esc-hint">
            <kbd>Esc</kbd> 닫기
          </span>
        </div>
      </div>
    </div>
  )
}

/** 지난 7일 가계부: 번 것과 쓴 것을 두 줄 막대로 그린다. 각 줄은 자기 줄의 최댓값을 높이 기준으로 삼고, 기록이 없는 날은 빈 칸이다. */
function WeekLedger({ slots }: { slots: LedgerSlot[] }) {
  if (slots.length === 0) return null
  const line = (name: string, pick: (s: LedgerSlot) => number, star: boolean) => {
    const max = Math.max(1, ...slots.map(pick))
    return (
      <div className="phone-week-line">
        <span className="phone-week-name">{name}</span>
        <span className="phone-week-cols">
          {slots.map((s) => (
            <span
              key={s.day}
              className={`phone-week-col${s.recorded ? '' : ' is-empty'}`}
              title={s.recorded ? `${Number(s.day.slice(5, 7))}/${Number(s.day.slice(8))} · 번 도토리 ${s.earned.toLocaleString()}개 · 쓴 도토리 ${s.spent.toLocaleString()}개` : `${Number(s.day.slice(5, 7))}/${Number(s.day.slice(8))} · 기록 없음`}
            >
              {star && s.best && <b className="phone-week-star" aria-label="가장 많이 번 날">★</b>}
              <span className={`phone-week-fill${star ? '' : ' is-spent'}`} style={{ height: `${Math.round((pick(s) / max) * 30)}px` }} />
            </span>
          ))}
        </span>
      </div>
    )
  }
  return (
    <div className="phone-life-row phone-week" role="group" aria-label="지난 7일 가계부">
      <span className="phone-life-title">📅 지난 7일</span>
      {line('번 것', (s) => s.earned, true)}
      {line('쓴 것', (s) => s.spent, false)}
      <div className="phone-week-line phone-week-dates">
        <span className="phone-week-name" />
        <span className="phone-week-cols">
          {slots.map((s) => (
            <span key={s.day} className={`phone-week-date${s.day === slots[slots.length - 1].day ? ' is-today' : ''}`}>
              {Number(s.day.slice(8))}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

/** 휴대폰 달력 앱: 오늘부터 30일 안의 섬 행사를 날짜순으로 보여 준다. 오늘과 내일은 강조한다. 월간 달력은 아래 버튼으로 연다. */
function CalendarApp() {
  const ctx = useCalendarCtx()
  const openPanel = useGame((s) => s.openPanel)
  const markCalendarOpened = useGame((s) => s.markCalendarOpened)
  const days = useMemo(() => upcomingEvents(ctx.today, 30, ctx), [ctx])
  const tomorrow = addDays(ctx.today, 1)
  // 줄을 눌러 펼친 설명은 한 번에 하나만 연다. 앱을 열면 오늘의 내일 행사 배지를 지운다
  const [openKey, setOpenKey] = useState<string | null>(null)
  useEffect(() => {
    markCalendarOpened()
  }, [markCalendarOpened])
  const label = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))} (${WEEK[weekdayOf(day) ?? 0]})`
  return (
    <>
      <h2 className="phone-help-title">달력</h2>
      <button type="button" className="phone-cal-month" onClick={() => openPanel('calendar')}>
        월간 달력 보기
      </button>
      {days.length === 0 ? (
        <p className="note">앞으로 30일 동안 정해진 행사는 없어요</p>
      ) : (
        <ul className="phone-cal">
          {days.map((d) => {
            const tag = d.day === ctx.today ? '오늘' : d.day === tomorrow ? '내일' : null
            return (
              <li key={d.day} className={`phone-cal-day${tag ? ' hot' : ''}`}>
                <span className="phone-cal-date">
                  {tag && <b className="phone-cal-tag">{tag}</b>} {label(d.day)}
                </span>
                {d.events.map((e, i) => {
                  const key = `${d.day}-${i}`
                  const isOpen = openKey === key
                  return (
                    <button
                      type="button"
                      key={key}
                      className="phone-cal-event"
                      aria-expanded={isOpen}
                      onClick={() => setOpenKey(isOpen ? null : key)}
                    >
                      <span aria-hidden>{e.icon}</span> {e.label}
                      {isOpen && <span className="phone-cal-note">{e.note}</span>}
                    </button>
                  )
                })}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
