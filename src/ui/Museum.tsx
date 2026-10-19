import { countOf } from '../core/inventory'
import { ITEMS } from '../core/items'
import { CURATOR_NAME, curatorLine, DONATABLE, donationKind, type ZoneKind, ZONE_NAME, zoneProgress } from '../core/museum'
import { useGame } from '../game/store'
import { Modal } from './Panels'

const ZONES: ZoneKind[] = ['fish', 'bug', 'tide', 'fossil']

/** 학예사 올롱과의 기증 창. 도감에 오른 물건 가운데 주머니에 있는 것을 낸다. */
export function MuseumPanel() {
  const dex = useGame((s) => s.dex)
  const museum = useGame((s) => s.museum)
  const inventory = useGame((s) => s.inventory)
  const donate = useGame((s) => s.donate)
  return (
    <Modal title="도토리 자연사 전시관">
      <p className="museum-curator">
        <b>{CURATOR_NAME}</b> 학예사: {curatorLine(museum.length, DONATABLE.length)}
      </p>
      {ZONES.map((kind) => {
        const p = zoneProgress(museum, kind)
        return (
          <section key={kind}>
            <h3>
              {ZONE_NAME[kind]} <small>{p.done}/{p.total}</small>
            </h3>
            <ul className="dex-grid">
              {DONATABLE.filter((id) => donationKind(id) === kind).map((id) => {
                const def = ITEMS[id]
                const seen = !!dex[id]
                const done = museum.includes(id)
                const owned = countOf(inventory, id)
                return (
                  <li key={id} className={seen ? '' : 'unknown'}>
                    <span className={seen ? 'big' : 'big silhouette'}>{def.icon}</span>
                    <span className="name">
                      {seen ? def.name : '???'}
                      {done && <small className="museum-badge" aria-label="기증 완료">🏛</small>}
                    </span>
                    {done ? (
                      <span className="price">기증 완료</span>
                    ) : seen && owned > 0 ? (
                      <button type="button" onClick={() => donate(id)}>
                        기증하기
                      </button>
                    ) : (
                      <span className="price">{seen ? '주머니에 없어요' : '도감에 올려 주세요'}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </Modal>
  )
}
