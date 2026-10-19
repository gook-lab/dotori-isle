import { COOK_RECIPES, shortfall } from '../core/cooking'
import { ITEMS, josa } from '../core/items'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 작은 화덕 창: 요리마다 재료가 얼마나 있는지 보여 주고, 모자라면 무엇이 부족한지 알려 준다. */
export function CookPanel() {
  const inventory = useGame((s) => s.inventory)
  const money = useGame((s) => s.money)
  const cookAt = useGame((s) => s.cookAt)
  return (
    <Modal title="작은 화덕">
      <p className="note">재료로 요리를 만들어요. 요리는 주머니에 들어가고, 주머니에서 먹거나 주민에게 선물할 수 있어요.</p>
      <ul className="recipe-list">
        {COOK_RECIPES.map((r) => {
          const item = ITEMS[r.id]
          const short = shortfall(r, inventory, money)
          const ok = short.length === 0
          return (
            <li key={r.id} className={ok ? 'ready' : ''}>
              <span className="big">{item.icon}</span>
              <div className="recipe-body">
                <strong>{item.name}</strong>
                <span className="note">{r.effectText}</span>
                <span className="mats">
                  {r.needs.map((n) => {
                    const have = haveOf(inventory, n.match)
                    return (
                      <span key={n.label} className={have >= n.count ? 'enough' : 'short'}>
                        {n.label} {have}/{n.count}
                      </span>
                    )
                  })}
                  {r.money > 0 && (
                    <span className={money >= r.money ? 'enough' : 'short'}>
                      🌰 {money.toLocaleString()}/{r.money.toLocaleString()}
                    </span>
                  )}
                </span>
                {!ok && <span className="note">부족해요: {short.map((x) => `${x.label} ${x.need - x.have}개`).join(', ')}</span>}
              </div>
              <button className="primary" disabled={!ok} onClick={() => cookAt(r.id)}>
                만들기
              </button>
            </li>
          )
        })}
      </ul>
      <p className="note">{josa('화덕', '은', '는')} 집 안에 놓고 E 로 써요.</p>
    </Modal>
  )
}

function haveOf(inv: { id: string; count: number }[], match: (id: string) => boolean): number {
  return inv.filter((s) => match(s.id)).reduce((n, s) => n + s.count, 0)
}
