import { withTic } from './chat'
import { birthdayInviteText } from './birthdays'
import { ITEMS, josa } from './items'
import { newItemsHighlight, TOP_TIER_LETTER_LINE } from './shopProgress'
import { hashString, mulberry32 } from './rng'
import { friendshipLevel, VILLAGERS } from './villagers'
import { WEEKDAY_NAME } from './guide'
import { weatherFor, type Weather } from './weather'

/** 편지함. 친해진 주민이 아침마다 편지를 보내고, 가끔 선물을 붙인다. */

/** 대표로 이름을 내는 편지: 가게 결산 편지는 따로 알리지 않고 이 줄의 머리에 둔다 */
const LEAD_LETTER = /^shop-month-/

/** 도착 알림의 머리가 되는 편지인가(가게 결산). 알림 순위를 정할 때 쓴다. */
export function isLeadLetter(l: Pick<Letter, 'id'>): boolean {
  return LEAD_LETTER.test(l.id)
}

/**
 * 하루 넘김에 새로 온 편지를 알리는 한 줄. 없으면 null.
 * 한 통이면 보낸 이 이름을, 여러 통이면 통수를 적는다. 편지마다 알리지 않고 이 줄 하나로 묶는다.
 * 결산 편지가 섞이면 "점장님 결산 편지 외 N통"처럼 결산을 앞에 둔다.
 */
export function arrivalNotice(arrived: readonly Pick<Letter, 'id' | 'fromName'>[]): string | null {
  if (arrived.length === 0) return null
  const lead = arrived.find(isLeadLetter)
  if (lead) return arrived.length === 1 ? `📮 ${lead.fromName}님 결산 편지가 왔어요` : `📮 ${lead.fromName}님 결산 편지 외 ${arrived.length - 1}통이 왔어요`
  if (arrived.length === 1) return `📮 ${arrived[0].fromName}에게서 편지가 왔어요`
  return `📮 편지 ${arrived.length}통이 왔어요`
}

export interface Letter {
  id: string
  from: string
  fromName: string
  day: string
  text: string
  gift: string | null
  read: boolean
  claimed: boolean
}

export const MAILBOX_MAX = 20

/** 호감도 단계가 높을수록 좋은 선물 */
const GIFTS = [
  ['peach', 'flower-seed', 'conch'],
  ['flower-seed', 'wooden-box', 'log-stool', 'scallop'],
  ['log-bench', 'stone-lantern', 'coral', 'iron'],
  ['iron-lamp', 'gold', 'fossil'],
]

/** 편지 본문. 말끝 버릇은 첫 문장에 붙이고, 날씨가 맞는 날에만 날씨 이야기를 쓴다. */
interface Body {
  text: (tic: string) => string
  /** 이 날씨에만 쓴다. 없으면 아무 날이나. */
  weather?: Weather[]
}

const BODIES: Body[] = [
  { text: (t) => `${withTic('요즘 섬이 점점 예뻐지는 것 같아.', t)} 다 네 덕분이야!` },
  { text: (t) => `${withTic('어제 산책하다가 네 생각이 났어.', t)} 오늘도 좋은 하루 보내!` },
  { text: (t) => `${withTic('바닷바람이 시원한 날엔 같이 조개 줍고 싶어.', t)}`, weather: ['sunny', 'cloudy'] },
  { text: (t) => `${withTic('우리 섬에 와 줘서 정말 기뻐.', t)} 앞으로도 잘 부탁해!` },
  { text: (t) => `${withTic('비 오는 날엔 달팽이가 나온대.', t)} 잠자리채 챙겨!`, weather: ['rain'] },
  { text: (t) => `${withTic('눈 오는 날엔 눈사람 만들기 딱이지.', t)} 같이 만들자!`, weather: ['snow'] },
  { text: (t) => `${withTic('작업대에서 뭐 만들었어?', t)} 나중에 구경시켜 줘!` },
]

export const WELCOME_LETTER: Letter = {
  id: 'welcome',
  from: 'pelican',
  fromName: '펠리',
  day: '',
  text: '도토리섬에 온 걸 환영해요, 꾸룩! 작은 선물로 꽃씨를 넣었어요. 섬 어딘가에 심어 봐요.',
  gift: 'flower-seed',
  read: false,
  claimed: false,
}

/** 아직 이사 오지 않은 여행 섬 손님이 보내는 편지 */
const GUEST_BODIES: Body[] = [
  { text: (t) => `${withTic('오렌지 섬에서 만나서 반가웠어.', t)} 도토리섬은 어떤 곳인지 자꾸 궁금해!` },
  { text: (t) => `${withTic('또 놀러 와!', t)} 오렌지 섬 바다는 오늘도 반짝반짝해.` },
]
const WAITING_BODIES: Body[] = [
  { text: (t) => `${withTic('집터 잡아 줘서 고마워.', t)} 이사 갈 날만 손꼽아 기다리고 있어!` },
  { text: (t) => `${withTic('짐 싸는 중이야.', t)} 집이 다 지어지면 바로 갈게!` },
]

/** 날씨에 맞는 본문만 골라 하나를 쓴다. 맞는 본문이 없으면 날씨 무관한 본문만 쓴다. */
function pickBody(bodies: readonly Body[], weather: Weather, rng: () => number): Body {
  const fit = bodies.filter((b) => !b.weather || b.weather.includes(weather))
  const list = fit.length ? fit : bodies.filter((b) => !b.weather)
  return list[Math.floor(rng() * list.length)]
}

/**
 * 그날 아침에 오는 편지. 한 번이라도 말을 건 주민 중 하나가 보낸다.
 * 날짜로 시드를 정해서 같은 날 두 번 불러도 같은 편지가 나온다.
 */
export function morningLetter(
  day: string,
  friendship: Record<string, number>,
  where: { houses: readonly string[]; recruits: readonly string[] } = { houses: [], recruits: [] },
  weather: Weather = weatherFor(day),
): Letter | null {
  const friends = VILLAGERS.filter((v) => (friendship[v.id] ?? 0) > 0)
  if (!friends.length) return null
  const rng = mulberry32(hashString(`letter:${day}`))
  const v = friends[Math.floor(rng() * friends.length)]
  const lv = friendshipLevel(friendship[v.id] ?? 0)
  // 이사 오기 전 손님은 오렌지 섬 이야기나 이사 준비 이야기를 한다.
  const away = v.guest && !where.houses.includes(v.id)
  const bodies = away ? (where.recruits.includes(v.id) ? WAITING_BODIES : GUEST_BODIES) : BODIES
  const body = pickBody(bodies, weather, rng).text(v.tic)
  // 친구 단계가 오를수록 선물을 붙일 확률도 오른다.
  const pool = GIFTS[Math.min(lv, GIFTS.length - 1)]
  const gift = rng() < 0.4 + lv * 0.15 ? pool[Math.floor(rng() * pool.length)] : null
  const ps = gift ? ` 작은 선물로 ${ITEMS[gift].name}${ITEMS[gift].icon} 넣었어!` : ''
  return { id: `letter-${day}`, from: v.id, fromName: v.name, day, text: body + ps, gift, read: false, claimed: false }
}

/**
 * 빚을 다 갚았을 때 펠리가 보내는 편지. 다음 집 이름과 빚을 알려 주고 집 상담 간판에서 맡기라고 한다.
 * `next` 가 없으면 가장 큰 집이라 축하만 한다. 같은 날 여러 번 갚아도 편지 id 는 날짜로 정해진다.
 */
export function loanPaidLetter(day: string, next: { name: string; loan: number } | null): Letter {
  const text = next
    ? `대출을 다 갚았네요, 꾸룩! 이제 다음 집(${next.name})을 맡길 수 있어요. 대출은 도토리 ${next.loan.toLocaleString()}개예요. 집 상담 간판에서 맡겨 봐요.`
    : '대출을 다 갚았네요, 꾸룩! 이제 가장 큰 집이에요. 정말 멋져요! 외관을 칠하거나 섬 가꾸기에 마일을 기부하며 더 꾸며 봐요.'
  return { id: `loan-paid-${day}`, from: 'pelican', fromName: '펠리', day, text, gift: null, read: false, claimed: false }
}

/** 따뜻한 모금 주간 첫날 아침 섬 가꾸기 위원회의 편지. 날짜로 id 를 정해 하루에 한 통이다. */
/** 계단이 생겨 그 자리의 물건을 주머니로 돌려놨을 때 아침에 한 번 알린다. 날짜로 id 를 정해 하루에 한 통이다. */
export function stepSpotLetter(day: string): Letter {
  return {
    id: `step-spot-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '섬에 계단이 생겨서, 계단이 생긴 자리의 물건은 주머니나 집 보관함에 돌려놨어요. 길과 정원 바닥도 그 칸만 걷어냈어요.',
    gift: null,
    read: false,
    claimed: false,
  }
}

export function warmFundLetter(day: string): Letter {
  return {
    id: `warm-fund-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '12월 첫째 주에는 섬 가꾸기 기부 마일이 1.2배로 쌓여요. 마을회관 접수대에서 마일을 모아 보세요.',
    gift: null,
    read: false,
    claimed: false,
  }
}

/** 집을 지은 다음 날 아침, 외관을 아직 한 번도 칠하지 않은 플레이어에게 칠하기 방법을 한 번 알린다. 날짜로 id 를 정해 하루에 한 통이다. */
export function paintTipLetter(day: string): Letter {
  return {
    id: `paint-tip-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '집이 완성됐네요! 바깥도 칠할 수 있어요. 집 상담의 집 꾸미기에서 지붕·벽·문 색을 골라요. 문이 가장 싸요.',
    gift: null,
    read: false,
    claimed: false,
  }
}

/** 새 방이 열린 다음 날 아침, 그 방에 어울리는 가구를 선물로 보낸다. 편지 id 는 방 이름이라 방마다 한 번만 온다. */
export function roomGiftLetter(day: string, room: { key: string; label: string; item: string }, itemName: string): Letter {
  return {
    id: `room-gift-${room.key}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: `${josa(room.label, '이', '가')} 생겼어요! ${room.label}에 어울리는 ${josa(itemName, '을', '를')} 보내요. 편지에서 받으면 주머니에 들어가요.`,
    gift: room.item,
    read: false,
    claimed: false,
  }
}

/** 점장 편지에 붙이는 단계별 가구. 큰 가게(2)와 백화점(3)에서 처음 들여오는 가구 가운데 하나다. */
export const SHOP_LETTER_GIFT: Readonly<Record<2 | 3, string>> = { 2: 'campfire', 3: 'lantern-hanging' }

/** 큰 가게·백화점으로 올린 날 점장이 보내는 편지. 새로 들여온 물건을 알리고 단계별 가구 하나를 선물로 붙인다. */
export function shopUpgradeLetter(day: string, tier: 2 | 3, news: readonly string[], gift: string): Letter {
  const shop = tier === 2 ? '큰 가게' : '도토리 백화점'
  const highlight = newItemsHighlight(news)
  const intro = highlight ? `이번에 ${josa(highlight, '을', '를')} 새로 들여왔어요.` : ''
  const g = ITEMS[gift]
  const text = `${josa(shop, '으로', '로')} 키워 주셔서 정말 고마워요! 단골 손님들 덕분에 여기까지 왔어요. ${intro} 작은 선물로 ${g.icon} ${josa(g.name, '을', '를')} 넣어 뒀어요. 섬에 놓아 보세요!`
  const top = tier === 3 ? ` ${TOP_TIER_LETTER_LINE}` : ''
  return { id: `shop-tier-${tier}`, from: 'shopkeeper', fromName: '점장', day, text: text + top, gift, read: false, claimed: false }
}

/**
 * 2차 섬 가꾸기 시설마다 그 시설을 보는 주민과 감사 문장. 주민은 시설마다 다르고, 편지 id 가 시설 id 라 한 시설에 한 번만 온다.
 * 주민의 말투로 쓴다. 반말에 그 주민의 말끝 버릇(tic)을 첫 문장에 붙인다(다른 주민 편지와 같은 방식).
 * 시설 이름은 받침에 맞춰 조사를 고른다.
 */
const ISLAND_THANKS: Readonly<Record<string, { from: string; line: (name: string, tic: string) => string }>> = {
  'lighthouse-lamps': { from: 'mocha', line: (n, t) => `${withTic(`${josa(n, '이', '가')} 켜져서 밤 산책이 훨씬 환해졌어.`, t)} 등대 쪽 길에서 자주 만날 것 같아. 고마워!` },
  'beach-parasol': { from: 'pengdol', line: (n, t) => `${withTic(`${josa(n, '이', '가')} 생겨서 더운 날 해변에서 쉬기 좋아졌어.`, t)} 그늘에서 같이 낮잠 자자. 고마워!` },
  'hill-pavilion': { from: 'maro', line: (n, t) => `${withTic(`${josa(n, '이', '가')} 생겨서 언덕에서 바다가 한눈에 보여.`, t)} 올라갈 때마다 기분이 좋아져. 고마워!` },
  'plaza-clock': { from: 'bomi', line: (n, t) => `${withTic(`${josa(n, '이', '가')} 생겨서 광장에서 시간 보기가 쉬워졌어.`, t)} 아침에 눈 뜰 때도 든든해. 고마워!` },
}

/** 2차 시설이 완성된 다음 날 아침 그 시설을 보는 주민의 감사 편지. 시설 목록에 없는 id 면 null. */
export function islandThanksLetter(day: string, facility: { id: string; name: string }): Letter | null {
  const t = ISLAND_THANKS[facility.id]
  const v = t ? VILLAGERS.find((x) => x.id === t.from) : undefined
  if (!t || !v) return null
  return { id: `island-thanks-${facility.id}`, from: v.id, fromName: v.name, day, text: t.line(facility.name, v.tic), gift: null, read: false, claimed: false }
}

/**
 * 주민 집 증축이 끝난 다음 날 아침, 그 집 주민이 보내는 감사 편지. 주민 말투(반말 + 말끝 버릇)로 쓴다.
 * 편지 id 가 주민 id 라 한 집에 한 번만 온다. 주민 id 가 없으면 null.
 */
export function houseThanksLetter(day: string, villagerId: string): Letter | null {
  const v = VILLAGERS.find((x) => x.id === villagerId)
  if (!v) return null
  const line = `${withTic('현관에 차양이 달려서 비 오는 날에도 편하게 드나들게 됐어', v.tic)} 고마워! 덕분에 우리 집이 더 아늑해졌어.`
  return { id: `house-thanks-${v.id}`, from: v.id, fromName: v.name, day, text: line, gift: null, read: false, claimed: false }
}

/** 생일 날 아침 주민이 보내는 초대 편지. 선물을 들고 놀러 오라고 한다. */
/** 태풍 전날 아침 펠리의 예보 편지. 내일 태풍이 온다는 것과 준비할 일을 알려 준다. */
/** 마지막으로 연 날(prev)에서 오늘까지 어제 것을 늦게 줄 만큼 떨어져 있는가. 어제를 놓쳤고, 일주일 안에 돌아온 경우만 본다. */
export function lateWindow(prev: string, today: string, dayIdx: (k: string) => number | null): boolean {
  const a = dayIdx(prev)
  const b = dayIdx(today)
  if (a === null || b === null) return false
  return b - a >= 2 && b - a <= 7
}

/**
 * 어제 아침에 놓친 선물 편지를 오늘 한 번 늦게 보낸다. 하루치만 본다(그 전 날 것은 그대로 놓친다).
 * 선물이 없는 편지는 늦게 보내지 않는다. 이미 받았거나(같은 id) 늦게 보낸 편지(late- id)가 있으면 빼다.
 */
export function lateGiftLetters(today: string, missed: readonly (Letter | null)[], haveIds: readonly string[]): Letter[] {
  return missed
    .filter((l): l is Letter => !!l && !!l.gift)
    .filter((l) => !haveIds.includes(l.id) && !haveIds.includes(`late-${l.id}`))
    .map((l) => ({ ...l, id: `late-${l.id}`, day: today, text: `📮 어제 못 받은 편지예요. ${l.text}`, read: false, claimed: false }))
}

export function typhoonLetter(day: string, eveDay: string): Letter {
  return { id: `typhoon-${eveDay}`, from: 'pelican', fromName: '펠리', day, text: '내일 큰 바람과 비가 온대요, 꾸룩! 배와 물건을 단단히 챙기세요. 바닷가엔 가지 마세요.', gift: null, read: false, claimed: false }
}

export function birthdayLetter(day: string, v: { id: string; name: string; tic: string }): Letter {
  return { id: `birthday-${day}-${v.id}`, from: v.id, fromName: v.name, day, text: birthdayInviteText(v.tic), gift: null, read: false, claimed: false }
}

/** 생일 초대 편지인가(감사 답례 편지는 아니다) */
const isBirthdayInvite = (l: Letter) => l.id.startsWith('birthday-') && !l.id.startsWith('birthday-thanks-')

/**
 * 편지 본문을 보는 날 기준으로 정한다. 저장된 문장은 고치지 않는다.
 * 지난 날의 생일 초대는 "○○의 생일은 ○월 ○일이었어요"로 바꿔 보여 준다.
 */
export function letterTextOn(l: Letter, today: string): string {
  if (!isBirthdayInvite(l) || l.day >= today) return l.text
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(l.day)
  if (!m) return l.text
  return `${l.fromName}의 생일은 ${Number(m[1])}월 ${Number(m[2])}일이었어요`
}

/** 생일 선물을 받은 다음 날 아침 답례 편지. 작은 가구를 함께 보낸다. */
export function birthdayThanksLetter(day: string, v: { id: string; name: string; tic: string }, present: string | null): Letter {
  const gift = present && ITEMS[present] ? present : null
  const giftText = gift ? ` 작은 답례로 ${ITEMS[gift].name}${ITEMS[gift].icon} 넣었어!` : ''
  return {
    id: `birthday-thanks-${day}-${v.id}`,
    from: v.id,
    fromName: v.name,
    day,
    text: `어제 생일 선물 정말 고마워${v.tic}!${giftText}`,
    gift,
    read: false,
    claimed: false,
  }
}

/**
 * 월요일 아침 섬 가꾸기 위원회의 별점 편지. 이번 주 별 개수와 가장 싼 조언 한 가지를 적는다.
 * 3★·5★ 보상을 처음 받는 주에는 보상 줄을 덧붙인다. id 는 날짜로 정해져 같은 주에 두 번 오지 않는다.
 */
export function ratingLetter(day: string, stars: number, tip: string | null, rewardLines: string[], arrived: string = day): Letter {
  // 제목에는 편지가 실제로 온 요일을 쓴다. 한 주의 첫날을 열지 않으면 월요일이 아니라 나중 요일에 온다.
  const weekday = WEEKDAY_NAME[new Date(`${arrived}T00:00:00`).getDay()]
  const parts = [`${weekday}요일 섬 별점 소식이에요. 이번 주 별점은 ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} 이에요.`]
  parts.push(tip ? `💡 ${tip}.` : '별 다섯 개예요. 이 섬이 정말 자랑스러워요!')
  parts.push(...rewardLines)
  return { id: `rating-${day}`, from: 'committee', fromName: '섬 가꾸기 위원회', day, text: parts.join(' '), gift: null, read: false, claimed: false }
}

/** 유성우 밤에 소원을 빌었다면 다음 날 아침 펠리의 작은 선물 편지. 밤마다 한 통이다. */
/** 교배로 처음 희귀색 꽃이 피면 한 번 보내는 편지. id 가 같으면 한 번만 온다. */
export function breedLetter(day: string, flower: { id: string; name: string; letter: string }): Letter {
  return { id: `breed-${flower.id}`, from: 'pelican', fromName: '펠리', day, text: `꽃밭에서 두 송이가 어울려 ${flower.letter}, 꾸룩! 도감 꽃 칸에 적어 뒀어요.`, gift: null, read: false, claimed: false }
}

/** 별자리 열두 개를 모두 본 날의 편지. 별 모양 조명을 함께 보낸다. */
export function starsLetter(day: string): Letter {
  return { id: 'stars-complete', from: 'pelican', fromName: '펠리', day, text: '별자리 열두 개를 다 찾았어요, 꾸룩! 밤하늘을 닮은 조명을 보내요.', gift: 'star-lamp', read: false, claimed: false }
}

export function wishLetter(day: string, night: string): Letter {
  return { id: `wish-${night}`, from: 'pelican', fromName: '펠리', day, text: '어젯밤 빈 소원이 살짝 이루어진 것 같아요, 꾸룩! 작은 선물을 보내요.', gift: 'flower-seed', read: false, claimed: false }
}

/** 축제 전날 아침 위원회 편지. 내일 무슨 축제인지와 할 일을 알려 준다. */
export function festivalEveLetter(day: string, f: { name: string; icon: string; eve: string }, eveDay: string): Letter {
  return { id: `festival-eve-${eveDay}`, from: 'committee', fromName: '섬 가꾸기 위원회', day, text: `${f.icon} ${josa(f.name, '이', '가')} 내일이에요! ${f.eve}`, gift: null, read: false, claimed: false }
}

/** 축제 할 일을 끝낸 날 보내는 선물 편지. 선물은 편지함에서 받는다(주머니가 가득 차도 잃지 않는다). */
export function festivalRewardLetter(day: string, f: { name: string; icon: string; reward: string }): Letter {
  return { id: `festival-reward-${day}`, from: 'committee', fromName: '섬 가꾸기 위원회', day, text: `${josa(f.name, '을', '를')} 끝낸 걸 축하해요! 축제 선물을 보내요.`, gift: f.reward, read: false, claimed: false }
}
