import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { countOf, furnitureOwned, hasFurniture, slotValue, totalValue } from '../core/inventory'
import { currentHour } from '../core/clock'
import { formatMiles } from '../core/miles'
import { isNewShopItem } from '../core/shopNew'
import { topItems, vsYesterday, weekTotals } from '../core/salesLedger'
import { cardNumberLine, NEW_STAMP_CARD, STAMP_GOAL, STAMP_REWARD, stampHint } from '../core/stampCard'
import { songiNow, songiQuote } from '../core/songi'
import { BUG_TABLE, dexHint, FISH_TABLE, FOSSIL_SPECIES, ITEMS, TIDE_TABLE, TOOLS, type ToolId } from '../core/items'
import { DIVE_SPECIES } from '../core/diving'
import { questProgress } from '../core/quests'
import { currentChapter, STORY_CHAPTERS, storyAwaitingClaim, storyCtxOf, storyProgress, storyRewards } from '../core/story'
import { weeklyOpen, weeklyView, WEEKLY_MILES } from '../core/weekly'
import { afterStoryLine } from '../core/afterStory'
import { useAfterGoals } from './objective'
import { TODO_ICON, todayTodos, TODO_DAY_CAP, TODO_REWARD } from '../core/todo'
import { activeReq, reqText } from '../core/requests'
import { donorIds, dexProgress } from '../core/dex'
import { CONSTELLATIONS } from '../core/stars'
import { ORE_IDS } from '../core/cave'
import { SEASON_INFO } from '../core/season'
import { RARE_FLOWERS } from '../core/breeding'
import { FURNITURE_IDS, furnitureHint, furnitureProgress } from '../core/furnitureCatalog'
import { museumOpen } from '../core/museum'
import { dexKindDone, type DexKind } from '../core/dexReward'
import { canBuyUpgrade, CAN_NAMES, CAN_SIDE, CAN_UPGRADES } from '../core/watering'
import { lookFor, shopStock, tierDef, unlockChecks, upgradeState, type ShopTier } from '../core/shopTiers'
import { weeklyBoughtOn } from '../core/weeklyLimited'
import { currentNewLine, newItemsLine, shopNextLine, TOP_TIER_UPGRADE_NOTE } from '../core/shopProgress'
import { isFlashDay, monthlyBoughtOn, monthlyFurniture, shopkeeperLines } from '../core/shopEvents'
import { isSoldOut } from '../core/shopDisplay'
import { canReform, FINISHES, REFORM_MIN_ACORNS, REFORM_TIER, REFORM_WOOD, reformAcorns, slotTitle, VARIANTS, variantById } from '../core/reform'
import { VariantMark } from './VariantMark'
import { ctxOf, systemOpen } from '../core/unlocks'
import { friendshipLevel, nextLevelAt, VILLAGERS } from '../core/villagers'
import { OrderTab } from './OrderTab'
import { FurniturePeek } from './FurniturePeek'
import { ToolIcon } from './ToolIcon'
import { firstClaimable, questBoard, todoCtxOf, useGame } from '../game/store'

/**
 * 모달 껍데기. `tall` 이면 높이를 고정하고 본문(`.tab-body`)만 스크롤한다. 탭을 바꿔도 창 크기가 변하지 않게 하려는 것이다.
 */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, children, tall = false }: { title: string; children: ReactNode; tall?: boolean }) {
  const close = () => useGame.getState().openPanel(null)
  const ref = useRef<HTMLDivElement>(null)
  // 열리면 첫 버튼으로 옮기고, 닫히면 열기 전에 있던 자리로 돌아간다
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => back?.focus?.()
  }, [])
  // Tab 은 창 안에서만 돈다. 게임 쪽 키 처리가 Tab 기본 동작을 막아 두므로 여기서 직접 옮긴다.
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1
    items[next].focus()
  }
  return (
    <div className="backdrop" onClick={close}>
      <div ref={ref} className={`panel${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={trap}>
        <header>
          <h2>{title}</h2>
          <button className="ghost" onClick={close}>
            닫기 <kbd>Esc</kbd>
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

function SellTab() {
  const inventory = useGame((s) => s.inventory)
  const sellPicked = useGame((s) => s.sellPicked)
  const sellAll = useGame((s) => s.sellAll)
  const day = useGame((s) => s.day)
  const shop = useGame((s) => s.shop)
  // 공사 중 문 닫은 날에는 팔 수 없다. 버튼을 막고 이유를 보여 준다.
  const closed = upgradeState(shop, day).status === 'closed'
  // 송이는 오늘 시세로 값을 매긴다(일요일엔 시세가 없어 팔 수 없다)
  const songi = songiNow(day, currentHour())
  const songiAm = songiQuote(day, true)
  const songiPm = songiQuote(day, false)
  // 고른 칸 번호들. 누르면 고르고, 아래 버튼으로 한 번에 판다.
  const [picked, setPicked] = useState<number[]>([])
  // 가구가 섞여 있으면 한 번 더 물어본다
  const [asking, setAsking] = useState(false)
  // 가방 내용이 바뀌면 고른 칸 번호가 어긋나니 고른 것을 비운다
  useEffect(() => {
    setPicked([])
    setAsking(false)
  }, [inventory])
  if (inventory.length === 0) return <p className="empty">팔 물건이 없어요. 섬을 둘러보고 올까요?</p>
  const chosen = inventory.filter((_, i) => picked.includes(i))
  const toggle = (i: number) => {
    setAsking(false)
    setPicked((p) => (p.includes(i) ? p.filter((k) => k !== i) : [...p, i]))
  }
  const sellChosen = () => {
    if (!asking && hasFurniture(chosen)) return setAsking(true)
    sellPicked(picked)
    setPicked([])
    setAsking(false)
  }
  return (
    <>
      {songiAm !== null && songiPm !== null && <p className="note">오늘 송이 시세 · 오전 🌰 {songiAm.toLocaleString()} · 오후 🌰 {songiPm.toLocaleString()}</p>}
      <ul className="sell-list">
        {inventory.map((slot, i) => {
          const def = ITEMS[slot.id]
          const on = picked.includes(i)
          return (
            <li key={`${slot.id}-${i}`}>
              <button className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(i)}>
                <span className="big">
                  {def.icon}
                  <VariantMark id={slot.variant} />
                </span>
                <span className="name">
                  {slotTitle(def.name, slot.variant)}
                  {slot.count > 1 && ` ×${slot.count}`}
                </span>
                <span className="price">🌰 {slotValue(slot, songi).toLocaleString()}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <footer className="sell-foot">
        {closed && <p className="notice">🚧 공사 중이라 문을 닫았어요. 내일 다시 열어요</p>}
        {asking && <p className="sell-ask">가구가 섞여 있어요. 정말 팔까요?</p>}
        <button className="primary" disabled={closed || picked.length === 0} onClick={sellChosen}>
          {asking ? '네, 팔아요' : `고른 ${picked.length}칸 팔기`} · 🌰 {totalValue(chosen, songi).toLocaleString()}
        </button>
        <button className="sell-all" disabled={closed} onClick={sellAll}>모두 팔기 · 🌰 {totalValue(inventory).toLocaleString()}</button>
      </footer>
    </>
  )
}

const FOR_SALE: ToolId[] = ['net', 'rod', 'shovel', 'can', 'axe', 'ladder']

/** 진열 코너 이름. 가구·잡화·씨앗으로 나눠 보여 준다. */
const CATEGORY_NAME: Record<string, string> = { furniture: '가구 코너', material: '잡화 코너', seed: '씨앗 코너' }

/** 공사 중이면 문을 닫는다. 도구도 같이 막는다. */
/** 이미 가진 개수. 0 이면 그리지 않는다. */
const Owned = ({ n }: { n: number }) => (n > 0 ? <small className="note">가짐 {n}</small> : null)

/** 단골 스탬프 카드: 상점 사기 탭 맨 위. 하루 첫 구매에 한 칸, 열 칸을 채우면 도토리를 받는다. */
function StampCardRow() {
  const card = useGame((s) => s.stampCard) ?? NEW_STAMP_CARD
  const day = useGame((s) => s.day)
  const num = cardNumberLine(card.cards)
  return (
    <section className="stamp-card" aria-label="단골 스탬프 카드">
      <div className="stamp-head">
        <strong>단골 스탬프</strong>
        {num && <small className="note">{num}</small>}
      </div>
      <div className="stamp-dots" role="img" aria-label={`${Math.min(card.n, STAMP_GOAL)}/${STAMP_GOAL}칸 찍힘`}>
        {Array.from({ length: STAMP_GOAL }, (_, i) => (
          <span key={i} className={`stamp-dot${i < card.n ? ' on' : ''}`} aria-hidden>
            {i < card.n ? '🌰' : ''}
          </span>
        ))}
      </div>
      <p className="note">
        {stampHint(card, day)} · 다 채우면 도토리 {STAMP_REWARD}개
      </p>
    </section>
  )
}

function BuyTab() {
  const [peek, setPeek] = useState<string | null>(null)
  const money = useGame((s) => s.money)
  const tools = useGame((s) => s.tools)
  const canLevel = useGame((s) => s.canLevel)
  const buyTool = useGame((s) => s.buyTool)
  const buyCanUpgrade = useGame((s) => s.buyCanUpgrade)
  const buyItem = useGame((s) => s.buyItem)
  const seeShopItem = useGame((s) => s.seeShopItem)
  const shopNew = useGame((s) => s.shopNew)
  const shop = useGame((s) => s.shop)
  const day = useGame((s) => s.day)
  const st = upgradeState(shop, day)
  const closed = st.status === 'closed'
  const questsDone = useGame((s) => s.questsDone)
  const dex = useGame((s) => s.dex)
  const islandStart = useGame((s) => s.islandStart)
  const stats = useGame((s) => s.stats)
  const ladderOpen = systemOpen('ladder', ctxOf({ day, islandStart, questsDone, dex, stats }))
  const shopLog = useGame((s) => s.shopLog)
  const weeklyBuy = useGame((s) => s.weeklyBuy)
  const buyMonthly = useGame((s) => s.buyMonthly)
  const inventory = useGame((s) => s.inventory)
  const homeStorage = useGame((s) => s.homeStorage)
  const homeFurniture = useGame((s) => s.homeFurniture)
  // 진열은 날짜와 단계로 정해져서 새로고침해도 같다. 같은 날에는 목록이 바뀌지 않는다.
  const stock = useMemo(() => shopStock(st.tier, day), [st.tier, day])
  const keeper = shopkeeperLines(st.tier, day, shopLog.sold)
  const monthly = monthlyFurniture(day)
  const flashDay = isFlashDay(day)
  return (
    <>
      <StampCardRow />
      {closed && <p className="notice">🚧 공사 중이라 문을 닫았어요. 내일 다시 열어요</p>}
      {!closed && (
        <div className="shopkeeper">
          <span className="big" aria-hidden>
            🦝
          </span>
          <div>
            <p>{keeper.name}: {keeper.greeting}</p>
            {keeper.memory && <small className="note">{keeper.memory}</small>}
          </div>
        </div>
      )}
      {/* 가구 줄(이달의 가구, 오늘의 진열)을 누르거나 올리면 여기서 돌아가요 */}
      <FurniturePeek id={peek} />
      {!closed && flashDay && <p className="notice">🚩 오늘은 금요일 반짝 할인! 진열 하나가 절반 값이에요</p>}
      {monthly && (
        <>
          <h3>
            이달의 가구 <small>이번 달 한 번만 살 수 있어요</small>
          </h3>
          <ul className="buy-list">
            <li onPointerEnter={() => setPeek(monthly.itemId)} onClick={() => setPeek(monthly.itemId)}>
              <span className="big">{monthly.icon}</span>
              <span className="name">
                {monthly.name}
                <small className="note">{monthlyBoughtOn(shopLog, day) ? '이번 달엔 이미 샀어요' : `정가 🌰 ${monthly.price.toLocaleString()}`}</small>
                <Owned n={furnitureOwned(monthly.itemId, { bag: inventory, storage: homeStorage, placed: homeFurniture })} />
              </span>
              <button className="primary" disabled={closed || monthlyBoughtOn(shopLog, day) || money < monthly.price} onClick={() => buyMonthly()}>
                {closed ? '공사 중' : monthlyBoughtOn(shopLog, day) ? '샀어요' : money < monthly.price ? `🌰 ${monthly.price.toLocaleString()} 필요해요` : `🌰 ${monthly.price.toLocaleString()} 사기`}
              </button>
            </li>
          </ul>
        </>
      )}
      <h3>도구</h3>
      <ul className="buy-list">
        {FOR_SALE.map((id) => {
          const t = TOOLS[id]
          const owned = tools.includes(id)
          const short = money < t.price
          return (
            <li key={id}>
              <span className="big">
                <ToolIcon id={id} />
              </span>
              <span className="name">
                {t.name}
                {id === 'ladder' && !ladderOpen && <small className="note">조금 더 지나면 살 수 있어요</small>}
              </span>
              <button className="primary" disabled={owned || short || closed || (id === 'ladder' && !ladderOpen)} onClick={() => buyTool(id)}>
                {owned ? '가지고 있어요' : short ? `🌰 ${t.price.toLocaleString()} 필요해요` : `🌰 ${t.price.toLocaleString()} 사기`}
              </button>
            </li>
          )
        })}
        {CAN_UPGRADES.map((u) => {
          const r = canBuyUpgrade(tools.includes('can'), canLevel, st.tier, money, u.level)
          const owned = canLevel >= u.level
          return (
            <li key={u.level}>
              <span className="big">
                <ToolIcon id="can" />
              </span>
              <span className="name">
                {CAN_NAMES[u.level]}
                <small className="note">{owned ? `${CAN_SIDE[u.level]}×${CAN_SIDE[u.level]} 칸에 한 번에 물을 줘요` : r.ok ? `${CAN_SIDE[u.level]}×${CAN_SIDE[u.level]} 칸에 한 번에 물을 줘요` : r.reason}</small>
              </span>
              <button className="primary" disabled={owned || !r.ok || closed} onClick={() => buyCanUpgrade(u.level)}>
                {owned ? '가지고 있어요' : `🌰 ${u.price.toLocaleString()} 사기`}
              </button>
            </li>
          )
        })}
      </ul>
      <h3>
        오늘의 진열 <small>날마다 바뀌어요</small>
      </h3>
      <ul className="buy-list">
        {stock.map((f) => {
          const sold = !f.weekly && isSoldOut(shopLog, day, f.itemId)
          const weeklyDone = !!f.weekly && weeklyBoughtOn(weeklyBuy, day)
          return (
          <li key={`${f.itemId}-${f.weekly ? 'weekly' : 'daily'}`} onPointerEnter={() => ITEMS[f.itemId]?.kind === 'furniture' && setPeek(f.itemId)} onClick={() => { seeShopItem(f.itemId); if (ITEMS[f.itemId]?.kind === 'furniture') setPeek(f.itemId) }}>
            <span className="big">{f.icon}</span>
            <span className="name">
              {f.name}
              {f.flash && <em className="sale flash">반짝 할인</em>}
              {f.sale && !f.flash && <em className="sale">특가</em>}
              {f.weekly && <em className="sale">주간 한정</em>}
              {isNewShopItem(f.itemId, shopNew ?? null, day) && <em className="sale">새</em>}
              {f.sale && <small className="note">정가 🌰 {f.basePrice.toLocaleString()}</small>}
              <small className="note">{CATEGORY_NAME[ITEMS[f.itemId]?.kind ?? ''] ?? ''}</small>
              {ITEMS[f.itemId]?.kind === 'furniture' && <Owned n={furnitureOwned(f.itemId, { bag: inventory, storage: homeStorage, placed: homeFurniture })} />}
            </span>
            <button className="primary" disabled={closed || sold || weeklyDone || money < f.price} onClick={() => buyItem(f.itemId, f.weekly)}>
              {closed ? '공사 중' : sold ? '품절' : weeklyDone ? '다음 주에 만나요' : money < f.price ? `🌰 ${f.price.toLocaleString()} 필요해요` : `🌰 ${f.price.toLocaleString()} 사기`}
            </button>
          </li>
          )
        })}
      </ul>
    </>
  )
}

/** 다음 단계로 키우기. 조건을 하나씩 보여 주고, 공사 중이면 맡긴 상태를 알린다. */
function UpgradeTab() {
  const shop = useGame((s) => s.shop)
  const day = useGame((s) => s.day)
  const money = useGame((s) => s.money)
  const stats = useGame((s) => s.stats)
  const questsDone = useGame((s) => s.questsDone)
  const stars = useGame((s) => s.rating.stars)
  const upgrade = useGame((s) => s.upgradeShop)
  const st = upgradeState(shop, day)
  const cur = tierDef(st.tier)
  const next = st.tier < 3 ? tierDef((st.tier + 1) as ShopTier) : null
  if (!next) {
    return (
      <>
        <div className="upgrade-card">
          <span className="big">🏪</span>
          <div>
            <strong>{cur.name}</strong>
            <small>{lookFor(st.tier).sign} · 가장 큰 가게예요</small>
          </div>
        </div>
        <p className="note">{TOP_TIER_UPGRADE_NOTE}</p>
      </>
    )
  }
  // 별점은 store 의 upgradeShop 과 같은 값을 넘겨야 화면과 실제 올리기가 맞는다
  const checks = unlockChecks(next.tier, { sold: stats.earn ?? 0, spent: stats.spent ?? 0, questsDone, stars })
  const unmet = checks.filter((c) => !c.done).length
  const pending = shop.order !== null
  const short = money < next.upgradeCost
  const label = pending
    ? `🚧 ${tierDef(shop.order!.to).name} 공사 중`
    : unmet
      ? '조건을 채우면 올릴 수 있어요'
      : short
        ? `🌰 ${next.upgradeCost.toLocaleString()} 필요해요`
        : `🌰 ${next.upgradeCost.toLocaleString()} 내고 올리기`
  return (
    <>
      <div className="upgrade-card">
        <span className="big">🏪</span>
        <div>
          <strong>{cur.name}</strong>
          <small>{lookFor(st.tier).sign}</small>
        </div>
      </div>
      <h3>다음: {next.name}</h3>
      {newItemsLine(next.tier) && <p className="note">{newItemsLine(next.tier)}</p>}
      <ul className="goals wide">
        {checks.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            <Bar value={c.have} max={c.need} />
            <small>
              {c.need > 1 ? `${c.have.toLocaleString()}/${c.need.toLocaleString()}` : c.done ? '완료' : '미완'}
            </small>
          </li>
        ))}
      </ul>
      <p className="note">맡긴 다음 날은 문을 닫고, 그다음 날 새 간판으로 다시 열어요.</p>
      <footer>
        <button className="primary" disabled={unmet > 0 || short} onClick={upgrade}>
          {label}
        </button>
      </footer>
    </>
  )
}

export function ShopPanel() {
  const [tab, setTab] = useState<'sell' | 'buy' | 'order' | 'upgrade' | 'reform'>('sell')
  const money = useGame((s) => s.money)
  const shop = useGame((s) => s.shop)
  const day = useGame((s) => s.day)
  const st = upgradeState(shop, day)
  const tier = st.tier
  const sign = lookFor(tier).sign
  const stats = useGame((s) => s.stats)
  const questsDone = useGame((s) => s.questsDone)
  const stars = useGame((s) => s.rating.stars)
  // 다음 단계까지 남은 조건을 맨 위에 한 줄로 보여 준다. 공사 중에는 조건 대신 공사 일정을 보여 준다.
  const nextLine = st.status === 'closed'
    ? `공사 중이라 오늘은 문을 닫았어요. ${Number(st.reopenDay.slice(5, 7))}월 ${Number(st.reopenDay.slice(8))}일 아침에 새 간판을 달아요`
    : shop.order
      ? `${tierDef(shop.order.to).name} 공사를 맡겼어요. 내일은 문을 닫고 모레 새 간판을 달아요`
      : shopNextLine(tier, { sold: stats.earn ?? 0, spent: stats.spent ?? 0, questsDone, stars })
  // 리폼 코너는 상점이 두 단계로 커진 뒤에 열린다
  const reformOpen = shop.tier >= REFORM_TIER
  return (
    <Modal title={sign} tall>
      {nextLine && <p className="shop-next">{nextLine}</p>}
      {/* 가게 탭은 자기 "새로 파는 물건" 줄이 있어서, 여기서는 두 줄이 겹치지 않게 뺀다 */}
      {tab !== 'upgrade' && currentNewLine(tier) && <p className="note shop-new">{currentNewLine(tier)}</p>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sell'} onClick={() => setTab('sell')}>
          팔기
        </button>
        <button role="tab" aria-selected={tab === 'buy'} onClick={() => setTab('buy')}>
          사기
        </button>
        <button role="tab" aria-selected={tab === 'order'} onClick={() => setTab('order')}>
          주문
        </button>
        <button role="tab" aria-selected={tab === 'upgrade'} onClick={() => setTab('upgrade')}>
          가게
        </button>
        {reformOpen && (
          <button role="tab" aria-selected={tab === 'reform'} onClick={() => setTab('reform')}>
            리폼
          </button>
        )}
        <span className="wallet">가진 도토리 🌰 {money.toLocaleString()}</span>
      </div>
      <div className="tab-body">
        {tab === 'sell' ? <SellTab /> : tab === 'buy' ? <BuyTab /> : tab === 'order' ? <OrderTab /> : tab === 'reform' && reformOpen ? <ReformTab /> : <><UpgradeTab />{tab === 'upgrade' && <LedgerBlock />}</>}
      </div>
    </Modal>
  )
}

/** 리폼 코너: 주머니나 방에 있는 가구를 골라 색 변형 하나로 바꾼다. 비용은 도토리와 목재 1. */
function ReformTab() {
  const inventory = useGame((s) => s.inventory)
  const homeFurniture = useGame((s) => s.homeFurniture)
  const homeStorage = useGame((s) => s.homeStorage)
  const money = useGame((s) => s.money)
  const reformFurniture = useGame((s) => s.reformFurniture)
  const tier = useGame((s) => s.shop.tier)
  const [pick, setPick] = useState<string | null>(null)
  const wood = countOf(inventory, 'wood')
  const sources = [
    ...inventory.flatMap((x, index) => (ITEMS[x.id]?.kind === 'furniture' ? [{ key: `bag-${index}`, src: { from: 'bag' as const, index }, itemId: x.id, variant: x.variant, where: '주머니' }] : [])),
    ...homeFurniture.map((p) => ({ key: `home-${p.id}`, src: { from: 'home' as const, id: p.id }, itemId: p.itemId, variant: p.variant, where: '방' })),
    ...homeStorage.flatMap((x, index) => (ITEMS[x.id]?.kind === 'furniture' ? [{ key: `storage-${index}`, src: { from: 'storage' as const, index }, itemId: x.id, variant: x.variant, where: '보관함' }] : [])),
  ]
  const chosen = sources.find((x) => x.key === pick) ?? null
  return (
    <>
      <p className="note">🪵 목재 {wood}개 · 한 번 바꿀 때 도토리 (가구 값의 40%, 최소 {REFORM_MIN_ACORNS})와 목재 {REFORM_WOOD}개가 들어요</p>
      {sources.length === 0 && <p className="note">리폼할 가구가 없어요. 가구를 주머니에 넣어 오세요</p>}
      <ul className="buy-list">
        {sources.map((x) => (
          <li key={x.key}>
            <span className="big">{ITEMS[x.itemId].icon}</span>
            <span className="name">
              {ITEMS[x.itemId].name}
              <small className="note">{x.where} · {variantById(x.variant)?.name ?? '기본 색'}</small>
            </span>
            <button className="primary" aria-pressed={pick === x.key} onClick={() => setPick(pick === x.key ? null : x.key)}>
              {pick === x.key ? '접기' : '색 고르기'}
            </button>
          </li>
        ))}
      </ul>
      {chosen && (
        <>
          <h3>{ITEMS[chosen.itemId].name} 색 고르기</h3>
          {[
            { title: '색 변형', list: VARIANTS },
            { title: '백화점 고급 마감', list: FINISHES },
          ].map((group) => (
            <Fragment key={group.title}>
              <h4>{group.title}</h4>
              <ul className="buy-list">
                {group.list.map((v) => {
                  const now = chosen.variant === v.id
                  const r = canReform(chosen.itemId, v.id, money, wood, tier)
                  return (
                    <li key={v.id}>
                      <span className="big">
                        <span className="swatch" style={{ background: v.color }} />
                      </span>
                      <span className="name">{v.name}</span>
                      <button className="primary reform-pick" disabled={now || !r.ok} onClick={() => reformFurniture(chosen.src, v.id)}>
                        {now ? '지금 색이에요' : r.ok ? `🌰 ${r.acorns.toLocaleString()} + 🪵 ${REFORM_WOOD} 바꾸기` : r.reason}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Fragment>
          ))}
          <p className="note">색 도토리 {reformAcorns(chosen.itemId) ?? 0}, 고급 마감은 가구 값의 3배(1,500~3,000)예요. 목재 {REFORM_WOOD}개가 들어요. 도감에는 기본 가구로만 남아요.</p>
        </>
      )}
    </>
  )
}

function DexSection({ title, ids, donorOnly, unit = '마리', kind }: { title: string; ids: string[]; donorOnly: boolean; unit?: string; kind?: DexKind }) {
  const dex = useGame((s) => s.dex)
  const museum = useGame((s) => s.museum)
  const inventory = useGame((s) => s.inventory)
  const prog = dexProgress(ids, dex)
  const shown = donorOnly ? donorIds(ids, dex, museum, inventory) : ids
  // 분류를 다 채우면 제목 옆에 ✨ 완성을 붙인다(보상은 한 번만 받는다)
  const done = kind ? dexKindDone(kind, dex, []) : false
  return (
    <section className="dex-section">
      <h3>
        {title} <small>{prog.found}/{prog.total} · {prog.pct}%</small>
        {done && <small className="dex-done"> ✨ 완성</small>}
      </h3>
      {donorOnly && shown.length === 0 && <p className="note">지금 기증할 수 있는 종이 없어요</p>}
      <ul className="dex-grid">
        {shown.map((id) => {
          const def = ITEMS[id]
          const n = dex[id]
          return (
            <li key={id}>
              {/* 못 잡은 것은 실루엣으로만 보여 준다 */}
              <span className={n ? 'big' : 'big silhouette'}>{def.icon}</span>
              <span className="name">
                {n ? def.name : '???'}
                {/* 자연사 전시관에 기증한 종은 🏛 표시를 단다 */}
                {museum.includes(id) && <small className="museum-badge" aria-label="자연사 전시관에 기증함" title="자연사 전시관에 기증함">🏛</small>}
                {/* 못 잡은 것도 어디서 언제 나오는지는 알려 줘서 찾아갈 수 있게 한다. */}
                {dexHint(id) && <small className="dex-hint">{dexHint(id)}</small>}
              </span>
              {n ? <span className="price">{n}{unit}</span> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const HEARTS = ['🤍', '💛', '🧡', '💖']
export const SPECIES_ICON = { cat: '🐱', rabbit: '🐰', penguin: '🐧', mole: '🐾', hedgehog: '🦔', bear: '🐻‍❄️', squirrel: '🐿️', chestnut: '🌰', otter: '🦦' }

function Friends() {
  const friendship = useGame((s) => s.friendship)
  const houses = useGame((s) => s.houses)
  const recruits = useGame((s) => s.recruits)
  return (
    <section>
      <h3>섬 친구</h3>
      <ul className="dex-grid">
        {VILLAGERS.filter((v) => !v.guest || recruits.includes(v.id) || (friendship[v.id] ?? 0) > 0).map((v) => {
          const pts = friendship[v.id] ?? 0
          const lv = friendshipLevel(pts)
          const next = nextLevelAt(pts)
          const away = v.newcomer && !houses.includes(v.id)
          // 여행 섬에서 만났지만 아직 초대 안 한 손님
          const met = v.guest && !recruits.includes(v.id) && !houses.includes(v.id)
          return (
            <li key={v.id} className={away ? 'unknown' : ''}>
              <span className="big">{SPECIES_ICON[v.species]}</span>
              <span className="name">
                {v.name}
                {houses.includes(v.id) && ' 🏡'}
              </span>
              <span className="price">
                {met ? '오렌지 섬에서 만났어요' : away ? '집을 지어주면 이사 와요' : `${HEARTS[lv]} ${next === null ? '단짝이에요' : `${next - pts}번 더 만나요`}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function DexPanel() {
  const [tab, setTab] = useState<'species' | 'furniture'>('species')
  // 기증 가능 필터: 켜면 도감 칸마다 지금 전시관에 낼 수 있는 종만 보여 준다
  const [donorOnly, setDonorOnly] = useState(false)
  const dex = useGame((s) => s.dex)
  const museum = useGame((s) => s.museum)
  const inventory = useGame((s) => s.inventory)
  const groups = {
    fish: FISH_TABLE.filter((f) => ITEMS[f.id].kind === 'fish').map((f) => f.id),
    bug: BUG_TABLE.map((b) => b.id),
    fossil: [...FOSSIL_SPECIES],
    // 잠수로 잡는 해산물은 바닷가 생물 칸에 함께 모은다
    tide: [...new Set([...TIDE_TABLE.map((t) => t.id), ...DIVE_SPECIES.map((d) => d.id)])],
    flower: RARE_FLOWERS.map((r) => r.id),
    ore: ORE_IDS,
  }
  // 전시관이 열리기 전에는 기증할 곳이 없으니 칩도 감춘다
  const open = museumOpen(dex)
  const donors = open ? donorIds([...groups.fish, ...groups.bug, ...groups.tide, ...groups.fossil], dex, museum, inventory).length : 0
  return (
    <Modal title="도감">
      <div className="tabs" role="tablist" aria-label="도감 종류">
        <button role="tab" aria-selected={tab === 'species'} onClick={() => setTab('species')}>
          생물
        </button>
        <button role="tab" aria-selected={tab === 'furniture'} onClick={() => setTab('furniture')}>
          가구
        </button>
      </div>
      {tab === 'furniture' ? (
        <FurnitureCatalog />
      ) : (
        <>
          <Friends />
          {open && (
        <div className="dex-filter">
          <button className="chip" aria-pressed={donorOnly} onClick={() => setDonorOnly((v) => !v)}>
            🏛 기증 가능 {donors}
          </button>
        </div>
      )}
          <DexSection title="물고기" ids={groups.fish} donorOnly={donorOnly && open} kind="fish" />
          <DexSection title="벌레" ids={groups.bug} donorOnly={donorOnly && open} kind="bug" />
          <DexSection title="바닷가 생물" ids={groups.tide} donorOnly={donorOnly && open} />
          <DexSection title="화석" ids={groups.fossil} donorOnly={donorOnly && open} />
          <DexSection title="꽃" ids={groups.flower} donorOnly={false} unit="송이" />
          <DexSection title="광석" ids={groups.ore} donorOnly={false} />
          <StarsSection />
          <SkySection />
        </>
      )}
    </Modal>
  )
}

/** 별자리 도감: 망원경으로 처음 본 별자리는 이름이 보이고, 못 본 것은 실루엣과 보는 법을 보여 준다 */
function StarsSection() {
  const seen = useGame((s) => s.starsSeen)
  const total = CONSTELLATIONS.length
  const pct = Math.round((seen.length / total) * 100)
  return (
    <section className="dex-section">
      <h3>
        별자리 <small>{seen.length}/{total} · {pct}%</small>
      </h3>
      <ul className="dex-grid">
        {CONSTELLATIONS.map((c) => {
          const got = seen.includes(c.id)
          return (
            <li key={c.id}>
              <span className={got ? 'big' : 'big silhouette'}>{got ? '✨' : '⭐'}</span>
              <span className="name">
                {got ? c.name : '???'}
                <small className="dex-hint">{SEASON_INFO[c.season].label} · 맑은 밤 망원경</small>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 하늘 기록: 무지개처럼 올려다봐야 남는 것. 봤는지 여부만 보여 준다. */
function SkySection() {
  const rainbow = useGame((s) => s.rainbowSeen)
  return (
    <section className="dex-section">
      <h3>
        하늘 <small>{rainbow ? '1/1' : '0/1'}</small>
      </h3>
      <ul className="dex-grid">
        <li>
          <span className={rainbow ? 'big' : 'big silhouette'}>{rainbow ? '🌈' : '?'}</span>
          <span className="name">
            {rainbow ? '무지개' : '???'}
            <small className="dex-hint">비 갠 오후 2~5시 · 벤치나 망원경으로 올려다보기</small>
          </span>
        </li>
      </ul>
    </section>
  )
}

/** 가구 도감: 한 번이라도 가진 가구는 이름이 보이고, 못 본 가구는 실루엣과 나오는 길을 보여 준다 */
function FurnitureCatalog() {
  const seen = useGame((s) => s.furnitureSeen)
  const [peek, setPeek] = useState<string | null>(null)
  const prog = furnitureProgress(seen)
  return (
    <section className="dex-section">
      <h3>
        가구 <small>{prog.found}/{prog.total} · {prog.pct}%</small>
        {dexKindDone('furniture', {}, seen) && <small className="dex-done"> ✨ 완성</small>}
      </h3>
      {/* 못 본 가구는 실루엣만 보여 주므로 미리보기도 가져 본 가구에만 쓴다 */}
      <FurniturePeek id={peek} />
      <ul className="dex-grid">
        {FURNITURE_IDS.map((id) => {
          const def = ITEMS[id]
          const got = seen.includes(id)
          return (
            <li key={id} onPointerEnter={() => got && setPeek(id)} onClick={() => got && setPeek(id)}>
              <span className={got ? 'big' : 'big silhouette'}>{def.icon}</span>
              <span className="name">
                {got ? def.name : '???'}
                <small className="dex-hint">{furnitureHint(id)}</small>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 가게 장부: 최근 7일 날짜별 판매 막대, 어제와 비교, 많이 판 물건 상위 3개 */
function LedgerBlock() {
  const days = useGame((s) => s.salesLedger)
  const today = useGame((s) => s.day)
  const week = weekTotals(days ?? [], today)
  const max = Math.max(1, ...week.map((w) => w.total))
  const diff = vsYesterday(days ?? [], today)
  const yest = week[week.length - 2].total
  const now = week[week.length - 1].total
  const diffText =
    now === 0 && yest === 0
      ? '아직 판 물건이 없어요'
      : yest === 0
        ? `오늘 도토리 ${now.toLocaleString()}개를 팔았어요`
        : diff === 0
          ? '어제와 같아요'
          : `어제보다 도토리 ${Math.abs(diff).toLocaleString()}개 ${diff > 0 ? '더' : '덜'} 팔았어요`
  const top = topItems(days ?? [], today)
  return (
    <section className="ledger" aria-label="가게 장부">
      <h3>
        가게 장부 <small>최근 7일 판매</small>
      </h3>
      <div className="ledger-bars">
        {week.map((w) => (
          <div className="ledger-col" key={w.day}>
            <span className="ledger-val">{w.total ? `🌰 ${w.total.toLocaleString()}` : '–'}</span>
            <div className="ledger-track">
              <div className={`ledger-fill${w.day === today ? ' today' : ''}`} style={{ height: `${Math.round((w.total / max) * 100)}%` }} />
            </div>
            <span className={`ledger-day${w.day === today ? ' today' : ''}`}>{WEEK_CHARS[new Date(`${w.day}T00:00:00Z`).getUTCDay()]}</span>
          </div>
        ))}
      </div>
      <p className="note">{diffText}</p>
      <p className="note">
        많이 판 물건:{' '}
        {top.length
          ? top.map((t, i) => (
              <span key={t.id} className="ledger-item">
                {i > 0 && ' · '}
                {ITEMS[t.id].icon} {ITEMS[t.id].name} 🌰 {t.amount.toLocaleString()}
              </span>
            ))
          : '아직 없어요'}
      </p>
    </section>
  )
}
const WEEK_CHARS = ['일', '월', '화', '수', '목', '금', '토']

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span style={{ width: `${(value / max) * 100}%` }} />
    </span>
  )
}

/** 섬 이야기 현재 장: 목표 진행과 장을 마치면 받을 보상. 다 마쳤으면 그 말만 보인다. */
function StoryBlock() {
  const s = useGame()
  const cleared = s.storyChapter ?? 0
  const ch = currentChapter(cleared)
  if (!ch) return <p className="empty">섬 이야기를 모두 마쳤어요 🎉</p>
  const ctx = storyCtxOf(s)
  const prog = storyProgress(ch, ctx)
  const got = storyRewards(cleared, cleared + 1)
  // 목표를 다 채운 퀘스트의 보상을 아직 안 받았으면 어디서 받는지 알려 준다
  const claimable = questBoard(s).filter((q) => q.done).map((q) => q.def.id)
  const awaiting = storyAwaitingClaim(ch, ctx, claimable)
  return (
    <div className="quest story-now">
      <div className="quest-head">
        <strong>
          {ch.no}장 · {ch.title}
        </strong>
        <small>{cleared}/{STORY_CHAPTERS.length} 장 마침</small>
      </div>
      <ul className="goals">
        {prog.goals.map((g) => (
          <li key={g.label}>
            <span>{g.label}</span>
            <Bar value={g.current} max={g.target} />
            <small>
              {g.current}/{g.target}
            </small>
          </li>
        ))}
      </ul>
      {awaiting ? <p className="note">🎁 보상을 받으면 다음 장으로 넘어가요(J)</p> : null}
      <p className="note">장을 마치면 도토리 {got.money.toLocaleString()}개{got.miles ? ` · 🏅 ${formatMiles(got.miles)}` : ''}{got.miles ? '을' : '를'} 받고 위원회 편지가 와요</p>
    </div>
  )
}

/** 이번 주 목표: 주마다 세 개. 하나에 마일리지, 셋 모두 채우면 도토리와 편지. */
function WeeklyBlock() {
  const s = useGame()
  if (!weeklyOpen(s.storyChapter ?? 0)) return <p className="empty">섬 이야기를 마치면 이번 주 목표가 열려요</p>
  const view = weeklyView(s.weekly ?? null, s.day, s.stats)
  return (
    <ul className="goals weekly-goals">
      {view.rows.map((r) => (
        <li key={r.stat} className={r.done ? 'done' : ''}>
          <span>{r.label}</span>
          <Bar value={r.current} max={r.target} />
          <small>
            {r.current}/{r.target}
          </small>
        </li>
      ))}
      <li className="note">하나를 채울 때마다 🏅 {WEEKLY_MILES}마일, 셋을 모두 채우면 🌰 도토리와 위원회 편지가 와요{view.bonus ? ' · 이번 주 보상은 받았어요' : ''}</li>
    </ul>
  )
}

/** 퀘스트 수첩. 메인 퀘스트와 오늘의 부탁을 진행도와 함께 보여준다. */
export function QuestPanel() {
  const quests = useGame((s) => s.quests)
  // 섬 이야기를 마친 뒤의 다음 목표 한 줄(HUD 와 같은 목표)
  const afterLine = afterStoryLine(useAfterGoals())
  const stats = useGame((s) => s.stats)
  const day = useGame((s) => s.day)
  const dailyBase = useGame((s) => s.dailyBase)
  const dailyClaimed = useGame((s) => s.dailyClaimed)
  const questsDone = useGame((s) => s.questsDone)
  const claim = useGame((s) => s.claimQuest)
  const requests = useGame((s) => s.requests)
  // 주민 부탁: 오늘 것만 보인다. 날이 바뀌면 자동으로 사라진다.
  const villagerReqs = Object.entries(requests).flatMap(([vid, r]) => {
    const ar = activeReq(r, day)
    return ar ? [{ vid, req: ar }] : []
  })
  // questBoard 는 매번 새 배열을 만들어서 셀렉터 대신 여기서 계산한다.
  const board = useMemo(() => questBoard({ quests, stats, day, dailyBase, dailyClaimed }), [quests, stats, day, dailyBase, dailyClaimed])
  const main = board.filter((q) => !q.def.id.startsWith('daily:'))
  const daily = board.filter((q) => q.def.id.startsWith('daily:'))
  const ready = firstClaimable({ quests, stats, day, dailyBase, dailyClaimed })
  // 오늘의 할 일: 상태에서 매번 새로 만든다. 저장된 마일리지는 정산 기록에서 읽는다.
  const gameState = useGame()
  // 별똥별 소원은 시각이 바뀌면 활성이 된다. 시계가 바뀔 때마다 목록을 다시 만든다.
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const todos = useMemo(() => todayTodos(todoCtxOf(gameState)), [gameState, clockTick])
  const todoMiles = gameState.todo.day === day ? gameState.todo.miles : 0
  // J 로 열었을 때 받을 보상이 있으면 그 자리로 포커스를 옮겨, 화면에서 바로 찾게 한다.
  useEffect(() => {
    if (!ready) return
    document.querySelector<HTMLButtonElement>(`[data-claim="${ready}"]`)?.focus({ preventScroll: false })
  }, [ready])

  const card = (q: (typeof board)[number]) => (
    <li key={q.def.id} className={`quest ${q.done ? 'done' : ''}`}>
      <div className="quest-head">
        <strong>{q.def.title}</strong>
        <small>{q.def.giver}</small>
      </div>
      <p>{q.def.story}</p>
      <ul className="goals">
        {questProgress(q.def, stats, q.baseline).map((g) => (
          <li key={g.goal.stat}>
            <span>{g.goal.label}</span>
            <Bar value={g.current} max={g.goal.target} />
            <small>
              {g.current}/{g.goal.target}
            </small>
          </li>
        ))}
      </ul>
      {q.done && (
        <button className="primary" data-claim={q.def.id} onClick={() => claim(q.def.id)}>
          보상 받기
        </button>
      )}
    </li>
  )

  return (
    <Modal title="퀘스트 수첩">
      {afterLine && <p className="after-story" role="status">{afterLine}</p>}
      <h3>섬 이야기</h3>
      <StoryBlock />
      <h3>이번 주 목표</h3>
      <WeeklyBlock />
      {ready && <p className="quest-hint">받을 보상이 있어요. Enter 나 E 로 바로 받아요</p>}
      <h3>오늘의 할 일</h3>
      <ul className="todo-list">
        {todos.map((t) => (
          // 자동 판정이라 누를 수 없다. 버튼이 아니고 커서도 바뀌지 않는다.
          <li key={t.id} className={`todo-item ${t.done ? 'done' : ''} ${t.later ? 'later' : ''}`} aria-label={`${t.title}${t.done ? ', 완료' : ''}`}>
            <span className="todo-check" aria-hidden />
            <span className="todo-icon" aria-hidden>
              {TODO_ICON[t.id]}
            </span>
            <span className="todo-title">{t.title}</span>
            {t.done && <span className="todo-badge">+{formatMiles(TODO_REWARD)}</span>}
          </li>
        ))}
      </ul>
      <p className="note">하루에 최대 {formatMiles(TODO_DAY_CAP)}까지 받아요. 오늘 {formatMiles(todoMiles)} 받았어요</p>
      <h3>이야기</h3>
      {main.length ? <ul className="quest-list">{main.map(card)}</ul> : <p className="empty">지금은 모든 이야기를 마쳤어요 🎉</p>}
      <h3>오늘의 부탁</h3>
      {daily.length ? <ul className="quest-list">{daily.map(card)}</ul> : <p className="empty">오늘 부탁은 다 들어줬어요. 내일 또 만나요</p>}
      <h3>주민 부탁</h3>
      {villagerReqs.length ? (
        <ul className="quest-list">
          {villagerReqs.map(({ vid, req }) => (
            <li key={vid} className={`quest ${req.done ? 'done' : ''}`}>
              <div className="quest-head">
                <strong>{VILLAGERS.find((o) => o.id === vid)?.name ?? vid}</strong>
                <small>{req.done ? '마쳤어요' : '오늘 안에'}</small>
              </div>
              <p>{reqText(req, (id) => VILLAGERS.find((o) => o.id === id)?.name ?? '')}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">지금 주민들이 따로 부탁한 일은 없어요</p>
      )}
      <p className="done-count">마친 이야기 {questsDone.length}개</p>
    </Modal>
  )
}
