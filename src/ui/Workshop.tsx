import { useMemo } from 'react'
import { countOf } from '../core/inventory'
import { ITEMS } from '../core/items'
import { formatMiles, MILE_SHOP, MILESTONES, POCKET_MAX, tierReached } from '../core/miles'
import { canCraft, RECIPES } from '../core/recipes'
import { islandRating, ratingInputOf, ratingTip } from '../core/rating'
import { TREES } from '../core/world'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 작업대: 아는 레시피와 필요한 재료, 만들기 버튼 */
export function CraftPanel() {
  const recipes = useGame((s) => s.recipes)
  const inventory = useGame((s) => s.inventory)
  const craftItem = useGame((s) => s.craftItem)
  const known = RECIPES.filter((r) => recipes.includes(r.id))
  const unknown = RECIPES.length - known.length
  return (
    <Modal title="작업대">
      <ul className="recipe-list">
        {known.map((r) => {
          const item = ITEMS[r.id]
          const ok = canCraft(r, inventory)
          return (
            <li key={r.id} className={ok ? 'ready' : ''}>
              <span className="big">{item.icon}</span>
              <div className="recipe-body">
                <strong>{item.name}</strong>
                <span className="mats">
                  {Object.entries(r.materials).map(([id, n]) => {
                    const have = countOf(inventory, id)
                    return (
                      <span key={id} className={have >= n ? 'enough' : 'short'}>
                        {ITEMS[id].icon} {have}/{n}
                      </span>
                    )
                  })}
                </span>
              </div>
              <button className="primary" disabled={!ok} onClick={() => craftItem(r.id)}>
                만들기
              </button>
            </li>
          )
        })}
      </ul>
      {unknown > 0 && <p className="empty">아직 모르는 레시피가 {unknown}개 있어요. 보물 자리나 퀘스트, 마일로 배워요</p>}
    </Modal>
  )
}

/** 도토리 마일리지: 업적 진행도와 교환소 */
export function MilesPanel() {
  const miles = useGame((s) => s.miles)
  const savings = useGame((s) => s.bank.savings)
  const stats = useGame((s) => s.stats)
  const pocket = useGame((s) => s.pocket)
  const exchange = useGame((s) => s.exchange)
  const placed = useGame((s) => s.placed)
  const plants = useGame((s) => s.plants)
  const holes = useGame((s) => s.holes)
  const ground = useGame((s) => s.ground)
  const houses = useGame((s) => s.houses)
  const shop = useGame((s) => s.shop)
  const museum = useGame((s) => s.museum)
  const felled = useGame((s) => s.felled)
  const day = useGame((s) => s.day)
  const lastRating = useGame((s) => s.rating)
  // 별점은 지금 섬 상태로 매긴다. 월요일 편지와 같은 식이지만 편지는 그날 한 번만 온다.
  const rating = useMemo(() => {
    const input = ratingInputOf({ placed, plants, holes, ground, houses, shop, museum, felled, day }, TREES, (id) => ITEMS[id]?.kind === 'junk')
    return { ...islandRating(input), tip: ratingTip(input) }
  }, [placed, plants, holes, ground, houses, shop, museum, felled, day])
  return (
    <Modal title="도토리 마일리지">
      <div className="miles-balance">
        🏅 <strong>{formatMiles(miles)}</strong>
      </div>
      {/* 통장 잔액은 여기서 한 줄로 보고, 넣고 빼기는 ATM 에서 한다. */}
      <p className="note">🐿️ 통장에 도토리 {savings.toLocaleString()}개 · ATM 에서 넣고 빼요</p>
      <p className="note">🏧 쓸 수 있는 곳: ATM 마일리지 상품(쿠폰·꽃씨·목재·이자 한도 등)</p>
      <h3>섬 별점</h3>
      <p className="note">
        <span className="stars">{'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}</span> 지금 {rating.stars}별 · {rating.score}/100점
        {lastRating.day ? ` · 지난 월요일 편지는 ${lastRating.stars}별이었어요` : ''}
      </p>
      <p className="note">{rating.tip ? `💡 ${rating.tip.text}.` : '별 다섯 개예요! 이 섬이 정말 자랑스러워요.'}</p>
      <h3>교환소</h3>
      <ul className="buy-list">
        {MILE_SHOP.map((r) => {
          const maxed = r.id === 'pocket' && pocket >= POCKET_MAX
          const short = miles < r.cost
          return (
            <li key={r.id}>
              <span className="big">{r.icon}</span>
              <span className="name">
                {r.name}
                <small className="note">{r.note}</small>
              </span>
              <button className="primary" disabled={short || maxed} onClick={() => exchange(r.id)}>
                {maxed ? '최대예요' : short ? `${formatMiles(r.cost)} 필요해요` : formatMiles(r.cost)}
              </button>
            </li>
          )
        })}
      </ul>
      <h3>섬 생활 업적</h3>
      <ul className="milestones">
        {MILESTONES.map((m) => {
          const tier = tierReached(m, stats)
          const next = m.tiers[tier]
          const v = stats[m.stat] ?? 0
          return (
            <li key={m.id}>
              <span className="stars">{'★'.repeat(tier)}{'☆'.repeat(m.tiers.length - tier)}</span>
              <span className="name">{m.title}</span>
              <small>{next === undefined ? '완료!' : `${v.toLocaleString()}/${next.toLocaleString()} · +${formatMiles(m.miles[tier])}`}</small>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
