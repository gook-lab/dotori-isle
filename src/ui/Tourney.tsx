import { ITEMS } from '../core/items'
import { SCORE_TIERS, TOURNEY_PRIZES } from '../core/tourney'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 점수 구간을 마릿수 오름차순으로 적는다. 참가상(0점)은 뺀다. */
const TIER_NOTE = SCORE_TIERS.filter((t) => t.points > 0)
  .slice()
  .reverse()
  .map((t) => `${t.min}마리 ${t.name} ${t.points}점`)
  .join(' · ')

/** 낚시 대회 진행자 창: 가진 포인트로 대회 상품을 바꾼다. */
export function TourneyPanel() {
  const tourney = useGame((s) => s.tourney)
  const exchange = useGame((s) => s.exchangeTourney)
  return (
    <Modal title="낚시 대회 상품">
      <p className="note">
        포인트 <b>{tourney.points}</b> · 일요일 낮에 진행자 앞에서 3분 판에 나가면 마릿수만큼 포인트를 받아요
      </p>
      <p className="note">
        {TIER_NOTE}
      </p>
      <ul className="buy-list">
        {TOURNEY_PRIZES.map((p) => {
          const item = ITEMS[p.id]
          const ok = tourney.points >= p.cost
          return (
            <li key={p.id}>
              <span className="big">{item.icon}</span>
              <span className="name">
                {item.name}
                <small className="note">포인트 {p.cost}</small>
              </span>
              <button className="primary" disabled={!ok} onClick={() => exchange(p.id)}>
                {ok ? `포인트 ${p.cost} 바꾸기` : `포인트 ${p.cost - tourney.points} 모자라요`}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
