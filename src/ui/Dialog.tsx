import { WEAR_BY_ID } from '../core/wardrobe'
import { useEffect, useState } from 'react'
import { ITEMS, josa } from '../core/items'
import { runtime } from '../game/runtime'
import { babble, voiceOf } from '../game/sfx'
import { giftBlockReason, useGame } from '../game/store'

/** 글자 하나 찍는 간격(ms). 괄호 속 몸짓 설명은 소리 없이 빠르게 지나간다. */
const TYPE_MS = 38
const GESTURE_MS = 12

/**
 * 대사를 한 글자씩 찍으며 주민 목소리로 웅얼거린다. 다 찍기 전에 누르면 남은 글자를 한 번에 보여준다.
 * 찍는 중인지는 runtime.typing 으로 알려서 키 입력과 주민 입 모양이 같이 본다.
 */
export function useTypewriter(line: string, voiceId: string, key: string): [number, () => void] {
  // 줄이 바뀐 첫 렌더에 이전 줄 글자 수가 남아 새 줄이 통째로 번쩍이지 않게 키와 함께 둔다.
  const [state, setState] = useState({ key, n: 0 })
  const setShown = (n: number) => setState({ key, n })
  useEffect(() => {
    const chars = [...line]
    const voice = voiceOf(voiceId)
    let i = 0
    let depth = 0
    let timer = 0
    runtime.typing = true
    runtime.skipTyping = false
    setShown(0)
    const tick = () => {
      if (runtime.skipTyping || i >= chars.length) {
        setShown(chars.length)
        runtime.typing = false
        runtime.skipTyping = false
        return
      }
      const ch = chars[i]
      if (ch === '(') depth++
      // 두 글자에 한 번만 소리를 내야 웅얼거림이 너무 빽빽하지 않다.
      if (depth === 0 && i % 2 === 0) babble(voice, ch, i >= chars.length - 2)
      if (ch === ')') depth = Math.max(0, depth - 1)
      i++
      setShown(i)
      timer = window.setTimeout(tick, depth > 0 ? GESTURE_MS : /[.!?…~]/.test(ch) ? TYPE_MS * 4 : TYPE_MS)
    }
    timer = window.setTimeout(tick, 120)
    return () => {
      window.clearTimeout(timer)
      runtime.typing = false
    }
  }, [line, voiceId, key])
  return [state.key === key ? state.n : 0, () => (runtime.skipTyping = true)]
}

/** 주민 대화창. 화면 아래에 붙고, E·Space·클릭으로 넘긴다. */
export function DialogBox() {
  const dialog = useGame((s) => s.dialog)
  const advance = useGame((s) => s.advanceDialog)
  const give = useGame((s) => s.giveRequest)
  const close = useGame((s) => s.openPanel)
  const answer = useGame((s) => s.answer)
  const line = dialog ? (dialog.lines[dialog.index] ?? '') : ''
  // 같은 대사가 연달아 나와도 다시 찍도록 몇 번째 줄인지도 키로 넘긴다.
  const [shown, skip] = useTypewriter(line, dialog?.villagerId ?? '', `${dialog?.index}:${dialog?.lines.length}`)
  // 훅은 모두 이 줄 위에 둔다. 대화가 없을 때의 조기 반환이 훅 순서를 바꾸지 않도록.
  const inventory = useGame((s) => s.inventory)
  const giveGift = useGame((s) => s.giveGift)
  const giveWear = useGame((s) => s.giveWear)
  const closet = useGame((s) => s.closet)
  const [picking, setPicking] = useState(false)
  if (!dialog) return null
  const typing = shown < [...line].length
  const last = dialog.index === dialog.lines.length - 1
  const offer = last && dialog.offer ? ITEMS[dialog.offer] : null
  const choices = last ? (dialog.choices ?? (dialog.choice ? [dialog.choice] : [])) : []
  const choose = useGame.getState().chooseDialog
  // 선물은 대화가 끝난 자리에서만 고른다. 주머니에 있는 물건을 종류별로 한 줄씩 보여 준다.
  const giftable = inventory.filter((slot) => ITEMS[slot.id] && ITEMS[slot.id].kind !== 'ticket')
  // 옷장의 옷도 선물할 수 있다. 입고 있는 옷도 복사해서 준다(옷장에서 빠지지 않는다).
  const wearable = closet.filter((id) => WEAR_BY_ID[id]?.slot === 'outfit')
  const canGift = last && !offer && choices.length === 0 && !dialog.ask && !giftBlockReason(dialog.villagerId) && giftable.length + wearable.length > 0
  return (
    <div className="dialog" role="dialog" aria-label={`${josa(dialog.name, '과', '와')} 대화`} onClick={typing ? skip : offer || choices.length > 0 || picking || (last && dialog.ask) ? undefined : advance}>
      <div className="dialog-name">{dialog.name}</div>
      <p key={`${dialog.index}-${dialog.lines.length}`} className="dialog-line" aria-label={line}>
        {[...line].slice(0, shown).join('')}
        {/* 아직 안 찍힌 글자도 자리를 잡아 둬야 줄바꿈이 찍는 도중에 바뀌지 않는다. */}
        <span className="dialog-rest" aria-hidden>
          {[...line].slice(shown).join('')}
        </span>
      </p>
      {typing ? (
        <span className="dialog-next">…</span>
      ) : last && dialog.ask ? (
        <div className="dialog-ask" role="listbox" aria-label="대답 고르기">
          {dialog.ask.options.map((o, i) => (
            <button
              key={o.label}
              role="option"
              aria-selected={dialog.ask!.sel === i}
              className={dialog.ask!.sel === i ? 'on' : ''}
              onClick={(e) => {
                e.stopPropagation()
                answer(i)
              }}
            >
              <kbd>{i + 1}</kbd> {o.label}
            </button>
          ))}
        </div>
      ) : offer ? (
        <div className="dialog-choices">
          <button className="primary" onClick={give}>
            {offer.icon} {offer.name} 건네기 <kbd>E</kbd>
          </button>
          <button className="ghost" onClick={() => close(null)}>
            다음에 줄게
          </button>
        </div>
      ) : choices.length > 0 ? (
        <div className="dialog-choices">
          {choices.map((c, i) => (
            <button key={c.action} className="primary" onClick={() => choose(c.action)}>
              {c.label} {i === 0 && <kbd>E</kbd>}
            </button>
          ))}
          <button className="ghost" onClick={() => close(null)}>
            다음에 할게요
          </button>
        </div>
      ) : picking ? (
        <div className="dialog-choices gift-pick">
          <p className="note">어떤 물건을 줄까요?</p>
          <ul className="gift-list" aria-label="선물 고르기">
            {giftable.map((slot) => (
              <li key={`${slot.id}-${slot.variant ?? ''}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPicking(false)
                    giveGift(slot.id, slot.variant)
                  }}
                >
                  {ITEMS[slot.id].icon} {ITEMS[slot.id].name} <small>×{slot.count}</small>
                </button>
              </li>
            ))}
            {wearable.map((id) => (
              <li key={`wear-${id}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPicking(false)
                    giveWear(id)
                  }}
                >
                  👕 {WEAR_BY_ID[id].name} <small>옷 선물</small>
                </button>
              </li>
            ))}
          </ul>
          <button
            className="ghost"
            onClick={(e) => {
              e.stopPropagation()
              setPicking(false)
            }}
          >
            그만두기
          </button>
        </div>
      ) : canGift ? (
        <div className="dialog-choices">
          <button
            className="primary"
            onClick={(e) => {
              e.stopPropagation()
              setPicking(true)
            }}
          >
            🎁 선물하기
          </button>
          <button className="ghost" onClick={() => close(null)}>
            닫기
          </button>
        </div>
      ) : (
        <span className="dialog-next">{last ? '닫기' : '다음'} ▾</span>
      )}
    </div>
  )
}

/** 잡았을 때 화면 아래 뜨는 한마디. 주인공 목소리로 찍고, 다 찍고 잠시 뒤 혼자 닫힌다. */
export function CatchCaption() {
  const caption = useGame((s) => s.caption)
  const closeCaption = useGame((s) => s.closeCaption)
  const text = caption?.text ?? ''
  const [shown, skip] = useTypewriter(text, 'player', caption ? `${caption.itemId}:${caption.text}` : '')
  const done = !!caption && shown >= [...text].length
  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(closeCaption, 2600)
    return () => window.clearTimeout(id)
  }, [done, closeCaption])
  if (!caption) return null
  const def = ITEMS[caption.itemId]
  return (
    <div className="dialog caption" role="status" onClick={done ? closeCaption : skip}>
      <div className="dialog-name">
        {def?.icon} {def?.name}
      </div>
      <p className="dialog-line" aria-label={text}>
        {[...text].slice(0, shown).join('')}
        <span className="dialog-rest" aria-hidden>
          {[...text].slice(shown).join('')}
        </span>
      </p>
      {caption.fresh && done && <span className="caption-new">📖 도감에 새로 올렸어요</span>}
    </div>
  )
}
