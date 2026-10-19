import { isIndoor } from '../game/indoor'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { currentHour, isNight, timeLabel } from '../core/clock'
import { isPlaceable, ITEMS, TOOL_ORDER, TOOLS, type ToolId } from '../core/items'
import { activeBuffs, clockOf } from '../core/cooking'
import { now, runtime } from '../game/runtime'
import { CAN_NAMES } from '../core/watering'
import { isMarketDay } from '../core/market'
import { festivalOn } from '../core/festivals'
import { fogActive } from '../core/fog'
import { SEASON_INFO, seasonFor } from '../core/season'
import { WEATHER_INFO, weatherFor } from '../core/weather'
import { isMuted, setMuted } from '../game/sfx'
import { useGame } from '../game/store'
import { Minimap } from './Minimap'
import { activeObjective, houseLine, idleObjectiveLine, unlockHint, useAfterGoals } from './objective'
import { afterStoryHudLine } from '../core/afterStory'
import { pickUpHintOn } from '../core/guide'
import { ctxOf, nextUnlockHint } from '../core/unlocks'
import { slotTitle } from '../core/reform'
import { VariantMark } from './VariantMark'
import { rewardParts } from '../core/quests'
import { hudObjectiveLines } from '../core/hudObjective'
import { flowerWeekLine, NEW_FLOWER_WEEK } from '../core/flowerWeek'
import { chapterQuestIds } from '../core/story'
import { ToolIcon } from './ToolIcon'
import { ItemThumb } from './ItemThumb'
import { TreasureMap } from './TreasureMap'
import { PlaceHint } from './PlaceHint'
import { parseMapId } from '../core/bottle'
import { PhoneButton } from './Phone'
import { CountUp } from './countUp'

const TOAST_MS = 2600

function Clock() {
  const [hour, setHour] = useState(currentHour)
  useEffect(() => {
    const id = setInterval(() => setHour(currentHour()), 15_000)
    return () => clearInterval(id)
  }, [])
  const day = useGame((s) => s.day)
  const kind = weatherFor(day)
  const season = SEASON_INFO[seasonFor(day)]
  // 안개는 날씨 표와 따로 도는 아침 겹침이라 시각을 같이 본다
  const w = fogActive(day, seasonFor(day), kind, hour) ? { icon: '🌫️', label: '안개' } : WEATHER_INFO[kind]
  return (
    <div className="pill" role="img" aria-label={`${season.label} · ${w.label} · ${timeLabel(hour)}`} title={`${season.label} · 오늘 날씨: ${w.label}`}>
      {season.icon} {isNight(hour) && w.icon === '☀️' ? '🌙' : w.icon} {timeLabel(hour)}
    </div>
  )
}

/** 알림 시간을 셀 때 한 프레임에서 세는 최대 시간(ms) */
const FRAME_CAP_MS = 100

/**
 * 알림은 한 번에 한 줄씩 TOAST_MS 동안 보이고, 끝나면 store 의 다음 알림이 올라온다.
 * HUD 밖(App 에서 창 뒤가 아니라 창 위)에 그린다. HUD 는 자기 쌓임 맥락이라 창 위로 올릴 수 없다.
 */
export function Toast() {
  const toast = useGame((s) => s.toast)
  const dismiss = useGame((s) => s.dismissToast)
  const albumOpen = useGame((s) => s.albumOpen)
  // 대화 중에는 아래쪽 대화 상자와 겹치니 알림을 미룬다. 대화가 끝나면 그때 보여 준다.
  const talking = useGame((s) => s.dialog !== null)
  const panelOpen = useGame((s) => s.panel !== null || s.bagOpen)
  // 앨범을 연 동안엔 알림을 가리고, 시간도 멈춘다. 닫은 뒤에 다시 보여 준다.
  useEffect(() => {
    if (!toast || albumOpen || talking) return
    // 시간은 그려진 프레임으로 잰다. 한 프레임은 최대 FRAME_CAP_MS 만 센다. 첫 화면을 불러오느라 몇 초씩 멈춘 프레임 동안
    // 시간이 다 흘러 알림이 보이지도 않고 지나가지 않게 하려는 것이다. 탭이 가려져 프레임이 멈추면 알림도 기다린다.
    let shown = 0
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      shown += Math.min(Math.max(now - last, 0), FRAME_CAP_MS)
      last = now
      if (shown >= TOAST_MS) dismiss(toast.id)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [toast, albumOpen, talking, dismiss])
  if (!toast || albumOpen || talking) return null
  return (
    <div key={toast.id} className={`toast ${panelOpen ? 'toast-panel' : ''}`} role="status">
      {toast.text}
    </div>
  )
}

/** 가방 안에서 Tab 으로 도는 대상: 누를 수 있는 버튼(칸·정렬·지도 칸) */
const BAG_FOCUSABLE = 'button:not([disabled])'

function Inventory() {
  const inventory = useGame((s) => s.inventory)
  const placing = useGame((s) => s.placing)
  const placingVariant = useGame((s) => s.placingVariant)
  const bagOpen = useGame((s) => s.bagOpen)
  const wrapRef = useRef<HTMLDivElement>(null)
  // 가방이 열리면 첫 버튼으로 옮기고, 닫히면 열기 전에 있던 자리로 돌아간다
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
    wrapRef.current?.querySelector<HTMLElement>(BAG_FOCUSABLE)?.focus()
    return () => back?.focus?.()
  }, [])
  // Tab 은 가방 안에서만 돈다. Space·Enter 로 버튼이 한 번 더 눌리지 않게 막는다(게임의 행동 키가 따로 처리한다).
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && wrapRef.current) {
      const items = [...wrapRef.current.querySelectorAll<HTMLElement>(BAG_FOCUSABLE)]
      if (!items.length) return
      e.preventDefault()
      const i = items.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1
      items[next].focus()
      return
    }
    // Enter 는 브라우저가 버튼을 누르게 둔다(월드 행동은 Player 가 막는다). Space 는 버튼이 한 번 더 눌리지 않게 막는다.
    if (e.key === ' ' && (e.target as HTMLElement).tagName === 'BUTTON') e.preventDefault()
  }
  const startPlacing = useGame((s) => s.startPlacing)
  const eatDish = useGame((s) => s.eatDish)
  const pocket = useGame((s) => s.pocket)
  // 요리를 누르면 먹기 메뉴가 뜬다
  const [dish, setDish] = useState<string | null>(null)
  const sortBag = useGame((s) => s.sortBag)
  // 보물 지도를 누르면 섬 지도가 펼쳐진다(열린 지도는 TreasureMapHost 가 그린다)
  const setMap = useGame((s) => s.setTreasureMap)
  return (
    <div ref={wrapRef} className="bag-area" onKeyDown={onKey} onKeyUp={(e) => { if (e.key === ' ') e.preventDefault() }}>
    {/* 놓는 중에 자동으로 뜬 주머니는 옅게 깔아 땅이 가려지지 않게 한다. 가리키면 진하게 본다. */}
    <div className={`inventory${placing && !bagOpen ? ' peek' : ''}`} aria-label="주머니">
      {Array.from({ length: pocket }, (_, i) => {
        const slot = inventory[i]
        const def = slot && ITEMS[slot.id]
        const content = (
          <>
            {def && (def.kind === 'seafood' ? <ItemThumb id={def.id} /> : <span className="slot-icon">{def.icon}</span>)}
            {def && <VariantMark id={slot?.variant} />}
            {slot && slot.count > 1 && <span className="slot-count">{slot.count}</span>}
          </>
        )
        // 요리 칸은 누르면 먹기 메뉴가 뜬다.
        if (def && def.kind === 'dish') {
          return (
            <button key={i} className={`slot dish ${dish === def.id ? 'on' : ''}`} title={`${def.name} 먹기`} onClick={() => setDish(dish === def.id ? null : def.id)}>
              {content}
            </button>
          )
        }
        if (def && parseMapId(def.id)) {
          return (
            <button key={i} className="slot" title={def.name} onClick={() => setMap(def.id)}>
              {content}
            </button>
          )
        }
        // 가구 칸은 눌러서 섬에 놓을 수 있다.
        if (def && isPlaceable(def.id)) {
          return (
            <button
              key={i}
              className={`slot furniture ${placing === def.id && placingVariant === slot?.variant ? 'on' : ''}`}
              title={`${slotTitle(def.name, slot?.variant)} 놓기`}
              onClick={() => {
                const on = placing === def.id && placingVariant === slot?.variant
                // 고른 칸의 변형을 함께 넘겨, 기본 칸이 앞에 있어도 금박 칸을 놓을 수 있게 한다
                startPlacing(on ? null : def.id, slot?.variant)
                // 좁은 화면에서는 주머니에서 고르는 순간 닫아, 조이스틱과 놓기 버튼이 다시 보이게 한다
                if (window.matchMedia('(max-width: 560px)').matches) useGame.getState().toggleBag(false)
              }}
            >
              {content}
            </button>
          )
        }
        return (
          <div key={i} className="slot" title={def ? slotTitle(def.name, slot?.variant) : undefined}>
            {content}
          </div>
        )
      })}
      {dish && ITEMS[dish] && (
        <div className="dish-menu" role="menu" aria-label={`${ITEMS[dish].name} 메뉴`}>
          <span>
            {ITEMS[dish].icon} {ITEMS[dish].name}
          </span>
          <button role="menuitem" onClick={() => { eatDish(dish); setDish(null) }}>
            먹기
          </button>
          <button onClick={() => setDish(null)}>닫기</button>
        </div>
      )}
    </div>
    <button className="pill bag-sort" onClick={sortBag} title="종류별로 정리해요">
      정렬
    </button>
    {/* 좁은 화면에서 주머니를 연 동안 조이스틱·버튼 줄이 숨으므로 닫기는 여기서 한다(넓은 화면은 I 키) */}
    {bagOpen && (
      <button className="pill bag-close" onClick={() => useGame.getState().toggleBag(false)} aria-label="주머니 닫기">
        닫기
      </button>
    )}
    </div>
  )
}

/** 열린 보물 지도를 그린다. 주머니를 닫아도 지도는 닫기나 Esc 로 닫을 때까지 남는다. */
function TreasureMapHost() {
  const id = useGame((s) => s.treasureMap)
  const setMap = useGame((s) => s.setTreasureMap)
  if (!id) return null
  return <TreasureMap id={id} onClose={() => setMap(null)} />
}

/** 요리 효과가 남아 있는 동안 왼쪽 아래에 남은 시간을 칩으로 보여 준다. 효과는 runtime 에 있어 짧은 주기로 다시 읽는다. */
function BuffChips() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [])
  const list = activeBuffs(now(), runtime)
  if (list.length === 0) return null
  return (
    <div className="buff-chips" aria-label="요리 효과">
      {list.map((b) => (
        <span key={b.label} className="buff-chip">
          {b.label}
          {b.seconds !== null && <b>{clockOf(b.seconds)}</b>}
        </span>
      ))}
    </div>
  )
}

/** 지금 할 일 한 줄. 받을 보상이 있으면 누를 때 수첩을 연다. 줄 우선순위는 core 의 hudObjectiveLines 가 정한다. */
function ObjectiveLine() {
  const quests = useGame((s) => s.quests)
  const stats = useGame((s) => s.stats)
  const day = useGame((s) => s.day)
  const dailyBase = useGame((s) => s.dailyBase)
  const dailyClaimed = useGame((s) => s.dailyClaimed)
  const island = useGame((s) => s.island)
  const questsDone = useGame((s) => s.questsDone)
  const dex = useGame((s) => s.dex)
  const islandStart = useGame((s) => s.islandStart)
  const home = useGame((s) => s.home)
  const inventory = useGame((s) => s.inventory)
  const marketBought = useGame((s) => s.marketBought)
  const open = useGame((s) => s.openPanel)
  const storyChapter = useGame((s) => s.storyChapter ?? 0)
  const afterGoals = useAfterGoals()
  const obj = useMemo(
    () => activeObjective({ quests, stats, day, dailyBase, dailyClaimed }, chapterQuestIds(storyChapter)),
    [quests, stats, day, dailyBase, dailyClaimed, storyChapter],
  )
  const lines = hudObjectiveLines({
    ready: !!obj?.ready,
    trip: island === 'trip',
    market: isMarketDay(day) && !marketBought.some((k) => k.startsWith(`${day}:`)),
    earn: obj?.goal.goal.stat === 'earn',
    home,
    unlock: ctxOf({ day, islandStart, questsDone, dex, stats }),
  })
  const hint = lines.hint && <span className="objective-hint">{lines.hint.text}</span>
  const cls = (extra = '') => `objective${extra}${hint ? ' has-hint' : ''}`
  if (lines.main === 'ready' && obj) {
    return (
      <button className={cls(' ready')} onClick={() => open('quest')}>
        🎁 보상 받기 <kbd>J</kbd>
        <span className="reward-detail"> · {rewardParts(obj.quest.reward).join(' · ')}</span>
        {hint}
      </button>
    )
  }
  // 여행 섬의 목표는 도토리섬 것이라 여기선 돌아가는 법을 알려 준다.
  if (lines.main === 'trip') return <div className="objective">⛵ 펠리에게 말하면 돌아가요</div>
  // 장날에는 장터 가판대를 들르는 것이 가장 가까운 할 일이다. 이번 장에서 아무것도 안 샀을 때만 알린다.
  if (lines.main === 'market') return <div className={cls()}>🧺 광장 장터에서 오늘만 나온 물건을 구경해요{hint}</div>
  // 이야기 퀘스트가 다 떨어졌으면 다음에 열릴 기능을 가리킨다
  // 목표가 비어도 HUD 줄은 남겨서, 다음에 할 일을 어디서 보는지 알려 준다
  if (!obj) {
    // 섬 이야기를 마쳤으면 다음 목표 첫 번째를 보여 준다. 목표가 하나도 없을 때만 휴대폰 안내를 쓴다.
    const after = afterStoryHudLine(afterGoals)
    if (after) return <div className={cls()}>{after}{hint}</div>
    return <div className={cls()}>{idleObjectiveLine(nextUnlockHint(ctxOf({ day, islandStart, questsDone, dex, stats })))}{hint}</div>
  }
  const { goal } = obj.goal
  // 집 짓기 목표는 진행 숫자 대신 모자란 재료를 보여 준다. 어디서 모을지는 미니맵 마커가 가리킨다.
  if (goal.stat.startsWith('build:')) {
    return <div className={cls()} title={obj.quest.title}>{houseLine(goal.stat.slice('build:'.length), inventory)}{hint}</div>
  }
  // 첫 나무 흔들기 목표: 누르거나 올리면 다음에 할 일을 한 줄로 알려 준다
  if (goal.stat === 'shake') {
    const pocketFruit = inventory.reduce((n, s) => n + (ITEMS[s.id]?.kind === 'fruit' ? s.count : 0), 0)
    return <ShakeObjective title={obj.quest.title} current={obj.goal.current} target={goal.target} label={goal.label} pickUp={pickUpHintOn(stats, questsDone, pocketFruit)} hint={hint} />
  }
  // 도토리 벌기 목표는 파는 곳을 한 줄로 알려 준다. 미니맵 마커는 상점 문을 가리킨다.
  return (
    <div className={cls()} title={obj.quest.title}>
      {goal.slow ? '🌱' : '🎯'} {goal.label} <b>{obj.goal.current}/{goal.target}</b>
      {goal.slow && <> · {goal.slow}</>}
      {hint}
    </div>
  )
}

const SHAKE_TIP = '열매 나무 가까이 가서 E'
function ShakeObjective({ title, current, target, label, pickUp, hint }: { title: string; current: number; target: number; label: string; pickUp: boolean; hint: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`objective${open ? ' tip-open' : ''}${hint ? ' has-hint' : ''}`} data-tip={SHAKE_TIP} title={title} onClick={() => setOpen((o) => !o)}>
      🎯 {label} <b>{current}/{target}</b>
      {pickUp && <> · 떨어진 열매를 주워요</>}
      {hint}
    </div>
  )
}

/** 토요일에만 뜬다. 장터가 서 있다는 표시이자 누르면 장터 패널이 열린다. */
function MarketButton() {
  const day = useGame((s) => s.day)
  const open = useGame((s) => s.openPanel)
  if (!isMarketDay(day)) return null
  return (
    <button className="pill quest-btn" onClick={() => open('market')} aria-label="떠돌이 장터 열림" title="오늘은 장날이에요">
      🧺 장터
    </button>
  )
}

/** 봄 꽃 심기 주간(4월 1~7일)에만 뜬다. 오늘 받은 보너스 마일을 한 줄로 보여 준다. */
function FlowerWeekPill() {
  const day = useGame((s) => s.day)
  const state = useGame((s) => s.flowerWeek) ?? NEW_FLOWER_WEEK
  const line = flowerWeekLine(state, day)
  if (!line) return null
  return <span className="pill flower-week" role="status">{line}</span>
}

/** 계절 축제 날에만 뜬다. 누르면 축제 패널이 열린다. */
function FestivalButton() {
  const day = useGame((s) => s.day)
  const open = useGame((s) => s.openPanel)
  const fest = festivalOn(day)
  if (!fest) return null
  return (
    <button className="pill quest-btn" onClick={() => open('festival')} aria-label={`${fest.name} 열림`} title={fest.goal}>
      {fest.icon} 축제
    </button>
  )
}

/** 집 빚이 남았을 때만 뜬다. 누르면 집 상담이 열린다. */
function LoanButton() {
  const loan = useGame((s) => s.home.loan)
  const open = useGame((s) => s.openPanel)
  if (loan <= 0) return null
  return (
    <button className="pill quest-btn" onClick={() => open('home')} aria-label={`대출 도토리 ${loan.toLocaleString()}개 남았어요. 집 상담 열기`} title={`대출 도토리 ${loan.toLocaleString()}개 남았어요`}>
      🏠 대출 {loan.toLocaleString()}
    </button>
  )
}

function BagButton() {
  const open = useGame((s) => s.bagOpen)
  const toggle = useGame((s) => s.toggleBag)
  const fullAt = useGame((s) => s.bagFullAt)
  const ref = useRef<HTMLButtonElement>(null)
  // 주머니가 가득 차 못 받으면 가방이 한 번 흔들린다. 시각이 바뀔 때마다 애니메이션을 처음부터 다시 돈다.
  useEffect(() => {
    const el = ref.current
    if (!el || !fullAt) return
    el.classList.remove('bag-shake')
    void el.offsetWidth
    el.classList.add('bag-shake')
  }, [fullAt])
  return (
    <button ref={ref} className="pill quest-btn" onClick={() => toggle()} aria-label="주머니" aria-pressed={open}>
      🎒 <kbd>I</kbd>
    </button>
  )
}

function MuteButton() {
  const [muted, setState] = useState(isMuted)
  return (
    <button
      className="pill quest-btn touch-hide"
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
      onClick={() => {
        setMuted(!muted)
        setState(!muted)
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

/** 펠리컨 여행 중 화면을 하늘색으로 덮었다가 걷어 낸다. */
/** 대화할 때 화면 위아래에 띠를 두르고 가장자리를 어둡게 해 두 사람에게 눈이 가게 한다. */
export function TalkFrame() {
  const talking = useGame((s) => s.panel === 'talk')
  return <div className={`talk-frame ${talking ? 'on' : ''}`} aria-hidden />
}

export function TravelFade() {
  const traveling = useGame((s) => s.traveling)
  const door = useGame((s) => s.doorFade)
  return (
    <>
      <div className={`travel-fade ${traveling ? 'on' : ''}`} aria-hidden={!traveling}>
        <span>꾸룩꾸룩… 펠리를 타고 날아가는 중</span>
      </div>
      {/* 문을 드나들 때: 짧게 까맣게 덮었다 걷는다 */}
      <div className={`travel-fade door-fade ${door ? 'on' : ''}`} aria-hidden />
    </>
  )
}

/** 좁은 화면: 잠긴 도구는 칸마다 두지 않고 '🔒 +N' 한 칸으로 모아, 누르면 여는 방법을 펼친다. */
function LockedTools({ locked }: { locked: ToolId[] }) {
  const [open, setOpen] = useState(false)
  if (locked.length === 0) return null
  return (
    <div className="tool-more">
      <button className={`tool-more-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-label={`잠긴 도구 ${locked.length}개 보기`} onClick={() => setOpen(!open)}>
        🔒 +{locked.length}
      </button>
      {open && (
        <ul className="tool-more-pop">
          {locked.map((id) => (
            <li key={id}>
              <b>{TOOLS[id].name}</b>
              <span>{unlockHint(id, TOOLS[id].price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Hud() {
  const money = useGame((s) => s.money)
  const tool = useGame((s) => s.tool)
  const tools = useGame((s) => s.tools)
  const canLevel = useGame((s) => s.canLevel)
  const equip = useGame((s) => s.equip)
  const prompt = useGame((s) => s.prompt)
  // 방 놓기 중에는 안내를 화면 위로 올려, 아래 버튼 줄(돌리기·행동)과 겹치지 않게 한다
  const placingHome = useGame((s) => !!s.homePlacing)
  const placing = useGame((s) => s.placing)
  const bagOpen = useGame((s) => s.bagOpen)
  // 실내(집·전시관·마을회관·동굴·상점)에서는 미니맵을 숨긴다
  const indoor = useGame((s) => isIndoor(s))
  const notify = useGame((s) => s.notify)
  // 패널이 떠 있으면 목표줄은 잠깐 빠진다.
  const panelOpen = useGame((s) => s.panel !== null || s.bagOpen)
  // 대화나 잡은 것 자랑 중엔 HUD 가 물러난다.
  const talking = useGame((s) => s.panel === 'talk' || !!s.caption)

  return (
    <div className={`hud ${talking ? 'talking' : ''} ${panelOpen ? 'panel-open' : ''}`}>
      <div className="hud-left">
        <div className="pill money" role="img" aria-label={`도토리 ${money.toLocaleString()}개`}>
          🌰 <CountUp value={money} />
        </div>
        <LoanButton />
        <MarketButton />
        <FestivalButton />
        <FlowerWeekPill />
        <Clock />
        <BagButton />
        <MuteButton />
      </div>
      <div className="hud-right">
        {TOOL_ORDER.map((id) => {
          const owned = id === 'hand' || tools.includes(id)
          const name = id === 'can' ? CAN_NAMES[canLevel] : TOOLS[id].name
          // 잠긴 칸도 눌러 보면 여는 방법을 알려 준다(터치엔 hover 가 없어서).
          const hint = `${name} · ${unlockHint(id, TOOLS[id].price)}`
          return (
            <button
              key={id}
              className={`tool ${tool === id ? 'on' : ''} ${owned ? '' : 'locked'}`}
              title={owned ? name : `🔒 ${hint}`}
              aria-label={owned ? name : `${name} 잠김. ${unlockHint(id, TOOLS[id].price)}`}
              aria-pressed={tool === id}
              aria-disabled={!owned}
              onClick={() => (owned ? equip(id) : notify(`🔒 ${hint}`))}
            >
              <span>{owned ? <ToolIcon id={id} /> : '🔒'}</span>
              <kbd>{TOOLS[id].key}</kbd>
            </button>
          )
        })}
        <LockedTools locked={TOOL_ORDER.filter((id) => id !== 'hand' && !tools.includes(id))} />
      </div>
      {!indoor && <Minimap />}
      {!panelOpen && <ObjectiveLine />}
      <PhoneButton />
      <BuffChips />
      {prompt && (
        <div className={`prompt${placingHome ? ' place-prompt' : ''}`}>
          <kbd>E</kbd> {prompt}
        </div>
      )}
      <div className="hud-bottom">
        {/* 가구를 놓는 중엔 남은 가구를 고를 수 있게 주머니를 열어 둔다. */}
        {(bagOpen || placing) && <Inventory />}
        <PlaceHint />
        <TreasureMapHost />
      </div>
    </div>
  )
}

