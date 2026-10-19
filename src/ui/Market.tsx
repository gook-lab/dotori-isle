import { useMemo } from 'react'
import { ITEMS } from '../core/items'
import { dayIndex } from '../core/economy'
import { boughtThisVisit, isMarketDay, marketStock } from '../core/market'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 밤송이의 인사. 장날마다 돌아가며 한 줄씩 한다. */
const GREETINGS = ['어서 와! 오늘만 나온 물건이 있어, 구경하고 가.', '또 와 줘서 고마워! 이번 장에는 특별한 것만 들고 왔어.', '쭈뼛쭈뼛 말고 편하게 골라 봐. 가시 조심!']

/** 토요일 장터 가판대. 희귀 가구는 방문마다 점마다 한 개, 꽃씨 꾸러미와 오늘만 주머니도 방문마다 한 번이다. */
export function MarketPanel() {
  const day = useGame((s) => s.day)
  const money = useGame((s) => s.money)
  const bought = useGame((s) => s.marketBought)
  const buy = useGame((s) => s.buyMarket)
  // 진열은 날짜로 정해져서 같은 장날에는 목록이 바뀌지 않는다.
  const stock = useMemo(() => marketStock(day), [day])
  if (!isMarketDay(day)) {
    return (
      <Modal title="장터">
        <p className="empty">장터는 토요일에만 열려요. 떠돌이 상인이 다음 장날에 다시 와요</p>
      </Modal>
    )
  }
  const row = (id: string, icon: string, name: string, note: string, price: number) => {
    const done = boughtThisVisit(bought, day, id)
    const short = money < price
    return (
      <li key={id}>
        <span className="big">{icon}</span>
        <span className="name">
          {name}
          <small className="note">{note}</small>
        </span>
        <button className="primary" disabled={done || short} onClick={() => buy(id)}>
          {done ? '이미 샀어요' : short ? `🌰 ${price.toLocaleString()} 필요해요` : `🌰 ${price.toLocaleString()} 사기`}
        </button>
      </li>
    )
  }
  return (
    <Modal title="떠돌이 장터">
      <p className="merchant-say">
        <b>밤송이</b> <span>“{GREETINGS[((dayIndex(day) ?? 0) % GREETINGS.length + GREETINGS.length) % GREETINGS.length]}”</span>
      </p>
      <h3>희귀 가구 <small>이번 장날 세 점</small></h3>
      <ul className="buy-list">
        {stock.rare.map((r) => row(r.itemId, ITEMS[r.itemId].icon, ITEMS[r.itemId].name, '장터 한정', r.price))}
      </ul>
      <h3>꾸러미</h3>
      <ul className="buy-list">
        {row('seed', '🌱', `꽃씨 ${stock.seed.count}개 꾸러미`, '꽃밭에 나눠 심어요', stock.seed.price)}
        {row('mystery', '🎁', '오늘만 주머니', '열기 전엔 몰라요', stock.mystery.price)}
      </ul>
    </Modal>
  )
}
