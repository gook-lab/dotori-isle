import { useEffect, useState } from 'react'
import { ITEMS } from '../core/items'
import { letterTextOn } from '../core/letters'
import { WEARS, type WearDef } from '../core/wardrobe'
import { useGame } from '../game/store'
import { ComposeTab, SentTab } from './Compose'
import { Modal } from './Panels'

/** 옷장. 옷 가판대에서 열면 살 수 있고, C 로 열면 가진 것만 갈아입는다. */
export function ClosetPanel() {
  const [tab, setTab] = useState<WearDef['slot']>('outfit')
  const money = useGame((s) => s.money)
  const wear = useGame((s) => s.wear)
  const closet = useGame((s) => s.closet)
  const shop = useGame((s) => s.closetShop)
  const tier = useGame((s) => s.shop.tier)
  const buyWear = useGame((s) => s.buyWear)
  const putOn = useGame((s) => s.putOn)
  // 가판대에는 상점 단계가 된 것만 나온다(수영복은 1단계부터)
  const list = WEARS.filter((w) => w.slot === tab && (shop ? (w.minTier ?? 0) <= tier : closet.includes(w.id)))
  return (
    <Modal title={shop ? '옷 가판대' : '옷장'} tall>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'outfit'} onClick={() => setTab('outfit')}>
          옷
        </button>
        <button role="tab" aria-selected={tab === 'hat'} onClick={() => setTab('hat')}>
          모자
        </button>
        <span className="wallet">가진 도토리 🌰 {money.toLocaleString()}</span>
      </div>
      <ul className="buy-list">
        {tab === 'hat' && wear.hat && (
          <li>
            <span className="big">🙆</span>
            <span className="name">모자 벗기</span>
            <button onClick={() => putOn(null)}>벗기</button>
          </li>
        )}
        {list.map((w) => {
          const owned = closet.includes(w.id)
          const on = wear.outfit === w.id || wear.hat === w.id
          return (
            <li key={w.id}>
              <span className="swatch" style={{ background: w.color }} aria-hidden>
                {w.icon}
              </span>
              <span className="name">{w.name}</span>
              {owned ? (
                <button className={on ? '' : 'primary'} disabled={on && w.slot === 'outfit'} onClick={() => putOn(w.id)}>
                  {on ? (w.slot === 'hat' ? '벗기' : '입는 중') : '입기'}
                </button>
              ) : (
                <button className="primary" disabled={money < w.price} onClick={() => buyWear(w.id)}>
                  🌰 {w.price.toLocaleString()}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {!shop && <p className="empty">상점 왼쪽 옷 가판대에서 새 옷과 모자를 살 수 있어요</p>}
    </Modal>
  )
}

/** 편지함: 받은 편지, 보낸 편지, 편지 쓰기 세 탭 */
export function MailPanel() {
  const [tab, setTab] = useState<'inbox' | 'sent' | 'compose'>('inbox')
  return (
    <Modal title="편지함" tall>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}>
          받은 편지
        </button>
        <button role="tab" aria-selected={tab === 'compose'} onClick={() => setTab('compose')}>
          편지 쓰기
        </button>
        <button role="tab" aria-selected={tab === 'sent'} onClick={() => setTab('sent')}>
          보낸 편지함
        </button>
      </div>
      <div className="tab-body">{tab === 'inbox' ? <Inbox /> : tab === 'compose' ? <ComposeTab /> : <SentTab />}</div>
    </Modal>
  )
}

/** 받은 편지: 왼쪽 목록, 오른쪽 본문과 선물 받기 */
function Inbox() {
  const letters = useGame((s) => s.letters)
  const readLetter = useGame((s) => s.readLetter)
  const claimLetter = useGame((s) => s.claimLetter)
  const today = useGame((s) => s.day)
  const [openId, setOpenId] = useState<string | null>(() => letters.find((l) => !l.read)?.id ?? letters[0]?.id ?? null)
  const open = letters.find((l) => l.id === openId)
  useEffect(() => {
    if (open && !open.read) readLetter(open.id)
  }, [open, readLetter])
  if (!letters.length) {
    return (
      <>
        <p className="empty">아직 편지가 없어요. 주민과 친해지면 아침마다 편지가 와요</p>
      </>
    )
  }
  return (
    <>
      <div className="mail">
        <ul className="mail-list">
          {letters.map((l) => (
            <li key={l.id}>
              <button aria-current={l.id === openId} onClick={() => setOpenId(l.id)}>
                <span>{l.read ? '✉️' : '💌'}</span>
                <span className="name">{l.fromName}</span>
                {l.gift && !l.claimed && <span title="선물">🎁</span>}
              </button>
            </li>
          ))}
        </ul>
        {open && (
          <article className="letter">
            <p className="letter-from">{open.fromName}에게서</p>
            <p>{letterTextOn(open, today)}</p>
            {open.gift && (
              <button className="primary" disabled={open.claimed} onClick={() => claimLetter(open.id)}>
                {open.claimed ? '선물을 받았어요' : `${ITEMS[open.gift].icon} 선물 받기`}
              </button>
            )}
          </article>
        )}
      </div>
    </>
  )
}
