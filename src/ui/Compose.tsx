import { useState } from 'react'
import { ITEMS } from '../core/items'
import { checkLetterText, LETTER_MAX, PAPERS, paperOf, sentToday, STAMP_COST, type PaperId } from '../core/mail'
import { slotTitle } from '../core/reform'
import { friendshipLevel, VILLAGERS } from '../core/villagers'
import { useGame } from '../game/store'

/** 주민에게 편지 쓰기: 받는 주민, 글(80자), 편지지, 동봉할 물건 하나 */
export function ComposeTab() {
  const money = useGame((s) => s.money)
  const day = useGame((s) => s.day)
  const out = useGame((s) => s.outLetters)
  const inventory = useGame((s) => s.inventory)
  const friendship = useGame((s) => s.friendship)
  const sendLetter = useGame((s) => s.sendLetter)
  const [to, setTo] = useState(VILLAGERS[0].id)
  const [text, setText] = useState('')
  const [paper, setPaper] = useState<PaperId>('kraft')
  // 동봉 고르기 값은 "id#변형" 형식이다(변형이 없으면 "id#")
  const [enclose, setEnclose] = useState<string | null>(null)
  const sentNow = sentToday(out, day)
  const checked = checkLetterText(text)
  const shown = [...text].length
  const send = () => {
    const [encloseId, encloseVariant] = enclose ? enclose.split('#') : [null, '']
    if (sendLetter(to, text, paper, encloseId, encloseVariant || undefined)) {
      setText('')
      setEnclose(null)
    }
  }
  const toName = VILLAGERS.find((v) => v.id === to)?.name ?? ''
  const toLevel = friendshipLevel(friendship[to] ?? 0)
  return (
    <div className="compose">
      <div className="compose-body">
      {sentNow && <p className="notice">오늘은 이미 보냈어요. 내일 또 보낼 수 있어요</p>}
      <h3>받는 주민</h3>
      <div className="compose-people" role="group" aria-label="받는 주민">
        {VILLAGERS.map((v) => (
          <button key={v.id} aria-pressed={to === v.id} onClick={() => setTo(v.id)}>
            {v.name}
          </button>
        ))}
      </div>
      <p className="note">{toName} · 우정 {toLevel === 0 ? '처음 단계' : `${toLevel}단계`}</p>
      <h3>
        글 <small className="note">{shown}/{LETTER_MAX}자</small>
      </h3>
      <textarea
        aria-label="편지 글"
        className="compose-text"
        value={text}
        rows={4}
        placeholder="짧게 안부를 전해 볼까요?"
        onChange={(e) => setText([...e.target.value].slice(0, LETTER_MAX).join(''))}
      />
      <h3>편지지</h3>
      <div className="compose-people" role="group" aria-label="편지지">
        {PAPERS.map((p) => (
          <button key={p.id} aria-pressed={paper === p.id} onClick={() => setPaper(p.id)}>
            <span className="swatch" style={{ background: p.color }} /> {p.name}
          </button>
        ))}
      </div>
      <h3>
        동봉 <small className="note">선택 · 주머니 물건 하나</small>
      </h3>
      <select aria-label="동봉할 물건" value={enclose ?? ''} onChange={(e) => setEnclose(e.target.value || null)}>
        <option value="">동봉하지 않아요</option>
        {inventory
          .filter((x) => ITEMS[x.id] && ITEMS[x.id].kind !== 'ticket')
          .map((x) => (
            <option key={`${x.id}#${x.variant ?? ''}`} value={`${x.id}#${x.variant ?? ''}`}>
              {ITEMS[x.id].icon} {slotTitle(ITEMS[x.id].name, x.variant)} ×{x.count}
            </option>
          ))}
      </select>
      </div>
      <div className="compose-send">
        <p className="note">하루에 한 통 · 답장은 사흘 안에 와요</p>
        <button className="primary" disabled={!checked.ok || sentNow || money < STAMP_COST} onClick={send}>
          {sentNow ? '내일 또 보낼 수 있어요' : money < STAMP_COST ? `🌰 ${STAMP_COST} 필요해요` : !checked.ok ? '글을 먼저 써요' : `편지 보내기 · 🌰 ${STAMP_COST}`}
        </button>
      </div>
    </div>
  )
}

/** 보낸 편지함: 최근 열 통. 답장이 왔는지와 답장 날을 보여 준다. */
export function SentTab() {
  const out = useGame((s) => s.outLetters)
  if (!out.length) return <p className="empty">아직 보낸 편지가 없어요</p>
  return (
    <ul className="sent-list" aria-label="보낸 편지함">
      {out.map((o) => {
        const v = VILLAGERS.find((x) => x.id === o.to)
        return (
          <li key={o.id}>
            <span className="name">
              {v?.name ?? '주민'} <small className="note">{o.day} · {paperOf(o.paper)?.name}</small>
            </span>
            <p className="sent-text">{o.text}</p>
            {o.gift && ITEMS[o.gift] && <small className="note">동봉: {ITEMS[o.gift].icon} {slotTitle(ITEMS[o.gift].name, o.giftVariant)}</small>}
            <small className="note">{o.replied ? '답장이 왔어요' : `${o.replyDay}쯤 답장이 와요`}</small>
          </li>
        )
      })}
    </ul>
  )
}
