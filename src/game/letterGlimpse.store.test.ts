import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { OutLetter } from '../core/mail'
import { VILLAGERS } from '../core/villagers'
import { useGame } from './store'

const fresh = useGame.getState()
const D1 = '2026-03-16'
const D2 = '2026-03-17'
const mocha = VILLAGERS.find((v) => v.id === 'mocha')!

// 어제 보낸 편지가 주민에게 가서 이야기가 나오는 아침(D2)
const letterTo = (gift: string | null, giftVariant?: string): OutLetter => ({
  id: 'o1', to: 'mocha', day: D1, text: '안녕', paper: 'kraft', gift, ...(giftVariant && { giftVariant }),
  replyDay: D2, replyText: '답장', replied: false, acked: false,
})

beforeEach(() => {
  useGame.setState({ ...fresh, day: D2, money: 100, talked: [], friendship: {}, outLetters: [], dialog: null })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('편지 동봉 마감 가구에 주민이 알아본다', () => {
  it('금박 가구를 동봉한 편지를 받으면 주민 대사에 마감을 알아본다', () => {
    useGame.setState({ outLetters: [letterTo('chair', 'gold')] })
    useGame.getState().talkTo(mocha)
    const text = (useGame.getState().dialog?.lines ?? []).join(' ')
    expect(text).toContain('번쩍번쩍')
    expect(text).toContain('이런 건 처음 봐')
  })

  it('기본 가구를 동봉한 편지에는 마감 얘기를 하지 않는다', () => {
    useGame.setState({ outLetters: [letterTo('chair')] })
    useGame.getState().talkTo(mocha)
    const text = (useGame.getState().dialog?.lines ?? []).join(' ')
    expect(text).not.toContain('번쩍번쩍')
    expect(text).not.toContain('반짝')
  })
})
