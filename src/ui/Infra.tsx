import { BRIDGE_COST, BRIDGE_MAX, builtBy, refundOf, STAIR_COST, STAIR_MAX } from '../core/infra'
import { PATH_KINDS, PATH_MAX, PATH_NAME, PERMIT_COST, PERMIT_MILES, pathCount, type PathKind } from '../core/paths'
import { formatMiles } from '../core/miles'
import { startInfra, startPaint } from '../game/actions'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 섬 정비 안내판 패널: 다리와 계단을 맡기고, 맡긴 것은 철거해 절반을 돌려받는다. */
export function InfraPanel() {
  const infra = useGame((s) => s.infra)
  const day = useGame((s) => s.day)
  const money = useGame((s) => s.money)
  const remove = useGame((s) => s.removeInfra)
  const miles = useGame((s) => s.miles)
  const buyPermit = useGame((s) => s.buyPathPermit)
  const piece = (id: string, icon: string, name: string, ordered: string, cost: number) => (
    <li key={id}>
      <span className="big">{icon}</span>
      <span className="name">
        {name}
        <small className="note">{builtBy(ordered, day) ? '지어졌어요' : '내일 아침에 지어져요'}</small>
      </span>
      <button onClick={() => remove(id)}>철거 🌰 {refundOf(cost).toLocaleString()}</button>
    </li>
  )
  const pathIcon: Record<PathKind, string> = { dirt: '🟫', stone: '🪨', brick: '🧱' }
  const pathNote: Record<PathKind, string> = { dirt: '부드럽고 수수한 흙길', stone: '단단한 돌을 잇댄 길', brick: '붉은 벽돌을 깐 길' }
  const commission = (kind: 'bridge' | 'stair', count: number, max: number, cost: number, label: string) => {
    const full = count >= max
    const short = money < cost
    return (
      <li>
        <span className="big">{kind === 'bridge' ? '🌉' : '🪜'}</span>
        <span className="name">
          {label} 맡기기
          <small className="note">{full ? `${max}곳까지만 놓을 수 있어요` : '고른 자리에 빨간 표시가 나타나요'}</small>
        </span>
        <button className="primary" disabled={full || short} onClick={() => startInfra(kind)}>
          {full ? '가득 찼어요' : short ? `🌰 ${cost.toLocaleString()} 필요해요` : `🌰 ${cost.toLocaleString()} 고르기`}
        </button>
      </li>
    )
  }
  return (
    <Modal title="섬 정비">
      <p className="merchant-say">
        <b>구리구리</b> <span>“맡겨 주시면 다음 날 아침에 지어 둘게요. 다리에는 난간도 달아 둘게요”</span>
      </p>
      <h3>
        다리 <small>{infra.bridges.length}/{BRIDGE_MAX} · 개울 위</small>
      </h3>
      <ul className="buy-list">
        {infra.bridges.map((b) => piece(b.id, '🌉', '다리', b.ordered, BRIDGE_COST))}
        {commission('bridge', infra.bridges.length, BRIDGE_MAX, BRIDGE_COST, '다리')}
      </ul>
      <h3>
        계단 <small>{infra.stairs.length}/{STAIR_MAX} · 언덕 절벽</small>
      </h3>
      <ul className="buy-list">
        {infra.stairs.map((st) => piece(st.id, '🪜', '계단', st.ordered, STAIR_COST))}
        {commission('stair', infra.stairs.length, STAIR_MAX, STAIR_COST, '계단')}
      </ul>
      <h3>
        길 <small>{infra.permit ? `${pathCount(infra.paths)}/${PATH_MAX} · 평지에 한 칸씩` : '공사 허가가 필요해요'}</small>
      </h3>
      <ul className="buy-list">
        {infra.permit ? (
          PATH_KINDS.map((k) => (
            <li key={k}>
              <span className="big">{pathIcon[k]}</span>
              <span className="name">
                {PATH_NAME[k]}
                <small className="note">{pathNote[k]} · E 로 한 칸씩 놓아요</small>
              </span>
              <button className="primary" onClick={() => startPaint(k)}>
                깔기 시작
              </button>
            </li>
          ))
        ) : (
          <li>
            <span className="big">🛤️</span>
            <span className="name">
              길 공사 허가
              <small className="note">한 번 받으면 세 가지 길을 깔 수 있어요</small>
            </span>
            <span className="buy-actions">
              <button className="primary" disabled={money < PERMIT_COST} onClick={() => buyPermit('acorn')}>
                {money < PERMIT_COST ? `🌰 ${PERMIT_COST.toLocaleString()} 필요해요` : `🌰 ${PERMIT_COST.toLocaleString()} 사기`}
              </button>
              <button disabled={miles < PERMIT_MILES} onClick={() => buyPermit('miles')}>
                {miles < PERMIT_MILES ? `${formatMiles(PERMIT_MILES)} 필요해요` : `${formatMiles(PERMIT_MILES)} 쓰기`}
              </button>
            </span>
          </li>
        )}
      </ul>
    </Modal>
  )
}
