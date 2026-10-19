import { beforeEach, describe, expect, it } from 'vitest'
import { ITEM_LIST } from '../core/items'
import { tasteOf } from '../core/gifts'
import { VILLAGERS } from '../core/villagers'
import { runtime } from './runtime'
import { useGame } from './store'

const v = VILLAGERS[0]
const idWithTaste = (taste: 'love' | 'like' | 'dislike') => ITEM_LIST.map((i) => i.id).find((id) => tasteOf(v.id, id) === taste)

/** 대화창이 열린 상태를 흉내 낸다. 선물은 열린 대화에서 준다. */
function openDialogWith(itemId: string) {
  useGame.setState({
    inventory: [{ id: itemId, count: 1 }],
    dialog: { villagerId: v.id, lines: [], index: 0, offer: null, choice: null, ask: null } as never,
    giftDay: {},
    birthdayThanks: [],
  })
}

describe('좋아하는 선물을 받으면 대화를 닫아도 기쁜 표정이 남는다', () => {
  beforeEach(() => {
    runtime.react = null
  })

  it('사랑 선물은 기쁜 표정(happy)을 준다', () => {
    const id = idWithTaste('love')
    expect(id).toBeDefined()
    openDialogWith(id!)
    useGame.getState().giveGift(id!)
    expect(runtime.react).toMatchObject({ id: v.id, mood: 'happy' })
  })

  it('좋아함 선물도 기쁜 표정을 준다', () => {
    const id = idWithTaste('like')
    expect(id).toBeDefined()
    openDialogWith(id!)
    useGame.getState().giveGift(id!)
    expect(runtime.react?.mood).toBe('happy')
  })

  it('싫어하는 선물은 표정을 바꾸지 않는다', () => {
    const id = idWithTaste('dislike')
    expect(id).toBeDefined()
    openDialogWith(id!)
    useGame.getState().giveGift(id!)
    expect(runtime.react).toBeNull()
  })
})
