import { birthdayTalkLines } from './birthdays'
import { firstSnowTalkLines } from './firstSnow'
import { playerBirthdayTalkLines } from './playerBirthday'
import { milestoneTalkLines, type Milestone } from './milestoneTalk'
import { islandTalkLine, porchTalkLine } from './islandTalk'
import { RAIN_STONE_ID } from './rainStones'
import { afterTalkLines } from './afterTalk'
import type { DayPart } from './clock'
import { ITEMS, josa } from './items'
import { pickWeighted, type Rng } from './rng'
import type { Season } from './season'
import type { Taste } from './gifts'
import type { VillagerDef } from './villagers'
import { wornLines } from './villagerWear'
import { WEAR_BY_ID } from './wardrobe'
import type { Weather } from './weather'

/**
 * 주민 수다. 그때의 상황(날씨·계절·시간·옷차림·든 도구·주머니·집 안·친한 정도)을 보고 화제를 고르고,
 * 주민 성격에 맞는 말투로 말한다. 최근에 꺼낸 화제는 피하고, 가끔은 질문을 던져 답을 고르게 한다.
 * 같은 날 같은 순번의 대화는 늘 같게 나오도록 rng 는 바깥에서 날짜로 시드해 넘긴다.
 */

export type Personality = 'cheery' | 'shy' | 'cool' | 'lazy' | 'sporty' | 'grumpy'

export const PERSONALITY: Record<string, Personality> = {
  mocha: 'cool',
  bomi: 'cheery',
  pengdol: 'sporty',
  guriguri: 'lazy',
  dongri: 'shy',
  somi: 'shy',
  soda: 'cheery',
  bori: 'grumpy',
  maro: 'lazy',
  coco: 'cool',
  yuja: 'sporty',
  sora: 'cheery',
  toto: 'lazy',
  kongi: 'shy',
  mimi: 'cool',
  gomdol: 'sporty',
  darami: 'cheery',
  bamtol: 'grumpy',
  chumbung: 'sporty',
}

export interface ChatContext {
  v: VillagerDef
  hour: number
  part: DayPart
  weather: Weather
  season: Season
  /** 친한 정도 0~ */
  level: number
  hat: string | null
  outfit: string
  tool: string
  /** 주머니 속 물건 id */
  pocket: string[]
  /** 주민 자기 집 안에서 이야기하는 중 */
  home: boolean
  /** 소문 낼 다른 주민 */
  others: { id: string; name: string }[]
  /** 이 주민과 최근에 나눈 화제 id(오래된 것부터) */
  recent: string[]
  /** 오늘 이 주민에게 대답해 준 질문 화제 id. 같은 날 같은 질문은 다시 하지 않는다. */
  answered?: string[]
  /** 플레이어가 옷을 선물해서 지금 입고 나온 옷과, 그 옷에 대한 주민 취향 */
  wornGift?: { id: string; taste: Taste }
  /** 질문을 던져도 되는지. 마지막 줄을 다른 일(물건 건네기)에 쓰면 false */
  allowAsk?: boolean
  /** 오늘 생일인 주민과 아직 생일 수다를 하지 않았다(하루 한 번 보장). 참이면 생일 수다만 고른다. */
  birthdayDue?: boolean
  /** 플레이어 생일이고 이 주민과 오늘 처음 말을 나눈다. 축하 수다를 고른다. */
  playerBirthdayDue?: boolean
  /** 오늘 이 주민과 처음 말을 나누고 이정표가 있다. 이정표 수다를 고른다(하루 한 번). */
  milestoneDue?: boolean
  /** 새로 생긴 섬 요소가 지금 있는지(islandTalk.ts). 반짝이는 조약돌은 pocket 에서 본다. */
  island?: { wallpaper: boolean; set: boolean; ledger: boolean; stairs: boolean; facility: boolean; porch: { id: string; name: string }[] }
  /** 오늘 꺼낼 섬 이야기 목표 키(afterTalk.ts). 있으면 그 목표 이야기를 먼저 한다. */
  afterDue?: string
  /** 오늘 섬에 생긴 일. 해당하는 것만 채운다. 없으면 그 화제는 뽑히지 않는다. */
  today?: TodayTalk
}

/** 오늘 섬 소식. todayTalk.ts 가 게임 상태에서 모은다. */
export interface TodayTalk {
  /** 도토리 상점. closed 면 오늘 공사 중이고, sale 은 오늘 특가(반짝 특가 우선) 물건 이름 */
  shop?: { closed: boolean; sale: string | null }
  /** 오늘 마을회관 방송에서 고른 한 줄(머리 이모지는 뺀다) */
  broadcast?: string
  /** 오늘 송이 시세가 높다 */
  songiHigh?: boolean
  /** 지금 진행 중인 섬 이야기 장 */
  story?: { no: number; title: string }
  /** 오늘 해변에 병이 떠밀려 왔다 */
  bottle?: boolean
  /** 섬 이야기를 다 보고 에필로그도 끝났다. 이때는 story 대신 회상 줄을 한다. */
  storyDone?: boolean
  /** 일요일 이번 주 소식에서 고른 한 줄(머리 이모지는 뺀다) */
  weekQuote?: string
  /** 호박 등불 밤(10월 31일 저녁)이다. 사탕 이야기를 꺼낸다. */
  pumpkin?: boolean
  /** 도토리 감사 장날(11월 셋째 주 토요일)이다. 수확물 이야기를 꺼낸다. */
  harvest?: boolean
  /** 지금 말을 거는 주민의 생일이다(오늘 날짜 기준). */
  birthday?: boolean
  /** 오늘이 그 해 첫눈 날 */
  firstSnow?: boolean
  /** 플레이어 생일이다. 주민들이 축하 수다를 한다. */
  playerBirthday?: boolean
  /** 경제 이정표(상점·대출·증축·섬 가꾸기·계절 주간). 날짜와 함께 준다(milestoneTalk.ts). */
  milestone?: { kind: Milestone; day: string }
}

export interface Ask {
  /** 질문 화제 id. 대답하면 오늘은 다시 묻지 않는다. */
  topic?: string
  /** invite 가 붙은 대답을 고르면 그 손님을 도토리섬으로 초대한다. */
  /** stay: 이사 고민에 대한 대답. true 면 남고(우정 +2), false 면 떠나는 것을 응원한다. */
  options: { label: string; reply: string; invite?: boolean; stay?: boolean }[]
}

export interface Chat {
  topic: string
  lines: string[]
  ask?: Ask
}

/** 말끝 버릇을 문장 부호 앞에 붙인다. "좋다!" + "냥" → "좋다냥!" */
export function withTic(line: string, tic: string): string {
  const m = line.match(/^(.*?)([.!?~…]*)$/)!
  const body = m[1]
  const punct = m[2]
  // 물음표는 지켜야 질문으로 읽힌다. 버릇 끝 부호를 떼고 물음표를 붙인다.
  // 공백으로 시작하는 버릇(' 뽀')은 질문에 붙이면 뜬금없는 음절이 되니 질문에는 붙이지 않는다.
  if (punct.includes('?')) return tic.startsWith(' ') ? `${body}?` : `${body}${tic.replace(/[.!?]+$/, '')}?`
  // 버릇이 부호로 끝나면(~해줘!, ~) 원래 부호를 버린다. 아니면 버릇 뒤에 원래 부호를 붙인다.
  return /[.!?~…]$/.test(tic) ? `${body}${tic}` : `${body}${tic}${punct || '.'}`
}

interface Voice {
  /** 말머리 */
  lead: string[]
  /** 옷차림 칭찬 */
  praise: string
  /** 좋아하는 것 */
  likes: string
  /** 취미 이야기 */
  hobby: string[]
  /** 질문에 고른 답을 받는 말 */
  agree: string
  differ: string
}

const VOICES: Record<Personality, Voice> = {
  cheery: {
    lead: ['있잖아!', '헤헤,', '와아,'],
    praise: '완전 귀여워! 나도 따라 하고 싶어!',
    likes: '노래 부르기',
    hobby: ['요즘 새 노래를 만들고 있어! 들어 볼래? ♪라라~', '기분이 좋으면 나도 모르게 빙글빙글 돌게 돼!'],
    agree: '역시! 우리 마음이 딱 맞았어!',
    differ: '오, 그것도 좋다! 다음엔 같이 해 보자!',
  },
  shy: {
    lead: ['저기…', '음…', '그러니까…'],
    praise: '…정말 예뻐…',
    likes: '그림 그리기',
    hobby: ['…사실 너를 그려 봤어. 아직은 비밀이야…', '조용한 곳에서 꽃을 보고 있으면 마음이 편해져…'],
    agree: '…나도! 같아서 기뻐…',
    differ: '…그렇구나. 너에 대해 하나 더 알았어…',
  },
  cool: {
    lead: ['음.', '그래,', '흠,'],
    praise: '센스 있네.',
    likes: '책 읽기',
    hobby: ['어젯밤에 별자리 책을 다 읽었어. 밤하늘이 달라 보여', '따뜻한 차 한 잔이면 하루가 정리돼.'],
    agree: '역시 너도 보는 눈이 있네.',
    differ: '그런 생각도 있구나. 나쁘지 않아.',
  },
  lazy: {
    lead: ['음냐…', '흐아암…', '있지~'],
    praise: '보기만 해도 기분이 몽글몽글해져~',
    likes: '낮잠',
    hobby: ['햇볕 드는 데서 낮잠 자면 세상 제일 행복해~', '배고프다~ 간식 생각하면 힘이 나~'],
    agree: '그치~ 그게 제일 편하지~',
    differ: '오~ 그것도 좋지~ 나는 어느 때든 낮잠이 좋아~',
  },
  sporty: {
    lead: ['좋아!', '자!', '헤이!'],
    praise: '멋진데! 뛰어다니기도 좋겠어!',
    likes: '달리기',
    hobby: ['아침마다 섬을 한 바퀴 뛰어! 같이 뛸래?', '오늘은 팔굽혀펴기 백 번 했어! 하나, 둘!'],
    agree: '좋아! 그 기세야!',
    differ: '그것도 훈련이 되겠는걸!',
  },
  grumpy: {
    lead: ['흥.', '뭐야,', '쳇,'],
    praise: '흥, 나만큼은 아니지만 귀엽네.',
    likes: '칭찬받기',
    hobby: ['나 오늘 엄청 착했어. 그러니까 칭찬해 줘야 해.', '다들 나만 보면 귀엽대. 당연하지만.'],
    agree: '흥, 내 말이 맞지?',
    differ: '…뭐, 네가 그렇다면 그런 걸로 해 줄게.',
  },
}

/** 다른 주민 이야기. 그 주민의 버릇을 소문으로 전한다. */
export const GOSSIP: Record<string, string> = {
  yuja: '유자가 또 "얍!" 하면서 섬을 뛰어다니더라',
  somi: '솜이는 민들레 씨를 불 때마다 소원을 빈대',
  soda: '소다는 바람 부는 날마다 "랄라~" 하고 노래해',
  bori: '보리는 도토리를 볼에 한가득 넣고 다니더라',
  maro: '마로는 한 모금 마실 때마다 "후아~" 한대',
  coco: '코코는 매끈한 조약돌로 공기놀이를 해. 진짜 잘해',
  mocha: '모카 옆에 가면 은은하게 커피 향이 나',
  bomi: '봄이는 꽃만 보면 깡충깡충 뛴대',
  pengdol: '펭돌은 바다에서 수영하는 게 제일 좋대',
  guriguri: '구리구리는 땅 파는 게 취미래',
  dongri: '동그리는 인사하면 몸을 동그랗게 말아',
}

const WEATHER_LINES: Record<Weather, string[]> = {
  sunny: ['오늘 햇살 진짜 좋다. 빨래 널기 딱이야', '이런 날엔 바닷가 산책이 최고야'],
  cloudy: ['구름이 잔뜩 꼈네. 덥지 않아서 좋아', '흐린 날엔 물고기 그림자가 더 잘 보여'],
  rain: ['비 오는 날엔 달팽이가 기어 나온대', '빗소리 들으면서 차 마시는 거 좋아해', '비 오는 날엔 갈치가 잡힌대!'],
  snow: ['눈이다! 눈사람 만들고 싶어', '발자국 꾹꾹 찍으며 걷는 거 재밌어'],
}

const SEASON_LINES: Record<Season, string[]> = {
  spring: ['벚꽃잎이 바람에 날리는 거 봤어? 너무 예뻐', '봄엔 도다리가 잡힌대. 봄바람 타고 와'],
  summer: ['매미 소리 들려? 맴맴, 여름이다!', '여름엔 바닷물이 시원해서 좋아'],
  autumn: ['나뭇잎이 빨갛고 노랗게 물들었어', '고추잠자리가 날아다니면 가을이래'],
  winter: ['코끝이 시려. 따뜻한 데 들어가고 싶다', '겨울 방어는 기름이 올라서 맛있대'],
}

const PART_LINES: Record<DayPart, string[]> = {
  dawn: ['이렇게 일찍? 하늘이 보랏빛이야', '새벽 공기는 차갑고 맑아'],
  morning: ['좋은 아침! 오늘은 뭐 할 거야?', '아침엔 새들이 제일 시끄러워'],
  day: ['한낮엔 나무 그늘이 최고야', '점심 먹었어? 나는 벌써 배고파'],
  evening: ['노을 봤어? 하늘이 주황색이야', '저녁 바람이 선선해서 좋다'],
  night: ['이 시간까지 안 자? 별이 예쁘다', '별똥별 보면 소원 빌어야 해'],
}

const TOOL_LINES: Record<string, string> = {
  rod: '낚싯대 들었네! 그림자 큰 물고기 근처에 던져 봐',
  net: '잠자리채구나! 살금살금 다가가야 안 도망가',
  shovel: '반짝이는 땅을 파 봐. 화석이 나올지도 몰라',
  axe: '도끼로 나무를 치면 목재가 나와. 너무 많이 베진 마',
  can: '물뿌리개구나. 꽃에 물 주면 쑥쑥 자라',
}

interface Topic {
  id: string
  weight: number
  when?: (c: ChatContext) => boolean
  say: (c: ChatContext, rng: Rng, me: Voice) => string[]
  ask?: (c: ChatContext, me: Voice, rng: Rng) => { q: string; options: { label: string; like: boolean; reply?: string }[] }
}

const pick = <T,>(xs: readonly T[], rng: Rng) => xs[Math.floor(rng() * xs.length)]

/** 절반쯤은 말머리를 붙여 주민 말투가 살아나게 한다. */
const withLead = (text: string, rng: Rng, me: Voice) => (rng() < 0.5 && [...text].length <= 22 ? `${pick(me.lead, rng)} ${text}` : text)

/** 오늘 섬 소식 화제. 두 줄씩 말하고, 성격마다 말투를 맞춘다. */
type Pair = [string, string]
type Per = Record<Personality, Pair>
const who = (c: ChatContext): Personality => PERSONALITY[c.v.id] ?? 'cheery'
/** 이 주민이 말할 포치 주인: 증축된 집 가운데 말하는 주민 자신의 집은 뺀 첫 집. 없으면 null. */
const porchOf = (c: ChatContext): { id: string; name: string } | null => c.island?.porch.find((h) => h.id !== c.v.id) ?? null

const SHOP_CLOSED: Per = {
  cheery: ['있잖아! 도토리 상점 공사한대! 망치 소리 들리지?', '새 간판이 올라간대. 다 되면 같이 구경 가자!'],
  shy: ['…상점에서 망치 소리가 나. 공사 중이래…', '다 되면 진열이 많아진대. 기대돼…'],
  cool: ['상점 공사 중이더라. 오늘은 문이 닫혔어.', '더 넓어진다니 나쁘지 않네.'],
  lazy: ['상점 공사한대~ 시끄러워서 낮잠을 못 자겠어~', '다 되면 의자도 늘어난대~ 그건 좋다~'],
  sporty: ['상점 공사 중이래! 빨리 끝나면 좋겠다!', '새 간판 달리면 같이 뛰어가서 보자!'],
  grumpy: ['흥, 상점 공사 때문에 시끄러워 죽겠어.', '…새 진열은 내가 먼저 볼 거야. 쳇.'],
}

/** 공사가 없는 날. 가람은 계산, 나루는 진열을 맡았다는 이야기를 곁들인다. */
const SHOP_OPEN: Record<Personality, (sale: string | null) => Pair> = {
  cheery: (sale) => [
    sale ? `있잖아! 상점에 ${sale} 특가가 떴대!` : '있잖아! 상점 진열이 오늘 새로 바뀌었대!',
    '가람은 계산, 나루는 진열을 맡았대. 다들 친절하더라!',
  ],
  shy: (sale) => [
    sale ? `…상점에 ${sale} 특가가 있대…` : '…상점 진열이 바뀌었대…',
    '가람은 계산을, 나루는 진열을 맡았대. 나도 가 보고 싶어…',
  ],
  cool: (sale) => [
    sale ? `상점에 ${sale} 특가가 나왔더라.` : '상점 진열이 오늘 바뀌었더라.',
    '가람이 계산하고 나루가 진열한다지. 역할 분담이 깔끔해.',
  ],
  lazy: (sale) => [
    sale ? `상점에 ${sale} 특가래~ 싸다니까 가 볼까~` : '상점 진열이 바뀌었대~ 가기는 귀찮아~',
    '가람이 계산하고 나루가 진열한대~ 편하겠다~',
  ],
  sporty: (sale) => [
    sale ? `상점에 ${sale} 특가 떴대! 뛰어가자!` : '상점 진열 바뀌었대! 구경하러 뛰자!',
    '가람은 계산, 나루는 진열이래! 둘 다 빨라 보이던데!',
  ],
  grumpy: (sale) => [
    sale ? `흥, 상점에 ${sale} 특가라니. 나 빼고 다 가는 거지?` : '흥, 상점 진열이 바뀌었대. 누가 알려 달래?',
    '가람이 계산하고 나루가 진열한대. …뭐, 잘하겠지.',
  ],
}

const BROADCAST: Record<Personality, (q: string) => Pair> = {
  cheery: (q) => [`있잖아! 방송에서 "${q}"래!`, '방송 듣자마자 너한테 제일 먼저 알려 주고 싶었어!'],
  shy: (q) => [`…방송에서 "${q}"래…`, '나 방송 듣다가 조용히 고개를 끄덕였어…'],
  cool: (q) => [`방송에서 "${q}"라더라.`, '소식은 챙겨 듣는 편이 편해.'],
  lazy: (q) => [`방송에서 "${q}"래~ 나는 듣다가 졸았어~`, '그래도 소식은 알아야지~'],
  sporty: (q) => [`방송에서 "${q}"래! 좋아, 바로 움직이자!`, '소식 듣자마자 한 바퀴 뛰고 왔어!'],
  grumpy: (q) => [`흥, 방송이 "${q}"래. 누가 알려 달랬나.`, '…그래도 듣긴 했어. 쳇.'],
}

const SONGI_HIGH: Per = {
  cheery: ['송이 시세가 높대! 나도 송이 주우러 가야지!', '송이 팔면 도토리 많이 받을 수 있겠다. 헤헤!'],
  shy: ['…송이 값이 올랐대. 나도 조금 주워 볼까…', '…너도 팔 거면 같이 가자…'],
  cool: ['송이 시세가 높더라. 이 정도면 팔 만하네.', '값이 오를 때 파는 게 현명하지.'],
  lazy: ['송이 값 올랐대~ 근데 줍는 건 귀찮아~', '그래도 값 좋을 때 팔면 편하겠다~'],
  sporty: ['송이 시세 올랐대! 오늘 많이 주워서 팔자!', '뛰어다니면서 송이 줍기, 딱 내 체질이야!'],
  grumpy: ['흥, 송이 값 올랐다고 다들 난리야.', '…비싸게 팔면 나도 뭐 하나 사 줄게. 쳇.'],
}

/** 장마다 하는 응원. 장 번호(1~5)로 고른다. */
const STORY_CHEER: Record<number, string> = {
  1: '처음 온 섬이 낯설어도 금방 정이 들 거야.',
  2: '이웃이 하나둘 늘어나는 게 정말 기뻐.',
  3: '집 한 채가 완성되는 날이 얼마 안 남았어.',
  4: '섬을 예쁘게 꾸미는 솜씨가 점점 좋아지고 있어.',
  5: '마지막 장이야. 끝까지 같이 가자.',
}

const STORY_TAIL: Record<Personality, string> = {
  cheery: '헤헤, 응원할게!',
  shy: '…응원할게.',
  cool: '잘하고 있어.',
  lazy: '천천히 가도 돼~',
  sporty: '이 기세로 가자!',
  grumpy: '…뭐, 응원은 해 줄게. 쳇.',
}

const STORY_TALK: Record<Personality, (title: string) => string> = {
  cheery: (t) => `있잖아! 섬 이야기 "${t}" 장이 진행 중이래!`,
  shy: (t) => `…섬 이야기 "${t}" 장 얘기 들었어…`,
  cool: (t) => `섬 이야기 "${t}" 장이 지금 진행 중이지.`,
  lazy: (t) => `섬 이야기 "${t}" 장이래~ 나는 응원만 할게~`,
  sporty: (t) => `섬 이야기 "${t}" 장이다! 좋아, 달리자!`,
  grumpy: (t) => `흥, "${t}" 장 같은 거 하는 거 알아.`,
}

/** 섬 이야기를 다 본 뒤의 축하와 회상 */
const STORY_DONE: Per = {
  cheery: ['섬 이야기 다 봤다며? 나 진짜 신났었어!', '같이 한 일들 하나하나 다 기억나! 고마워!'],
  shy: ['…섬 이야기 다 봤다며? 나도 뭉클했어…', '…같이 지나온 날들이 자꾸 떠올라…'],
  cool: ['섬 이야기 다 봤다며? 꽤 긴 여정이었지.', '돌아보니 우리가 많이 해냈더라. 수고했어.'],
  lazy: ['섬 이야기 다 봤다며~ 긴 이야기였다~', '그래도 같이 하니까 재밌었지~ 수고했어~'],
  sporty: ['섬 이야기 다 봤다며? 완주 축하해!', '처음부터 끝까지 같이 달린 거야! 최고였어!'],
  grumpy: ['흥, 섬 이야기 다 봤다며? 뭐, 축하는 해 줄게.', '…처음 만났을 땐 이렇게 될 줄 몰랐어. 쳇.'],
}

/** 일요일 이번 주 소식을 인용하는 말 */
const WEEK_RECAP: Record<Personality, (q: string) => Pair> = {
  cheery: (q) => [`지난 주 방송에서 "${q}"래! 우리 열심히 했나 봐!`, '다음 주에도 같이 많이 하자, 헤헤!'],
  shy: (q) => [`…이번 주 소식에 "${q}"라고 나왔어…`, '…너랑 한 것들이라 괜히 뿌듯해…'],
  cool: (q) => [`이번 주 소식에 "${q}"라고 나오더라.`, '꽤 알차게 보냈네.'],
  lazy: (q) => [`이번 주 방송에 "${q}"래~ 그럭저럭 했네~`, '다음 주에는 좀 쉬어도 되겠다~'],
  sporty: (q) => [`이번 주 소식에 "${q}"래! 완전 잘 뛰었어!`, '다음 주도 이 기세로 가자!'],
  grumpy: (q) => [`흥, 이번 주 소식에 "${q}"래. 뭐, 나쁘지 않네.`, '…나 빼고 한 건 없었지? 쳇.'],
}

/** 호박 등불 밤 저녁의 사탕 이야기 */
const PUMPKIN_NIGHT: Per = {
  cheery: ['있잖아! 오늘 밤 호박 등불 밤이래! 사탕 있으면 나한테 줄래?', '같이 광장 등불 보러 가자, 헤헤!'],
  shy: ['…오늘 밤 호박 등불이 켜진대… 사탕 있어…?', '…나 사탕 좋아하는데, 아무한테도 말 안 했어…'],
  cool: ['호박 등불 밤이더라. 사탕 하나면 충분해.', '등불이 광장에 켜진다니 운치 있네.'],
  lazy: ['호박 등불 밤이래~ 사탕 줄 거지~?', '등불 아래서 낮잠 자면 최고일 텐데~'],
  sporty: ['호박 등불 밤이다! 사탕 찾으러 뛰자!', '광장 한 바퀴 뛰면서 등불 구경할래?'],
  grumpy: ['흥, 호박 등불 밤이래. 사탕 안 주면 가만 안 둬.', '…사탕 주면 칭찬해 줄게. 쳇.'],
}

/** 도토리 감사 장날 아침의 수확 이야기 */
const HARVEST_TODAY: Per = {
  cheery: ['있잖아! 오늘 감사 장날이래! 올해 수확물 나눠 먹자!', '과일 파이 같은 요리 만들어 가면 다들 좋아할 거야!'],
  shy: ['…오늘 감사 장날이래… 수확물 있으면 같이 나눠 먹을래…?', '…나는 도토리 쿠키 만들어 왔어… 조금 나눠 줄게…'],
  cool: ['오늘 감사 장날이더군. 수확물 나눌 만한 게 있나?', '장날 구경이나 하다 가야겠어.'],
  lazy: ['오늘 감사 장날이래~ 과일 하나만 줄 거지~?', '수확물 나눠 먹으면 낮잠도 잘 올 것 같아~'],
  sporty: ['오늘 감사 장날이다! 수확물 들고 광장으로 뛰자!', '과일 먹고 에너지 충전해서 장터 한 바퀴 돌래!'],
  grumpy: ['흥, 오늘 감사 장날이래. 수확물은 챙겼겠지?', '…나눠 주는 게 싫은 건 아니거든. 쳇.'],
}

const BOTTLE_TODAY: Per = {
  cheery: ['있잖아! 오늘 바다에 유리병이 떠밀려 왔대!', '무슨 편지가 들었을까? 같이 주우러 가자!'],
  shy: ['…오늘 해변에 병이 떠밀려 왔대…', '편지가 들었을지도 몰라… 궁금해…'],
  cool: ['오늘 해변에 유리병이 떠밀려 왔더라.', '편지 내용이 궁금하긴 하네.'],
  lazy: ['바다에 병이 떠밀려 왔대~ 주우러 가긴 귀찮아~', '편지 있으면 나한테도 보여 줘~'],
  sporty: ['해변에 병이 떠밀려 왔대! 바로 달려가자!', '편지 찾으면 같이 읽자!'],
  grumpy: ['흥, 해변에 병이 떠밀려 왔대. 누가 버린 거야?', '…편지 내용 나중에 알려 줘. 쳇.'],
}

const TOPICS: Topic[] = [
  // 선물한 옷을 입고 나왔을 때: 취향에 따라 다른 말
  { id: 'worn-gift', weight: 4, when: (c) => !!c.wornGift, say: (c) => wornLines(c.v, c.wornGift!.id, c.wornGift!.taste) },
  { id: 'weather', weight: 3, say: (c, rng, me) => [withLead(pick(WEATHER_LINES[c.weather], rng), rng, me)] },
  { id: 'season', weight: 3, say: (c, rng, me) => [withLead(pick(SEASON_LINES[c.season], rng), rng, me)] },
  { id: 'time', weight: 2, say: (c, rng, me) => [withLead(pick(PART_LINES[c.part], rng), rng, me)] },
  {
    id: 'hat',
    weight: 4,
    when: (c) => !!c.hat,
    say: (c, _rng, me) => [`그 ${WEAR_BY_ID[c.hat!].name}, 너한테 잘 어울려!`, me.praise],
  },
  {
    id: 'outfit',
    weight: 1.5,
    when: (c) => c.outfit !== 'shirt-sky',
    say: (c) => [`${WEAR_BY_ID[c.outfit].name} 새로 샀어? 색이 예쁘다`],
  },
  { id: 'tool', weight: 2.5, when: (c) => !!TOOL_LINES[c.tool], say: (c) => [TOOL_LINES[c.tool]] },
  {
    id: 'pocket-fish',
    weight: 3,
    when: (c) => c.pocket.some((id) => ITEMS[id]?.kind === 'fish'),
    say: (c) => {
      const fish = ITEMS[c.pocket.find((id) => ITEMS[id]?.kind === 'fish')!]
      return [`킁킁… 주머니에서 ${fish.name} 냄새가 나는데?`, '상점에 팔면 도토리를 꽤 받을걸']
    },
  },
  {
    id: 'pocket-fruit',
    weight: 2.5,
    when: (c) => c.pocket.some((id) => ITEMS[id]?.kind === 'fruit'),
    say: (c) => {
      const fruit = ITEMS[c.pocket.find((id) => ITEMS[id]?.kind === 'fruit')!]
      return [`${josa(fruit.name, '이', '가')} 있네! 달콤한 냄새…`, '…아니야, 달라는 건 아니고!']
    },
  },
  {
    id: 'gossip',
    weight: 3,
    when: (c) => c.others.length > 0,
    say: (c, rng, me) => {
      const o = pick(c.others, rng)
      return [`${pick(me.lead, rng)} ${GOSSIP[o.id] ?? `${josa(o.name, '은', '는')} 요즘 잘 지내나 봐`}`]
    },
  },
  { id: 'hobby', weight: 2.5, say: (_c, rng, me) => [pick(me.hobby, rng)] },
  {
    id: 'island',
    weight: 1.5,
    say: (_c, rng, me) => [
      withLead(
        pick(
          [
            '펠리한테 말하면 오렌지 섬에 데려다준대',
            '도토리 마일리지 모으면 주머니를 늘릴 수 있대',
            '작업대에서 레시피대로 가구를 만들 수 있어',
            '밤에 망원경으로 보면 별똥별이 지나간대',
          ],
          rng,
        ),
        rng,
        me,
      ),
    ],
  },
  {
    id: 'home',
    weight: 6,
    when: (c) => c.home,
    say: (_c, rng) => [pick(['우리 집에 놀러 와 줘서 고마워! 편하게 있어', '이 침대 폭신폭신해. 누워 보고 싶지?', '창밖으로 별이 보여서 이 방이 좋아'], rng)],
  },
  {
    id: 'friend',
    weight: 2,
    when: (c) => c.level >= 2,
    say: (_c, rng, me) => [withLead(pick(['너랑 있으면 시간이 금방 가', '우리 이제 진짜 친구지?', '처음 만난 날 기억나? 그때 조금 긴장했었어'], rng), rng, me)],
  },
  {
    id: 'shop-today',
    weight: 3,
    when: (c) => !!c.today?.shop,
    say: (c) => {
      const shop = c.today!.shop!
      return shop.closed ? SHOP_CLOSED[who(c)] : SHOP_OPEN[who(c)](shop.sale)
    },
  },
  {
    id: 'broadcast-today',
    weight: 2,
    when: (c) => !!c.today?.broadcast,
    say: (c) => BROADCAST[who(c)](c.today!.broadcast!),
  },
  { id: 'songi-today', weight: 2.5, when: (c) => !!c.today?.songiHigh, say: (c) => SONGI_HIGH[who(c)] },
  {
    id: 'story-today',
    weight: 2.5,
    when: (c) => !!c.today?.story,
    say: (c) => {
      const st = c.today!.story!
      return [STORY_TALK[who(c)](st.title), `${STORY_CHEER[st.no] ?? ''} ${STORY_TAIL[who(c)]}`.trim()]
    },
  },
  { id: 'bottle-today', weight: 3, when: (c) => !!c.today?.bottle, say: (c) => BOTTLE_TODAY[who(c)] },
  { id: 'pumpkin-night', weight: 3, when: (c) => !!c.today?.pumpkin, say: (c) => PUMPKIN_NIGHT[who(c)] },
  { id: 'harvest-today', weight: 3, when: (c) => !!c.today?.harvest, say: (c) => HARVEST_TODAY[who(c)] },
  { id: 'birthday-talk', weight: 4, when: (c) => !!c.today?.birthday, say: (c) => birthdayTalkLines(who(c)) },
  { id: 'first-snow-today', weight: 3, when: (c) => !!c.today?.firstSnow, say: (c) => firstSnowTalkLines(who(c)) },
  { id: 'after-milestone', weight: 4, when: (c) => !!c.afterDue, say: (c) => afterTalkLines(who(c), c.afterDue!) },
  { id: 'player-birthday', weight: 4, when: (c) => !!c.today?.playerBirthday, say: (c) => playerBirthdayTalkLines(who(c)) },
  { id: 'milestone-talk', weight: 4, when: (c) => !!c.today?.milestone, say: (c) => milestoneTalkLines(c.today!.milestone!.kind, who(c), c.today!.milestone!.day, c.v.id) },
  // 새 섬 요소에 가끔 반응한다(해당 상태일 때만, 성격별 한 줄)
  { id: 'island-wallpaper', weight: 1, when: (c) => !!c.island?.wallpaper, say: (c) => [islandTalkLine('wallpaper', who(c))] },
  { id: 'island-set', weight: 1, when: (c) => !!c.island?.set, say: (c) => [islandTalkLine('set', who(c))] },
  { id: 'island-pebble', weight: 1, when: (c) => c.pocket.includes(RAIN_STONE_ID), say: (c) => [islandTalkLine('pebble', who(c))] },
  { id: 'island-ledger', weight: 1, when: (c) => !!c.island?.ledger, say: (c) => [islandTalkLine('ledger', who(c))] },
  { id: 'island-stairs', weight: 1, when: (c) => !!c.island?.stairs, say: (c) => [islandTalkLine('stairs', who(c))] },
  { id: 'island-facility', weight: 1, when: (c) => !!c.island?.facility, say: (c) => [islandTalkLine('facility', who(c))] },
  { id: 'island-porch', weight: 1, when: (c) => !!porchOf(c), say: (c) => [porchTalkLine(porchOf(c)!.name, who(c))] },
  { id: 'story-done', weight: 2.5, when: (c) => !!c.today?.storyDone, say: (c) => STORY_DONE[who(c)] },
  { id: 'week-recap', weight: 2.5, when: (c) => !!c.today?.weekQuote, say: (c) => WEEK_RECAP[who(c)](c.today!.weekQuote!) },
  {
    id: 'ask-time',
    weight: 2,
    when: (c) => c.level >= 1,
    say: () => [],
    ask: (_c, me, rng) => ({
      q: `${pick(me.lead, rng)} 너는 아침이 좋아, 밤이 좋아?`,
      options: [
        { label: '아침이 좋아', like: true },
        { label: '밤이 좋아', like: false },
      ],
    }),
  },
  {
    id: 'ask-season',
    weight: 2,
    when: (c) => c.level >= 1,
    say: () => [],
    ask: (c, _me, rng) => ({
      q: pick(['제일 좋아하는 계절은 뭐야?', '계절 중에 어떤 게 제일 좋아?', '봄, 여름, 가을, 겨울 중에 뭐가 제일 좋아?'], rng),
      options: (['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => ({
        label: { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }[s],
        like: s === c.season,
      })),
    }),
  },
  {
    id: 'ask-catch',
    weight: 1.5,
    when: (c) => c.level >= 1,
    say: () => [],
    ask: (_c, me, rng) => ({
      q: `${pick(me.lead, rng)} 낚시랑 벌레 잡기, 뭐가 더 좋아?`,
      options: [
        { label: '낚시!', like: true },
        { label: '벌레 잡기!', like: false },
      ],
    }),
  },
]

const RECENT_MAX = 12
/** 기억이 다 떨어졌을 때도 피할 바로 앞 화제 수 */
const RECENT_JUST_NOW = 4

/** 화제 id 목록. 화제가 빠지지 않았는지 테스트할 때 쓴다. */
export const TOPIC_IDS: readonly string[] = TOPICS.map((t) => t.id)

export function pickChat(c: ChatContext, rng: Rng): Chat {
  const me = VOICES[PERSONALITY[c.v.id] ?? 'cheery']
  const usable = TOPICS.filter((t) => (!t.when || t.when(c)) && (c.allowAsk !== false || !t.ask) && !(t.ask && c.answered?.includes(t.id)))
  // 최근 화제는 길게(RECENT_MAX) 기억하되, 다 떨어지면 바로 앞의 몇 개만 피한다
  const fresh = usable.filter((t) => !c.recent.includes(t.id))
  const notJustNow = usable.filter((t) => !c.recent.slice(-RECENT_JUST_NOW).includes(t.id))
  const pool = fresh.length > 0 ? fresh : notJustNow.length > 0 ? notJustNow : usable
  // 생일 수다가 아직 없었던 날이면 그 화제만 고른다(화제 기억과 상관없이 하루 한 번)
  const forced = usable.filter((t) => (t.id === 'birthday-talk' && !!c.birthdayDue) || (t.id === 'player-birthday' && !!c.playerBirthdayDue) || (t.id === 'after-milestone' && !!c.afterDue) || (t.id === 'milestone-talk' && !!c.milestoneDue))
  const topic = pickWeighted(forced.length > 0 ? forced : pool, rng)
  const tic = c.v.tic
  const lines = topic.say(c, rng, me).map((l) => withTic(l, tic))
  if (topic.ask) {
    const a = topic.ask(c, me, rng)
    lines.push(withTic(a.q, tic))
    return {
      topic: topic.id,
      lines,
      ask: { topic: topic.id, options: a.options.map((o) => ({ label: o.label, reply: withTic(o.reply ?? (o.like ? me.agree : me.differ), tic) })) },
    }
  }
  return { topic: topic.id, lines }
}

/** 최근 화제 목록에 새 화제를 넣는다. 오래된 것부터 빠진다. */
export function rememberTopic(recent: readonly string[], topic: string): string[] {
  return [...recent.filter((t) => t !== topic), topic].slice(-RECENT_MAX)
}

/** 말 대신 몸짓으로 이야기하는 주민의 화제별 몸짓 */
const GESTURE: Record<string, string> = {
  weather: '하늘을 가리키며 빙글 돈다',
  season: '떨어지는 잎을 잡으려고 폴짝 뛴다',
  time: '해(달)를 가리키며 고개를 끄덕인다',
  hat: '네 모자를 가리키며 엄지를 척 든다',
  outfit: '네 옷을 보고 박수를 짝짝 친다',
  tool: '네 도구를 따라 휘두르는 시늉을 한다',
  'pocket-fish': '코를 킁킁거리며 주머니를 가리킨다',
  'pocket-fruit': '주머니를 보며 침을 꿀꺽 삼킨다',
  gossip: '저쪽 친구를 가리키며 뭔가 흉내 낸다',
  hobby: '좋아하는 걸 하는 시늉을 신나게 한다',
  'birthday-talk': '고깔모자를 쓴 머리를 흔들며 축하 춤을 춘다',
  'first-snow-today': '두 손을 모아 눈덩이를 굴리는 시늉을 한다',
  'after-milestone': '손에 든 표지판을 높이 들어 보인다',
  'player-birthday': '작은 선물 상자를 내밀며 축하의 박수를 친다',
  island: '부두 쪽을 가리키며 날갯짓 흉내를 낸다',
  home: '방을 한 바퀴 빙 둘러보며 뿌듯해한다',
  friend: '네 손을 꼭 잡고 흔든다',
}

/** 소리로 말하는 주민(유자·솜이)만 쓰는 몸짓. 날씨·계절·주머니·친한 정도를 보고 고른다. */
const VOICE_GESTURE: { id: string; when?: (c: ChatContext) => boolean; text: string }[] = [
  // 오늘 섬 소식 몸짓
  { id: 'today-shop-closed', when: (c) => !!c.today?.shop?.closed, text: '망치로 두드리는 흉내를 내요' },
  { id: 'today-shop-open', when: (c) => !!c.today?.shop && !c.today.shop.closed, text: '진열대 쪽을 가리키며 폴짝 뛰어요' },
  { id: 'today-broadcast', when: (c) => !!c.today?.broadcast, text: '귀를 쫑긋 세우고 고개를 기울여요' },
  { id: 'today-songi', when: (c) => !!c.today?.songiHigh, text: '송이를 줍는 시늉을 해요' },
  { id: 'today-story', when: (c) => !!c.today?.story, text: '주먹을 꽉 쥐고 힘내라는 몸짓을 해요' },
  { id: 'today-bottle', when: (c) => !!c.today?.bottle, text: '바다 쪽을 손가락으로 가리켜요' },
  { id: 'today-story-done', when: (c) => !!c.today?.storyDone, text: '두 손을 번쩍 들고 박수를 쳐요' },
  { id: 'weather-rain', when: (c) => c.weather === 'rain', text: '젖은 귀를 탈탈 털며 물방울을 튕긴다' },
  { id: 'weather-snow', when: (c) => c.weather === 'snow', text: '두 손으로 눈을 뭉쳐 던지는 시늉을 한다' },
  { id: 'weather-sunny', when: (c) => c.weather === 'sunny', text: '햇볕을 쬐려고 배를 하늘로 드러내고 뒹군다' },
  { id: 'weather-cloudy', when: (c) => c.weather === 'cloudy', text: '구름을 가리키며 하품을 한다' },
  { id: 'season-spring', when: (c) => c.season === 'spring', text: '꽃잎을 잡으려고 두 손을 뻗는다' },
  { id: 'season-summer', when: (c) => c.season === 'summer', text: '부채질하는 시늉을 하며 헥헥거린다' },
  { id: 'season-autumn', when: (c) => c.season === 'autumn', text: '떨어지는 낙엽을 쫓아 깡충깡충 뛴다' },
  { id: 'season-winter', when: (c) => c.season === 'winter', text: '손을 호호 불며 몸을 웅크린다' },
  { id: 'pocket-bug', when: (c) => c.pocket.some((id) => ITEMS[id]?.kind === 'bug'), text: '주머니 속 벌레 소리에 귀를 쫑긋 세운다' },
  { id: 'friend-close', when: (c) => c.level >= 2, text: '꼬리 같은 귀를 흔들며 네 품에 파고든다' },
  { id: 'friend-new', when: (c) => c.level === 0, text: '멀리서 힐끔힐끔 보다가 한 걸음 다가온다' },
]

/** 소리 목록. 게임이 넘긴 목록에 더해 주민 목소리에 맞는 소리를 섞는다. */
const VOICE_SOUNDS: Record<string, string[]> = {
  shout: ['호잇!', '얍얍~!', '헤에, 진짜?', '와햐아!!', '얍? 얍!'],
  tiny: ['…응', '히잉…!', '우웅…', '우와, 우와…'],
}

export function gestureChat(c: ChatContext, rng: Rng, shout: string[]): Chat {
  const voice = c.v.voice
  const gift = c.playerBirthdayDue && c.today?.playerBirthday ? 'player-birthday' : c.birthdayDue && c.today?.birthday ? 'birthday-talk' : null
  if (gift) {
    const sounds = voice ? [...new Set([...shout, ...VOICE_SOUNDS[voice]])] : shout
    return { topic: gift, lines: [`(${GESTURE[gift]}) ${pick(sounds, rng)}`] }
  }
  const voiced = voice ? VOICE_GESTURE.filter((g) => (!g.when || g.when(c)) && !c.recent.includes(g.id)) : []
  const usable = [
    ...Object.keys(GESTURE).filter((id) => {
      const t = TOPICS.find((x) => x.id === id)!
      return (!t.when || t.when(c)) && !c.recent.includes(id)
    }),
    ...voiced.map((g) => g.id),
  ]
  const id = usable.length ? pick(usable, rng) : 'weather'
  const text = GESTURE[id] ?? VOICE_GESTURE.find((g) => g.id === id)?.text ?? GESTURE.weather
  const sounds = voice ? [...new Set([...shout, ...VOICE_SOUNDS[voice]])] : shout
  return { topic: id, lines: [`(${text}) ${pick(sounds, rng)}`] }
}
