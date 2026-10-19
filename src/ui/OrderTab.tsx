import { checkOrder, ORDER_DAILY_MAX } from '../core/catalogOrder'
import { ITEMS } from '../core/items'
import { useGame } from '../game/store'
import { FurniturePeek } from './FurniturePeek'
import { useState } from 'react'

/** 상점 「주문」 탭: 한 번이라도 가져 본 가구를 정가로 주문하면 다음 날 아침 우체통에 소포로 온다. */
export function OrderTab() {
  const [peek, setPeek] = useState<string | null>(null)
  const money = useGame((s) => s.money)
  const day = useGame((s) => s.day)
  const seen = useGame((s) => s.furnitureSeen)
  const orders = useGame((s) => s.orders ?? [])
  const orderCatalog = useGame((s) => s.orderCatalog)
  const today = orders.filter((o) => o.day === day).length
  const list = seen.filter((id) => ITEMS[id]?.kind === 'furniture')
  return (
    <>
      <p className="note">
        가져 본 가구를 정가로 주문해요. 하루 {ORDER_DAILY_MAX}개까지이고, 오늘 {today}개 주문했어요. 다음 날 아침 우체통에 소포 편지로 와요.
      </p>
      {list.length === 0 ? (
        <p className="empty">아직 가져 본 가구가 없어요. 섬에서 가구를 하나 손에 넣어 봐요</p>
      ) : (
        <>
          <FurniturePeek id={peek} />
        <ul className="buy-list">
          {list.map((id) => {
            const it = ITEMS[id]
            const c = checkOrder(id, { day, money, seen, orders })
            return (
              <li key={id} onPointerEnter={() => setPeek(id)} onClick={() => setPeek(id)}>
                <span className="big">{it.icon}</span>
                <span className="name">
                  {it.name}
                  <small className="note">{c.ok || c.price === undefined ? (c.ok ? `정가 🌰 ${c.price.toLocaleString()}` : c.reason) : `정가 🌰 ${c.price.toLocaleString()} · ${c.reason}`}</small>
                </span>
                <button className="primary" disabled={!c.ok} onClick={() => orderCatalog(id)}>
                  {c.ok ? `🌰 ${c.price.toLocaleString()} 주문` : '주문할 수 없어요'}
                </button>
              </li>
            )
          })}
        </ul>
        </>
      )}
      {orders.length > 0 && (
        <>
          <h3>
            내일 아침 도착 <small>소포 편지로 우체통에 와요</small>
          </h3>
          <ul className="buy-list">
            {orders.map((o, i) => (
              <li key={`${o.day}-${o.itemId}-${i}`}>
                <span className="big">{ITEMS[o.itemId]?.icon}</span>
                <span className="name">
                  {ITEMS[o.itemId]?.name}
                  <small className="note">{o.day} 주문</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
