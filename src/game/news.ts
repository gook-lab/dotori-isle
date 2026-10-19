import { isBirthday } from '../core/birthdays'
import { dailyStock } from '../core/shopTiers'
import { festivalOn, nextDay } from '../core/festivals'
import { isMarketDay, marketTomorrow, weekdayOf } from '../core/market'
import { isFlashDay, monthlyFurniture } from '../core/shopEvents'
import { isMeteorNight, prevDay, rainbowDay } from '../core/skyEvents'
import { TOURNEY_WEEKDAY } from '../core/tourney'
import { morningNews, type NewsInput } from '../core/morningNews'
import { isPumpkinDay, isPumpkinEve, PUMPKIN_DAY_LINE, PUMPKIN_EVE_LINE } from '../core/pumpkin'
import { HARVEST_DAY_LINE, HARVEST_EVE_LINE, isHarvestFairDay, isHarvestFairEve } from '../core/harvestFair'
import { FIRST_SNOW_DAY_LINE, FIRST_SNOW_EVE_LINE, isFirstSnowDay, isFirstSnowEve } from '../core/firstSnow'
import { VILLAGERS } from '../core/villagers'
import { visitorFor } from '../core/visits'
import { weatherFor } from '../core/weather'
import { getLayout } from '../core/daily'
import { RAIN_STONE_ID } from '../core/rainStones'
import type { HomeState } from '../core/home'
import { songiQuote } from '../core/songi'
import type { ShopState } from '../core/shopTiers'

/** 오늘의 섬 소식 줄을 게임 상태에서 모은다. 쓰는 것은 모두 기존 데이터다. */
export function newsFor(s: { day: string; houses: string[]; shop: ShopState; home: HomeState }): string[] {
  const day = s.day
  const weather = weatherFor(day)
  const names = (ids: string[]) => ids.map((id) => VILLAGERS.find((v) => v.id === id)?.name ?? id)
  const stock = dailyStock(s.shop.tier, day)
  const visitor = visitorFor(day, s.houses)
  const songiAm = songiQuote(day, true)
  const songiPm = songiQuote(day, false)
  const input: NewsInput = {
    weather,
    tomorrow: weatherFor(nextDay(day)),
    rainbow: rainbowDay(weatherFor(prevDay(day)), weather),
    meteor: isMeteorNight(day, weather),
    festival: festivalOn(day)?.name ?? null,
    market: isMarketDay(day),
    marketTomorrow: marketTomorrow(day),
    tourney: weekdayOf(day) === TOURNEY_WEEKDAY,
    visitor: visitor ? names([visitor])[0] : null,
    birthdays: names(VILLAGERS.filter((v) => !v.guest && isBirthday(v.id, day)).map((v) => v.id)),
    flashSale: isFlashDay(day) ? stock.find((e) => e.flash)?.name ?? null : null,
    sales: stock.filter((e) => e.sale && !e.flash).map((e) => e.name),
    monthly: monthlyFurniture(day)?.name ?? null,
    loan: s.home.loan,
    rainStones: getLayout(day).shells.filter((x) => x.itemId === RAIN_STONE_ID).length,
    songi: songiAm === null || songiPm === null ? null : { am: songiAm, pm: songiPm },
  }
  // 호박 등불 밤 전날과 당일에는 마을 방송에 행사 소식을 한 줄 더 붙인다
  const pumpkin = isPumpkinEve(day) ? [PUMPKIN_EVE_LINE] : isPumpkinDay(day) ? [PUMPKIN_DAY_LINE] : []
  // 도토리 감사 장날 전날과 당일에도 한 줄 더 붙인다
  const harvest = isHarvestFairEve(day) ? [HARVEST_EVE_LINE] : isHarvestFairDay(day) ? [HARVEST_DAY_LINE] : []
  // 첫눈 예보(전날)와 첫눈 날 소식도 마을 방송에 한 줄 붙인다
  const snow = isFirstSnowEve(day, weatherFor) ? [FIRST_SNOW_EVE_LINE] : isFirstSnowDay(day, weatherFor) ? [FIRST_SNOW_DAY_LINE] : []
  return [...morningNews(input), ...pumpkin, ...harvest, ...snow]
}
