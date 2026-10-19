import { describe, expect, it } from 'vitest'
import { checkLetterText, letterFeatures, LETTER_MAX, letterTalkLines, pendingFor, personaOf, pushOut, OUT_MAX, repliesDue, replyDayOf, replyText, sentToday, type OutLetter } from './mail'

const letter = (over: Partial<OutLetter> = {}): OutLetter => ({
  id: 'L1',
  to: 'mocha',
  day: '2026-03-16',
  text: '안녕',
  paper: 'pink',
  gift: null,
  replyDay: '2026-03-18',
  replyText: '답장',
  replied: false,
  acked: false,
  ...over,
})

describe('편지 글 확인', () => {
  it('빈 글과 여든 자를 넘는 글은 보내지 않는다', () => {
    expect(checkLetterText('   ').ok).toBe(false)
    expect(checkLetterText('가'.repeat(LETTER_MAX + 1)).ok).toBe(false)
    expect(checkLetterText('가'.repeat(LETTER_MAX))).toEqual({ ok: true, text: '가'.repeat(LETTER_MAX) })
  })

  it('앞뒤 빈칸은 다듬어서 보낸다', () => {
    expect(checkLetterText('  안녕  ')).toEqual({ ok: true, text: '안녕' })
  })

  it('길이와 이모지 유무만 본다', () => {
    expect(letterFeatures('짧아')).toEqual({ long: false, emoji: false })
    expect(letterFeatures('아주 긴 글을 쓰고 싶어서 여기까지 길게 써 봤어요 정말로요')).toMatchObject({ long: true })
    expect(letterFeatures('좋아 😊').emoji).toBe(true)
  })
})

describe('답장 문구', () => {
  it('같은 편지에는 항상 같은 문구가 나온다', () => {
    const f = { long: true, emoji: false }
    expect(replyText('mocha', '모카', '냥', f, 'L1')).toBe(replyText('mocha', '모카', '냥', f, 'L1'))
  })

  it('긴 글과 짧은 글, 이모지 유무에 따라 다른 말을 한다', () => {
    const short = replyText('mocha', '모카', '냥', { long: false, emoji: false }, 'L9')
    const long = replyText('mocha', '모카', '냥', { long: true, emoji: false }, 'L9')
    const emoji = replyText('mocha', '모카', '냥', { long: false, emoji: true }, 'L9')
    expect(new Set([short, long, emoji]).size).toBe(3)
  })

  it('성격마다 말투가 다르다', () => {
    expect(personaOf('mocha')).toBe('bright')
    expect(personaOf('somi')).toBe('shy')
    expect(personaOf('nobody')).toBe('calm')
    const f = { long: false, emoji: false }
    expect(replyText('mocha', '모카', '', f, 'L2')).not.toBe(replyText('coco', '코코', '', f, 'L2'))
  })
})

describe('답장 날과 보낸 편지함', () => {
  it('답장은 보낸 다음 날부터 사흘 안에 온다', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const d = replyDayOf(id, '2026-03-16')!
      expect(d > '2026-03-16' && d <= '2026-03-19').toBe(true)
    }
  })

  it('하루에 한 통만 보낸다', () => {
    expect(sentToday([letter()], '2026-03-16')).toBe(true)
    expect(sentToday([letter()], '2026-03-17')).toBe(false)
  })

  it('보낸 편지함은 최근 열 통만 남긴다', () => {
    let out: OutLetter[] = []
    for (let i = 0; i < OUT_MAX + 4; i++) out = pushOut(out, letter({ id: `L${i}` }))
    expect(out).toHaveLength(OUT_MAX)
    expect(out[0].id).toBe(`L${OUT_MAX + 3}`)
  })

  it('어제 보낸 편지는 그 주민과 말할 때 꺼내고, 오늘 보낸 것은 아직 아니다', () => {
    const out = [letter({ day: '2026-03-16' })]
    expect(pendingFor(out, 'mocha', '2026-03-17')?.id).toBe('L1')
    expect(pendingFor(out, 'mocha', '2026-03-16')).toBeNull()
    expect(pendingFor(out, 'bomi', '2026-03-17')).toBeNull()
    expect(pendingFor([letter({ acked: true })], 'mocha', '2026-03-17')).toBeNull()
  })

  it('답장은 오늘이 되었을 때 한 번만 우편함에 넣을 것으로 고른다', () => {
    const out = [letter({ replyDay: '2026-03-18' }), letter({ id: 'L2', replyDay: '2026-03-20' }), letter({ id: 'L3', replyDay: '2026-03-18', replied: true })]
    expect(repliesDue(out, '2026-03-18').map((l) => l.id)).toEqual(['L1'])
  })

  it('편지 이야기는 종이 색을 말하고 두 줄이다', () => {
    const lines = letterTalkLines({ tic: '냥' }, letter({ paper: 'mint' }))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('민트 편지지')
  })
})
