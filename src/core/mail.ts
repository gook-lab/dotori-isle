/**
 * 주민에게 편지 쓰기. 글은 80자까지, 편지지 세 종, 주머니 물건 하나를 동봉할 수 있다(우표값 도토리 20).
 * 답장은 사흘 안에 온다. 답장 문구는 주민 성격 템플릿에 내 글의 길이와 이모지 유무만 반영한다(글 내용은 해석하지 않는다).
 * 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { addDays } from './economy'
import { hashString, mulberry32 } from './rng'
import { josa } from './items'

export const LETTER_MAX = 80
export const STAMP_COST = 20
/** 보낸 편지함에 남기는 최근 편지 수 */
export const OUT_MAX = 10
/** 답장이 오는 데 걸리는 날(1~3일 사이에서 편지마다 정해진다) */
export const REPLY_DAYS = 3
/** 편지를 보내면 우정이 이만큼 오른다(선물보다 적다) */
export const LETTER_FRIENDSHIP = 1

export const PAPERS = [
  { id: 'kraft', name: '크라프트지', color: '#d9b98c' },
  { id: 'pink', name: '분홍 편지지', color: '#f7c6d0' },
  { id: 'mint', name: '민트 편지지', color: '#bfe8d4' },
] as const
export type PaperId = (typeof PAPERS)[number]['id']

export const paperOf = (id: string): (typeof PAPERS)[number] | null => PAPERS.find((p) => p.id === id) ?? null

/** 보낸 편지 한 통. 답장 문구는 보낼 때 미리 정해 둔다. */
export interface OutLetter {
  id: string
  to: string
  day: string
  text: string
  paper: PaperId
  gift: string | null
  /** 동봉한 가구의 색 변형(core/reform.ts). 기본 가구거나 동봉이 없으면 없다. 불러올 때 검사한다. */
  giftVariant?: string
  replyDay: string
  replyText: string
  /** 답장 편지를 이미 우편함에 넣었는지 */
  replied: boolean
  /** 받은 주민이 편지 이야기를 꺼냈는지 */
  acked: boolean
}

/** 보내기 전에 글을 확인한다. 통과하면 다듬은 글을, 아니면 이유를 돌려준다. */
export function checkLetterText(raw: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = raw.trim()
  if (!text) return { ok: false, reason: '글을 먼저 써요' }
  if ([...text].length > LETTER_MAX) return { ok: false, reason: `글은 ${LETTER_MAX}자까지 써요` }
  return { ok: true, text }
}

/** 글의 단순한 특징: 길이가 긴지, 이모지가 있는지. 내용은 보지 않는다. */
export function letterFeatures(text: string): { long: boolean; emoji: boolean } {
  return { long: [...text].length >= 30, emoji: /\p{Extended_Pictographic}/u.test(text) }
}

/** 주민 성격. 말투 템플릿을 고르는 데 쓴다. 정하지 않은 주민은 차분한 편이다. */
export type Persona = 'bright' | 'calm' | 'shy'
const PERSONA: Record<string, Persona> = {
  mocha: 'bright',
  bomi: 'bright',
  somi: 'shy',
  soda: 'shy',
  yuja: 'bright',
  kongi: 'bright',
  bori: 'bright',
  maro: 'calm',
  coco: 'calm',
  pengdol: 'calm',
  dongri: 'shy',
  guriguri: 'calm',
}
export const personaOf = (villagerId: string): Persona => PERSONA[villagerId] ?? 'calm'

/** 성격과 글 특징에 맞는 답장 문구. 같은 조건이라도 편지마다 다른 줄을 고른다(id 로 정해진다). */
export function replyText(villagerId: string, name: string, tic: string, features: { long: boolean; emoji: boolean }, letterId: string): string {
  const rng = mulberry32(hashString(`reply:${letterId}`))
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
  const persona = personaOf(villagerId)
  const open: Record<Persona, readonly string[]> = {
    bright: [`${josa(name, '이야', '야')}${tic}! 편지 고마워!`, `우와, ${name}한테 편지가 왔어${tic}!`],
    calm: [`${josa(name, '이에요', '예요')}. 편지 잘 받았어요.`, `편지 고마워요. ${josa(name, '이', '가')} 읽었어요.`],
    shy: [`저, ${josa(name, '이야', '야')}… 편지 받았어${tic}`, `편지 고마워… ${josa(name, '이', '가')} 기뻐서 두 번 읽었어`],
  }
  const body = features.long
    ? {
        bright: '긴 편지라서 한참 읽었어. 다음에도 이렇게 써 줘!',
        calm: '편지를 천천히 읽었어요. 정성이 느껴졌어요.',
        shy: '이렇게 길게 써 줘서… 많이 생각나더라.',
      }[persona]
    : {
        bright: '짧아도 충분히 반가웠어!',
        calm: '짧은 편지도 좋아요. 마음이 전해졌어요.',
        shy: '짧은데도… 기분이 좋아졌어.',
      }[persona]
  const tail = features.emoji
    ? { bright: '이모지까지 보내 줘서 웃음이 났어 ✨', calm: '이모지 덕분에 밝은 편지가 됐어요 🙂', shy: '그림도 귀여워… 🌸' }[persona]
    : null
  return [pick(open[persona]), body, tail].filter(Boolean).join(' ')
}

/** 답장이 오는 날: 보낸 날 다음 날부터 사흘 안에서 편지마다 정해진다. */
export function replyDayOf(letterId: string, sentDay: string): string | null {
  const n = 1 + (hashString(`replyday:${letterId}`) % REPLY_DAYS)
  return addDays(sentDay, n)
}

/** 하루에 한 통만 보낸다. */
export const sentToday = (out: readonly OutLetter[], day: string): boolean => out.some((l) => l.day === day)

/** 보낸 편지 목록에 새 편지를 앞에 두고, 최근 열 통만 남긴다. */
export function pushOut(out: readonly OutLetter[], letter: OutLetter): OutLetter[] {
  return [letter, ...out].slice(0, OUT_MAX)
}

/** 어제 보낸 편지 가운데 아직 주민이 꺼내지 않은 것(그 주민과 말할 때 이야기한다). */
export function pendingFor(out: readonly OutLetter[], villagerId: string, day: string): OutLetter | null {
  return out.find((l) => l.to === villagerId && !l.acked && l.day < day) ?? null
}

/** 답장 편지 가운데 오늘이 되었고 아직 우편함에 넣지 않은 것 */
export function repliesDue(out: readonly OutLetter[], day: string): OutLetter[] {
  return out.filter((l) => !l.replied && l.replyDay <= day)
}

/** 편지 이야기를 꺼내는 주민의 말 두세 줄. 종이 색을 함께 말한다. */
export function letterTalkLines(villager: { tic: string }, letter: OutLetter): string[] {
  const paper = paperOf(letter.paper)?.name ?? '편지지'
  return [`어제 보내 준 편지 잘 받았어${villager.tic}. ${paper}라서 더 반가웠어.`, '다음에 또 써 줘. 기다릴게!']
}
