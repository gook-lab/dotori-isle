import { ITEMS } from '../core/items'
import { festivalOn, progressOn } from '../core/festivals'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 계절 축제 패널: 오늘 축제의 할 일, 진행 수, 받을 선물. 수확제에서는 과일을 바친다. */
export function FestivalPanel() {
  const day = useGame((s) => s.day)
  const inv = useGame((s) => s.inventory)
  const fest = useGame((s) => s.festival)
  const offer = useGame((s) => s.festivalOffer)
  const f = festivalOn(day)
  if (!f) {
    return (
      <Modal title="계절 축제">
        <p className="empty">오늘은 축제가 없어요. 계절마다 그 달 15일에 광장에서 열려요.</p>
      </Modal>
    )
  }
  const n = progressOn(fest, day)
  const claimed = fest.claimed.includes(day)
  const fruits = [...new Set(inv.map((x) => x.id))].filter((id) => ITEMS[id]?.kind === 'fruit')
  const reward = ITEMS[f.reward]
  return (
    <Modal title={`${f.icon} ${f.name}`}>
      <p className="note">{f.goal}</p>
      <p className="note">
        진행 {Math.min(n, f.target)}/{f.target} · 선물 {reward.icon} {reward.name} (축제 전용)
      </p>
      {claimed && <p className="note">선물을 편지함에 보냈어요. 편지함에서 받아요.</p>}
      {f.task === 'offer' && !claimed && (
        <>
          <h3>바칠 과일</h3>
          {fruits.length === 0 && <p className="empty">가진 과일이 없어요. 과일을 더 모아 와요.</p>}
          <ul className="buy-list">
            {fruits.map((id) => (
              <li key={id}>
                <span className="big">{ITEMS[id].icon}</span>
                <span className="name">{ITEMS[id].name}</span>
                <button className="primary" disabled={n >= f.target} onClick={() => offer(id)}>
                  바치기
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {f.task === 'sit' && !claimed && <p className="note">밤에 벤치나 의자에 앉으면 불꽃을 본 것으로 쳐요.</p>}
      {f.task === 'snowman' && !claimed && <p className="note">눈사람 인형을 섬에 놓으면 대회에 낸 것으로 쳐요.</p>}
      {f.task === 'water' && !claimed && <p className="note">꽃에 물을 주면 진행이 올라가요.</p>}
    </Modal>
  )
}
