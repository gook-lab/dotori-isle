import { josa } from './items'
import { WEATHER_INFO, type Weather } from './weather'

/** 아침 섬 소식 한 줄의 재료. 게임 상태에서 모아 넣고, 여기서는 문구와 순서만 정한다. */
export interface NewsInput {
  weather: Weather
  tomorrow: Weather
  /** 오늘의 무지개 가능성(어제 날씨 → 오늘 날씨) */
  rainbow: boolean
  /** 오늘 밤 별똥별 */
  meteor: boolean
  festival: string | null
  market: boolean
  marketTomorrow: boolean
  tourney: boolean
  /** 오늘 집에 놀러 올 수 있는 주민 이름 */
  visitor: string | null
  /** 오늘 생일인 주민 이름들 */
  birthdays: readonly string[]
  /** 반짝 특가 물건 이름(금요일) 또는 보통 특가 이름들 */
  flashSale: string | null
  sales: readonly string[]
  /** 이달의 가구 이름 */
  monthly: string | null
  /** 남은 대출 */
  loan: number
  /** 오늘 해변에 깔린 반짝이는 조약돌 수(비 오는 날에만). 없으면 0 */
  rainStones?: number
  /** 오늘 송이 시세(오전·오후). 일요일이면 없다. */
  songi?: { am: number; pm: number } | null
}

/** 소식은 많아도 이만큼만 보여 준다 */
export const NEWS_MAX_LINES = 4

const SAY: Record<Weather, string> = { sunny: '맑아요', cloudy: '흐려요', rain: '비가 와요', snow: '눈이 와요' }

/**
 * 아침 섬 소식 줄들. 우선순위 순서로 세우고, 없는 항목은 건너뛴다.
 * 1 날씨(오늘·내일) → 2 행사(축제·장날·낚시 대회·별똥별·무지개) → 3 생일 → 4 방문객 → 5 상점 → 6 대출.
 */
export function morningNews(n: NewsInput): string[] {
  const lines: string[] = []
  // 첫 줄은 그날 날씨 이모지로 시작한다(방송 머리글 📻은 카드 헤더에 둔다)
  const icon = WEATHER_INFO[n.weather].icon
  lines.push(
    n.tomorrow === n.weather
      ? `${icon} 오늘은 ${SAY[n.weather]} 내일도 비슷하겠어요.`
      : `${icon} 오늘은 ${SAY[n.weather]} 내일은 ${SAY[n.tomorrow]}`,
  )
  // 비 오는 날의 조약돌은 날씨 바로 다음 줄에 둔다
  if (n.rainStones) lines.push(`🪨 비가 씻어 준 반짝이는 조약돌이 해변에 ${n.rainStones}개 있어요. 주워서 팔 수 있어요.`)
  // 행사는 한 줄만: 축제가 가장 크고, 나머지는 이 순서로 하나만 고른다
  if (n.festival) lines.push(`🎪 오늘은 ${n.festival} 날이에요. 광장에 나와 봐요.`)
  else if (n.tourney) lines.push('🎣 오늘은 낚시 대회가 열려요. 9시부터 18시까지예요.')
  else if (n.market) lines.push('🧺 오늘은 장날이에요. 광장에 장이 서요.')
  else if (n.meteor) lines.push('🌠 오늘 밤에는 별똥별이 떨어질 수 있어요.')
  else if (n.rainbow) lines.push('🌈 오늘 오후에 무지개가 뜰지도 몰라요.')
  else if (n.marketTomorrow) lines.push('🧺 내일은 장날이에요. 미리 준비해 봐요.')
  if (n.birthdays.length) lines.push(`🎂 오늘은 ${n.birthdays.join(', ')}의 생일이에요. 축하해 줘요.`)
  if (n.visitor) lines.push(`🚪 오늘 ${josa(n.visitor, '이', '가')} 집에 놀러 올지도 몰라요.`)
  if (n.flashSale) lines.push(`🏷️ 오늘 반짝 특가예요. ${josa(n.flashSale, '을', '를')} 반값에 살 수 있어요.`)
  else if (n.sales.length) lines.push(`🏷️ 상점에 특가가 있어요. ${josa(n.sales.slice(0, 2).join(', '), '을', '를')} 싸게 팔아요.`)
  if (n.songi) lines.push(`🍄 오늘 송이 시세는 오전 도토리 ${n.songi.am.toLocaleString()}개, 오후 도토리 ${n.songi.pm.toLocaleString()}개예요.`)
  if (n.monthly) lines.push(`🛍️ 이달의 가구 ${josa(n.monthly, '이', '가')} 들어왔어요.`)
  if (n.loan > 0) lines.push(`🏦 대출 도토리 ${n.loan.toLocaleString()}개가 남아 있어요. ATM에서 갚아요.`)
  return lines.slice(0, NEWS_MAX_LINES)
}
