import { currentGift, fundedAmount, fundRoom, GIFT_PROJECTS, GIFT_PROJECTS_2, giftLine, type IslandGiftState, NEW_ISLAND_GIFT, warmFundOn } from '../core/islandGift'
import { formatMiles } from '../core/miles'
import { useGame } from '../game/store'
import { Modal } from './Panels'

const acornText = (n: number) => `${n.toLocaleString()}개`

/**
 * 마을회관 접수대의 섬 가꾸기 기부 패널. 1차는 마일, 1차를 다 들이면 2차를 도토리로 기부한다.
 * 한 줄 진행과 시설 목록, 기부 버튼 두 개를 둔다. 두 단계가 같은 자리를 쓴다.
 */
export function IslandGiftPanel() {
  const gift: IslandGiftState = useGame((s) => s.islandGift) ?? NEW_ISLAND_GIFT
  const acorn: IslandGiftState = useGame((s) => s.islandAcorn) ?? NEW_ISLAND_GIFT
  const miles = useGame((s) => s.miles)
  const money = useGame((s) => s.money)
  const day = useGame((s) => s.day)
  const donate = useGame((s) => s.donateGift)
  const donateAcorn = useGame((s) => s.donateAcornGift)
  const phase2 = currentGift(gift) === null
  const list = phase2 ? GIFT_PROJECTS_2 : GIFT_PROJECTS
  const state = phase2 ? acorn : gift
  const cur = currentGift(state, list)
  const have = phase2 ? money : miles
  const fmt = phase2 ? acornText : formatMiles
  const left = cur ? cur.cost - state.fund : 0
  // 따뜻한 모금 주간의 표시값과 한 번에 낼 수 있는 한도는 core 가 정한다(실제 적립과 같은 함수). 2차는 도토리라 1.2배가 없다.
  const warm = !phase2 && !!cur && warmFundOn(day)
  const room = phase2 ? left : fundRoom(left, day)
  const canGive = !!cur && !state.ready && have > 0 && left > 0
  const most = Math.min(have, room)
  const step = phase2 ? 1000 : 100
  const give = (n: number) => (phase2 ? donateAcorn(n) : donate(n))
  return (
    <Modal title={phase2 ? '섬 가꾸기 2차 기부' : '섬 가꾸기 기부'}>
      <p className="note">{phase2 ? '1차를 다 들였어요. 2차는 도토리로 기부해요' : '마일을 모아 섬 공공시설을 하나씩 들여요. 값이 차면 다음 날 아침에 섬에 나타나요'}</p>
      <div className="miles-balance">{phase2 ? <>🌰 <strong>{acornText(money)}</strong></> : <>🏅 <strong>{formatMiles(miles)}</strong></>}</div>
      <p className="note" role="status">{giftLine(state, list, fmt)}</p>
      {warm && (
        <p className="note">
          따뜻한 모금 주간이에요. 기부하면 1.2배로 쌓여요 <span className="nowrap">(100마일 → {formatMiles(fundedAmount(100, day))} 적립)</span>
        </p>
      )}
      <ul className="buy-list">
        {list.map((p, i) => {
          const st = i < state.built ? '완성' : i === state.built ? (state.ready ? '내일 완성' : '진행 중') : '대기'
          return (
            <li key={p.id}>
              <span className="big">{p.icon}</span>
              <span className="name">
                {p.name}
                <small className="note">{i === state.built ? `${state.fund.toLocaleString()}/${fmt(p.cost)}` : fmt(p.cost)} · {st}</small>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="home-block gift-actions">
        <button className="primary" disabled={!canGive || have < step || room < step} onClick={() => give(step)}>
          {phase2 ? `도토리 ${acornText(step)}` : `${formatMiles(step)} 기부`}
        </button>
        <button className="primary" disabled={!canGive} onClick={() => give(most)}>
          {canGive ? `가능한 만큼(${fmt(most)})` : state.ready ? '내일 아침에 완성돼요' : cur ? (phase2 ? '도토리를 모아 오세요' : '마일을 모아 오세요') : '모두 마쳤어요'}
        </button>
      </div>
    </Modal>
  )
}
