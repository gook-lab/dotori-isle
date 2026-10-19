import { useState } from 'react'
import { canUpgrade, HOME_SITE, hasAttic, hasCellar, hasSideRoom, homeDef, type HomeStage, loanLabel, nextStage, storageSlots } from '../core/home'
import { ATTIC_CELLS, CELLAR_CELLS, SIDE_CELLS } from '../core/interior'
import { upgradeLines, upgradePreview } from '../core/upgradePreview'
import { shopFirstHint } from '../core/shopProgress'
import { FENCE_FOR_SALE, GARDEN_PERMIT } from '../core/fence'
import { formatMiles } from '../core/miles'
import { ITEMS } from '../core/items'
import { DEFAULT_PAINT, INTERIOR_WALLS, INTERIOR_WALL_COST, interiorAffordable, PAINT_COST, PAINT_OPTIONS, PAINT_PARTS, PAINT_PART_NAME, paintAffordable, paintColors, paintHint } from '../core/homePaint'
import { frameFloor, frameHung, scoreHome, scoreSummaryLine } from '../core/homeScore'
import { homeTopLine } from '../core/loanGuide'
import { currentGift, NEW_ISLAND_GIFT } from '../core/islandGift'
import { decodeGarden, gardenStats } from '../core/gardenTiles'
import { GARDEN_RANGE_TEXT } from '../core/gardenRange'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 단계에 열린 방마다 따로 있는 가구 칸을 덧붙인다(다락 4×3, 옆방 5×4, 지하실 6×5). 본채 방바닥 가구 칸과 따로 센다. */
const roomNote = (stage: HomeStage) => {
  const rooms: string[] = []
  if (hasAttic(stage)) rooms.push(`다락 ${ATTIC_CELLS.w}×${ATTIC_CELLS.h}칸`)
  if (hasSideRoom(stage)) rooms.push(`옆방 ${SIDE_CELLS.w}×${SIDE_CELLS.h}칸`)
  if (hasCellar(stage)) rooms.push(`지하실 ${CELLAR_CELLS.w}×${CELLAR_CELLS.h}칸`)
  return rooms.map((r) => ` · ${r}`).join('')
}

/** 집 상담: 지금 집, 다음 집, 빚. 다음 집은 빚을 다 갚아야 맡길 수 있다. */
export function HomePanel() {
  const home = useGame((s) => s.home)
  const orderHome = useGame((s) => s.orderHome)
  const permit = useGame((s) => s.gardenPermit)
  const buyPermit = useGame((s) => s.buyGardenPermit)
  const buyFence = useGame((s) => s.buyFence)
  const startGardenPaint = useGame((s) => s.startGardenPaint)
  const paint = useGame((s) => s.homePaint ?? DEFAULT_PAINT)
  const homeFurniture = useGame((s) => s.homeFurniture)
  const wallPhoto = useGame((s) => s.wallPhoto)
  const placed = useGame((s) => s.placed)
  const gardenTiles = useGame((s) => s.gardenTiles)
  const money = useGame((s) => s.money)
  const paintHome = useGame((s) => s.paintHome)
  const interiorWall = useGame((s) => s.interiorWall)
  const paintInterior = useGame((s) => s.paintInterior)
  const islandGift = useGame((s) => s.islandGift)
  const [ask, setAsk] = useState(false)
  const cur = homeDef(home.stage)
  const next = nextStage(home.stage)
  const gate = canUpgrade(home.stage, home.loan)
  const preview = next ? upgradePreview(home.stage) : null
  const shop = useGame((s) => s.shop)
  const shopStats = useGame((s) => s.stats)
  const shopQuests = useGame((s) => s.questsDone)
  const shopStars = useGame((s) => s.rating.stars)
  const shopHint = shopFirstHint({ loan: home.loan, tier: shop.tier, pending: shop.order !== null, stats: { sold: shopStats.earn ?? 0, spent: shopStats.spent ?? 0, questsDone: shopQuests, stars: shopStars } })
  return (
    <Modal title="집 상담">
      <div className="upgrade-card">
        <span className="big">{cur.icon}</span>
        <div>
          <strong>{cur.name}</strong>
          <small>
            {cur.look.label} · 가구 칸 {cur.grid.w}×{cur.grid.h} · 보관 {storageSlots(home.stage)}칸{roomNote(home.stage)}
          </small>
        </div>
      </div>
      <p className="loan-line">{loanLabel(home.loan)}</p>
      <p className="note">{scoreSummaryLine(scoreHome({ stage: home.stage, furniture: homeFurniture, framed: frameHung(!!wallPhoto, homeFurniture), framedFloor: frameFloor(!!wallPhoto, homeFurniture), garden: gardenStats(placed, decodeGarden(gardenTiles), HOME_SITE) }).total)}</p>
      {home.order ? (
        <p className="notice">🏗️ {homeDef(home.order.to).name} 짓는 중이에요. 내일 아침에 완성돼요</p>
      ) : next ? (
        <section className="home-part">
          <h3>
            다음: {next.icon} {next.name}
          </h3>
          <p className="note">
            {next.look.label} · 대출 {next.loan.toLocaleString()}개 · 보관 {next.storage}칸{roomNote(next.stage)}
          </p>
          {preview && (
            <div className="upgrade-preview" aria-label="증축 미리보기">
              <strong>증축하면 이렇게 바뀌어요</strong>
              <ul>
                {upgradeLines(preview).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {!gate.ok ? (
            home.loan > 0 ? (
              <div className="home-block" role="note">
                <p>대출을 다 갚아야 다음 집을 지을 수 있어요</p>
                <p>
                  남은 대출 <strong>{home.loan.toLocaleString()}개</strong>
                </p>
                <p className="note">ATM은 도토리 상점 안에 있어요. 거기서 대출을 갚아요.</p>
              </div>
            ) : (
              <p className="empty">{gate.reason}</p>
            )
          ) : ask ? (
            <div className="confirm">
              <p>대출 {next.loan.toLocaleString()}개를 잡고 짓기를 맡길까요? 대출은 ATM 에서 갚아요.</p>
              <footer className="two">
                <button className="ghost" onClick={() => setAsk(false)}>
                  다음에
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setAsk(false)
                    orderHome()
                  }}
                >
                  네, 맡겨요
                </button>
              </footer>
            </div>
          ) : (
            <>
              {shopHint && <p className="note upgrade-hint">{shopHint}</p>}
            <footer>
              <button className="primary" onClick={() => setAsk(true)}>
                짓기 맡기기 · 대출 {next.loan.toLocaleString()}
              </button>
            </footer>
            </>
          )}
        </section>
      ) : (
        <>
          <p className="empty">가장 큰 집이에요 🎉</p>
          {home.loan === 0 && !home.order && <p className="note">{homeTopLine(currentGift(islandGift ?? NEW_ISLAND_GIFT) !== null)}</p>}
        </>
      )}
      {home.stage >= 1 && !home.order && (
        <section className="home-part">
          <h3>집 꾸미기</h3>
          <p className="note">고르면 바로 칠해져요. 한 번 바꿀 때마다 도토리가 들어요</p>
          <p className="note">{paintHint(money, paint)}</p>
          {PAINT_PARTS.map((part) => (
            <div key={part} className="paint-row">
              <div className="paint-head">
                <span className="paint-label">
                  {PAINT_PART_NAME[part]} 🌰 {PAINT_COST[part].toLocaleString()}
                </span>
                <small className="paint-name">{PAINT_OPTIONS[part][paint[part]]?.name}</small>
              </div>
              <div className="paint-swatches" role="radiogroup" aria-label={`${PAINT_PART_NAME[part]} 색`}>
                {PAINT_OPTIONS[part].map((opt, i) => (
                  <button
                    key={opt.name}
                    type="button"
                    role="radio"
                    aria-checked={paint[part] === i}
                    aria-label={opt.name}
                    title={opt.name}
                    className={`paint-swatch${paint[part] === i ? ' on' : ''}`}
                    style={{ background: opt.color ?? paintColors(home.stage, DEFAULT_PAINT)[part], opacity: paintAffordable(money, part, i, paint) ? 1 : 0.45 }}
                    onClick={() => paintHome(part, i)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="paint-row">
            <div className="paint-head">
              <span className="paint-label">
                실내 벽지 🌰 {INTERIOR_WALL_COST.toLocaleString()}
              </span>
              <small className="paint-name">{INTERIOR_WALLS[interiorWall]?.name}</small>
            </div>
            <div className="paint-swatches" role="radiogroup" aria-label="실내 벽지 색">
              {INTERIOR_WALLS.map((opt, i) => (
                <button
                  key={opt.name}
                  type="button"
                  role="radio"
                  aria-checked={interiorWall === i}
                  aria-label={opt.name}
                  title={opt.name}
                  className={`paint-swatch${interiorWall === i ? ' on' : ''}`}
                  style={{ background: opt.color, opacity: interiorAffordable(money, i, interiorWall) ? 1 : 0.45 }}
                  onClick={() => paintInterior(i)}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="home-part">
        <h3>정원 꾸미기</h3>
        {permit ? (
          <>
            <p className="note">{GARDEN_RANGE_TEXT}. 주머니 울타리를 골라 E 로 놓아요. 옆 칸과 이어져요</p>
            <footer className="two">
              <button className="ghost" onClick={() => buyFence('fence-white')}>
                하얀 나무 울타리 🌰 {FENCE_FOR_SALE['fence-white']?.toLocaleString()}
              </button>
              <button className="ghost" onClick={() => buyFence('fence-stone')}>
                낮은 돌담 🌰 {FENCE_FOR_SALE['fence-stone']?.toLocaleString()}
              </button>
            </footer>
            <p className="note">바닥은 E 로 바라보는 칸에 깔고, 같은 칸에서 한 번 더 E 하면 걷어요</p>
            <footer>
              <button className="ghost" onClick={() => startGardenPaint('gravel')}>
                자갈 바닥
              </button>
              <button className="ghost" onClick={() => startGardenPaint('brick')}>
                벽돌 바닥
              </button>
              <button className="ghost" onClick={() => startGardenPaint('deck')}>
                나무 데크
              </button>
            </footer>
          </>
        ) : (
          <>
            <p className="note">한 번만 받으면 돼요. 나무 울타리 스무 개를 함께 줘요</p>
            <footer className="stack">
              <button className="primary" disabled={money < GARDEN_PERMIT.money} onClick={() => buyPermit('money')}>
                {money < GARDEN_PERMIT.money ? `도토리 ${GARDEN_PERMIT.money.toLocaleString()}개 필요해요` : `도토리 ${GARDEN_PERMIT.money.toLocaleString()}개로 받기`}
              </button>
              <button className="ghost" onClick={() => buyPermit('miles')}>
                {formatMiles(GARDEN_PERMIT.miles)}로 받기
              </button>
            </footer>
          </>
        )}
      </section>
    </Modal>
  )
}

/** 집 보관함: 주머니 물건을 보관하고 꺼낸다. 주머니와 보관함 칸 수를 따로 본다. */
export function StoragePanel() {
  const inventory = useGame((s) => s.inventory)
  const storage = useGame((s) => s.homeStorage)
  const stage = useGame((s) => s.home.stage)
  const pocket = useGame((s) => s.pocket)
  const toStorage = useGame((s) => s.moveToStorage)
  const fromStorage = useGame((s) => s.takeFromStorage)
  return (
    <Modal title="집 보관함">
      <p className="note">
        보관 {storage.length}/{storageSlots(stage)}칸 · 주머니 {inventory.length}/{pocket}칸
      </p>
      <div className="store-cols">
        <section>
          <h3>주머니</h3>
          {inventory.length ? (
            <ul className="sell-list">
              {inventory.map((slot, i) => (
                <li key={`${slot.id}-${i}`}>
                  <button onClick={() => toStorage(i)}>
                    <span className="big">{ITEMS[slot.id].icon}</span>
                    <span className="name">
                      {ITEMS[slot.id].name}
                      {slot.count > 1 && ` ×${slot.count}`}
                    </span>
                    <span className="price">넣기 →</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">주머니가 비었어요</p>
          )}
        </section>
        <section>
          <h3>보관함</h3>
          {storage.length ? (
            <ul className="sell-list">
              {storage.map((slot, i) => (
                <li key={`${slot.id}-${i}`}>
                  <button onClick={() => fromStorage(i)}>
                    <span className="big">{ITEMS[slot.id].icon}</span>
                    <span className="name">
                      {ITEMS[slot.id].name}
                      {slot.count > 1 && ` ×${slot.count}`}
                    </span>
                    <span className="price">← 꺼내기</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">보관한 물건이 없어요</p>
          )}
        </section>
      </div>
    </Modal>
  )
}
