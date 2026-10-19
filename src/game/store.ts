import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { currentHour, dayOverride, dayPart, isNight } from '../core/clock'
import { generateDay, type BugSpawn, type DigSpot, type ShellSpawn } from '../core/daily'
import { pineShake } from '../core/pine'
import { sanitizeSeen, seenFurniture } from '../core/furnitureCatalog'
import { FLOWER_COLORS, growOvernight, type Plant } from '../core/garden'
import { breedOvernight, RARE_FLOWERS } from '../core/breeding'
import { addItem, countOf, removeOne, removeOneOf, sellSlots, sortInventory, totalValue, type Slot } from '../core/inventory'
import { letterFor, letterId, mapId, parcelContents, parseMapId, pickTreasure, registerMapItem, TREASURE_MONEY, treasureCandidates, treasureReward } from '../core/bottle'
import { canReform, REFORM_TIER, sanitizeVariant, variantById } from '../core/reform'
import { heightAt, isWalkable } from '../core/island'
import { costLabel, FISH_TABLE, ITEMS, josa, TOOL_ORDER, TOOLS, type ToolId, FOSSIL_SPECIES } from '../core/items'
import { addMileGain, formatMiles, MILE_SHOP, mileToastText, newMiles, POCKET_MAX, type MileGain, type MileReward } from '../core/miles'
import { decodePaths, encodePaths, paintTiles, pathCellsOf, PATH_MAX, PATH_NAME, PERMIT_COST, PERMIT_MILES, type PathKind } from '../core/paths'
import { canPlace, placeBlocker, type Placed, type WallDir } from '../core/placement'
import { isWallDir, isWallItem, rehomeSouthWalls, wallBlocker } from '../core/wallHang'
import { craft, pickUnknown, RECIPE_BY_ID, STARTER_RECIPES } from '../core/recipes'
import { dailyQuests, FIRST_QUEST, isComplete, QUESTS, rewardParts, type QuestDef, type Reward } from '../core/quests'
import { SHORE_LETTER, SHORE_LETTER_TEXT, SHORE_QUEST, shoreDue } from '../core/guide'
import { dateKey, hashString, mulberry32, pickWeighted } from '../core/rng'
import { gestureChat, PERSONALITY, pickChat, rememberTopic, withTic, type Ask, type ChatContext } from '../core/chat'
import { todayTalk } from '../core/todayTalk'
import { catchQuip } from '../core/quips'
import { FIREFLY_GONE_S } from '../core/fireflies'
import { seasonFor } from '../core/season'
import { ATTIC, CAVE_ROOM, entryOf, HALL_ROOM, HOME_MOVES, HOME_ROOM, HOME_ROOM_SIZES, type HomeFloor, homeFloorOf, homeRoom, MUSEUM_ROOM, ROOM_ENTRY, roomCenter, roomSolids, SHOP_ROOM, shopRoom } from '../core/interior'
import { CLERK_SAY_MS, clerkLine, SHOP_BELL_TEXT, songiMood } from '../core/shopRoom'
import { isSoldOut, markSoldToday, soldOutApplies } from '../core/shopDisplay'
import { GUEST_SAY_MS, shopGuestLine } from '../core/shopGuest'
import { HALL_SITE } from '../core/hall'
import { caveOpen, caveSpot, CaveState, chestDue, chestItem, chestWeek, EMPTY_CAVE, minesLeft, oreFor, sanitizeCave } from '../core/cave'
import { bridgeOk, BRIDGE_COST, BRIDGE_MAX, builtBridges, builtStairs, bridgeShapes, NO_INFRA, refundOf, sanitizeInfra, stairOk, stairRamps, STAIR_COST, STAIR_MAX, type Infra } from '../core/infra'
import { extraRamps, onStepSpot } from '../core/tiers'
import { clearStepSpots } from '../core/stepClear'
import { extraBridges } from '../core/waters'
import { canDonate, donate as museumDonate, MUSEUM_SITE, museumLayout, museumOpen, museumSolids, sanitizeDonated, ZONE_MILES, ZONE_NAME } from '../core/museum'
import { blockedByScenery, bushFind, type ScenerySpot } from '../core/scenery'
import { guestTalk, tripGuestsFor, type TripGuest } from '../core/guests'
import { dailyRequest, friendshipLevel, HOUSE_R, isHomeAt, talkLines, VILLAGERS, type Mood, type Villager } from '../core/villagers'
import type { PhotoFilter, PhotoPose } from '../core/photo'
import { ALBUM_MAX, addPhoto, albumId, removePhoto, sanitizeAlbum, sanitizeWall, type AlbumPhoto } from '../core/album'
import { activeReq, deliverTo, kindOf, LOST_ITEM, lostSpot, newReq, onPickup, onTalk, onWater, reqText, rewardOf, sanitizeReq, type Req } from '../core/requests'
import { burst, CATCH_FLY, flyToPocket, IMPACT_AT, impactAt, now, runtime, startAct } from './runtime'
import { COOK_BY_ID, cook, DISH_GIFT_BONUS, effectSeconds, isDish, shortfall } from '../core/cooking'
import { visitTalk } from '../core/visits'
import { biteDelaySeconds, COMPANION_FRIENDSHIP, COMPANION_MS, companionGift, companionRemaining, type CompanionMode } from '../core/companion'
import { DIVE_SECONDS, diveResult, SURFACE_Y } from '../core/diving'
import { play } from './sfx'
import { DOCKS, live, SHOP, SHOP_DOOR, setShopSize, TREES, type Dock, type RockSpot, type TreeSpot } from '../core/world'
import { canWalk } from '../core/scenery'
import { nearestFreeSpot } from '../core/unstick'
import { cliffFaceAt } from '../core/tiers'
import { ctxOf, daysSinceStart, devUnlocked, introLetter, newlyOpened, SYSTEM_IDS, SYSTEMS, systemOpen } from '../core/unlocks'
import { cleanDailyBase, cleanDailyMoney, cleanLedger, flowOf, otherOf, pushLedger, type DayLog } from '../core/life'
import { cleanLoanHistory, EMPTY_LOAN_HISTORY, legacyLoanHistory, recordBorrow, recordPayment, type LoanHistory } from '../core/loanHistory'
import { cleanHomeNew, floorArrivalText, isAreaArrivalText, isFirstRoomVisit, markRoomVisited, newHomeGreeting, ROOM_GIFT, roomGiftFloors, type HomeNew } from '../core/homeWelcome'
import { cleanSeenHints, firstHintOnce, isFirstHint, type FirstHint } from '../core/firstHints'
import { cleanStoryChapter, STORY_CHAPTERS, storyBannerTexts, storyClearedCount, storyCtxOf, storyRewards } from '../core/story'
import { CONSTELLATIONS, isNewSighting, sanitizeStars, starsComplete } from '../core/stars'
import { addDesign, DESIGN_MAX, encodeCells, newDesignId, nextDesignName, sanitizeDesign, type SavedDesign } from '../core/design'
import { completedSetIds, firstScoreWeek, frameFloor, frameHung, homeScoreLetter, HOME_SETS, newlyCompletedSets, SET_MILES, scoreHome, starGiftFor, starsOf, tierOf } from '../core/homeScore'
import { DEX_BONUS, doneDexKinds, type DexKind, newDexRewards, sanitizeDexRewards } from '../core/dexReward'
import { freshTodo, NEW_TODO, rewardTodos, sanitizeTodo, todayTodos, type TodoCtx, type TodoState } from '../core/todo'
import { canExchange, canJoin, countCatch, finishRun, medalOf, NEW_TOURNEY, runOver, sanitizeTourney, startRun, tourneyWindow, type TourneyState } from '../core/tourney'
import { checkOrder, parcelLetters, sanitizeOrders, type CatalogOrder } from '../core/catalogOrder'
import { houseThanksLetter, islandThanksLetter, stepSpotLetter, birthdayLetter, birthdayThanksLetter, breedLetter, festivalEveLetter, festivalRewardLetter, lateGiftLetters, lateWindow, loanPaidLetter, MAILBOX_MAX, morningLetter, paintTipLetter, warmFundLetter, roomGiftLetter, ratingLetter, shopUpgradeLetter, SHOP_LETTER_GIFT, starsLetter, typhoonLetter, wishLetter, WELCOME_LETTER, type Letter, arrivalNotice, isLeadLetter } from '../core/letters'
import { birthdayChatDue, birthdayHelloLine, birthdayMentionLine, birthdayPartyNow, isBirthday } from '../core/birthdays'
import { cleanPlayerBirthday, isPlayerBirthday, playerBirthdayLetter, playerBirthdayTalkDue, type PlayerBirthday } from '../core/playerBirthday'
import { canGiveToday, finishGlimpse, giftReaction, presentFor } from '../core/gifts'
import { wearReaction, wearTaste, wornOutfit, type WearTaste } from '../core/villagerWear'
import { arrivalDayOf, canThinkOfMoving, farewellText, leaveDayOf, MOVE_ASK, movers, pickMover, pickReplacement, welcomeText, type Arrival, type MoveTalk } from '../core/moving'
import { checkLetterText, letterFeatures, letterTalkLines, LETTER_FRIENDSHIP, paperOf, pendingFor, pushOut, repliesDue, replyDayOf, replyText, sentToday, STAMP_COST, type OutLetter, type PaperId } from '../core/mail'
import { boughtThisVisit, isMarketDay, marketStock, marketTomorrow, mysteryPick, visitKey, weekdayOf } from '../core/market'
import { firstNewRecipe, islandRating, mondayOf, nextRewarded, ratingInputOf, ratingRewards, ratingTip, type RatingState } from '../core/rating'
import { festivalDone, festivalEve, festivalOn, type Festival, type FestivalState, type FestivalTask, nextDay, progressOn } from '../core/festivals'
import { DEFAULT_OUTFIT, WEAR_BY_ID, type Wear } from '../core/wardrobe'
import { setIslandStart, weatherFor } from '../core/weather'
import { addDays, balloonProgress, typhoonEve } from '../core/wind'
import { isMeteorNight, METEOR_LINE, prevDay, RAINBOW_LINE, rainbowDay, rainbowHour } from '../core/skyEvents'
import { isSleepHour, napBonus, napLine, NAP_MILES } from '../core/furnitureActions'
import { MAX_HOLES, type Hole } from '../core/holes'
import { pruneRegrown, REGROW_DAYS, treeState, type Felled } from '../core/trees'
import { accrueInterest, buyAtmProduct, cleanCoupons, createBank, deposit, repayLoan, withdraw, type BankState } from '../core/bank'
import { breakDeposit, cleanDeposit, depositInterest, depositMaturedLine, type FixedDeposit, openDeposit, settleDeposit } from '../core/deposit'
import { planMorningToasts, type MorningNotice } from '../core/morningToasts'
import { cleanShopNew, seeShopNew, type ShopNewState } from '../core/shopNew'
import { cleanWeeklyBuy, weeklyBoughtOn, weekStart } from '../core/weeklyLimited'
import { cleanExpanded, cleanHouseExpand, cleanHouseThanks, completeHouseExpand, donateHouse, expandable, expandChoiceLabel, expandCost, expandDoneLine, expandOffer, houseTapAmount, type HouseExpand, type HouseThanks } from '../core/houseExpand'
import { cleanStampCard, stampOn, withStampNote, type StampCard } from '../core/stampCard'
import { addSales, cleanSalesLedger, saleLines, type Sale, type SalesDay } from '../core/salesLedger'
import { addMonthSales, cleanShopMonth, settleMonth, shouldSettle, type ShopMonth } from '../core/shopMonth'
import { cleanIslandGift, currentGift, donateGift as giftDonate, GIFT_PROJECTS, GIFT_PROJECTS_2, giftBuiltText, morningGift, NEW_ISLAND_GIFT, type IslandGiftState, warmFundStart } from '../core/islandGift'
import { cleanFlowerWeek, flowerBonus, flowerWeekLetter, flowerWeekStart, NEW_FLOWER_WEEK, type FlowerWeekState } from '../core/flowerWeek'
import { cleanWeekly, newWeekly, WEEKLY_BONUS_MONEY, WEEKLY_MILES, weeklyOpen, weeklyView, type WeeklyState } from '../core/weekly'
import { cleanWeekMark, isRecapDay, nextMark, RECAP_HEAD, recapLines, snapshotOf, type WeekMark } from '../core/weekRecap'
import { afterProgressOf } from './afterProgress'
import { cleanAfterCelebrated, cleanWeekMilestones, milestoneText, milestoneWeekLine, nearestAfterGoals, newAfterMilestones } from '../core/afterStory'
import { AFTER_TALK_KEEP, afterTalkKey, cleanAfterDays, cleanAfterTalkDone } from '../core/afterTalk'
import { FIRST_SNOW_REWARD, cleanFirstSnowWinters, firstSnowCompleted, firstSnowLetter, firstSnowRewardLetter, isFirstSnowDay, winterKeyOf } from '../core/firstSnow'
import { HARVEST_REWARD_MONEY, harvestAskLines, harvestFairLetter, harvestFurnitureFor, harvestNoneLines, harvestThanksLetter, harvestThanksLines, isHarvestFairDay, isHarvestFairHour, pickHarvestGift } from '../core/harvestFair'
import { CANDY_ID, candyOutcome, costumeFor, isPumpkinDay, isPumpkinNight, isPumpkinOutfit, PRANK_OUTFIT, pumpkinAskLines, pumpkinLetter, pumpkinPrankLines, pumpkinThanksLines, pumpkinThanksLetter } from '../core/pumpkin'
import { fenceBlocker, FENCE_FOR_SALE, FENCE_PIECES, GARDEN_PERMIT, isFence, type FenceKind } from '../core/fence'
import { decodeGarden, encodeGarden, gardenStats, gardenTileBlocker, GARDEN_ITEM, GARDEN_KIND_OF_ITEM, GARDEN_TILE_MAX, GARDEN_TILE_NAME, isGardenItem, paintGarden, type GardenKind } from '../core/gardenTiles'
import { floorOpen, hasAttic, homePlaceBlocker, HOME_SITE, homeDef, homeRadius, homeSolids, isHomeStage, NEW_HOME, nextStage, payLoan, settleHome, startHomeUpgrade, storageSlots, loanLabel, type HomeState } from '../core/home'
import { canBuyUpgrade, CAN_NAMES, CAN_SIDE, isCanLevel, type CanLevel } from '../core/watering'
import { limitedPitch } from '../core/shopDisplay'
import { isShopTier, lookFor, NEW_SHOP, newItemsAt, settleUpgrade, shopMilesReward, shopStock, startUpgrade, tierDef, upgradeState, type ShopState } from '../core/shopTiers'
import { shopReopenText } from '../core/shopProgress'
import { monthKey, monthlyBoughtOn, monthlyFurniture, NEW_SHOP_LOG, sanitizeShopLog, type ShopLog } from '../core/shopEvents'
import { dayIndex } from '../core/economy'
import { isBuildToast, shopDaysLeft, shopPendingText } from '../core/build'
import { SONGI_BUNDLE, SONGI_BUNDLE_PRICE, SONGI_ID, cleanSongiBuy, songiBundlesLeft, songiNow, songiOpen, songiWeekOf, spoilSongi } from '../core/songi'
import { newsFor } from './news'
import { cleanInteriorWall, cleanPaint, DEFAULT_PAINT, INTERIOR_WALL_COST, INTERIOR_WALLS, PAINT_COST, PAINT_OPTIONS, PAINT_PART_NAME, paintTipDue, type HomePaint, type PaintPart } from '../core/homePaint'
import { migrateItemIds } from '../core/itemIds'
import { migrateVillagerIds } from '../core/villagerIds'

export interface GroundItem {
  id: string
  itemId: string
  x: number
  z: number
}

/** 리폼할 가구가 어디 있는지: 주머니 칸(index), 방 가구(id), 보관함 칸(index) */
const COMPANION_CHOICES: DialogChoice[] = [
  { label: '🎣 같이 낚시해요', action: 'fish-along' },
  { label: '🦋 같이 벌레 잡아요', action: 'bug-along' },
]

export interface DialogChoice {
  label: string
  action: 'trip-go' | 'trip-back' | 'fish-along' | 'bug-along' | 'expand-house'
}

/** 같이 낚시 중인 주민 상태. 저장하지 않는다. */
export interface CompanionState {
  villagerId: string
  /** 끝나는 시각(ms) */
  until: number
  /** 다음 입질 시각(ms) */
  nextBite: number
  /** 주민이 잡은 물고기 종류 */
  catches: string[]
  mode: CompanionMode
  /** 플레이어가 벌레를 잡은 시각(ms). 주민이 박수 친다. */
  clapAt: number
}

export type ReformSource = { from: 'bag'; index: number } | { from: 'home'; id: string } | { from: 'storage'; index: number }

/** 아침 섬 소식을 마지막으로 띄운 날. 기기에 남으며 저장 게임과는 따로 둔다. */
/** 공사 중 문 닫은 날의 안내. 사기·팔기 모두 같은 문장을 쓴다. */
const SHOP_CLOSED_TEXT = '공사 중이라 문을 닫았어요. 내일 다시 열어요'
const NEWS_KEY = 'dotori-isle-news-day'
/** 저장 키와 저장 버전. 설정 창의 저장 내보내기·가져오기가 같은 값을 쓴다. */
export const SAVE_KEY = 'dotori-isle-save'
export const SAVE_VERSION = 29
/** 진열대에서 산 뒤 점원이 고마워요! 말풍선을 띄우는 시간(밀리초) */
const THANK_SAY_MS = 1600
/** 저장 쓰기 스위치. 처음부터·되살리기·덮어쓰기는 저장 키를 바꾼 뒤 켠다. 리로드 전에 스토어가 옛 상태를 다시 쓰지 못하게 한다. */
let saveWritesPaused = false
export function pauseSaveWrites(): void {
  saveWritesPaused = true
}
/** 스위치를 되돌린다. 앱은 리로드로 풀리고, 테스트가 쓴다. */
export function resumeSaveWrites(): void {
  saveWritesPaused = false
}
/** 기기 저장소를 매번 전역에서 읽는다(테스트가 저장소를 나중에 바꿔 끼울 수 있게). 저장소가 없으면 아무 일도 하지 않는다. */
const guardedLocal = {
  getItem: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key: string, value: string) => {
    if (!saveWritesPaused) globalThis.localStorage?.setItem(key, value)
  },
  removeItem: (key: string) => globalThis.localStorage?.removeItem(key),
}
/** 이행에 실패한 원본 저장을 남기는 키 앞부분. 뒤에 저장 버전과 시각이 붙는다. */
export const BACKUP_PREFIX = 'dotori-isle-backup-'
/** 백업은 가장 최근 몇 개만 남긴다 */
export const BACKUP_KEEP = 3

export type Panel = 'shop' | 'dex' | 'talk' | 'quest' | 'craft' | 'cook' | 'miles' | 'closet' | 'mail' | 'home' | 'atm' | 'storage' | 'market' | 'museum' | 'festival' | 'infra' | 'tourney' | 'design' | 'homeScore' | 'calendar' | 'map' | 'settings' | 'songi' | 'phone' | 'gift' | null

export interface Dialog {
  villagerId: string
  name: string
  lines: string[]
  index: number
  /** 마지막 줄에서 건넬 수 있는 물건 */
  offer: string | null
  /** 마지막 줄에서 고를 수 있는 일(펠리컨 여행) */
  choice?: DialogChoice | null
  /** 여러 선택지(같이 낚시·벌레잡기). 첫 번째가 E 로 고르는 것이다. */
  choices?: DialogChoice[]
  /** 마지막 줄에서 던진 질문과 고를 답. sel 은 지금 고른 칸 */
  ask?: (Ask & { sel: number }) | null
}

export interface ActiveQuest {
  id: string
  /** 받았을 때의 통계. 진행도는 여기서 늘어난 만큼 센다. */
  baseline: Record<string, number>
}

export interface SaveData {
  money: number
  inventory: Slot[]
  /** 맨손 말고 가진 도구 */
  tools: ToolId[]
  tool: ToolId
  /** 물뿌리개 단계. 1 기본 · 2 넓은(2×2) · 3 큰(3×3). 물뿌리개를 가졌을 때만 뜻이 있다. */
  canLevel: CanLevel
  /** 아래 하루짜리 기록이 어느 날짜의 것인지. 날이 바뀌면 비운다. */
  day: string
  /** 섬에 처음 온 날. 이 날과 다음 날은 날씨가 맑다. 예전 저장에는 없어서 null 이다. */
  islandStart: string | null
  /** 한 번이라도 손에 넣은 가구 id. 팔거나 놓아도 남는다(가구 도감). */
  furnitureSeen: string[]
  shaken: string[]
  collected: string[]
  caught: string[]
  dug: string[]
  chopped: Record<string, number>
  rockHits: Record<string, number>
  /** 삽으로 판 구멍. 메우기 전까지 남는다. */
  holes: Hole[]
  /** 베어 넘긴 나무: 그루터기 또는 싹(파낸 날) */
  felled: Felled
  ground: GroundItem[]
  dex: Record<string, number>
  placed: Placed[]
  plants: Plant[]
  friendship: Record<string, number>
  /** 오늘 말을 건 주민, 부탁을 들어준 주민 */
  talked: string[]
  fulfilled: string[]
  /** 주민별 오늘의 부탁(bring 제외). 날이 바뀌면 비운다. */
  requests: Record<string, Req>
  /** 찍어 둔 사진(썸네일). 열두 장까지. */
  album: AlbumPhoto[]
  /** 집 벽에 건 사진 id. 앨범에 없으면 걸린 게 없다. */
  wallPhoto: string | null
  /** 주민별 최근 수다 화제. 같은 이야기를 되풀이하지 않게 */
  chatLog: Record<string, string[]>
  /** 집을 지어준 주민 */
  houses: string[]
  /** 여행 섬에서 초대한 손님. 도토리섬에 집터가 생긴다. */
  recruits: string[]
  stats: Record<string, number>
  quests: ActiveQuest[]
  questsDone: string[]
  /** 오늘 시작 시점 통계(일일 퀘스트 기준)와 받은 일일 보상 */
  dailyBase: Record<string, number>
  /** 아침에 잡은 지갑 기준값. 가계부의 그 밖의 흐름(otherOf) 계산에 쓴다. 예전 저장에는 없어서 null 이다. */
  dailyMoney?: number | null
  /** 지난 날의 번·쓴 도토리 기록(최근 7일). 날이 바뀔 때 어제 것을 더한다. 없으면 빈 기록이다. */
  ledger?: DayLog[]
  /** 대출 상환 기록(누적·최근 3건). 없으면 빈 기록이다. */
  loanHistory?: LoanHistory
  dailyClaimed: string[]
  /** 주민마다 마지막으로 선물을 받은 날. 하루에 한 번만 준다. */
  giftDay: Record<string, string>
  /** 생일에 받은 선물. 다음 날 아침 답례 편지에 쓴다. */
  birthdayThanks: { villagerId: string; giftDay: string; present: string | null }[]
  /** 장날마다 한 번씩 산 물건(`날짜:물건`). 같은 장날에 같은 물건은 다시 못 산다. */
  marketBought: string[]
  /** 주머니 칸 수 */
  pocket: number
  /** 아는 DIY 레시피 */
  recipes: string[]
  miles: number
  /** 마일리지 업적별로 이미 받은 단계 수 */
  milesClaimed: Record<string, number>
  /** 입고 있는 모자·옷과 가진 옷들 */
  wear: Wear
  closet: string[]
  letters: Letter[]
  /** 상점 단계와 올리는 공사 기록 */
  shop: ShopState
  /** 상점 기록: 주인에게 판 품목별 개수, 이달의 가구를 산 달 */
  shopLog: ShopLog
  /** 정원 꾸미기 허가를 받았는지. 예전 저장에는 없어서 없으면 허가가 없다. */
  gardenPermit?: boolean
  /** 집이 완성된 날과 새 집 안내를 했는지. 예전 저장에는 없어서 없으면 연출이 없다. */
  homeNew?: HomeNew | null
  /** 처음 여는 기능 안내를 이미 띄운 목록(ATM·휴대폰·송이·마을회관·병). 없으면 아직 본 것이 없다. */
  seenHints?: FirstHint[]
  /** 휴대폰 달력 앱을 연 날. 내일 행사 점 배지는 이 날에는 다시 뜨지 않는다. 없으면 아직 안 연 것이다. */
  calendarOpenedDay?: string | null
  /** 섬 이야기에서 마친 장 수(core/story.ts). 예전 저장에는 없어서 0 장이고, 채운 조건만큼 자동으로 넘어간다. */
  storyChapter?: number
  /** 5장을 모두 마친 에필로그를 이미 보였는지. 한 번만 튼다. 예전 저장에는 없어서 false 다. */
  storyEnded?: boolean
  /** 이번 주 목표(core/weekly.ts). 없으면 null. 예전 저장에는 없어서 다음 날 넘김 때 새로 뽑는다. */
  weekly?: WeeklyState | null
  /** 이번 주 소식의 기준값(core/weekRecap.ts). 지난 일요일의 통계와 그때 낸 요약. 없으면 null. */
  weekMark?: WeekMark | null
  /** 섬 이야기 이후 목표를 축하한 목표 키(`dex:50` 같은 꼴). 같은 목표는 두 번 축하하지 않는다. 예전 저장은 빈 목록이다. */
  afterCelebrated?: string[]
  /** 이번 주에 채운 목표의 주간 소식 줄. 일요일 요약에 붙고 나면 비운다. */
  weekMilestones?: string[]
  /** 섬 이야기 이후 목표를 채운 날(목표 키 → 날짜). 채운 날과 그다음 날에 주민이 그 이야기를 꺼낸다. */
  afterMilestoneDays?: Record<string, string>
  /** 목표 이야기를 이미 꺼낸 목표 키. 목표마다 한 번만 꺼낸다. */
  afterTalkDone?: string[]
  /** 호박 등불 밤에 사탕 교환을 한 주민(`날짜:주민 id`). 같은 날 한 번만 한다. */
  pumpkinDone?: string[]
  /** 도토리 감사 장날에 수확물을 나눈 주민(`날짜:주민 id`). 장날마다 한 번만 한다. */
  harvestFairDone?: string[]
  /** 첫눈 날 눈사람 완성 보상을 받은 겨울(예: 2026-27). 예전 저장의 연도 값은 불러올 때 겨울로 바꾼다. */
  firstSnowWinters?: string[]
  /** 생일 날 생일 수다를 한 주민(`날짜:주민 id`). 같은 날 두 번째 대화에서 한 번 보장하는 데 쓴다. */
  birthdayChatDone?: string[]
  /** 플레이어 생일(월·일). 정하지 않았으면 null. 설정 창에서 고른다. */
  playerBirthday?: PlayerBirthday | null
  /** 정기 예금 한 건(core/deposit.ts). 없으면 null. 예전 저장에는 없어서 null 이다. */
  deposit?: FixedDeposit | null
  /** 섬 가꾸기 기부 진행(core/islandGift.ts). 예전 저장에는 없어서 처음 상태로 본다. */
  islandGift?: IslandGiftState
  /** 섬 가꾸기 2차(도토리로 기부, core/islandGift.ts GIFT_PROJECTS_2). 예전 저장에는 없어서 처음 상태로 본다. */
  islandAcorn?: IslandGiftState
  /** 2차 시설이 완성된 날(완성 아침). 감사 편지는 그다음 날 아침 한 번 보내고 비운다. 없거나 맞지 않으면 null. */
  islandThanksDay?: string | null
  /** 최근 상점 재개장의 새 물건 배지 기록(core/shopNew.ts). 예전 저장에는 없어서 배지가 없다. */
  shopNew?: ShopNewState | null
  /** 주간 한정 물건을 산 주의 월요일(core/weeklyLimited.ts). 없으면 이번 주에 아직 안 샀다. 예전 저장에는 없다. */
  weeklyBuy?: string | null
  /** 주민 집 증축: 지금 넓히는 한 집(core/houseExpand.ts). 없으면 진행 중인 집이 없다. 예전 저장에는 없다. */
  houseExpand?: HouseExpand | null
  /** 증축을 끝낸 주민 집 id 목록. 예전 저장에는 없어서 빈 목록이다. */
  expanded?: string[]
  /** 증축을 끝낸 집의 감사 편지 기록(core/houseExpand.ts). 완성 다음 날 아침에 보내고 비운다. 예전 저장에는 없다. */
  houseThanks?: HouseThanks | null
  /** 가게 장부: 날마다 상점에 판 도토리 합계와 물건별 합계, 최근 14일(core/salesLedger.ts). 예전 저장에는 없다. */
  salesLedger?: SalesDay[]
  /** 이번 달 가게 판매 누계와 결산 여부(core/shopMonth.ts). 달 마지막 날 아침에 편지로 정리한다. 예전 저장에는 없다. */
  shopMonth?: ShopMonth | null
  /** 봄 꽃 심기 주간의 오늘 보너스 진행(core/flowerWeek.ts). 예전 저장에는 없어서 처음 상태로 본다. */
  flowerWeek?: FlowerWeekState
  /** 이번 주 일요일에 송이 상인에게서 산 묶음 수(core/songi.ts). 예전 저장에는 없어서 없으면 안 샀다. */
  songiBuy?: { week: string; n: number } | null
  /** 상점 단골 스탬프 카드(core/stampCard.ts). 예전 저장에는 없어서 빈 카드로 시작한다. */
  stampCard?: StampCard | null
  /** 정원 바닥 타일 한 줄(core/gardenTiles.ts). 예전 저장에는 없어서 빈 칸이다. */
  gardenTiles?: string
  /** 완성 알림을 이미 보낸 가구 세트 id. 예전 저장은 지금 완성된 세트로 채워 한꺼번에 알리지 않는다. */
  setsDone?: string[]
  /** 도감 완성 보상을 받은 분류(물고기·벌레·가구). 예전 저장은 그때 다 채운 분류로 채워 보상을 다시 주지 않는다. */
  dexRewarded?: DexKind[]
  /** 집 꾸미기 등급 중 기념 가구를 이미 받은 별 번호(1~5). 예전 저장은 빈 목록이다. */
  homeStars?: number[]
  /** 가구 주문 목록(주문한 날 기준). 하루 넘김에 소포 편지로 보내고 비운다. 예전 저장은 빈 목록이다. */
  orders?: CatalogOrder[]
  /** 집 바깥 색 번호(지붕·벽·문). 예전 저장은 모두 기본색이다. */
  homePaint?: HomePaint
  /** 방 벽지 번호(INTERIOR_WALLS). 예전 저장은 0번 크림이다. */
  interiorWall?: number
  /** 내 집 단계와 빚, 짓는 중인 집 */
  home: HomeState
  /** 집 방 안에 놓은 가구(방 가운데 기준 칸) */
  homeFurniture: Placed[]
  /** 집 보관함 칸 */
  homeStorage: Slot[]
  /** 집 침대에서 잠 보너스를 받은 날 */
  napDay: string | null
  /** 자연사 전시관에 기증한 물건 id */
  museum: string[]
  /** 망원경으로 처음 본 별자리 id. 열두 개를 모두 보면 편지와 별 모양 조명을 받는다. */
  starsSeen: string[]
  /** 무지개를 올려다본 적이 있는지. 처음 보면 하늘 기록에 한 번 남긴다. */
  rainbowSeen: boolean
  /** 해안 동굴 기록: 오늘 캔 횟수와 마지막으로 연 상자 주 번호 */
  cave: CaveState
  /** 통장 잔고와 하루 인출 기록 */
  bank: BankState
  /** 섬 별점: 마지막으로 매긴 월요일, 그때 별 개수, 보상을 받은 최고 별 단계 */
  rating: RatingState
  /** 별 다섯 개 보상으로 받은 황금 물뿌리개 */
  goldCan: boolean
  /** 계절 축제: 오늘 축제의 할 일 진행, 수확제에 바친 과일, 선물을 보낸 축제 날 */
  festival: FestivalState
  /** 소원을 빈 유성우 밤(날짜 키). 밤마다 한 번만 빈다. */
  wishNight: string | null
  /** 섬 정비: 맡긴 다리와 계단. 다음 날 아침에 지어진다. */
  infra: Infra
  /** 기능 소개 편지를 보낸 기능 id. 한 번 알린 기능은 다시 알리지 않는다. */
  introduced: string[]
  /** 낚시 대회: 가진 포인트와 마지막으로 나간 날 */
  tourney: TourneyState
  /** 오늘의 할 일: 정산한 날, 정산한 항목, 그날 받은 마일리지 */
  todo: TodoState
  /** 마이 디자인: 저장한 그림(최대 여섯 장) */
  designs: SavedDesign[]
  /** 주민이 입고 있는 선물 옷(주민 id → 옷 id 와 선물한 날). 선물한 날의 다음 날부터 입는다. */
  villagerWear: Record<string, { outfit: string; day: string }>
  /** 보낸 편지함: 최근 열 통. 답장 날이 되면 우편함에 답장이 온다. */
  outLetters: OutLetter[]
  /** 지금 이사를 고민하는 손님 주민과 고민한 날 */
  moveTalk: MoveTalk | null
  /** 마지막으로 이사 고민이 시작된 날(한 달에 한 번) */
  lastMoveDay: string | null
  /** 떠난 자리에 올 손님과 올 날 */
  arrivals: Arrival[]
  /** 광장 깃발에 단 디자인 id. 없으면 기본 빨간 깃발이다. */
  flagDesign: string | null
  /** 무지 티셔츠 앞판에 입힌 디자인 id */
  shirtDesign: string | null
}

interface GameState extends SaveData {
  /** 사진 모드(저장하지 않는다) */
  photo: boolean
  /** 타이틀 화면이 떠 있는 동안 true. 시작 전에는 입력과 HUD 를 막는다. 저장하지 않는다. */
  title: boolean
  /** 장이 바뀔 때 가운데에 띄울 제목. key 가 바뀔 때마다 다시 띄운다. 저장하지 않는다. */
  storyFlash: { text: string; key: number } | null
  /** 아직 띄우지 않은 장 배너 글. 여러 장이 한꺼번에 넘어가면 줄 세워 둔다(저장하지 않는다). */
  storyFlashQueue: string[]
  /** 지금 호박 등불 밤(저녁 17시~자정)인가. syncClock 이 바꾼다(저장하지 않는다). */
  pumpkinNightOn: boolean
  /** 에필로그가 시작한 시각(Date.now). 없으면 연출이 없다. 저장하지 않는다. */
  storyEnding: number | null
  /** 오늘의 아침 섬 소식 줄. 타이틀이 끝난 뒤 하루 한 번 뜬다. 닫으면 null. 저장하지 않는다 */
  news: string[] | null
  /** 마이크 책상에서 다시 튼 방송인지(첫날 보류 중에도 카드를 보여 준다). 저장하지 않는다. */
  newsFromHall: boolean
  /** 타이틀을 닫는다. 카메라가 플레이어 뒤로 내려온다. */
  endTitle(): void
  /** 오늘 아침 소식을 띄운다(하루 한 번, 타이틀 중에는 띄우지 않는다) */
  showNews(): void
  nextStoryFlash(): void
  closeNews(): void
  /** 보물 지도가 펼쳐진 칸 id. 지도를 닫으면 null. 저장하지 않는다 */
  treasureMap: string | null
  /** 주머니가 가득 차 못 받은 때의 시각(performance.now). 가방 아이콘을 흔든다. 저장하지 않는다 */
  bagFullAt: number
  /** 집 안에서 보고 있는 자리. 0 본채 방바닥, 1 다락, 2 옆방, 3 지하실(저장하지 않는다). */
  homeFloor: HomeFloor
  /** 우산 없이 비를 오래 맞아 몸이 젖었다. 저장하지 않는다. */
  wet: boolean
  /** 같이 낚시하는 주민. 저장하지 않는다(새로고침하면 끝난다). */
  companion: CompanionState | null
  photoPose: PhotoPose | null
  photoMood: Mood | null
  photoFilter: PhotoFilter
  prompt: string | null
  /** 화면에 떠 있는 알림. 뒤따르는 알림은 toastQueue 에서 차례로 올라온다. */
  toast: { id: number; text: string } | null
  toastQueue: { id: number; text: string }[]
  /** 지나간 알림 기록(휴대폰 알림 앱). 저장하지 않는다. */
  noticeLog: { id: number; text: string; at: number }[]
  /** 알림 앱을 마지막으로 연 때의 가장 큰 알림 번호. 그보다 큰 것이 안 본 알림이다. 저장하지 않는다. */
  noticeSeen: number
  panel: Panel
  /** 시계 틱마다 갱신. 벌레·물고기 종류가 이 값을 따른다. */
  night: boolean
  /** 배치 중인 가구·꽃씨와 회전 */
  placing: string | null
  /** 놓을 가구의 색 변형(주머니 칸에서 고른 것). 없으면 기본 가구. 저장하지 않는다. */
  placingVariant?: string
  placingRot: number
  /** 섬 놓기 중 손가락으로 찍은 칸. 없으면 바라보는 앞 칸을 쓴다. 비영속. */
  placeCell: { x: number; z: number } | null
  dialog: Dialog | null
  /** 펠리컨 여행 중 화면이 까맣게 넘어가는 동안 true */
  traveling: boolean
  /** 이번 여행에 여행 섬에 놀러 와 있는 손님. 섬을 떠나면 비운다. */
  tripGuests: TripGuest[]
  /** 지금 서 있는 섬. 새로 켜면 도토리섬이다(저장하지 않는다). */
  island: 'home' | 'trip'
  /** 지금 들어가 있는 주민 집(주민 id). 섬에 있으면 null */
  inside: string | null
  /** 문을 드나드는 동안 화면이 잠깐 어두워진다 */
  doorFade: boolean
  /** 외관 색을 바꾼 시각(밀리초). 비계 연출에만 쓰고 저장하지 않는다. */
  homePaintAt: number
  /** 실내 벽지 번호. 저장한다. */
  interiorWall: number
  /** 옷장을 옷 가판대에서 열었으면 살 수도 있다 */
  closetShop: boolean
  /** 주머니(인벤토리) 창이 열려 있는지. I 로 여닫는다. */
  bagOpen: boolean
  /** 잡았을 때 화면 아래 뜨는 한마디. 새로 도감에 오르면 fresh */
  caption: { itemId: string; text: string; fresh: boolean } | null
  /** 집 방 안에 있는지. 바깥 섬과 상호작용 순서가 다르다. */
  inHome: boolean
  /** 자연사 전시관 방 안에 있는지 */
  inMuseum: boolean
  /** 도토리 상점 안에 있는지. 저장하지 않는다. */
  inShop: boolean
  /** 점원이 지금 하는 말풍선. 저장하지 않는다. */
  clerkSay: { id: string; text: string } | null
  /** 상점 손님이 지금 하는 말풍선. 저장하지 않는다. */
  shopGuestSay: { id: string; text: string } | null
  /** 해안 동굴 방 안에 있는지(저장하지 않는다) */
  inCave: boolean
  /** 마을회관 방 안에 있는지(저장하지 않는다) */
  inHall: boolean
  /** 방 안에서 놓을 가구와 회전. 바깥 섬의 placing 과 따로 둔다. */
  homePlacing: string | null
  /** 방 놓기 중인 가구의 색 변형. 저장하지 않는다. */
  homePlacingVariant?: string
  homePlacingRot: number
  /** 방 놓기 중 손가락으로 찍은 칸(방 가운데 기준). 없으면 바라보는 칸을 쓴다. 저장하지 않는다. */
  homePlaceCell: { x: number; z: number } | null
  /** 주민 방에서 불빛을 끈 물건(주민id/물건id). 저장하지 않는다. */
  roomLampsOff: string[]

  /** 날짜와 밤낮을 현재 시각에 맞춘다. 주기적으로 부른다. */
  syncClock(): void
  /** 알림을 띄운다. first 가 true 면 지금 뜬 알림 앞에 바로 올리고, 밀린 알림은 큐 맨 앞으로 간다. */
  notify(text: string, first?: boolean): void
  /** 화면 알림이 다 떴으면 다음 알림을 올린다. 지난 id 는 무시한다. */
  dismissToast(id: number): void
  setPrompt(prompt: string | null): void
  openPanel(panel: Panel): void
  /** 처음 여는 기능의 안내를 한 번 띄운다. 이미 봤으면 아무 일도 없다. */
  showFirstHint(id: FirstHint): void
  /** 달력 앱을 열었다. 오늘의 내일 행사 점 배지를 지운다. */
  markCalendarOpened(): void

  shakeTree(tree: TreeSpot): void
  /** 덤불 뒤적이기. 덤불마다 하루 한 번 꽃씨나 도토리 꾸러미가 나올 수 있다. */
  shakeBush(bush: ScenerySpot): void
  chopTree(tree: TreeSpot): void
  hitRock(rock: RockSpot): void
  /** 화덕에서 요리를 만든다. 재료가 모자라면 무엇이 부족한지 알린다. */
  cookAt(recipeId: string): void
  /** 가방의 요리를 먹는다. 효과는 잠깐 남는다. */
  eatDish(itemId: string): void
  dig(spot: DigSpot): void
  /** 삽으로 아무 땅이나 판다. 구멍이 가득 차면 false. */
  digHole(x: number, z: number): boolean
  /** 구멍을 메운다 */
  fillHole(id: string): void
  /** 그루터기를 파낸다. 줄기 자리는 싹이 되어 며칠 뒤 다시 자란다. */
  digStump(tree: TreeSpot): void
  /** 꽃 한 송이에 물을 준다. waterPlants([id]) 와 같다. */
  water(plantId: string | null): void
  /** 물뿌리개 범위 안의 꽃들에 한 번에 물을 준다. 마른 꽃만 젖고 몇 송이 적셨는지 알린다. */
  waterPlants(plantIds: readonly string[]): void
  pickGround(id: string): void
  /** 사진 모드 켜고 끄기(끄면 자세·표정·필터도 되돌린다) */
  setPhoto(on: boolean): void
  setPhotoPose(pose: PhotoPose | null): void
  setPhotoMood(mood: Mood | null): void
  setPhotoFilter(filter: PhotoFilter): void
  addAlbumPhoto(src: string): boolean
  removeAlbumPhoto(id: string): void
  hangPhoto(id: string | null): void
  /** 수영복을 입고 물가에서 바다로 들어간다 */
  startSwim(): void
  /** 물가에 닿아 걸어 나온다 */
  stopSwim(): void
  /** 거품 자리에서 잠수한다. key 는 거품 자리 키. */
  diveAt(key: string): void
  finishDive(): void
  /** 방문 중인 집들이 손님과 짧게 이야기한다 */
  talkVisitor(): void
  /** 앨범 화면이 떠 있는지. 떠 있는 동안 토스트를 가린다. 저장하지 않는다. */
  albumOpen: boolean
  setAlbumOpen(on: boolean): void
  /** 주민의 오늘 부탁을 연다(bring 은 기존 흐름이라 여기서 만들지 않는다) */
  startReq(villagerId: string): void
  /** 부탁을 끝내고 보상을 준다 */
  completeReq(villagerId: string): void
  collectShell(shell: ShellSpawn): void
  /** 보물 지도를 든 채 목표 자리를 삽으로 판다. 상자가 나오고 지도는 없어진다. */
  digTreasure(mapItemId: string): void
  catchBug(bug: BugSpawn, speciesId: string): void
  /** 잠자리채로 잡은 반딧불이. 잠깐 사라졌다가 다른 덤불에서 다시 나온다. */
  catchFirefly(index: number): void
  /** 주머니가 꽉 차 못 받으면 false. 그땐 물고기 그림자를 남겨 둔다. */
  catchFish(fishId: string): boolean
  /** 낚았거나 놀라 달아난 물고기 그림자를 오늘 목록에서 뺀다. */
  fishGone(id: string): void

  sell(index: number): void
  sellAll(): void
  /** 고른 칸들을 한 번에 판다 */
  sellPicked(indices: number[]): void
  /** 가방을 종류 → 값 순으로 다시 늘어놓는다 */
  sortBag(): void
  setTreasureMap(id: string | null): void
  buyMonthly(): void
  buyTool(id: ToolId): void
  /** 섬 정비: 개울 위 다리·절벽 계단을 맡긴다(다음 날 아침에 지어진다). 성공하면 true. */
  commissionBridge(x: number, z: number, rot: number): boolean
  commissionStair(plateau: number, ang: number): boolean
  /** 맡긴 정비를 철거하고 몫을 돌려받는다 */
  removeInfra(id: string): boolean
  /** 길 공사 허가를 산다. 도토리 또는 마일리지로 한 번만 산다. */
  buyPathPermit(pay: 'acorn' | 'miles'): boolean
  /** 같은 칸에 길이 있으면 걷고, 없으면 놓는다 */
  paintPath(x: number, z: number, kind: PathKind): void
  /** weekly 는 주간 한정 칸(마감이 붙은 판)을 고른다. 주지 않으면 일반 칸이다. */
  buyItem(itemId: string, weekly?: boolean): void
  /** 물건을 살펴봤다(목록에서 누름). 이번 재개장의 새 물건이면 배지를 뗀다. */
  seeShopItem(itemId: string): void
  /** 진열대에서 E 로 바로 산다. 성공하면 점원이 고마워한다. 실패 안내는 buyItem 과 같다. */
  buyDisplay(itemId: string, clerk: string, weekly?: boolean): void
  /** 대화 선택지: 이 주민 집 증축에 지갑의 도토리를 값까지 보탠다. */
  donateHouseExpand(villagerId: string): void
  /** 점원이 짧게 말풍선으로 답한다(패널은 열지 않는다). */
  thankClerk(id: string): void
  /** 가구 도감에 오른 가구를 정가로 주문한다. 다음 날 아침 소포 편지로 온다. */
  orderCatalog(itemId: string): void
  /** 장터 가판대에서 산다. id 는 희귀 가구 id, 'seed'(꽃씨 꾸러미), 'mystery'(오늘만 주머니). */
  buyMarket(id: string): void
  /** 물뿌리개를 넓은(2) 또는 큰(3) 것으로 바꾼다. 상점 단계와 도토리를 확인한다. */
  buyCanUpgrade(to: 2 | 3): void
  equip(id: ToolId): void
  cycleTool(): void

  startPlacing(itemId: string | null, variant?: string): void
  /** 방 놓기 중 찍은 칸을 정한다(null 이면 바라보는 칸으로 되돌린다). */
  setHomePlaceCell(cell: { x: number; z: number } | null): void
  setPlaceCell(cell: { x: number; z: number } | null): void
  rotatePlacing(): void
  placeAt(x: number, z: number): void
  pickUpPlaced(id: string): void
  toggleLight(id: string): void
  stargaze(): void
  /** 앉았을 때 통계만 올린다. 자리 고정은 runtime.seat 가 맡는다. */
  sat(itemId: string): void

  build(v: Villager): boolean

  talkTo(v: Villager): void
  advanceDialog(): void
  giveRequest(): void

  claimQuest(id: string): void

  craftItem(recipeId: string): void
  learnRecipe(id?: string | null): void
  exchange(id: MileReward['id']): void
  talkPelican(dock: Dock): void
  chooseDialog(action?: DialogChoice['action']): void
  startCompanion(villagerId: string, mode?: CompanionMode): void
  recordCompanionCatch(fishId: string): void
  tickCompanion(): void
  endCompanion(): void

  enterHouse(villagerId: string): void
  leaveHouse(): void
  /** 질문의 답 칸을 옮기거나(±1) 고른다 */
  moveAsk(step: number): void
  answer(index?: number): void
  closeCaption(): void
  toggleBag(open?: boolean): void
  openCloset(shop: boolean): void
  buyWear(id: string): void
  putOn(id: string | null): void
  readLetter(id: string): void
  claimLetter(id: string): void
  /** 수확제에 과일 한 개를 바친다 */
  festivalOffer(itemId: string): void
  /** 불꽃 구경 벤치에 앉는다(runtime.seat 은 행동 쪽에서 잡는다). 밤이면 축제 할 일로 친다. */
  watchFireworks(): void
  /** 낚시 대회에 나간다(일요일 낮, 하루 한 번). 3분 동안 잡은 물고기를 센다. */
  startTourney(): void
  /** 판이 끝났거나 대회 시간이 끝났으면 포인트를 주고 마친다. */
  finishTourney(): void
  /** 대회 포인트로 상품 가구 하나를 주머니에 넣는다. */
  exchangeTourney(id: string): void
  /** 마이 디자인을 저장한다. id 가 있으면 그 디자인을 고쳐 쓴다. 여섯 장을 넘기면 null. */
  saveDesign(cells: number[], id?: string): string | null
  deleteDesign(id: string): void
  /** 광장 깃발에 디자인을 단다. null 이면 기본 깃발로 돌린다. */
  setFlagDesign(id: string | null): void
  /** 무지 티셔츠 앞판에 디자인을 입힌다. null 이면 무늬 없는 티셔츠다. */
  setShirtDesign(id: string | null): void
  /** 상점 2단계 이상의 리폼 코너에서 가구 하나를 색 변형으로 바꾼다. 도토리와 목재 1을 쓴다. */
  reformFurniture(src: ReformSource, variant: string): boolean
  seeConstellation(id: string): boolean
  /** 무지개를 올려다봤다. 처음이면 기록하고 알린다. */
  seeRainbow(): void
  /** 유성우 밤에 자리에 앉아 소원을 빈다 */
  makeWish(): void

  /** 상점 한 단계 올리기: 조건을 확인하고 도토리를 받은 뒤 공사를 맡긴다 */
  upgradeShop(): void
  /** 공사·완성 알림을 같은 갈래의 옛 알림 대신 바로 띄운다(core/build.ts 의 갈래) */
  notifyBuild(text: string): void
  /** 다음 집 짓기를 맡긴다. 빚이 잡히고 내일 아침 완성된다. */
  orderHome(): void
  /** 정원 꾸미기 허가를 산다. 도토리 3000개 또는 마일 300. 울타리 스무 개를 함께 준다. */
  buyGardenPermit(by: 'money' | 'miles'): void
  /** 플레이어 생일을 정한다(월·일). null 이면 정하지 않은 것으로 되돌린다. */
  setPlayerBirthday(bd: PlayerBirthday | null): void
  /** 송이 상인에게서 송이를 묶음으로 산다. 일요일 5~12시, 한 주 세 묶음까지. */
  buySongi(bundles?: number): void
  /** 도토리로 울타리 한 묶음(스무 개)을 산다. 허가가 있어야 한다. */
  buyFence(kind: Exclude<FenceKind, 'fence'>): void
  paintHome(part: PaintPart, index: number): void
  /** 방 벽지를 고른다. 집이 생긴 뒤에만 되고, 도토리가 정가(INTERIOR_WALL_COST)만큼 든다. */
  paintInterior(index: number): void
  /** 바닥 깔기를 시작한다. 허가가 있어야 한다. E 로 바라보는 칸에 깔고, 같은 칸에서 같은 종류를 다시 찍으면 걷는다. */
  startGardenPaint(kind: GardenKind): void
  enterHome(): void
  leaveHome(): void
  /** 다락방 사다리: 방바닥에서 올라가고, 다락에서 내려온다 */
  climbHome(): void
  /** 옆방 문·지하 계단으로 자리를 옮긴다. 단계가 모자라면 아무 일도 없다. */
  moveHomeArea(to: HomeFloor): void
  /** 주머니 칸 index 의 물건을 집 보관함으로(한 종류 통째로) */
  moveToStorage(index: number): void
  takeFromStorage(index: number): void
  placeInHome(x: number, z: number, wall?: WallDir): void
  pickUpHome(id: string): void
  rotateHomePlacing(): void
  bankDeposit(amount: number): void
  /** 정기 예금 맡기기(지갑에서 빠진다). 만기는 맡긴 날 + 기간이다. */
  depositOpen(amount: number, days: number): void
  /** 정기 예금 중도 해지: 원금만 통장으로 돌아간다 */
  depositBreak(): void
  /** 섬 가꾸기에 마일을 기부한다(마을회관 접수대). */
  donateGift(amount: number): void
  /** 섬 가꾸기 2차에 도토리를 기부한다(1차를 다 들인 뒤 접수대). */
  donateAcornGift(amount: number): void
  bankWithdraw(amount: number): void
  /** 주머니 도토리로 집 빚 갚기 */
  repayFromPocket(amount: number): void
  /** 통장에서 집 빚 갚기 */
  repayFromSavings(amount: number): void
  /** 방 가구 불빛을 켜거나 끈다(방 안에서 E) */
  toggleHomeLight(id: string): void
  /** 집 침대에 눕는다. 밤이면 푹 자고 하루 한 번 마일리지를 받는다. */
  nap(hour?: number): void
  /** 주머니의 도감 물건 한 개를 전시관에 기증한다. 종마다 한 번이다. */
  donate(itemId: string): void
  /** 전시관 문 앞에서 들어간다 */
  enterMuseum(): void
  /** 마을회관 문으로 들어가고 나온다 */
  enterHall(): void
  leaveHall(): void
  /** 마이크 책상: 오늘 아침 마을 방송을 다시 튼다 */
  replayNews(): void
  enterCave(): void
  leaveCave(): void
  /** 떠 있는 바람 풍선을 잠자리채로 잡는다 */
  catchBalloon(): void
  /** 동굴 벽을 삽으로 캔다. node 는 CAVE_NODES 의 번호 */
  mineCave(node: number): void
  /** 이번 주 상자를 연다 */
  openCaveChest(): void
  leaveMuseum(): void
  /** 도토리 상점 건물 문으로 들어가고 나온다 */
  enterShop(): void
  leaveShop(): void
  /** 점원에게 말을 걸면 말풍선을 잠깐 띄운 뒤 상점 패널을 연다 */
  talkClerk(id: string): void
  talkShopGuest(id: string): void
  /** 주민 방 불빛을 켜거나 끈다. key 는 주민id/물건id. */
  toggleRoomLamp(key: string): void
  /** 빚이 0 이 된 순간: 축하 알림과 다음 집을 알리는 편지 */
  loanCleared(): void
  /** 대화 중인 주민에게 주머니 물건 하나를 선물한다. 하루에 한 번. */
  giveGift(itemId: string, variant?: string): void
  /** 옷장의 옷 하나를 이 주민에게 선물한다. 다음 날부터 그 옷을 입고 나온다. */
  giveWear(outfitId: string): void
  /** 주민에게 편지를 보낸다. 우표값 도토리와 하루 한 통을 확인한다. 동봉 물건은 주머니에서 빠진다. */
  sendLetter(to: string, text: string, paper: PaperId, enclose: string | null, variant?: string): boolean
  /** 마일리지로 ATM 상품 사기 */
  buyAtm(id: string): void
}

const initial: SaveData = {
  money: 0,
  infra: NO_INFRA,
  introduced: [],
  tourney: NEW_TOURNEY,
  todo: NEW_TODO,
  designs: [],
  villagerWear: {},
  outLetters: [],
  moveTalk: null,
  lastMoveDay: null,
  arrivals: [],
  flagDesign: null,
  shirtDesign: null,
  inventory: [],
  tools: [],
  tool: 'hand',
  canLevel: 1,
  day: dateKey(new Date()),
  islandStart: dateKey(new Date()),
  furnitureSeen: [],
  orders: [],
  shaken: [],
  collected: [],
  caught: [],
  dug: [],
  chopped: {},
  rockHits: {},
  holes: [],
  felled: {},
  ground: [],
  dex: {},
  placed: [],
  plants: [],
  friendship: {},
  chatLog: {},
  talked: [],
  fulfilled: [],
  requests: {},
  album: [],
  wallPhoto: null,
  houses: [],
  houseExpand: null,
  expanded: [],
  houseThanks: null,
  recruits: [],
  stats: {},
  quests: [{ id: FIRST_QUEST, baseline: {} }],
  questsDone: [],
  storyChapter: 0,
  deposit: null,
  islandGift: NEW_ISLAND_GIFT,
  islandAcorn: NEW_ISLAND_GIFT,
  islandThanksDay: null,
  flowerWeek: NEW_FLOWER_WEEK,
  weekly: null,
  weekMark: null,
  afterCelebrated: [],
  weekMilestones: [],
  afterMilestoneDays: {},
  afterTalkDone: [],
  pumpkinDone: [],
  harvestFairDone: [],
  firstSnowWinters: [],
  birthdayChatDone: [],
  playerBirthday: null,
  dailyBase: {},
  ledger: [],
  loanHistory: EMPTY_LOAN_HISTORY,
  dailyClaimed: [],
  giftDay: {},
  birthdayThanks: [],
  marketBought: [],
  pocket: 20,
  recipes: STARTER_RECIPES,
  miles: 0,
  milesClaimed: {},
  wear: { hat: null, outfit: DEFAULT_OUTFIT },
  closet: [DEFAULT_OUTFIT],
  letters: [WELCOME_LETTER],
  shop: NEW_SHOP,
  shopLog: NEW_SHOP_LOG,
  home: NEW_HOME,
  homeFurniture: [],
  homeStorage: [],
  napDay: null,
  museum: [],
  starsSeen: [],
  rainbowSeen: false,
  cave: { ...EMPTY_CAVE },
  bank: createBank(dateKey(new Date())),
  rating: { day: null, stars: 0, rewarded: 0, since: dateKey(new Date()) },
  goldCan: false,
  festival: { day: null, n: 0, offered: [], claimed: [] },
  wishNight: null,
}

/** 지금 이 주민에게 선물을 줄 수 없는 이유. 줄 수 있으면 null. */
/** 주민이 지금 입고 나온 선물 옷과 그 옷의 취향 */
export function wornGiftOf(entry: { outfit: string; day: string } | undefined, day: string, v: { wearTaste?: WearTaste }): { id: string; taste: ReturnType<typeof wearTaste> } | undefined {
  const id = wornOutfit(entry, day)
  // 행사 옷(망토·가면·장난 옷)은 선물 옷이 아니라 취향이 없다
  return id && WEAR_BY_ID[id] ? { id, taste: wearTaste(v.wearTaste, id) } : undefined
}

/** 저장된 이사 고민: 바른 주민 id 와 날짜만 남긴다. */
function sanitizeMoveTalk(raw: unknown): MoveTalk | null {
  const m = raw as Partial<MoveTalk> | null
  if (!m || typeof m.id !== 'string' || typeof m.since !== 'string' || dayIndex(m.since) === null) return null
  return VILLAGERS.some((v) => v.id === m.id) ? { id: m.id, since: m.since } : null
}

/** 저장된 떠난 자리 손님 목록: 손님 주민과 날짜가 바른 것만 남긴다. */
function sanitizeArrivals(raw: unknown): Arrival[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((a): a is Arrival => typeof a?.id === 'string' && typeof a?.day === 'string' && dayIndex(a.day) !== null && VILLAGERS.some((v) => v.id === a.id))
}

/** 저장된 보낸 편지: 글 길이와 편지지, 날짜가 바른 것만 남기고 최근 열 통까지만 둔다. */
function sanitizeOutLetters(raw: unknown): OutLetter[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((l): l is OutLetter => {
      if (!l || typeof l !== 'object') return false
      const o = l as Partial<OutLetter>
      return (
        typeof o.id === 'string' &&
        typeof o.to === 'string' &&
        typeof o.text === 'string' &&
        [...o.text].length <= 80 &&
        paperOf(o.paper ?? '') !== null &&
        typeof o.day === 'string' &&
        dayIndex(o.day) !== null &&
        typeof o.replyDay === 'string' &&
        typeof o.replyText === 'string'
      )
    })
    .map((l) => ({ ...l, gift: typeof l.gift === 'string' ? l.gift : null, giftVariant: typeof l.gift === 'string' ? sanitizeVariant(l.giftVariant) : undefined, replied: l.replied === true, acked: l.acked === true }))
    .slice(0, 10)
}

/** 저장된 사탕 교환 기록: `날짜:주민 id` 문자열만 남기고 오래된 것은 뺀다. */
function sanitizePumpkinDone(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}:[a-z]+$/.test(x)).slice(-PUMPKIN_KEEP)
}
const PUMPKIN_KEEP = 60

/** 저장된 날짜·주민 기록(수확 장날, 생일 수다): `날짜:주민 id` 문자열만 남기고 오래된 것은 뺀다. */
function sanitizeDayKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}:[a-z]+$/.test(x)).slice(-PUMPKIN_KEEP)
}

/**
 * 도토리 감사 장날 낮, 처음 말 거는 주민에게 수확물을 건넨다. 과일이나 요리가 있으면 도토리와 답례 가구 편지를 받고,
 * 없으면 아쉬워하기만 한다(기록을 남기지 않아 다시 말을 걸 수 있다). 같은 날 같은 주민은 한 번만 받는다.
 */
function harvestTalk(s: GameState, v: { id: string; name: string }, hour: number): { lines: string[]; patch: Partial<GameState> } | null {
  if (!isHarvestFairHour(s.day, hour)) return null
  const key = `${s.day}:${v.id}`
  const done = s.harvestFairDone ?? []
  if (done.includes(key)) return null
  const who = PERSONALITY[v.id] ?? 'cheery'
  const ask = harvestAskLines(who)
  const giftId = pickHarvestGift(s.inventory)
  if (!giftId) return { lines: [...ask, ...harvestNoneLines(who)], patch: {} }
  const inv = removeOne(s.inventory, giftId)
  if (!inv) return null
  const furniture = ITEMS[harvestFurnitureFor(key)]
  return {
    lines: [...ask, ...harvestThanksLines(who, `${furniture.name}${furniture.icon}`)],
    patch: {
      inventory: inv,
      money: s.money + HARVEST_REWARD_MONEY,
      letters: [harvestThanksLetter(s.day, v, furniture.id), ...s.letters].slice(0, MAILBOX_MAX),
      harvestFairDone: [...done, key].slice(-PUMPKIN_KEEP),
    },
  }
}

/**
 * 호박 등불 밤 저녁, 처음 말 거는 주민은 사탕을 달라고 한다. 사탕이 있으면 건네고 답례 편지를 받고,
 * 없으면 장난을 쳐서 그날 하루 옷 색이 바뀐다. 같은 날 같은 주민은 한 번만 한다.
 */
function pumpkinTalk(s: GameState, v: { id: string; name: string }, hour: number): { lines: string[]; patch: Partial<GameState> } | null {
  if (!isPumpkinNight(s.day, hour)) return null
  const key = `${s.day}:${v.id}`
  const done = s.pumpkinDone ?? []
  if (done.includes(key)) return null
  const next = [...done, key].slice(-PUMPKIN_KEEP)
  const who = PERSONALITY[v.id] ?? 'cheery'
  const ask = pumpkinAskLines(who)
  const out = candyOutcome(countOf(s.inventory, CANDY_ID) > 0, key)
  if (out.kind === 'treat') {
    const inv = removeOne(s.inventory, CANDY_ID)
    if (!inv) return null
    const gift = ITEMS[out.gift]
    return {
      lines: [...ask, ...pumpkinThanksLines(who, `${gift.name}${gift.icon}`)],
      patch: { inventory: inv, letters: [pumpkinThanksLetter(s.day, v, out.gift), ...s.letters].slice(0, MAILBOX_MAX), pumpkinDone: next },
    }
  }
  return {
    lines: [...ask, ...pumpkinPrankLines(who)],
    patch: { villagerWear: { ...s.villagerWear, [v.id]: { outfit: PRANK_OUTFIT.id, day: s.day } }, pumpkinDone: next },
  }
}

/** 저장된 주민 옷: 옷장 품목이 될 수 있는 옷과 바르게 적힌 날만 남긴다. */
function sanitizeVillagerWear(raw: unknown): Record<string, { outfit: string; day: string }> {
  const out: Record<string, { outfit: string; day: string }> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, e] of Object.entries(raw as Record<string, { outfit?: unknown; day?: unknown }>)) {
    if (typeof e?.outfit !== 'string' || (WEAR_BY_ID[e.outfit]?.slot !== 'outfit' && !isPumpkinOutfit(e.outfit))) continue
    if (typeof e.day !== 'string' || dayIndex(e.day) === null) continue
    out[id] = { outfit: e.outfit, day: e.day }
  }
  return out
}

export function giftBlockReason(villagerId: string): string | null {
  const s = useGame.getState()
  const v = VILLAGERS.find((x) => x.id === villagerId)
  if (!v) return '이 주민에게는 줄 수 없어요'
  if (v.guest && !s.houses.includes(v.id)) return '이사 오기 전이라 선물은 나중에 줄 수 있어요'
  if (!canGiveToday(s.giftDay[v.id], s.day)) return `${josa(v.name, '은', '는')} 오늘은 이미 선물을 받았어요`
  return null
}

export const CHOPS_PER_TREE = 3
/** 이만큼 베면 나무가 넘어간다. 앞 세 번은 목재, 그 뒤 두 번은 힘만 쓴다. */
export const FELL_CHOPS = CHOPS_PER_TREE + 2
export const HITS_PER_ROCK = 5
/** 열매나무가 이보다 적게 서 있으면 베어 넘기지 않는다. 흔들기 퀘스트가 막히지 않게 남겨 둔다. */
export const MIN_FRUIT_STANDING = 8

const ROCK_TABLE = [
  { id: 'stone', weight: 59 },
  // 철광석은 집 여섯 채에 8개쯤 든다. 바위 한 번에 나올 확률을 조금 올려 둔다.
  { id: 'iron', weight: 34 },
  { id: 'gold', weight: 7 },
]

let toastSeq = 0

/** 아침 정리 중이면 여기에 모은 알림을 쓴다(syncClock 이 끝에서 토스트와 휴대폰 목록으로 나눈다) */
let morningSink: MorningNotice[] | null = null

/** 휴대폰 알림 목록에만 남긴다. 토스트는 띄우지 않는다. */
function logNotice(text: string) {
  useGame.setState({ noticeLog: [...useGame.getState().noticeLog, { id: ++toastSeq, text, at: currentHour() }].slice(-NOTICE_MAX) })
}

/** 오늘 마을 방송에 붙을 이번 주 소식 줄(머리글 없이). 일요일이고 오늘 요약을 만들었을 때만 줄이 있다. */
function recapShownOn(key: string): string[] {
  const m = useGame.getState().weekMark
  return m && m.day === key && isRecapDay(key) ? m.recap : []
}

/** 방송 카드에 붙일 블록: 구분 머리글 뒤에 요약 줄. 요약이 없으면 빈 목록. */
const recapBlock = (lines: string[]): string[] => (lines.length ? [RECAP_HEAD, ...lines] : [])

/** 일요일 아침에 지난 기준값과 비교해 이번 주 요약을 만들고, 요약을 알림에 남기고, 기준값을 지금으로 옮긴다. */
/** 팔린 것을 가게 장부(14일)와 이번 달 누계에 함께 적는다 */
function salesPatch(s: { salesLedger?: SalesDay[]; shopMonth?: ShopMonth | null; day: string }, sales: Sale[]) {
  return { salesLedger: addSales(s.salesLedger ?? [], s.day, sales), shopMonth: addMonthSales(s.shopMonth, s.day, sales) }
}

function weekRecapToday(key: string): string[] {
  const s = useGame.getState()
  const now = snapshotOf(s.stats, s.shop.tier, s.houses.length)
  const mark = s.weekMark
  if (!mark) {
    useGame.setState({ weekMark: nextMark(now, key, []) })
    return []
  }
  if (mark.day === key || !isRecapDay(key)) return recapShownOn(key)
  const recap = recapLines(now, mark, s.weekMilestones ?? [])
  logNotice(RECAP_HEAD)
  for (const text of recap) logNotice(text)
  useGame.setState({ weekMark: nextMark(now, key, recap), weekMilestones: [] })
  return recap
}
/** 동시에 기다리는 알림 수. 넘치면 오래된 것부터 버린다. */
export const TOAST_QUEUE_MAX = 4
/** 휴대폰 알림 앱에 남기는 지나간 알림 수 */
export const NOTICE_MAX = 30
let groundSeq = 0
/** 오늘 대답한 주민 질문. `주민:날짜:화제` 꼴이다. 새로고침하면 다시 묻는다. */
const askedToday: string[] = []
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}-${++groundSeq}`

/** 받을 수 있는(목표를 다 채운) 퀘스트 목록. 메인과 오늘의 일일 퀘스트를 함께 본다. */
export function questBoard(s: Pick<SaveData, 'quests' | 'stats' | 'day' | 'dailyBase' | 'dailyClaimed'>) {
  const main = s.quests.map((a) => ({ def: QUESTS[a.id], baseline: a.baseline })).filter((q) => q.def)
  const daily = dailyQuests(s.day)
    .filter((q) => !s.dailyClaimed.includes(q.id))
    .map((def) => ({ def, baseline: s.dailyBase }))
  return [...main, ...daily].map((q) => ({ ...q, done: isComplete(q.def, s.stats, q.baseline) }))
}

/** 받을 수 있는 보상 가운데 맨 앞 것. 키보드로 바로 받게 할 때 쓴다. */
export function firstClaimable(s: Pick<SaveData, 'quests' | 'stats' | 'day' | 'dailyBase' | 'dailyClaimed'>): string | null {
  return questBoard(s).find((q) => q.done)?.def.id ?? null
}

/** 열매나무는 MIN_FRUIT_STANDING 그루를 넘게 서 있을 때만 베어 넘긴다. 소나무는 언제든 된다. */
export function fellable(tree: TreeSpot, s: Pick<SaveData, 'felled' | 'day'>): boolean {
  if (tree.kind === 'pine') return true
  const standing = TREES.filter((t) => t.kind === 'fruit' && treeState(t.id, s.felled, s.day) === 'tree').length
  return standing > MIN_FRUIT_STANDING
}

/** 주인에게 판 품목을 기록한다. 같은 품목은 개수를 더한다. */
function logSold(log: ShopLog, slots: readonly Slot[]): ShopLog {
  const sold = { ...log.sold }
  for (const slot of slots) sold[slot.id] = (sold[slot.id] ?? 0) + slot.count
  return { ...log, sold }
}

/** 저장할 항목만 고른다. 하루짜리 기록과 섬 상태는 모두 여기 든다. */
export const saveOf = (s: GameState): SaveData => ({
  money: s.money,
  infra: s.infra,
  introduced: s.introduced,
  tourney: s.tourney,
  todo: s.todo,
  designs: s.designs,
  villagerWear: s.villagerWear,
  outLetters: s.outLetters,
  moveTalk: s.moveTalk,
  lastMoveDay: s.lastMoveDay,
  arrivals: s.arrivals,
  flagDesign: s.flagDesign,
  shirtDesign: s.shirtDesign,
  inventory: s.inventory,
  tools: s.tools,
  tool: s.tool,
  canLevel: s.canLevel,
  day: s.day,
  islandStart: s.islandStart,
  furnitureSeen: s.furnitureSeen,
  shaken: s.shaken,
  collected: s.collected,
  caught: s.caught,
  dug: s.dug,
  chopped: s.chopped,
  rockHits: s.rockHits,
  holes: s.holes,
  felled: s.felled,
  ground: s.ground,
  dex: s.dex,
  placed: s.placed,
  plants: s.plants,
  friendship: s.friendship,
  talked: s.talked,
  fulfilled: s.fulfilled,
  requests: s.requests,
  album: s.album,
  wallPhoto: s.wallPhoto,
  chatLog: s.chatLog,
  houses: s.houses,
  recruits: s.recruits,
  stats: s.stats,
  quests: s.quests,
  questsDone: s.questsDone,
  dailyBase: s.dailyBase,
  dailyMoney: s.dailyMoney,
  ledger: s.ledger,
  loanHistory: s.loanHistory,
  dailyClaimed: s.dailyClaimed,
  giftDay: s.giftDay,
  birthdayThanks: s.birthdayThanks,
  marketBought: s.marketBought,
  pocket: s.pocket,
  recipes: s.recipes,
  miles: s.miles,
  milesClaimed: s.milesClaimed,
  wear: s.wear,
  closet: s.closet,
  letters: s.letters,
  shop: s.shop,
  shopLog: s.shopLog,
  gardenPermit: s.gardenPermit,
  homeNew: s.homeNew,
  seenHints: s.seenHints,
  calendarOpenedDay: s.calendarOpenedDay,
  storyChapter: s.storyChapter,
  storyEnded: s.storyEnded,
  weekly: s.weekly,
  weekMark: s.weekMark,
  afterCelebrated: s.afterCelebrated,
  weekMilestones: s.weekMilestones,
  afterMilestoneDays: s.afterMilestoneDays,
  afterTalkDone: s.afterTalkDone,
  pumpkinDone: s.pumpkinDone,
  harvestFairDone: s.harvestFairDone,
  firstSnowWinters: s.firstSnowWinters,
  birthdayChatDone: s.birthdayChatDone,
  playerBirthday: s.playerBirthday,
  deposit: s.deposit,
  islandGift: s.islandGift,
  islandAcorn: s.islandAcorn,
  islandThanksDay: s.islandThanksDay,
  shopNew: s.shopNew,
  weeklyBuy: s.weeklyBuy,
  houseExpand: s.houseExpand,
  expanded: s.expanded,
  houseThanks: s.houseThanks,
  salesLedger: s.salesLedger,
  shopMonth: s.shopMonth,
  flowerWeek: s.flowerWeek,
  songiBuy: s.songiBuy,
  stampCard: s.stampCard,
  gardenTiles: s.gardenTiles,
  setsDone: s.setsDone,
  dexRewarded: s.dexRewarded,
  homeStars: s.homeStars,
  orders: s.orders,
  homePaint: s.homePaint,
  interiorWall: s.interiorWall,
  home: s.home,
  homeFurniture: s.homeFurniture,
  homeStorage: s.homeStorage,
  napDay: s.napDay,
  museum: s.museum,
  starsSeen: s.starsSeen,
  rainbowSeen: s.rainbowSeen,
  cave: s.cave,
  bank: s.bank,
  rating: s.rating,
  goldCan: s.goldCan,
  festival: s.festival,
  wishNight: s.wishNight,
})

/** 저장 이행이 실패했는지. loadSave 가 세우고, 스토어를 만든 뒤 토스트로 알린 다음에도 그대로 둔다. */
let loadFailed = false

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** 주머니가 가득 찼을 때 알리고 가방 아이콘을 흔든다. 주운 물건은 그대로 바닥에 남는다. */
      const pocketFull = (msg: string) => {
        const s = get()
        // 집 보관함에 빈 칸이 있으면 그리로 옮기라고 알린다. 집 안이면 보관함을 바로 연다.
        const room = s.homeStorage.length < storageSlots(s.home.stage)
        if (room) {
          s.notify(s.inHome ? '주머니가 가득 찼어요. 집 보관함에 넣을 수 있어요' : '주머니가 가득 찼어요. 집에 가면 보관함에 넣을 수 있어요')
          set({ bagFullAt: performance.now(), ...(s.inHome ? { panel: 'storage' as const } : {}) })
          return
        }
        s.notify(msg)
        set({ bagFullAt: performance.now() })
      }
      /** 주머니에 넣는다. 꽉 찼으면 알리고 false. */
      const give = (itemId: string, count = 1, variant?: string): boolean => {
        const { inv, added } = addItem(get().inventory, itemId, count, get().pocket, variant)
        if (added === 0) {
          pocketFull('주머니가 가득 찼어요. 몇 개 팔거나 내려놓아 볼까요?')
          return false
        }
        set({ inventory: inv })
        return true
      }

      /**
       * 땅에 떨어뜨린다. 바위·나무에서 나온 재료처럼 직접 주워 가게 한다.
       * from 을 주면 그 자리에서 포물선을 그리며 튀어나와 착지하는 연출이 붙는다.
       */
      const drop = (itemId: string, x: number, z: number, fallbackX: number, fallbackZ: number, from?: [number, number, number], arc = 1) => {
        const ok = isWalkable(x, z) && !blockedByScenery(x, z, 0.2)
        const id = uid('g')
        if (from) runtime.drops[id] = { from, arc, t0: now() }
        set({ ground: [...get().ground, { id, itemId, x: ok ? x : fallbackX, z: ok ? z : fallbackZ }] })
      }

      /** 주웠을 때: 몸을 숙이고, 물건이 손을 거쳐 주머니로 쏙 들어간다. */
      const pickedUp = (itemId: string, x: number, z: number) => {
        flyToPocket(itemId, [x, heightAt(x, z) + 0.2, z])
        // 주운 자리에 반짝이와 먼지를 한 번 터뜨려 손에 든 순간을 바닥에서도 읽히게 한다.
        const gy = heightAt(x, z)
        burst({ kind: 'sparks', x, y: gy + 0.3, z })
        burst({ kind: 'puff', x, y: gy + 0.1, z })
        startAct('pick')
        play('pick')
      }

      /** 잡았을 때: 머리 위로 번쩍 들어 보인다. */
      const showOff = (itemId: string, delay = 0) => {
        runtime.show = { itemId, t0: now() }
        // 자랑 동작과 소리는 물고기가 손에 닿은 뒤에 난다(delay). 화면의 물고기 연출은 ShowOff 가 같은 시간만큼 늦춘다.
        const go = () => {
          startAct('show')
          play('catch')
        }
        if (delay > 0) setTimeout(go, delay * 1000)
        else go()
      }

      /**
       * 나무가 넘어간다. 기울기는 runtime.fall 이 맡고(칼날이 박히는 순간부터), 목재와 열매를 쏟고 그루터기가 남는다.
       */
      const fell = (tree: TreeSpot) => {
        const s = get()
        const p = runtime.player
        const yaw = Math.atan2(tree.x - p.x, tree.z - p.z)
        runtime.fall = { id: tree.id, t0: now() + IMPACT_AT.chop, yaw }
        set({ felled: { ...s.felled, [tree.id]: { state: 'stump', day: s.day } } })
        const y = heightAt(tree.x, tree.z)
        // 쓰러진 쪽과 반대편으로 흩어진다. 열매는 아직 달린 나무에서만 떨어진다.
        const items: string[] = ['wood', 'wood', 'wood']
        if (tree.kind === 'fruit' && !s.shaken.includes(tree.id)) items.push(tree.fruit ?? 'peach', tree.fruit ?? 'peach')
        items.forEach((item, i) => {
          const a = yaw + Math.PI + (i - (items.length - 1) / 2) * 0.6
          const from: [number, number, number] = [tree.x, y + 2 * tree.scale, tree.z]
          drop(item, tree.x + Math.sin(a) * 1.6, tree.z + Math.cos(a) * 1.6, tree.x, tree.z + 1, from, 0.6)
        })
        s.notify('나무가 쓰러졌어요! 그루터기가 남아요')
        play('thud')
      }

      /** 통계를 올리고, 이번 일로 새로 끝난 퀘스트가 있으면 알린다. */
      const bump = (stat: string, amount = 1) => {
        const before = questBoard(get()).filter((q) => q.done).map((q) => q.def.id)
        set({ stats: { ...get().stats, [stat]: (get().stats[stat] ?? 0) + amount } })
        const fresh = questBoard(get()).filter((q) => q.done && !before.includes(q.def.id))
        // 마일리지 업적: 단계를 넘으면 바로 마일이 쌓인다.
        // 둘 다 일어나면 퀘스트 알림이 뒤에 와서 화면에 남는다.
        const m = newMiles(get().stats, get().milesClaimed)
        set({ miles: get().miles + m.miles, milesClaimed: m.claimed })
        if (m.miles) {
          play('coin')
          for (const r of m.reached) gainMileToast(r.m.miles[r.tier - 1], `${r.m.title} ${r.tier}단계`)
        }
        if (fresh.length) play('coin')
        if (fresh.length) get().notify(`📜 「${fresh[0].def.title}」 완료! 수첩(J)에서 보상을 받아요`)
      }

      /** 도감 기록. 처음 잡은 종이면 true. */
      // 벌레 잡기가 성공한 뒤의 공통 처리: 통계·박수·도감·카드·벌레 보너스
      const landBug = (speciesId: string) => {
        countCatchToday('bug')
        // 같이 벌레 잡는 주민이 있으면 박수를 친다
        const comp = get().companion
        if (comp?.mode === 'bug') set({ companion: { ...comp, clapAt: Date.now() } })
        showOff(speciesId)
        const fresh = record(speciesId)
        set({ caption: { itemId: speciesId, text: catchQuip(speciesId), fresh } })
        bump('bug')
      }

      const record = (speciesId: string): boolean => {
        const dex = get().dex
        set({ dex: { ...dex, [speciesId]: (dex[speciesId] ?? 0) + 1 } })
        return !dex[speciesId]
      }

      /** 호감도를 올리고, 단계가 오르면 선물 대사를 돌려준다. */
      /** 소문거리가 될 다른 주민. 이사 온 주민만 */
      const presentOthers = (id: string, houses: readonly string[]) =>
        VILLAGERS.filter((o) => o.id !== id && (!o.newcomer || houses.includes(o.id))).map((o) => ({ id: o.id, name: o.name }))

      const befriend = (v: Villager, amount: number): string[] => {
        const before = get().friendship[v.id] ?? 0
        const after = before + amount
        set({ friendship: { ...get().friendship, [v.id]: after } })
        const lv = friendshipLevel(after)
        if (lv <= friendshipLevel(before)) return []
        const gift = v.gifts[lv - 1]
        const def = ITEMS[gift]
        const { inv, added } = addItem(get().inventory, gift, 1, get().pocket)
        if (added) set({ inventory: inv })
        else set({ money: get().money + def.price * 2 })
        play('success')
        get().notify(added ? `${v.name}에게 ${josa(def.name, '을', '를')} 선물 받았어요 ${def.icon}` : `주머니가 꽉 차서 ${josa(v.name, '이', '가')} 도토리로 줬어요`)
        return v.voice === 'shout'
          ? [`(등 뒤에서 ${def.icon} ${josa(def.name, '을', '를')} 꺼내 쑥 내민다) 얍!`]
          : v.voice === 'tiny'
          ? [`(${def.icon} ${josa(def.name, '을', '를')} 두 손으로 꼭 쥐고 내민다) …응!`]
          : [`우리 꽤 친해진 것 같아${v.tic}! 이거 선물이야. ${def.icon} ${def.name}!`]
      }

      const grant = (r: Reward) => {
        const s = get()
        let inv = s.inventory
        let money = s.money + (r.money ?? 0)
        for (const [id, n] of r.items ?? []) {
          const res = addItem(inv, id, n, s.pocket)
          inv = res.inv
          // 주머니가 차서 못 받은 만큼은 판매가로 바꿔 준다.
          money += (n - res.added) * ITEMS[id].price
        }
        const tools = [...s.tools, ...(r.tools ?? []).filter((t) => !s.tools.includes(t))]
        const recipes = [...s.recipes, ...(r.recipes ?? []).filter((x) => !s.recipes.includes(x))]
        set({ inventory: inv, money, tools, recipes, miles: s.miles + (r.miles ?? 0) })
      }

      return {
        ...initial,
        prompt: null,
        toast: null,
        toastQueue: [],
        noticeLog: [],
        noticeSeen: 0,
        panel: null,
        night: isNight(currentHour()),
        placing: null, placingVariant: undefined,
        placingRot: 0,
        placeCell: null,
        dialog: null,
        traveling: false,
        tripGuests: [],
        island: 'home',
        inside: null,
        doorFade: false,
        homePaintAt: 0,
        interiorWall: 0,
        closetShop: false,
        bagOpen: false,
        caption: null,
        inHome: false,
        inMuseum: false,
        inShop: false,
        clerkSay: null,
        shopGuestSay: null,
        inCave: false,
        inHall: false,
        homePlacing: null, homePlacingVariant: undefined,
        homePlacingRot: 0,
        homePlaceCell: null,
        roomLampsOff: [],

        syncClock() {
          const s = get()
          const key = dayOverride() ?? dateKey(new Date())
          // 아침에 쌓이는 알림은 여기 모았다가 마지막에 중요한 몇 개만 토스트로 띄운다(나머지는 휴대폰 목록)
          const morning: MorningNotice[] = []
          morningSink = morning
          // 호박 등불 밤 불빛과 행사 옷은 저녁 시각에 맞춰 켜고 끈다(바뀔 때만 상태를 건드린다)
          const nightOn = isPumpkinNight(key, currentHour())
          if (nightOn !== s.pumpkinNightOn) set({ pumpkinNightOn: nightOn })
          // 무지개 시간(14~17시)이 되면 같은 날 한 번 알려서 벤치나 망원경으로 올려다보게 한다
          if (rainbowDay(weatherFor(prevDay(key)), weatherFor(key)) && rainbowHour(currentHour()) && runtime.rainbowToldDay !== key) {
            runtime.rainbowToldDay = key
            s.notify('🌈 무지개가 떴어요! 벤치나 망원경으로 올려다봐요')
          }
          if (s.day !== key) {
            // 다음 일요일이 되면 남은 송이는 상한다(주머니와 집 보관함 모두)
            const hasSongi = (list: readonly { id: string }[]) => list.some((x) => x.id === SONGI_ID)
            if (weekdayOf(key) === 0 && (hasSongi(s.inventory) || hasSongi(s.homeStorage))) {
              set({ inventory: spoilSongi(get().inventory), homeStorage: spoilSongi(get().homeStorage) })
              morning.push({ text: '송이가 상했어요. 다음엔 일요일 아침에 사 와요', rank: 6 })
            }
            // 새 날이 되면 아침 소식을 한 번 띄운다(같은 날은 showNews 가 막는다)
            get().showNews()
            // 물 준 꽃 쌍은 밤에 옆칸에 새 꽃을 낳을 수 있다. 낳은 꽃은 자라기 전 목록에 더한다.
            const bred = breedOvernight(s.plants, {
              goldCan: s.goldCan,
              rng: mulberry32(hashString(`${key}:breed`)),
              free: (x, z) => canPlace(x, z, s.placed, s.plants, { felled: s.felled, day: key, holes: s.holes }),
              newId: () => uid('f'),
            })
            const { plants, bloomed } = growOvernight(bred.plants)
            set({
              day: key,
              shaken: [],
              collected: [],
              caught: [],
              dug: [],
              chopped: {},
              rockHits: {},
              felled: pruneRegrown(s.felled, key),
              talked: [],
              fulfilled: [],
              requests: {},
              ground: s.ground.filter((g) => !g.id.startsWith('lost-')),
              plants,
              dailyBase: { ...s.stats },
              dailyMoney: s.money,
              // 어제 번·쓴 양을 가계부에 남긴다(기준값을 바꾸기 전에 읽는다)
              ledger: pushLedger(s.ledger ?? [], { day: s.day, ...flowOf(s.stats, s.dailyBase), other: otherOf(s.money, s.dailyMoney ?? null, s.stats, s.dailyBase) }),
              dailyClaimed: [],
            })
            // 가게 결산: 달 마지막 날 아침(놓쳤으면 다음 달 첫 아침)에 지난 판매를 편지로 정리하고 보너스 마일을 준다
            const month = get().shopMonth ?? null
            if (month && shouldSettle(month, key)) {
              const st = settleMonth(month, key)
              set({ letters: [st.letter, ...get().letters].slice(0, MAILBOX_MAX), miles: get().miles + st.bonus, shopMonth: st.tally })
            }
            // 증축이 끝난 다음 날 아침, 그 주민이 감사 편지를 한 통 보낸다. 완성 아침에는 아직 보내지 않는다(완성 뒤에 새로 적는다).
            const pendingThanks = get().houseThanks
            if (pendingThanks && pendingThanks.day < key) {
              const letter = houseThanksLetter(key, pendingThanks.id)
              if (letter && !get().letters.some((l) => l.id === letter.id)) set({ letters: [letter, ...get().letters].slice(0, MAILBOX_MAX) })
              set({ houseThanks: null })
            }
            // 주민 집 증축이 다 찬 날 아침: 그 집에 차양이 달리고 알림 한 줄이 뜬다
            const ex = completeHouseExpand(s.houseExpand ?? null, s.expanded ?? [], key)
            if (ex.done) {
              set({ houseExpand: ex.current, expanded: ex.expanded, houseThanks: { id: ex.done, day: key } })
              morning.push({ text: expandDoneLine(ex.done), rank: 3 })
            }
            // 도토리 감사 장날 아침: 장날 편지를 보낸다. 방송 줄은 news.ts 가 붙인다(같은 말을 토스트로 또 띄우지 않는다).
            if (isHarvestFairDay(key)) {
              const hl = harvestFairLetter(key)
              if (!get().letters.some((l) => l.id === hl.id)) set({ letters: [hl, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 첫눈 날 아침: 위원회 편지로 눈사람 인형을 보낸다. 방송 줄은 news.ts 가 붙인다.
            if (isFirstSnowDay(key, weatherFor)) {
              const fl = firstSnowLetter(key)
              if (!get().letters.some((l) => l.id === fl.id)) set({ letters: [fl, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 호박 등불 밤 아침: 행사 편지를 보내고, 섬 주민들은 저녁에 입을 망토와 가면을 미리 골라 둔다.
            // 플레이어 생일 아침: 위원회 편지와 작은 화분 선물, 주민들의 축하 수다는 오늘 말을 거는 대화에서 나온다.
            if (isPlayerBirthday(s.playerBirthday, key)) {
              const bl = playerBirthdayLetter(key)
              if (!get().letters.some((l) => l.id === bl.id)) set({ letters: [bl, ...get().letters].slice(0, MAILBOX_MAX) })
              morning.push({ text: '🎂 오늘은 내 생일이에요! 섬 주민들이 축하 인사를 준비했어요', rank: 4 })
            }
            if (isPumpkinDay(key)) {
              const pl = pumpkinLetter(key)
              if (!get().letters.some((l) => l.id === pl.id)) set({ letters: [pl, ...get().letters].slice(0, MAILBOX_MAX) })
              const cos = Object.fromEntries(VILLAGERS.filter((v) => !v.guest || s.houses.includes(v.id)).map((v) => [v.id, { outfit: costumeFor(v.id), day: key }]))
              set({ villagerWear: { ...get().villagerWear, ...cos } })
            }
            const letter = morningLetter(key, s.friendship, { houses: s.houses, recruits: s.recruits }, weatherFor(key))
            // 방금 넣은 생일·장날 편지를 지우지 않도록 최신 편지 목록에 붙인다
            if (letter && !get().letters.some((l) => l.id === letter.id)) {
              set({ letters: [letter, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 어제 아침에 놓친 선물 편지(아침 편지·유성우 소원 편지)는 오늘 한 번 늦게 보낸다. 하루치만 본다.
            // 섬에 온 첫날 이전은 놓친 게 아니니 따지지 않는다.
            const yesterday = prevDay(key)
            // 꽃 심기 주간 첫날 아침 위원회가 한 번 알린다
            if (flowerWeekStart(key)) {
              const fl = flowerWeekLetter(key)
              if (!get().letters.some((l) => l.id === fl.id)) set({ letters: [fl, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 따뜻한 모금 주간 첫날 아침에 위원회가 한 번 알린다. 섬 가꾸기가 남아 있을 때만 보낸다.
            if (warmFundStart(key) && currentGift(s.islandGift ?? NEW_ISLAND_GIFT) !== null) {
              const warm = warmFundLetter(key)
              if (!get().letters.some((l) => l.id === warm.id)) set({ letters: [warm, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 어제 집을 지었고 아직 한 번도 칠하지 않았으면 외관 칠하기를 한 번 알린다
            if (paintTipDue(s.homeNew?.day ?? null, yesterday, s.homePaint ?? DEFAULT_PAINT)) {
              const tip = paintTipLetter(key)
              if (!get().letters.some((l) => l.id === tip.id)) set({ letters: [tip, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 어제 새 방이 열렸으면 그 방에 어울리는 가구를 선물 편지로 한 번 보낸다(방 이름이 편지 id)
            for (const f of roomGiftFloors(s.homeNew ?? null, yesterday, s.home.stage)) {
              const room = ROOM_GIFT[f]
              if (!room) continue
              const gift = roomGiftLetter(key, room, ITEMS[room.item].name)
              if (!get().letters.some((l) => l.id === gift.id)) set({ letters: [gift, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            // 2차 시설이 완성된 날의 다음 날 아침, 그 시설을 보는 주민이 감사 편지를 한 통 보낸다. 완성 아침에는 아직 보내지 않는다.
            const thanksDay = get().islandThanksDay
            if (thanksDay && thanksDay < key) {
              const built = GIFT_PROJECTS_2[(get().islandAcorn?.built ?? 0) - 1]
              const thanks = built ? islandThanksLetter(key, built) : null
              if (thanks && !get().letters.some((l) => l.id === thanks.id)) set({ letters: [thanks, ...get().letters].slice(0, MAILBOX_MAX) })
              set({ islandThanksDay: null })
            }
            // 마지막으로 연 날에서 일주일 안에 돌아왔을 때만 어제 것을 본다. 평범한 첫 아침에는 끼어들지 않는다.
            const missed = daysSinceStart({ day: key, islandStart: s.islandStart }) < 1 || !lateWindow(s.day, key, dayIndex) ? [] : [
              morningLetter(yesterday, s.friendship, { houses: s.houses, recruits: s.recruits }, weatherFor(yesterday)),
              s.wishNight && nextDay(s.wishNight) === yesterday ? wishLetter(yesterday, s.wishNight) : null,
            ]
            const late = lateGiftLetters(key, missed, get().letters.map((l) => l.id))
            if (late.length) set({ letters: [...late, ...get().letters].slice(0, MAILBOX_MAX) })
            // 주문한 가구는 다음 날 아침 소포 편지로 온다. 배달한 주문은 목록에서 뺀다.
            const parcels = parcelLetters(key, s.orders ?? []).filter((l) => !get().letters.some((x) => x.id === l.id))
            set({ orders: (s.orders ?? []).filter((o) => o.day >= key), ...(parcels.length ? { letters: [...parcels, ...get().letters].slice(0, MAILBOX_MAX) } : {}) })
            // 오늘 생일인 이웃은 생일 초대 편지를 보내고, 지난 생일 선물에는 답례 편지를 보낸다.
            const island = VILLAGERS.filter((v) => !v.guest || s.houses.includes(v.id))
            const birthdays = island.filter((v) => isBirthday(v.id, key))
            const invites = birthdays.map((v) => birthdayLetter(key, v)).filter((l) => !s.letters.some((x) => x.id === l.id))
            const thanks = s.birthdayThanks.filter((t) => t.giftDay < key)
            const replies = thanks
              .map((t) => {
                const v = VILLAGERS.find((x) => x.id === t.villagerId)
                return v ? birthdayThanksLetter(key, v, t.present) : null
              })
              .filter((l): l is Letter => !!l && !s.letters.some((x) => x.id === l.id))
            const arriving = [...invites, ...replies]
            if (arriving.length) {
              set({ letters: [...arriving, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            if (thanks.length) set({ birthdayThanks: s.birthdayThanks.filter((t) => t.giftDay >= key) })
            // 한 주에 한 번, 그 주에 처음 연 아침에 섬 별점 편지를 보내고 처음 오른 별 단계의 보상을 준다.
            weeklyRating(key)
            // 내일 축제면 전날 편지를, 오늘 축제면 아침 알림을 준다.
            // 유성우 밤에 빈 소원은 다음 날 아침 편지로 돌아온다.
            if (s.wishNight && nextDay(s.wishNight) === key) {
              const wl = wishLetter(key, s.wishNight)
              if (!get().letters.some((l) => l.id === wl.id)) set({ letters: [wl, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            if (typhoonEve(key)) {
              const tl = typhoonLetter(key, addDays(key, 1))
              if (!get().letters.some((l) => l.id === tl.id)) set({ letters: [tl, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            const eveFest = festivalEve(key)
            if (eveFest) {
              const eveDay = nextDay(key)
              const eve = festivalEveLetter(key, eveFest, eveDay)
              if (!get().letters.some((l) => l.id === eve.id)) set({ letters: [eve, ...get().letters].slice(0, MAILBOX_MAX) })
            }
            const todayFest = festivalOn(key)
            if (todayFest) morning.push({ text: `${todayFest.icon} 오늘은 ${josa(todayFest.name, '이에요', '예요')}! ${todayFest.goal}`, rank: 3 })
            if (bloomed) {
              bump('bloom', bloomed)
              morning.push({ text: `밤새 꽃 ${bloomed}송이가 활짝 피었어요 🌸`, rank: 4 })
            }
            if (bred.born.length) {
              // 희귀색은 도감 '꽃' 칸에 적고, 처음 필 때 편지를 보낸다
              const dex = { ...get().dex }
              const fresh: Letter[] = []
              for (const b of bred.born) {
                if (!b.rare) continue
                const info = RARE_FLOWERS.find((r) => r.id === b.rare)
                if (!dex[b.rare]) {
                  if (info) fresh.push(breedLetter(key, info))
                  if (info) morning.push({ text: `✨ 처음 보는 ${josa(info.name, '이', '가')} 피었어요!`, rank: 3 })
                }
                dex[b.rare] = (dex[b.rare] ?? 0) + 1
              }
              const letters = [...fresh.filter((l) => !get().letters.some((x) => x.id === l.id)), ...get().letters].slice(0, MAILBOX_MAX)
              set({ dex, letters })
              morning.push({ text: `🌸 꽃밭에서 교배로 새 꽃 ${bred.born.length}송이가 피었어요`, rank: 5 })
            }
          }
          // 비 오는 날은 심어 둔 꽃이 저절로 물을 머금는다.
          if (weatherFor(get().day) === 'rain' && get().plants.some((p) => !p.watered)) {
            set({ plants: get().plants.map((p) => ({ ...p, watered: true })) })
          }
          // 상점 공사·집 짓기·이자는 날짜가 넘어갈 때 풀린다. 같은 날이면 값이 그대로라 매번 불러도 된다.
          const shopBefore = get().shop
          const shopAfter = settleUpgrade(shopBefore, get().day)
          if (shopAfter !== shopBefore) {
            runtime.milestoneDays.shopUp = get().day
            const reward = shopMilesReward(shopAfter.tier)
            // 새 단계로 다시 여는 날 배지 기록을 새로 쓴다(이전 단계의 떼어 낸 기록은 버린다)
            set({ shop: shopAfter, miles: get().miles + reward, shopNew: { tier: shopAfter.tier, day: get().day, seen: [] } })
            // 큰 가게·백화점으로 오르면 점장이 편지를 보낸다. 같은 단계 편지는 한 번만 넣는다.
            if (shopAfter.tier === 2 || shopAfter.tier === 3) {
              const tier = shopAfter.tier
              const id = `shop-tier-${tier}`
              if (!get().letters.some((l) => l.id === id)) {
                const letter = shopUpgradeLetter(get().day, tier, newItemsAt(tier), SHOP_LETTER_GIFT[tier])
                set({ letters: [letter, ...get().letters].slice(0, MAILBOX_MAX) })
              }
            }
            // 날이 넘어갈 때 편지 알림이 같이 쌓이니, 문 여는 알림은 큐를 건너뛰어 먼저 보인다
            morning.push({ text: shopReopenText(tierDef(shopAfter.tier).name, reward), rank: 0, build: true })
            // 재개장 아침에는 리본 커팅 연출을 한 번 띄운다(점원 둘이 문 앞에서 인사)
            runtime.shopRibbon = now()
            // 새 간판을 다는 순간 상점 앞에서 색종이를 날린다(카메라가 멀어도 보이게 위쪽에서)
            burst({ kind: 'confetti', x: SHOP.x, y: heightAt(SHOP.x, SHOP.z) + 3, z: SHOP.z + SHOP.d / 2 + 1 })
            play('success')
          }
          const homeBefore = get().home
          const homeAfter = settleHome(homeBefore, get().day)
          // 집 완성과 섬 가꾸기 완성은 같은 아침이면 한 줄로 합쳐 세 개 규칙 안에 든다. 집 줄의 자리에 넣고, 시설은 뒤에 이어 붙인다.
          let buildNotice: MorningNotice | null = null
          if (homeAfter !== homeBefore) {
            set({ home: homeAfter, homeNew: { day: get().day, greeted: false, from: homeBefore.stage } })
            // 완성 알림은 날이 넘어가며 쌓인 편지 알림보다 먼저 보이고, 집 위에서 색종이를 날린다
            // 대출이 남아 있으면 어디서 갚는지 한 줄 덧붙인다(처음 짓는 사람은 ATM 위치를 모른다)
            const loanLine = homeAfter.loan > 0 ? ` 대출 도토리 ${homeAfter.loan.toLocaleString()}개는 도토리 상점 안 ATM에서 갚아요` : ''
            // 같은 아침에 상점도 재개장했으면 그 알림을 지우지 않고 뒤에 줄 세운다(순서: 문 연 알림 → 완성 → 편지)
            const homeText = `🏡 ${josa(homeDef(homeAfter.stage).name, '이', '가')} 완성됐어요!${loanLine}`
            // 상점이 같은 아침에 재개장했으면 그 뒤에 줄 서고, 아니면 공사 갈래로 바로 띄운다
            buildNotice = { text: homeText, rank: 1, build: shopAfter === shopBefore }
            morning.push(buildNotice)
            if (HOME_SITE) burst({ kind: 'confetti', x: HOME_SITE.x, y: heightAt(HOME_SITE.x, HOME_SITE.z) + 3, z: HOME_SITE.z })
            play('success')
          }
          // 하루 넘김에 새로 온 편지는 한 줄로 한 번만 알린다. 완성 알림 뒤, 이자 앞이다.
          const arrived = get().letters.filter((l) => !s.letters.some((x) => x.id === l.id))
          const notice = arrivalNotice(arrived)
          // 결산 편지가 섞이면 돈이 걸린 소식이라 예금 만기와 같은 1순위로 둔다(몰리는 아침에도 토스트에 남게). 그 밖의 편지 도착은 편지함에 남으니 뒤로 미룬다.
          if (notice) morning.push({ text: notice, rank: arrived.some(isLeadLetter) ? 1 : 3 })
          const bankBefore = get().bank
          const bankAfter = accrueInterest(bankBefore, get().day)
          if (bankAfter !== bankBefore) {
            set({ bank: bankAfter })
            const gain = bankAfter.savings - bankBefore.savings
            if (gain > 0) morning.push({ text: `🐿️ 통장에 이자 도토리 ${gain.toLocaleString()}개가 붙었어요`, rank: 5 })
          }
          // 정기 예금 만기: 원금과 이자를 통장에 넣는다(통장 한도 무시). 이자는 맡길 때 정해져 있어 며칠 늦어도 한 번이다.
          const dueDeposit = get().deposit
          const matured = settleDeposit(dueDeposit ?? null, get().day)
          if (dueDeposit && matured.payout > 0) {
            const b = get().bank
            // 처음 만기 한 번만 입출금 탭 안내를 붙인다(본 목록은 seenHints 에 남긴다)
            const hint = firstHintOnce(get().seenHints ?? [], 'deposit')
            set({ bank: { ...b, savings: b.savings + matured.payout }, deposit: matured.deposit, ...(hint ? { seenHints: hint.seen } : {}) })
            morning.push({ text: depositMaturedLine(dueDeposit.days, matured.interest, !!hint), rank: 1, front: true })
          }
          // 섬 가꾸기: 완성일 아침이 되면 시설을 하나 들이고 알린다
          const gift = morningGift(get().islandGift ?? NEW_ISLAND_GIFT, get().day)
          if (gift.built) {
            runtime.milestoneDays.giftDone = get().day
            set({ islandGift: gift.state })
            // 완성된 자리에 색종이를 한 번 날린다
            const at = GIFT_PROJECTS.find((p) => p.id === gift.built?.id)?.anchor
            if (at) burst({ kind: 'confetti', x: at.x, y: heightAt(at.x, at.z) + 2.5, z: at.z })
            const giftText = giftBuiltText(gift.built.name)
            if (buildNotice) buildNotice.text += ` · ${giftText}`
            else {
              buildNotice = { text: giftText, rank: 1, front: true }
              morning.push(buildNotice)
            }
          }
          // 섬 가꾸기 2차: 도토리로 든 시설도 완성일 아침에 들인다(1차를 다 들인 뒤에만 기부가 열린다)
          const acorn = morningGift(get().islandAcorn ?? NEW_ISLAND_GIFT, get().day, GIFT_PROJECTS_2)
          if (acorn.built) {
            set({ islandAcorn: acorn.state, islandThanksDay: get().day })
            const at = acorn.built.anchor
            burst({ kind: 'confetti', x: at.x, y: heightAt(at.x, at.z) + 2.5, z: at.z })
            const acornText = giftBuiltText(acorn.built.name)
            if (buildNotice) buildNotice.text += ` · ${acornText}`
            else {
              buildNotice = { text: acornText, rank: 1, front: true }
              morning.push(buildNotice)
            }
          }
          // 중요한 알림 세 개만 토스트로 띄우고, 나머지는 휴대폰 알림 목록에만 남긴다. 상점 → 집 → 편지 순서는 입력 순서로 지킨다.
          const plan = planMorningToasts(morning)
          for (const t of plan.toasts) {
            if (t.build) get().notifyBuild(t.text)
            else get().notify(t.text, t.front)
          }
          for (const t of plan.phone) logNotice(t.text)
          morningSink = null
          const night = isNight(currentHour())
          if (get().night !== night) set({ night })
        },
        notifyBuild(text) {
          const now = get()
          // 옛 공사·완성 알림은 현재 토스트와 줄에서 지우고, 새 것을 바로 띄운다
          set({
            toast: now.toast && isBuildToast(now.toast.text) ? null : now.toast,
            toastQueue: now.toastQueue.filter((t) => !isBuildToast(t.text)),
          })
          get().notify(text, true)
        },
        notify(text, first = false) {
          const item = { id: ++toastSeq, text }
          set({ noticeLog: [...get().noticeLog, { ...item, at: currentHour() }].slice(-NOTICE_MAX) })
          // 알림이 겹치면 버리지 않고 줄 세운다. 너무 쌓이면 가장 오래된 것부터 뺀다.
          const s = get()
          if (!s.toast) {
            set({ toast: item })
            return
          }
          // 우선 알림은 큐를 건너뛰고 바로 뜬다. 밀려난 알림은 큐 맨 앞에 남는다.
          if (first) {
            set({ toast: item, toastQueue: [s.toast, ...s.toastQueue].slice(0, TOAST_QUEUE_MAX) })
            return
          }
          set({ toastQueue: [...s.toastQueue, item].slice(-TOAST_QUEUE_MAX) })
        },
        dismissToast(id) {
          const s = get()
          if (s.toast?.id !== id) return
          const [next = null, ...rest] = s.toastQueue
          set({ toast: next, toastQueue: rest })
        },
        setPrompt(prompt) {
          if (get().prompt !== prompt) set({ prompt })
        },
        openPanel(panel) {
          // 대화창은 자기 소리가 따로 있다.
          const prev = get().panel
          if (panel && !prev && panel !== 'talk') play('open')
          else if (!panel && prev && prev !== 'talk') play('close')
          // 패널이 열리면 주머니는 닫는다(뒤에 겹쳐 비치지 않게).
          set({ panel, prompt: null, ...(panel && { bagOpen: false }), ...(panel !== 'talk' && { dialog: null }) })
          if (panel && isFirstHint(panel)) get().showFirstHint(panel)
        },

        shakeTree(tree) {
          const s = get()
          if (treeState(tree.id, s.felled, s.day) !== 'tree') return
          if (tree.kind === 'pine') {
            // 소나무는 하루 한 번만 흔든다. 연타로 솔가지를 모을 수 없게 한다.
            if (s.shaken.includes(tree.id)) return s.notify('솔잎만 바스락거려요')
            set({ shaken: [...s.shaken, tree.id] })
            const r = pineShake(Math.random())
            if (r.kind === 'none') return s.notify('솔잎만 바스락거려요')
            const itemId = r.kind === 'branch' ? 'wood' : r.id
            const y = heightAt(tree.x, tree.z)
            const a = Math.random() * Math.PI * 2
            const from: [number, number, number] = [tree.x + Math.cos(a) * 0.6 * tree.scale, y + 2.4 * tree.scale, tree.z + Math.sin(a) * 0.6 * tree.scale]
            drop(itemId, tree.x + Math.cos(a) * 1.3, tree.z + Math.sin(a) * 1.3, tree.x, tree.z + 0.9, from, 0.4)
            play('pop')
            return s.notify(r.kind === 'branch' ? '솔가지가 툭 떨어졌어요! 주워 봐요' : `${josa(ITEMS[itemId].name, '이', '가')} 나무에서 날아갔어요! 주워 봐요`)
          }
          if (tree.kind !== 'fruit' || s.shaken.includes(tree.id)) {
            s.notify('아무것도 떨어지지 않았어요')
            return
          }
          // 열매가 떨어진 흔들기만 센다. 빈 나무를 연타해서 퀘스트가 오르지 않게.
          bump('shake')
          const y = heightAt(tree.x, tree.z)
          ;[0, 1, 2].forEach((i) => {
            const a = (i / 3) * Math.PI * 2 + 0.6
            // 가지에 달려 있던 자리에서 툭 떨어진다.
            const from: [number, number, number] = [tree.x + Math.cos(a) * 0.7 * tree.scale, y + 2.1 * tree.scale, tree.z + Math.sin(a) * 0.7 * tree.scale]
            drop(tree.fruit ?? 'peach', tree.x + Math.cos(a) * 1.15, tree.z + Math.sin(a) * 1.15, tree.x, tree.z + 0.9, from, 0.25)
          })
          set({ shaken: [...get().shaken, tree.id] })
          s.notify(`${josa(ITEMS[tree.fruit ?? 'peach'].name, '이', '가')} 떨어졌어요! 떨어진 열매를 주워요`)
        },
        shakeBush(bush) {
          const s = get()
          // 업적은 그날 처음 뒤지는 덤불만 센다(빈 덤불 연타로 오르지 않게).
          if (!s.shaken.includes(bush.id)) bump('rustle')
          const found = s.shaken.includes(bush.id) ? null : bushFind(bush.id, s.day)
          if (!s.shaken.includes(bush.id)) set({ shaken: [...s.shaken, bush.id] })
          if (!found) return s.notify(['바스락… 아무것도 없어요', '잎사귀만 우수수 떨어졌어요', '덤불 속은 텅 비었어요'][Math.floor(Math.random() * 3)])
          // 덤불 밑에서 데구루루 굴러나온다.
          const a = Math.atan2(runtime.player.x - bush.x, runtime.player.z - bush.z)
          const y = heightAt(bush.x, bush.z)
          drop(found, bush.x + Math.sin(a) * 0.95, bush.z + Math.cos(a) * 0.95, runtime.player.x, runtime.player.z, [bush.x, y + 0.6, bush.z], 0.35)
          play('pop')
          s.notify(`덤불 속에서 ${josa(ITEMS[found].name, '이', '가')} 나왔어요!`)
        },
        chopTree(tree) {
          const s = get()
          if (treeState(tree.id, s.felled, s.day) !== 'tree') return
          const n = (s.chopped[tree.id] ?? 0) + 1
          // 열매나무를 너무 많이 베면 흔들기 퀘스트가 막히므로 마지막 한 번은 아껴 둔다.
          if (n >= FELL_CHOPS && !fellable(tree, s)) return s.notify('열매나무는 이 한 그루를 남겨 둬요')
          set({ chopped: { ...s.chopped, [tree.id]: n } })
          if (n <= CHOPS_PER_TREE) {
            // 플레이어 쪽 반원으로 튀어나오게 해 나무 뒤에 숨지 않게 한다.
            const p = runtime.player
            const a = Math.atan2(p.z - tree.z, p.x - tree.x) + (Math.random() - 0.5) * 2
            drop('wood', tree.x + Math.cos(a) * 1.3, tree.z + Math.sin(a) * 1.3, tree.x, tree.z + 1, [tree.x, heightAt(tree.x, tree.z) + 0.9, tree.z], 0.9)
            bump('chop')
          } else if (n === FELL_CHOPS - 1) s.notify('나무가 휘청여요. 한 번 더 베면 넘어가요')
          if (n >= FELL_CHOPS) fell(tree)
        },
        digHole(x, z) {
          const s = get()
          if (s.holes.length >= MAX_HOLES) {
            play('fail')
            s.notify('구멍이 가득 찼어요. 몇 개 메워 볼까요?')
            return false
          }
          set({ holes: [...s.holes, { id: uid('h'), x, z }] })
          return true
        },
        fillHole(id) {
          const s = get()
          set({ holes: s.holes.filter((h) => h.id !== id) })
          play('dig')
          s.notify('구멍을 메웠어요')
        },
        digStump(tree) {
          const s = get()
          if (treeState(tree.id, s.felled, s.day) !== 'stump') return
          // 파낸 날부터 싹이 자란다. 뿌리 조각으로 목재 하나를 얻는다.
          set({ felled: { ...s.felled, [tree.id]: { state: 'sapling', day: s.day } } })
          const p = runtime.player
          const a = Math.atan2(p.z - tree.z, p.x - tree.x) + 0.8
          drop('wood', tree.x + Math.cos(a) * 0.9, tree.z + Math.sin(a) * 0.9, tree.x, tree.z, [tree.x, heightAt(tree.x, tree.z), tree.z], 0.8)
          s.notify(`그루터기를 파냈어요. ${REGROW_DAYS}일 뒤 다시 자라요`)
        },
        hitRock(rock) {
          const s = get()
          const n = s.rockHits[rock.id] ?? 0
          if (n >= HITS_PER_ROCK) {
            play('fail')
            return s.notify('바위가 단단해졌어요. 내일 다시 와요')
          }
          const dropOne = () => {
            const item = pickWeighted(ROCK_TABLE, Math.random).id
            const p = runtime.player
            const a = Math.atan2(p.z - rock.z, p.x - rock.x) + (Math.random() - 0.5) * 2.4
            drop(item, rock.x + Math.cos(a) * 1.4, rock.z + Math.sin(a) * 1.4, rock.x, rock.z + 1.2, [rock.x, heightAt(rock.x, rock.z) + 0.9, rock.z], 1.2)
            return item
          }
          // 생선구이·수프 효과: 남은 타수만큼 한 번에 깬다
          if (runtime.rockCharge) {
            runtime.rockCharge = false
            let gold = false
            for (let i = n; i < HITS_PER_ROCK; i++) gold = dropOne() === 'gold' || gold
            set({ rockHits: { ...s.rockHits, [rock.id]: HITS_PER_ROCK } })
            s.notify(gold ? '요리 힘으로 바위를 한 번에 깼어요! 금광석도 나왔어요 🟡' : '요리 힘으로 바위를 한 번에 깼어요 💥')
            bump('rock')
            return
          }
          const item = dropOne()
          set({ rockHits: { ...s.rockHits, [rock.id]: n + 1 } })
          if (item === 'gold') s.notify('반짝! 금광석이 튀어나왔어요 🟡')
          bump('rock')
        },
        cookAt(recipeId) {
          const s = get()
          const r = COOK_BY_ID[recipeId]
          if (!r) return
          const out = cook(r, s.inventory, s.money, s.pocket)
          if (!out) {
            play('fail')
            const short = shortfall(r, s.inventory, s.money)
            if (short.length === 0) return pocketFull('주머니가 가득 찼어요. 몇 개 팔아 볼까요?')
            return s.notify(`재료가 부족해요: ${short.map((x) => `${x.label} ${x.have}/${x.need}`).join(' · ')}`)
          }
          set({ inventory: out.inv, money: out.money })
          play('success')
          const name = ITEMS[r.id].name
          s.notify(`${ITEMS[r.id].icon} ${josa(name, '을', '를')} 만들었어요`)
        },
        eatDish(itemId) {
          const s = get()
          if (!isDish(itemId)) return
          const inv = removeOne(s.inventory, itemId)
          if (!inv) return
          const r = COOK_BY_ID[itemId]
          set({ inventory: inv })
          // 효과는 한 번에 하나씩 덮어쓴다(같은 효과가 남아 있으면 시간을 새로 잰다)
          if (r.effect === 'haste') runtime.hasteUntil = now() + effectSeconds('haste')
          if (r.effect === 'happy') runtime.happyUntil = now() + effectSeconds('happy')
          if (r.effect === 'rock') runtime.rockCharge = true
          startAct('eat')
          // 입에 닿을 무렵 하트가 떠오른다
          const p = runtime.player
          impactAt(0.35, () => burst({ kind: 'heart', x: p.x, y: p.y + 1.5, z: p.z }), false)
          play('pop')
          s.notify(`${ITEMS[itemId].icon} ${josa(ITEMS[itemId].name, '을', '를')} 먹었어요. ${r.effectText}`)
        },
        dig(spot) {
          const s = get()
          if (s.holes.length >= MAX_HOLES) {
            play('fail')
            return s.notify('구멍이 가득 찼어요. 몇 개 메워 볼까요?')
          }
          // 구멍에서 쏙 튀어올라 옆에 떨어진다. 자리는 메우기 전까지 구멍으로 남는다.
          const p = runtime.player
          const a = Math.atan2(p.z - spot.z, p.x - spot.x) + 1.2
          drop(spot.itemId, spot.x + Math.cos(a) * 0.7, spot.z + Math.sin(a) * 0.7, spot.x, spot.z, [spot.x, heightAt(spot.x, spot.z), spot.z], 1.4)
          set({ dug: [...s.dug, spot.id], holes: [...s.holes, { id: spot.id, x: spot.x, z: spot.z }] })
          // 화석 종은 파내는 순간 도감에 오른다(전시관 화석 구역에 든다)
          if (FOSSIL_SPECIES.includes(spot.itemId)) set({ dex: { ...get().dex, [spot.itemId]: (get().dex[spot.itemId] ?? 0) + 1 } })
          s.notify(`${josa(ITEMS[spot.itemId].name, '을', '를')} 파냈어요! ${ITEMS[spot.itemId].icon}`)
          bump('dig')
        },
        water(plantId) {
          if (plantId) get().waterPlants([plantId])
        },
        waterPlants(plantIds) {
          const s = get()
          const dry = plantIds.filter((id) => s.plants.some((x) => x.id === id && !x.watered))
          if (dry.length === 0) {
            if (plantIds.length) s.notify(weatherFor(s.day) === 'rain' ? '비가 와서 이미 촉촉해요 🌧️' : '오늘은 충분히 마셨어요 💧')
            return
          }
          set({ plants: s.plants.map((x) => (dry.includes(x.id) ? { ...x, watered: true } : x)) })
          bump('water', dry.length)
          // 꽃 심기 주간에는 물 준 꽃마다 보너스 마일을 더한다(하루 상한이 있다)
          const fw = flowerBonus(s.flowerWeek ?? NEW_FLOWER_WEEK, 'water', dry.length, s.day)
          if (fw.miles) {
            set({ flowerWeek: fw.state, miles: get().miles + fw.miles })
            s.notify(`🏅 물주기 보너스 +${formatMiles(fw.miles)}`)
          }
          stepFestival('water', dry.length)
          for (const [vid, r] of Object.entries(get().requests)) {
            const ar = activeReq(r, get().day)
            if (!ar || ar.kind !== 'water' || ar.done) continue
            const nr = onWater(ar)
            set({ requests: { ...get().requests, [vid]: nr } })
            if (nr.done) get().completeReq(vid)
          }
          if (dry.length > 1) s.notify(`꽃 ${dry.length}송이에 물을 줬어요 💧`)
        },
        startReq(villagerId) {
          const s = get()
          if (activeReq(s.requests[villagerId], s.day)) return
          const kind = kindOf(villagerId, s.day)
          if (kind === 'bring') return
          const island = VILLAGERS.filter((o) => !o.guest || s.houses.includes(o.id)).map((o) => o.id)
          if (kind === 'deliver') {
            const to = deliverTo(villagerId, s.day, island)
            if (!to) return
            set({ requests: { ...s.requests, [villagerId]: newReq('deliver', s.day, { to }) } })
            return
          }
          if (kind === 'lost') {
            const spot = lostSpot(villagerId, s.day)
            if (spot) {
              const item = `lost-${villagerId}-${s.day}`
              set({
                ground: [...s.ground.filter((g) => g.id !== item), { id: item, itemId: LOST_ITEM, x: spot.x, z: spot.z }],
                requests: { ...s.requests, [villagerId]: newReq('lost', s.day, { item }) },
              })
              return
            }
          }
          set({ requests: { ...s.requests, [villagerId]: newReq('water', s.day) } })
        },
        completeReq(villagerId) {
          const s = get()
          const r = activeReq(s.requests[villagerId], s.day)
          if (!r || r.done) return
          const v = VILLAGERS.find((o) => o.id === villagerId)
          const reward = rewardOf(r)
          let inv = s.inventory
          if (reward.furniture) inv = addItem(inv, reward.furniture, 1, s.pocket).inv
          if (v) befriend(v, reward.friendship)
          set({
            requests: { ...get().requests, [villagerId]: { ...r, done: true, progress: r.target } },
            money: s.money + reward.acorns,
            inventory: inv,
          })
          play('success')
          const bond = v ? `💛 ${josa(v.name, '과', '와')} 더 친해졌어요` : ''
          get().notify([bond, reward.acorns ? `🌰 ${reward.acorns.toLocaleString()}` : ''].filter(Boolean).join(' · ') || '부탁을 들어줬어요')
        },
        setPhoto(on) {
          // 사진 모드는 조금 지나야 열린다(core/unlocks.ts). 나갈 때는 언제든 된다.
          if (on && !systemOpen('photo', ctxOf(get())) && !devUnlocked('photo')) return get().notify('사진 모드는 조금 더 지나면 열려요')
          set(on ? { photo: true } : { photo: false, photoPose: null, photoMood: null, photoFilter: 'basic' })
        },
        setPhotoPose(pose) {
          set({ photoPose: pose })
        },
        setPhotoMood(mood) {
          set({ photoMood: mood })
        },
        setPhotoFilter(filter) {
          set({ photoFilter: filter })
        },
        addAlbumPhoto(src) {
          const s = get()
          const album = addPhoto(s.album, { id: albumId(Date.now(), s.album), day: s.day, src })
          if (!album) {
            s.notify(`앨범이 가득 찼어요(${ALBUM_MAX}장). 한 장 지우고 다시 넣어 볼까요?`)
            return false
          }
          set({ album })
          s.notify('🖼 앨범에 넣었어요')
          return true
        },
        removeAlbumPhoto(id) {
          const s = get()
          set({ album: removePhoto(s.album, id), wallPhoto: s.wallPhoto === id ? null : s.wallPhoto })
        },
        albumOpen: false,
        setAlbumOpen(on) {
          set({ albumOpen: on })
        },
        talkVisitor() {
          const v = runtime.visit
          const vil = v && VILLAGERS.find((x) => x.id === v.villagerId)
          if (!v || !vil) return
          const lines = visitTalk(vil.name, runtime.visitTalks++)
          set({ panel: 'talk', dialog: { villagerId: vil.id, name: vil.name, lines, index: 0, offer: null } })
        },
        startSwim() {
          const s = get()
          if (s.wear.outfit !== 'swim-suit') return s.notify('수영복을 입으면 바다에 들어갈 수 있어요')
          if (runtime.swim) return
          // 물가(모래 위)에 선 채로 들어가니 한 걸음 바다 쪽으로 밀어 준다
          const p = runtime.player
          const r = Math.hypot(p.x, p.z) || 1
          p.x += (p.x / r) * 1.6
          p.z += (p.z / r) * 1.6
          runtime.swim = { t0: now(), wet: false }
          s.notify('🏊 바다에 들어갔어요. 거품 자리에서 E 를 누르면 잠수해요')
        },
        stopSwim() {
          if (!runtime.swim) return
          runtime.swim = null
          get().notify('🏖 물가로 나왔어요')
        },
        diveAt(key) {
          const s = get()
          if (!runtime.swim || runtime.dive) return
          if (runtime.dived.day === s.day && runtime.dived.keys.includes(key)) return s.notify('이 거품은 오늘 다 잡았어요')
          runtime.dive = { t0: now(), key }
          const p = runtime.player
          burst({ kind: 'splash', x: p.x, y: SURFACE_Y, z: p.z })
          setTimeout(() => get().finishDive(), DIVE_SECONDS * 1000)
        },
        finishDive() {
          const d = runtime.dive
          if (!d) return
          runtime.dive = null
          const s = get()
          runtime.dived = { day: s.day, keys: [...(runtime.dived.day === s.day ? runtime.dived.keys : []), d.key] }
          const id = diveResult(s.day, d.key, seasonFor(s.day), isNight(currentHour()))
          const r = addItem(s.inventory, id, 1, s.pocket)
          if (!r.added) return pocketFull('주머니가 가득 찼어요. 잡은 것을 놓고 올라왔어요')
          set({ inventory: r.inv, dex: { ...s.dex, [id]: (s.dex[id] ?? 0) + 1 } })
          // 물 위로 솟아 잡은 것을 들어 보인다
          runtime.show = { itemId: id, t0: now() }
          play('success')
          s.notify(`${ITEMS[id].icon} ${josa(ITEMS[id].name, '을', '를')} 잡았어요!`)
        },
        hangPhoto(id) {
          set({ wallPhoto: sanitizeWall(id, get().album) })
        },
        pickGround(id) {
          const g = get().ground.find((x) => x.id === id)
          if (!g) return
          // 레시피 카드는 주머니에 넣지 않고 바로 읽어서 배운다. 다 알면 팔 수 있게 넣는다.
          if (g.itemId === 'recipe-card' && pickUnknown(get().recipes, Math.random)) {
            delete runtime.drops[id]
            set({ ground: get().ground.filter((x) => x.id !== id) })
            pickedUp(g.itemId, g.x, g.z)
            return get().learnRecipe()
          }
          if (!give(g.itemId)) return
          delete runtime.drops[id]
          set({ ground: get().ground.filter((x) => x.id !== id) })
          pickedUp(g.itemId, g.x, g.z)
          get().notify(`${josa(ITEMS[g.itemId].name, '을', '를')} 주웠어요 ${ITEMS[g.itemId].icon}`)
          for (const [vid, r] of Object.entries(get().requests)) {
            const ar = activeReq(r, get().day)
            if (ar && ar.kind === 'lost' && !ar.done && onPickup(ar, id).done) {
              set({ requests: { ...get().requests, [vid]: onPickup(ar, id) } })
              get().completeReq(vid)
            }
          }
        },
        collectShell(shell) {
          // 유리병: 편지를 읽거나, 지도 조각이면 목표 자리가 적힌 지도로 바뀐다
          if (shell.itemId === 'bottle') {
            get().showFirstHint('bottle')
            const s = get()
            const letter = letterFor(shell.id)
            if (letter.map) {
              const spot = pickTreasure(shell.id, treasureCandidates())
              if (!spot) return s.notify('병 속 지도가 젖어서 읽을 수 없어요')
              const id = mapId(spot.x, spot.z)
              registerMapItem(id)
              const r = addItem(s.inventory, id, 1, s.pocket)
              if (!r.added) return pocketFull('주머니가 가득 찼어요. 병은 두고 왔어요')
              set({ inventory: r.inv, collected: [...s.collected, shell.id] })
              return s.notify('🗺️ 병 속에 보물 지도 조각이 있었어요. 주머니에서 펼쳐 봐요')
            }
            const r = addItem(s.inventory, letterId(letter.index), 1, s.pocket)
            if (!r.added) return pocketFull('주머니가 가득 찼어요. 병은 두고 왔어요')
            set({ inventory: r.inv, collected: [...s.collected, shell.id], stats: { ...s.stats, letter: (s.stats.letter ?? 0) + 1 }, caption: { itemId: letterId(letter.index), text: letter.text, fresh: false } })
            return
          }
          // 표류 소포: 열면 재료나 가구 하나가 든다
          if (shell.itemId === 'parcel') {
            const p = parcelContents(shell.id)
            if (!give(p.itemId, p.count)) return
            set({ collected: [...get().collected, shell.id] })
            bump('shell')
            pickedUp(shell.itemId, shell.x, shell.z)
            return get().notify(`📦 표류 소포를 열었어요. ${ITEMS[p.itemId].icon}${ITEMS[p.itemId].name} ${p.count > 1 ? `×${p.count} ` : ''}을 얻었어요`)
          }
          if (!give(shell.itemId)) return
          set({ collected: [...get().collected, shell.id] })
          bump('shell')
          pickedUp(shell.itemId, shell.x, shell.z)
          get().notify(`${josa(ITEMS[shell.itemId].name, '을', '를')} 주웠어요 ${ITEMS[shell.itemId].icon}`)
        },
        digTreasure(mapItemId) {
          const s = get()
          const spot = parseMapId(mapItemId)
          const inv = removeOne(s.inventory, mapItemId)
          if (!spot || !inv) return
          const furniture = Object.values(ITEMS).filter((d) => d.kind === 'furniture' && (d.buy ?? 0) >= 250).map((d) => d.id)
          const reward = treasureReward(`${mapItemId}:${s.day}`, furniture)
          play('success')
          if ('item' in reward) {
            const r = addItem(inv, reward.item, 1, s.pocket)
            if (r.added) {
              set({ inventory: r.inv })
              return s.notify(`📦 보물 상자에서 ${ITEMS[reward.item].icon} ${josa(ITEMS[reward.item].name, '이', '가')} 나왔어요!`)
            }
          }
          // 가방이 꽉 찼거나 도토리 상자였으면 도토리로 준다
          const money = 'money' in reward ? reward.money : TREASURE_MONEY
          set({ inventory: inv, money: s.money + money })
          s.notify(`📦 보물 상자에서 도토리 ${money.toLocaleString()}개가 나왔어요!`)
        },
        catchBug(bug, speciesId) {
          if (!give(speciesId)) return
          set({ caught: [...get().caught, bug.id] })
          landBug(speciesId)
        },
        catchFirefly(index) {
          if (!give('firefly')) return
          const prev = runtime.fireflyGone[index]
          runtime.fireflyGone[index] = { until: now() + FIREFLY_GONE_S, shift: (prev?.shift ?? 0) + 1 }
          landBug('firefly')
        },
        fishGone(id) {
          if (!get().caught.includes(id)) set({ caught: [...get().caught, id] })
        },
        catchFish(fishId) {
          const def = ITEMS[fishId]
          if (!give(fishId)) return false
          // 대회 판이 도는 동안 잡은 물고기는 마릿수에 든다
          if (runtime.tourney && def.kind === 'fish' && !runOver(runtime.tourney, Date.now())) runtime.tourney = countCatch(runtime.tourney)
          // 낚싯줄 끝에서 손까지 날아오는 시간만큼 기다렸다가 자랑하고 캡션을 띄운다.
          showOff(fishId, CATCH_FLY)
          const fresh = def.kind === 'fish' && record(fishId)
          setTimeout(() => set({ caption: { itemId: fishId, text: catchQuip(fishId), fresh } }), CATCH_FLY * 1000)
          if (def.kind === 'fish') {
            bump('fish')
            countCatchToday('fish')
          }
          if ((FISH_TABLE.find((f) => f.id === fishId)?.habitat ?? 'sea') !== 'sea') bump('fish-fresh')
          return true
        },

        sell(index) {
          const s = get()
          const slot = s.inventory[index]
          if (!slot) return
          const quote = songiNow(s.day, currentHour())
          if (slot.id === SONGI_ID && quote === 0) return s.notify('송이는 월~토에 팔 수 있어요')
          const earned = totalValue([slot], quote)
          set({ money: s.money + earned, inventory: s.inventory.filter((_, i) => i !== index), shopLog: logSold(s.shopLog, [slot]), ...salesPatch(s, saleLines([slot], quote)) })
          play('coin')
          bump('earn', earned)
        },
        sellPicked(indices) {
          const s = get()
          // 공사 중에는 문을 닫으니 팔 수도 없다(상점 판매는 문이 열린 날에만)
          if (upgradeState(s.shop, s.day).status === 'closed') return s.notify(SHOP_CLOSED_TEXT)
          const r = sellSlots(s.inventory, indices, songiNow(s.day, currentHour()))
          if (r.sold.length === 0) return
          set({ money: s.money + r.earned, inventory: r.inv, shopLog: logSold(s.shopLog, r.sold), ...salesPatch(s, saleLines(r.sold, songiNow(s.day, currentHour()))) })
          play('coin')
          s.notify(`${r.sold.length}칸을 팔아 도토리 ${r.earned.toLocaleString()}개를 받았어요`)
          bump('earn', r.earned)
        },
        sortBag() {
          const s = get()
          set({ inventory: sortInventory(s.inventory) })
          play('bag')
          s.notify('주머니를 종류별로 정리했어요')
        },
        setTreasureMap(id) {
          set({ treasureMap: id })
        },
        sellAll() {
          const s = get()
          if (s.inventory.length === 0) return
          if (upgradeState(s.shop, s.day).status === 'closed') return s.notify(SHOP_CLOSED_TEXT)
          // 시세가 없을 때(일요일)는 송이를 가방에 남긴다
          const quote = songiNow(s.day, currentHour())
          const r = sellSlots(s.inventory, s.inventory.map((_, i) => i), quote)
          if (r.sold.length === 0) return
          const earned = r.earned
          set({ money: s.money + earned, inventory: r.inv, shopLog: logSold(s.shopLog, r.sold), ...salesPatch(s, saleLines(r.sold, quote)) })
          play('coin')
          s.notify(`도토리 ${earned.toLocaleString()}개를 받았어요`)
          bump('earn', earned)
        },
        commissionBridge(x, z, rot) {
          const s = get()
          if (s.infra.bridges.length >= BRIDGE_MAX) {
            s.notify('다리는 섬에 네 개까지만 놓을 수 있어요')
            return false
          }
          if (s.money < BRIDGE_COST) {
            s.notify(`다리 공사는 도토리 ${BRIDGE_COST.toLocaleString()}개가 필요해요`)
            return false
          }
          if (!bridgeOk(x, z, rot, s.infra.bridges)) {
            s.notify('여기에는 다리를 놓을 수 없어요')
            return false
          }
          const piece = { id: `bridge-${Date.now().toString(36)}`, x, z, rot, ordered: s.day }
          set({ money: s.money - BRIDGE_COST, infra: { ...s.infra, bridges: [...s.infra.bridges, piece] } })
          bump('spent', BRIDGE_COST)
          play('coin')
          s.notify('다리 공사를 맡겼어요. 내일 아침에 지어져요')
          return true
        },
        commissionStair(plateau, ang) {
          const s = get()
          if (s.infra.stairs.length >= STAIR_MAX) {
            s.notify('계단은 섬에 네 개까지만 놓을 수 있어요')
            return false
          }
          if (s.money < STAIR_COST) {
            s.notify(`계단 공사는 도토리 ${STAIR_COST.toLocaleString()}개가 필요해요`)
            return false
          }
          if (!stairOk(plateau, ang, s.infra.stairs)) {
            s.notify('여기에는 계단을 놓을 수 없어요')
            return false
          }
          const piece = { id: `stair-${Date.now().toString(36)}`, plateau, ang, ordered: s.day }
          set({ money: s.money - STAIR_COST, infra: { ...s.infra, stairs: [...s.infra.stairs, piece] } })
          bump('spent', STAIR_COST)
          play('coin')
          s.notify('계단 공사를 맡겼어요. 내일 아침에 지어져요')
          return true
        },
        removeInfra(id) {
          const s = get()
          const b = s.infra.bridges.find((x) => x.id === id)
          const st = s.infra.stairs.find((x) => x.id === id)
          if (!b && !st) return false
          const back = refundOf(b ? BRIDGE_COST : STAIR_COST)
          set({
            money: s.money + back,
            infra: { ...s.infra, bridges: s.infra.bridges.filter((x) => x.id !== id), stairs: s.infra.stairs.filter((x) => x.id !== id) },
          })
          play('coin')
          s.notify(`정비를 거두고 도토리 ${back.toLocaleString()}개를 돌려받았어요`)
          return true
        },
        buyPathPermit(pay) {
          const s = get()
          if (s.infra.permit) return false
          if (pay === 'acorn' ? s.money < PERMIT_COST : s.miles < PERMIT_MILES) return false
          set({
            ...(pay === 'acorn' ? { money: s.money - PERMIT_COST } : { miles: s.miles - PERMIT_MILES }),
            infra: { ...s.infra, permit: true },
          })
          play('coin')
          s.notify('길 공사 허가를 받았어요. 이제 길을 깔 수 있어요')
          return true
        },
        paintPath(x, z, kind) {
          const s = get()
          if (onStepSpot(x, z)) return s.notify('계단 자리라 길을 깔 수 없어요')
          const r = paintTiles(decodePaths(s.infra.paths), x, z, kind)
          if (r.done === 'full') return s.notify(`길은 ${PATH_MAX}칸까지만 깔 수 있어요`)
          set({ infra: { ...s.infra, paths: encodePaths(r.tiles) } })
          play(r.done === 'added' ? 'pop' : 'coin')
          s.notify(r.done === 'added' ? `${josa(PATH_NAME[kind], '을', '를')} 깔았어요` : '길을 걷어냈어요')
        },
        buyTool(id) {
          const s = get()
          const price = TOOLS[id].price
          if (id === 'hand' || s.tools.includes(id) || s.money < price) return
          if (id === 'ladder' && !systemOpen('ladder', ctxOf(s))) return s.notify('사다리는 조금 더 지나면 상점에서 살 수 있어요')
          set({ money: s.money - price, tools: [...s.tools, id], tool: id })
          bump('spent', price)
          s.notify(`${josa(TOOLS[id].name, '을', '를')} 샀어요! ${TOOLS[id].key}번 키로 꺼낼 수 있어요`)
        },
        buyMarket(id) {
          const s = get()
          const key = s.day
          if (!isMarketDay(key)) return s.notify('장터는 토요일에만 열려요')
          const stock = marketStock(key)
          // 가격과 받을 물건을 정한다. 오늘만 주머니는 열 때 뽑는다.
          const rare = stock.rare.find((r) => r.itemId === id)
          const grants: { itemId: string; count: number }[] =
            id === 'seed' ? [{ itemId: 'flower-seed', count: stock.seed.count }]
              : id === 'mystery' ? [mysteryPick()]
                : rare ? [{ itemId: id, count: 1 }]
                  : []
          if (!grants.length) return s.notify('오늘은 그건 팔지 않아요')
          const price = id === 'seed' ? stock.seed.price : id === 'mystery' ? stock.mystery.price : rare!.price
          if (boughtThisVisit(s.marketBought, key, id)) return s.notify('이번 장날에는 이미 샀어요. 다음 장날에 와요')
          if (s.money < price) {
            play('fail')
            return s.notify('도토리가 모자라요')
          }
          let inv = s.inventory
          for (const g of grants) {
            const r = addItem(inv, g.itemId, g.count, s.pocket)
            if (r.added < g.count) {
              play('fail')
              return pocketFull('주머니가 가득 찼어요. 먼저 팔고 올까요?')
            }
            inv = r.inv
          }
          set({ inventory: inv, money: s.money - price, marketBought: [...s.marketBought, visitKey(key, id)] })
          bump('spent', price)
          play('coin')
          const got = grants.map((g) => `${ITEMS[g.itemId].name}${g.count > 1 ? ` ${g.count}개` : ''}`).join(', ')
          s.notify(id === 'mystery' ? `오늘만 주머니를 열었어요! ${got}` : `${got} 샀어요! 주머니에서 눌러 놓아 봐요`)
        },
        buyItem(itemId, weekly = false) {
          const s = get()
          // 공사 중에는 문을 닫는다. 진열은 오늘 단계의 것만 판다.
          const st = upgradeState(s.shop, s.day)
          if (st.status === 'closed') {
            play('fail')
            return s.notify(SHOP_CLOSED_TEXT)
          }
          const entry = shopStock(st.tier, s.day).find((e) => e.itemId === itemId && !!e.weekly === weekly)
          if (!entry) return s.notify('오늘은 진열하지 않은 물건이에요')
          if (!entry.weekly && isSoldOut(s.shopLog, s.day, itemId)) {
            play('fail')
            return s.notify('오늘 이 물건은 품절이에요. 내일 다시 와요')
          }
          if (entry.weekly && weeklyBoughtOn(s.weeklyBuy, s.day)) {
            play('fail')
            return s.notify('주간 한정 물건은 이번 주에 이미 샀어요. 다음 월요일에 다시 와요')
          }
          if (s.money < entry.price) {
            play('fail')
            return s.notify('도토리가 모자라요')
          }
          const { inv, added } = addItem(s.inventory, itemId, 1, s.pocket, entry.variant)
          if (!added) return pocketFull('주머니가 가득 찼어요. 먼저 팔고 올까요?')
          // 단골 스탬프: 그날 처음 산 날에만 한 칸 찍고, 열 칸이 차면 도토리를 더한다
          const stamp = stampOn(s.stampCard ?? null, s.day)
          set({ money: s.money - entry.price + stamp.reward, inventory: inv, shopLog: !entry.weekly && soldOutApplies(itemId) ? markSoldToday(s.shopLog, s.day, itemId) : s.shopLog, stampCard: stamp.card, ...(entry.weekly ? { weeklyBuy: weekStart(s.day) } : {}) })
          // 스탬프 안내는 구매 토스트에 붙인다. 따로 띄우면 재개장 아침 토스트가 셋을 넘는다.
          s.notify(withStampNote(`${josa(entry.name, '을', '를')} 샀어요!${entry.sale ? ' 특가로 싸게 샀어요' : ''} 주머니에서 눌러 섬에 놓아봐요`, stamp))
          bump('spent', entry.price)
          s.seeShopItem(itemId)
        },
        seeShopItem(itemId) {
          const s = get()
          const next = seeShopNew(s.shopNew ?? null, itemId, s.day)
          if (next !== (s.shopNew ?? null)) set({ shopNew: next })
        },
        donateHouseExpand(villagerId) {
          const s = get()
          if (!expandable(s.home.stage, s.houses, s.expanded ?? [], villagerId)) return
          const cur = s.houseExpand ?? null
          const fund = cur?.villagerId === villagerId ? cur.fund : 0
          // 한 번 누르면 1,000개(남은 값이 더 적으면 그만큼)만 보탠다. 모아 둔 도토리가 한꺼번에 빠지지 않게.
          const amount = houseTapAmount(expandCost(villagerId) - fund, s.money)
          if (amount <= 0) {
            play('fail')
            return s.notify('도토리가 없어서 집 증축을 돕지 못했어요')
          }
          const r = donateHouse(cur, s.money, amount, s.day, villagerId)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ houseExpand: r.state, money: r.money })
          // 섬 살림 '오늘' 줄에 이름을 붙이려고 따로 센다(상점 누계 spent 는 건드리지 않는다)
          bump('spentHouse', amount)
          play('success')
          const name = VILLAGERS.find((v) => v.id === villagerId)?.name ?? villagerId
          s.notify(r.done ? `🏠 ${name}네 집 증축 값이 다 모였어요. 내일 아침에 완성돼요` : `${name}네 집 증축에 도토리 ${amount.toLocaleString()}개를 보탰어요`)
        },
        buyDisplay(itemId, clerk, weekly = false) {
          const s = get()
          const before = isSoldOut(s.shopLog, s.day, itemId)
          s.buyItem(itemId, weekly)
          // 이번에 품절이 새로 기록되었을 때만 점원이 답한다. 돈이나 가방 안내는 buyItem 이 이미 했다.
          if (!before && isSoldOut(get().shopLog, get().day, itemId)) get().thankClerk(clerk)
        },
        thankClerk(id) {
          set({ clerkSay: { id, text: '고마워요!' } })
          setTimeout(() => {
            if (get().clerkSay?.id === id) set({ clerkSay: null })
          }, THANK_SAY_MS)
        },
        orderCatalog(itemId) {
          const s = get()
          const r = checkOrder(itemId, { day: s.day, money: s.money, seen: s.furnitureSeen, orders: s.orders ?? [] })
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ money: s.money - r.price, orders: [...(s.orders ?? []), { itemId, day: s.day }] })
          play('coin')
          s.notify(`📦 ${ITEMS[itemId].name} 주문을 넣었어요. 내일 아침 우체통에 도착해요`)
          bump('spent', r.price)
        },
        buyMonthly() {
          const s = get()
          const st = upgradeState(s.shop, s.day)
          if (st.status === 'closed') {
            play('fail')
            return s.notify('공사 중이라 문을 닫았어요. 내일 다시 열어요')
          }
          const m = monthlyFurniture(s.day)
          if (!m) return
          if (monthlyBoughtOn(s.shopLog, s.day)) return s.notify('이달의 가구는 이번 달에 이미 샀어요. 다음 달에 또 와요')
          if (s.money < m.price) {
            play('fail')
            return s.notify('도토리가 모자라요')
          }
          const { inv, added } = addItem(s.inventory, m.itemId, 1, s.pocket)
          if (!added) return pocketFull('주머니가 가득 찼어요. 먼저 팔고 올까요?')
          set({ money: s.money - m.price, inventory: inv, shopLog: { ...s.shopLog, monthly: monthKey(s.day) } })
          play('coin')
          s.notify(`${m.icon} ${josa(m.name, '을', '를')} 이달의 가구로 샀어요! 주머니에서 눌러 섬에 놓아봐요`)
          bump('spent', m.price)
        },
        buyCanUpgrade(to) {
          const s = get()
          const st = upgradeState(s.shop, s.day)
          if (st.status === 'closed') {
            play('fail')
            return s.notify('공사 중이라 문을 닫았어요. 내일 다시 열어요')
          }
          const r = canBuyUpgrade(s.tools.includes('can'), s.canLevel, st.tier, s.money, to)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ money: s.money - r.price, canLevel: to, tool: 'can' })
          bump('spent', r.price)
          play('coin')
          s.notify(`${josa(CAN_NAMES[to], '을', '를')} 샀어요! ${CAN_SIDE[to]}×${CAN_SIDE[to]} 칸에 한 번에 물을 줘요`)
        },
        // 도구를 바꾸면 놓기 모드도 그만둔다. 꽃씨를 심은 뒤 물뿌리개를 골라도 E 가 계속 심으려 드는 일이 없게.
        equip(id) {
          const s = get()
          if (id === 'hand' || s.tools.includes(id)) set({ tool: id, placing: null, placingVariant: undefined })
        },
        cycleTool() {
          const s = get()
          const owned = TOOL_ORDER.filter((t) => t === 'hand' || s.tools.includes(t))
          set({ tool: owned[(owned.indexOf(s.tool) + 1) % owned.length], placing: null, placingVariant: undefined })
        },

        startPlacing(itemId, variant) {
          // 주머니에 없는 가구로는 놓기 모드에 들어가지 않는다(놓는 순간 말없이 취소되는 일이 없게).
          if (itemId && countOf(get().inventory, itemId) === 0) return get().notify('주머니에 없어요')
          // 집 방 안에서는 방 칸용 놓기 모드를 쓴다. 바깥 섬의 놓기와 따로 둬서 미리보기가 엇갈리지 않게 한다.
          if (get().inHome) {
            if (itemId && ITEMS[itemId].kind === 'seed') return get().notify('방 안에는 꽃씨를 심을 수 없어요')
            return set({ homePlacing: itemId, homePlacingVariant: variant, homePlacingRot: 0, homePlaceCell: null, panel: null })
          }
          set({ placing: itemId, placingVariant: variant, placingRot: 0, placeCell: null, panel: null })
        },
        rotatePlacing() {
          // 울타리는 옆 칸과 이어지는 방향이 고정이라 돌리지 않는다
          if (isFence(get().placing ?? '')) return
          set({ placingRot: (get().placingRot + 1) % 4 })
        },
        placeAt(x, z) {
          const s = get()
          if (isGardenItem(s.placing)) {
            const kind = GARDEN_KIND_OF_ITEM[s.placing]
            const tiles = decodeGarden(s.gardenTiles)
            const why = gardenTileBlocker(x, z, HOME_SITE, s.placed, tiles, { felled: s.felled, day: s.day, holes: s.holes, paths: pathCellsOf(s.infra.paths) })
            if (why) return s.notify(why)
            const r = paintGarden(tiles, x, z, kind)
            if (r.done === 'full') return s.notify(`정원 바닥은 ${GARDEN_TILE_MAX}칸까지만 깔 수 있어요`)
            set({ gardenTiles: encodeGarden(r.tiles) })
            play('pop')
            return s.notify(r.done === 'removed' ? '깐 바닥을 걷어 잔디로 돌렸어요' : `${josa(GARDEN_TILE_NAME[kind], '을', '를')} 깔았어요`)
          }
          const why = placeBlocker(x, z, s.placed, s.plants, { felled: s.felled, day: s.day, holes: s.holes, paths: pathCellsOf(s.infra.paths) }) ?? (s.placing ? fenceBlocker(s.placing, x, z, HOME_SITE) : null)
          if (!s.placing || why) return s.notify(why ?? '여기엔 놓을 수 없어요')
          // 고른 변형의 칸을 빼고, 적는 변형도 그 칸과 같게 맞춘다. 그 변형이 다 나가면 놓기를 끝낸다.
          const pickedVariant = placingVariantOf(s.inventory, s.placing, s.placingVariant)
          const inv = removeOneOf(s.inventory, s.placing, pickedVariant)
          if (!inv) return set({ placing: null, placingVariant: undefined })
          const still = hasVariant(inv, s.placing, pickedVariant) ? s.placing : null
          const stillVariant = still ? pickedVariant : undefined
          if (ITEMS[s.placing].kind === 'seed') {
            const color = FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]
            set({ inventory: inv, plants: [...s.plants, { id: uid('f'), x, z, color, stage: 0, watered: weatherFor(s.day) === 'rain' }], placing: still, placingVariant: stillVariant, placeCell: null })
            s.notify('꽃씨를 심었어요. 물뿌리개로 물을 줘요 🌱')
            // 꽃 심기 주간에는 씨앗마다 보너스 마일을 더한다(하루 상한이 있다)
            const fw = flowerBonus(s.flowerWeek ?? NEW_FLOWER_WEEK, 'plant', 1, s.day)
            if (fw.miles) {
              set({ flowerWeek: fw.state, miles: get().miles + fw.miles })
              s.notify(`🏅 꽃 심기 보너스 +${formatMiles(fw.miles)}`)
            }
            return bump('plant')
          }
          const item: Placed = { id: uid('p'), itemId: s.placing, x, z, rot: isFence(s.placing) ? 0 : s.placingRot, variant: pickedVariant }
          set({ inventory: inv, placed: [...s.placed, item], placing: still, placingVariant: stillVariant, placeCell: null })
          bump('place')
          if (s.placing === 'snowman') stepFestival('snowman')
          // 첫눈 날 눈사람 인형을 놓으면 그 해 눈사람 완성으로 보고, 기념 가구를 편지로 보낸다(한 해에 한 번)
          if (firstSnowCompleted(s.day, s.placing, s.firstSnowWinters ?? [], weatherFor)) {
            const key = winterKeyOf(s.day) ?? s.day
            const rl = firstSnowRewardLetter(s.day)
            set({ firstSnowWinters: cleanFirstSnowWinters([...(get().firstSnowWinters ?? []), key]), letters: [rl, ...get().letters].slice(0, MAILBOX_MAX) })
            get().notify(`❄️ 올해 첫 눈사람을 완성했어요! 편지로 ${josa(ITEMS[FIRST_SNOW_REWARD].name, '을', '를')} 보냈어요`)
          }
        },
        pickUpPlaced(id) {
          const s = get()
          const p = s.placed.find((x) => x.id === id)
          if (!p || !give(p.itemId, 1, p.variant)) return
          set({ placed: get().placed.filter((x) => x.id !== id) })
          s.notify(`${josa(ITEMS[p.itemId].name, '을', '를')} 주머니에 넣었어요`)
        },

        toggleLight(id) {
          const p = get().placed.find((x) => x.id === id)
          if (!p) return
          set({ placed: get().placed.map((x) => (x.id === id ? { ...x, off: !x.off } : x)) })
          play('pop')
          if (!get().night) get().notify(p.off ? `${josa(ITEMS[p.itemId].name, '을', '를')} 켰어요. 밤이 되면 환하게 빛나요` : `${josa(ITEMS[p.itemId].name, '을', '를')} 껐어요`)
        },
        stargaze() {
          const s = get()
          startAct('look')
          if (!s.night) return s.notify('낮이라 별이 안 보여요. 밤에 다시 볼까요? 🔭')
          bump('stars')
          // 가끔 별똥별이 지나가면 소원을 빈다. 마일리지가 조금 쌓인다.
          if (Math.random() < 0.25) {
            play('success')
            set({ miles: get().miles + 50 })
            return gainMileToast(50, '별똥별 소원', '번')
          }
          play('pop')
          s.notify(['별이 총총해요 ✨', '저건 도토리 별자리일까요? ⭐', '달이 동그랗게 떴어요 🌙'][Math.floor(Math.random() * 3)])
        },
        sat(itemId) {
          play('pop')
          get().notify(`${ITEMS[itemId].name}에 앉았어요. 움직이면 일어나요`)
          bump('sit')
          if (get().night) stepFestival('sit')
        },

        build(v) {
          const s = get()
          if (s.houses.includes(v.id)) return false
          const missing = Object.entries(v.cost).filter(([id, n]) => countOf(s.inventory, id) < n)
          if (missing.length) {
            play('fail')
            const list = missing.map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name} ${countOf(s.inventory, id)}/${n}`).join(' · ')
            s.notify(`재료가 모자라요 — ${list}`)
            return false
          }
          let inv = s.inventory
          for (const [id, n] of Object.entries(v.cost)) for (let i = 0; i < n; i++) inv = removeOne(inv, id) ?? inv
          set({ inventory: inv, houses: [...s.houses, v.id] })
          play('build')
          s.notify(v.newcomer ? `🏡 ${josa(v.name, '이', '가')} 이사 왔어요! 인사하러 가볼까요?` : `🏡 ${v.name}의 집이 완성됐어요!`)
          bump(`build:${v.id}`)
          bump('build')
          return true
        },

        talkTo(v) {
          const s = get()
          const firstToday = !s.talked.includes(v.id)
          const extra = firstToday ? befriend(v, 1) : []
          // 여행 섬 손님: 자기소개와 초대 이야기만 한다.
          if (v.guest && !s.houses.includes(v.id)) {
            const nth = (runtime.talks[v.id] = (runtime.talks[v.id] ?? 0) + 1)
            const pending = s.recruits.find((id) => !s.houses.includes(id))
            const g = guestTalk(v, {
              nth,
              invited: s.recruits.includes(v.id),
              waiting: pending ? VILLAGERS.find((o) => o.id === pending)!.name : null,
              day: s.day,
            })
            set({
              talked: firstToday ? [...s.talked, v.id] : s.talked,
              panel: 'talk',
              prompt: null,
              dialog: { villagerId: v.id, name: v.name, lines: [...g.lines, ...extra], index: 0, offer: null, ask: g.ask ? { ...g.ask, sel: Math.max(0, g.ask.options.findIndex((o) => !o.invite)) } : null },
            })
            play('talk')
            if (firstToday) bump('talk')
            return
          }
          const request = dailyRequest(v.id, s.day)
          const requestDone = s.fulfilled.includes(v.id)
          const hasItem = countOf(get().inventory, request) > 0
          const points = get().friendship[v.id] ?? 0
          const level = friendshipLevel(points)
          const nth = (runtime.talks[v.id] = (runtime.talks[v.id] ?? 0) + 1)
          const hour = currentHour()
          const part = dayPart(hour)
          const [hello, ...requestLines] = talkLines(v, { firstToday, level, night: s.night, part, points, request, requestDone, hasItem, nth, inHouse: s.inside === v.id, hour })
          // 그때 상황을 보고 화제를 하나 고른다. 건넬 물건이 있으면 마지막 줄을 그 일에 쓰므로 질문은 하지 않는다.
          const offer = !requestDone && hasItem ? request : null
          // 채운 날과 그다음 날, 오늘 처음 말을 거는 주민이 목표 이야기를 한 번 꺼낸다(목표마다 한 번)
          const afterKey = firstToday ? afterTalkKey(s.afterMilestoneDays ?? {}, s.afterTalkDone ?? [], s.day) : null
          const ctx: ChatContext = {
            v,
            hour,
            part,
            weather: weatherFor(s.day),
            season: seasonFor(s.day),
            level,
            hat: s.wear.hat,
            outfit: s.wear.outfit,
            wornGift: wornGiftOf(s.villagerWear[v.id], s.day, v),
            tool: s.tool,
            pocket: s.inventory.map((x) => x.id),
            home: s.inside === v.id,
            others: presentOthers(v.id, s.houses),
            recent: s.chatLog[v.id] ?? [],
            answered: askedToday.filter((k) => k.startsWith(`${v.id}:${s.day}:`)).map((k) => k.split(':')[2]),
            allowAsk: !offer,
            today: { ...todayTalk({ day: s.day, hour, shop: s.shop, news: s.news, storyChapter: s.storyChapter ?? 0, storyDone: s.storyEnded === true && s.storyEnding === null, weekRecap: recapShownOn(s.day), pumpkinNight: isPumpkinNight(s.day, hour), harvestFair: isHarvestFairDay(s.day), firstSnow: isFirstSnowDay(s.day, weatherFor), playerBirthday: isPlayerBirthday(s.playerBirthday, s.day), milestone: { day: s.day, yesterday: prevDay(s.day), shopUpDay: runtime.milestoneDays.shopUp, loanPaidToday: s.letters.some((l) => l.id === `loan-paid-${s.day}`), homeDoneDay: s.homeNew?.day ?? null, giftDoneDay: runtime.milestoneDays.giftDone, giftOpen: currentGift(s.islandGift ?? NEW_ISLAND_GIFT) !== null } }), birthday: isBirthday(v.id, s.day) },
            birthdayDue: birthdayChatDue(v.id, s.day, firstToday, s.birthdayChatDone ?? []),
            playerBirthdayDue: playerBirthdayTalkDue(s.playerBirthday, s.day, firstToday),
            afterDue: afterKey ?? undefined,
            // 이정표 수다는 그날 처음 말을 걸 때 한 번만 꺼낸다
            milestoneDue: firstToday,
            // 새 섬 요소가 있을 때만 그 주민 화제가 풀에 든다(islandTalk.ts)
            island: { wallpaper: (s.interiorWall ?? 0) !== 0, set: (s.setsDone ?? []).length > 0, ledger: !!s.shopMonth?.settled, stairs: builtStairs(s.infra, s.day).length > 0, facility: (s.islandAcorn?.built ?? 0) > 0, porch: (s.expanded ?? []).flatMap((id) => { const v = VILLAGERS.find((x) => x.id === id); return v ? [{ id, name: v.name }] : [] }) },
          }
          const chat =
            v.voice === 'shout'
              ? gestureChat(ctx, Math.random, ['얍!', '와햐!', '헤에?!', '얍얍!'])
              : v.voice === 'tiny'
                ? gestureChat(ctx, Math.random, ['응…!', '우웅…', '…응?', '히잉…'])
                : pickChat(ctx, Math.random)
          // 호박 등불 밤 저녁에 처음 말 거는 주민은 사탕을 달라고 한다(사탕이 있으면 교환, 없으면 장난).
          const event = pumpkinTalk(s, v, hour) ?? harvestTalk(s, v, hour)
          const lines = [hello, ...(event?.lines ?? [])]
          const living = (o: { id: string; guest?: boolean }) => !o.guest || s.houses.includes(o.id)
          // 생일인 주민은 먼저 생일이라고 하고, 다른 주민은 오늘 생일인 이웃 이야기를 꺼낸다(하루 첫 만남).
          const birthdayToday = isBirthday(v.id, s.day)
          const mentions = firstToday ? VILLAGERS.filter((o) => o.id !== v.id && living(o) && isBirthday(o.id, s.day)).map((o) => birthdayMentionLine(o.name)) : []
          // 말을 전해 달라는 부탁이면 받는 주민과 이야기하며 끝난다. 그다음 이 주민의 오늘 부탁을 연다.
          for (const [senderId, r] of Object.entries(get().requests)) {
            const ar = activeReq(r, s.day)
            if (ar && ar.kind === 'deliver' && !ar.done && onTalk(ar, v.id).done) {
              set({ requests: { ...get().requests, [senderId]: onTalk(ar, v.id) } })
              get().completeReq(senderId)
            }
          }
          get().startReq(v.id)
          const myReq = activeReq(get().requests[v.id], s.day)
          const reqLine = myReq && !myReq.done ? reqText(myReq, (id) => VILLAGERS.find((o) => o.id === id)?.name ?? '') : null
          // 이사 온 뒤 처음 만나면 인사부터 한다. 오렌지 섬에서 데려온 손님은 그 이야기를 꺼낸다.
          const welcome = v.newcomer && s.houses.includes(v.id) && !s.stats[`welcome:${v.id}`]
          if (welcome) {
            // 이사 인사가 첫마디(인사 한 줄)를 대신한다. 행사 줄은 뒤에 그대로 남긴다.
            lines.splice(0, 1, withTic(v.guest ? '오렌지 섬에서 만난 거 기억나? 짠, 진짜로 이사 왔어!' : '짠! 나 이사 왔어. 불러 줘서 정말 고마워!', v.tic), withTic('앞으로 이웃으로 잘 부탁해. 자주 놀러 와!', v.tic))
            extra.push(...befriend(v, 2))
            bump(`welcome:${v.id}`)
            play('success')
          } else if (s.houses.includes(v.id) && firstToday) lines.push(withTic('집 지어줘서 정말 고마워. 매일 아늑하게 지내고 있어!', v.tic))
          // 부탁 이야기는 처음 만났을 때나 물건을 갖고 왔을 때만. 나머지는 수다로 채운다.
          // 질문은 답을 골라야 하니 늘 마지막 줄에 오고, 부탁 이야기는 그 앞에 둔다.
          if (birthdayToday && firstToday) lines.push(birthdayHelloLine(v.tic))
          // 생일 아침 처음 만나면 주인공 머리 위로 색종이를 날린다(파티 연출)
          if (birthdayPartyNow(v.id, s.day, firstToday)) runtime.party[v.id] = true
          // 내일 장날이면 장터 이야기를 한다(하루 첫 만남).
          if (firstToday && marketTomorrow(s.day) && !v.guest) lines.push(withTic('내일은 장날이야! 광장에 떠돌이 상인이 가판대를 편대.', v.tic))
          const fest = festivalOn(s.day)
          if (firstToday && fest && !v.guest) lines.push(withTic(fest.line, v.tic))
          if (firstToday && !v.guest && isMeteorNight(s.day, weatherFor(s.day))) lines.push(withTic(METEOR_LINE, v.tic))
          if (firstToday && !v.guest && rainbowDay(weatherFor(prevDay(s.day)), weatherFor(s.day))) lines.push(withTic(RAINBOW_LINE, v.tic))
          lines.push(...mentions)
          // 이사를 고민 중인 주민은 먼저 고민을 털어놓고, 남을지 보내 줄지 고르게 한다(답은 answer 에서 처리한다).
          const thinking = s.moveTalk?.id === v.id
          if (thinking) lines.splice(0, 0, withTic('요즘 이사를 생각하고 있어. 더 살기 좋은 곳이 있나 봐. 너는 어떻게 생각해?', v.tic))
          // 어제 보낸 편지 이야기. 물건을 동봉했다면 받은 물건 반응은 선물 취향을 그대로 쓴다.
          const letterIn = pendingFor(s.outLetters, v.id, s.day)
          if (letterIn) {
            lines.push(...letterTalkLines(v, letterIn))
            if (letterIn.gift && ITEMS[letterIn.gift]) {
              // 마감 가구면 알아보는 한 줄을 먼저 하고, 그다음 선물 취향 반응을 한다
              const glimpse = finishGlimpse(v, letterIn.giftVariant)
              if (glimpse) lines.push(glimpse)
              lines.push(...giftReaction(v, ITEMS[letterIn.gift].name, letterIn.gift, false).lines)
            }
          }
          if (reqLine) lines.push(withTic(reqLine, v.tic))
          const wantsRequest = firstToday || hasItem || (requestDone && !chat.ask)
          if (chat.ask && wantsRequest) lines.push(...requestLines)
          lines.push(...chat.lines)
          if (!chat.ask && wantsRequest) lines.push(...requestLines)
          set({
            ...(event?.patch ?? {}),
            talked: firstToday ? [...s.talked, v.id] : s.talked,
            outLetters: letterIn ? s.outLetters.map((o) => (o.id === letterIn.id ? { ...o, acked: true } : o)) : get().outLetters,
            chatLog: { ...s.chatLog, [v.id]: rememberTopic(s.chatLog[v.id] ?? [], chat.topic) },
            ...(chat.topic === 'after-milestone' && afterKey ? { afterTalkDone: [...(s.afterTalkDone ?? []), afterKey].slice(-AFTER_TALK_KEEP) } : {}),
            ...(chat.topic === 'birthday-talk' ? { birthdayChatDone: [...(s.birthdayChatDone ?? []), `${s.day}:${v.id}`].slice(-PUMPKIN_KEEP) } : {}),
            panel: 'talk',
            prompt: null,
            // 이사 인사 날엔 인사를 먼저 하고 집들이 선물을 건넨다.
            dialog: {
              villagerId: v.id,
              name: v.name,
              lines: welcome ? [...lines.slice(0, 2), ...extra, ...lines.slice(2)] : [...extra, ...lines],
              index: 0,
              offer,
              ask: thinking ? { ...MOVE_ASK, sel: 0 } : chat.ask ? { ...chat.ask, sel: 0 } : null,
              // 친구 단계 이상이면 같이 낚시하자고 고를 수 있다(물건을 건네는 중이나 질문 중엔 띄우지 않는다)
              choice: null,
              choices: ((): DialogChoice[] | undefined => {
                // 대화 선택지: 친구 단계의 같이 하기, 그리고 집 증축 돕기(내 집 5단계 뒤, 지어진 주민 집만)
                const house = !offer && !chat.ask ? expandOffer(s.home.stage, s.houses, s.expanded ?? [], s.houseExpand ?? null, v.id) : null
                const list: DialogChoice[] = [
                  ...(!offer && !chat.ask && !s.companion && level >= 2 ? COMPANION_CHOICES : []),
                  ...(house ? [{ label: expandChoiceLabel(v.id, house.remaining), action: 'expand-house' as const }] : []),
                ]
                return list.length ? list : undefined
              })(),
            },
          })
          play('talk')
          if (firstToday) bump('talk')
        },
        moveAsk(step) {
          const d = get().dialog
          if (!d?.ask) return
          const n = d.ask.options.length
          set({ dialog: { ...d, ask: { ...d.ask, sel: (d.ask.sel + step + n) % n } } })
          play('pop')
        },
        answer(index) {
          const s = get()
          const d = s.dialog
          const v = VILLAGERS.find((x) => x.id === d?.villagerId)
          if (!d?.ask || !v) return
          const opt = d.ask.options[index ?? d.ask.sel]
          if (!opt) return
          // 질문에 대답하면 오늘은 같은 질문을 다시 하지 않는다.
          if (d.ask.topic) askedToday.push(`${v.id}:${s.day}:${d.ask.topic}`)
          // 대답해 주면 하루 한 번 조금 더 친해진다. 이사 고민에 "같이 있자"고 하면 우정을 두 칸 올린다.
          const key = `${v.id}:${s.day}`
          const amount = opt.stay === true ? 2 : runtime.answered.has(key) ? 0 : 1
          const extra = amount ? befriend(v, amount) : []
          runtime.answered.add(key)
          // 이사 고민에 대답하면 고민이 풀리거나(남음), 떠나는 대로 둔다(응원)
          if (opt.stay !== undefined && get().moveTalk?.id === v.id) set({ moveTalk: opt.stay ? null : get().moveTalk })
          if (opt.invite && !s.recruits.includes(v.id)) {
            // 초대: 도토리섬에 이 손님 집터가 생긴다. 집을 지어 주면 이사 온다.
            set({ recruits: [...s.recruits, v.id] })
            bump('recruit')
            play('success')
            const cost = costLabel(v.cost)
            extra.push(`도토리섬에 ${v.name}네 집터가 생겼어요. 재료(${cost})를 모아 집을 지어 주면 이사 와요!`)
          } else play('talk')
          set({ dialog: { ...d, ask: null, index: 0, lines: [opt.reply, ...extra] } })
        },
        advanceDialog() {
          const d = get().dialog
          if (!d) return
          if (d.index < d.lines.length - 1) {
            play('talk')
            return set({ dialog: { ...d, index: d.index + 1 } })
          }
          set({ dialog: null, panel: null })
        },
        giveRequest() {
          const s = get()
          const d = s.dialog
          const v = VILLAGERS.find((x) => x.id === d?.villagerId)
          if (!d?.offer || !v) return
          const inv = removeOne(s.inventory, d.offer)
          if (!inv) return
          const def = ITEMS[d.offer]
          const reward = def.price * 2
          set({ inventory: inv, money: s.money + reward, fulfilled: [...s.fulfilled, v.id] })
          const extra = befriend(v, 2)
          set({ dialog: { ...d, offer: null, choice: null, index: 0, lines: [v.voice === 'shout' ? `와햐!! (받자마자 냠냠 먹고 도토리 ${reward.toLocaleString()}개를 내민다)` : v.voice === 'tiny' ? `우응…! (기뻐서 볼이 발그레해지며 도토리 ${reward.toLocaleString()}개를 건넨다)` : `와아, 고마워${v.tic}! 답례로 도토리 ${reward.toLocaleString()}개 줄게.`, ...extra] } })
          bump('give')
        },

        giveWear(outfitId) {
          const s = get()
          const d = s.dialog
          const v = VILLAGERS.find((x) => x.id === d?.villagerId)
          if (!d || !v) return
          const block = giftBlockReason(v.id)
          if (block) return s.notify(block)
          const def = WEAR_BY_ID[outfitId]
          if (!s.closet.includes(outfitId) || def?.slot !== 'outfit') return s.notify('옷장에 있는 옷만 선물할 수 있어요')
          const r = wearReaction(v, outfitId)
          set({
            villagerWear: { ...s.villagerWear, [v.id]: { outfit: outfitId, day: s.day } },
            giftDay: { ...s.giftDay, [v.id]: s.day },
          })
          const extra = befriend(v, r.points)
          bump('gift')
          play('coin')
          set({ dialog: { ...d, offer: null, choice: null, ask: null, index: 0, lines: [...r.lines, ...extra] } })
        },
        sendLetter(to, text, paper, enclose, variant) {
          const s = get()
          const v = VILLAGERS.find((x) => x.id === to)
          if (!v) return false
          const checked = checkLetterText(text)
          if (!checked.ok) {
            s.notify(checked.reason)
            return false
          }
          if (!paperOf(paper)) return false
          if (sentToday(s.outLetters, s.day)) {
            s.notify('편지는 하루에 한 통만 보낼 수 있어요. 내일 또 써요')
            return false
          }
          if (s.money < STAMP_COST) {
            s.notify(`우표값 도토리 ${STAMP_COST.toLocaleString()}개가 필요해요`)
            return false
          }
          let inv = s.inventory
          // 동봉은 고른 칸(id+변형)에서 하나를 뺀다. 변형이 없으면 기본 가구 칸이다.
          const giftVariant = enclose ? sanitizeVariant(variant) : undefined
          if (enclose) {
            const next = removeOneOf(inv, enclose, giftVariant)
            if (!next) {
              s.notify('주머니에 그 물건이 없어요')
              return false
            }
            inv = next
          }
          const id = `o${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
          const replyDay = replyDayOf(id, s.day) ?? s.day
          const letter: OutLetter = {
            id,
            to,
            day: s.day,
            text: checked.text,
            paper,
            gift: enclose,
            ...(giftVariant && { giftVariant }),
            replyDay,
            replyText: replyText(v.id, v.name, v.tic, letterFeatures(checked.text), id),
            replied: false,
            acked: false,
          }
          set({ money: s.money - STAMP_COST, inventory: inv, outLetters: pushOut(s.outLetters, letter) })
          befriend(v, LETTER_FRIENDSHIP)
          play('pop')
          get().notify(`${v.name}에게 편지를 보냈어요. 답장은 ${replyDay}쯤 올 거예요`)
          return true
        },
        giveGift(itemId, variant) {
          const s = get()
          const d = s.dialog
          const v = VILLAGERS.find((x) => x.id === d?.villagerId)
          if (!d || !v) return
          const block = giftBlockReason(v.id)
          if (block) return s.notify(block)
          const inv = removeOneOf(s.inventory, itemId, variant)
          if (!inv) return s.notify('주머니에 그 물건이 없어요')
          const birthday = isBirthday(v.id, s.day)
          const r = giftReaction(v, ITEMS[itemId].name, itemId, birthday)
          // 좋아하는 선물(사랑·좋아함)은 대화를 닫아도 1.8초 동안 기쁜 표정을 유지한다(Villagers 의 react 표정)
          if (r.taste === 'love' || r.taste === 'like') runtime.react = { id: v.id, mood: 'happy', t0: now() }
          set({ inventory: inv, giftDay: { ...s.giftDay, [v.id]: s.day } })
          if (birthday) set({ birthdayThanks: [...get().birthdayThanks, { villagerId: v.id, giftDay: s.day, present: presentFor(v.gifts, s.day, v.id) }] })
          // 요리를 선물하면 우정이 더 오른다
          const extra = befriend(v, r.points + (isDish(itemId) ? DISH_GIFT_BONUS : 0))
          bump('gift')
          play(birthday ? 'success' : 'coin')
          // 생일 선물은 색종이로 축하한다
          if (birthday) runtime.party[v.id] = true
          set({ dialog: { ...d, offer: null, choice: null, ask: null, index: 0, lines: [...r.lines, ...extra] } })
        },

        craftItem(recipeId) {
          const s = get()
          const r = RECIPE_BY_ID[recipeId]
          if (!r || !s.recipes.includes(recipeId)) return
          const inv = craft(r, s.inventory, s.pocket)
          if (!inv) {
            play('fail')
            return s.notify('재료가 모자라거나 주머니가 꽉 찼어요')
          }
          set({ inventory: inv })
          startAct('hit')
          play('chop')
          setTimeout(() => play('success'), 260)
          s.notify(`${josa(ITEMS[recipeId].name, '을', '를')} 만들었어요! ${ITEMS[recipeId].icon}`)
          bump('craft')
        },
        learnRecipe(id) {
          const s = get()
          const pick = id ?? pickUnknown(s.recipes, Math.random)
          if (!pick || s.recipes.includes(pick)) return s.notify('이미 아는 레시피예요')
          set({ recipes: [...s.recipes, pick] })
          play('success')
          s.notify(`📃 새 레시피: ${ITEMS[pick].name} ${ITEMS[pick].icon} — 작업대에서 만들 수 있어요`)
        },
        exchange(id) {
          const s = get()
          const r = MILE_SHOP.find((x) => x.id === id)
          if (!r || s.miles < r.cost) return
          if (id === 'pocket') {
            if (s.pocket >= POCKET_MAX) return s.notify('주머니는 이미 가장 커요')
            set({ miles: s.miles - r.cost, pocket: s.pocket + 10 })
            play('success')
            return s.notify(`👜 주머니가 ${s.pocket + 10}칸이 됐어요`)
          }
          if (id === 'recipe') {
            if (!pickUnknown(s.recipes, Math.random)) return s.notify('모든 레시피를 알고 있어요')
            set({ miles: s.miles - r.cost })
            return get().learnRecipe()
          }
          const { inv, added } = addItem(s.inventory, id, 1, s.pocket)
          if (!added) return pocketFull('주머니가 가득 찼어요')
          set({ miles: s.miles - r.cost, inventory: inv })
          play('coin')
          s.notify(`${r.icon} ${josa(r.name, '을', '를')} 받았어요`)
        },
        talkPelican(dock) {
          const s = get()
          if (s.traveling) return
          play('talk')
          const home = dock.id === 'home'
          const tickets = countOf(s.inventory, 'trip-ticket')
          const lines = home
            ? tickets > 0
              ? ['펠리예요, 꾸룩! 여행 티켓을 갖고 있네요.', '오렌지가 주렁주렁한 섬으로 날아가 볼까요? 꾸룩!']
              : ['펠리예요, 꾸룩! 저는 다른 섬까지 태워 주는 일을 해요.', '여행 티켓이 있으면 언제든 불러 줘요. 티켓은 마일리지 교환소(M)에서 바꿀 수 있어요.']
            : ['재미있게 놀았어요? 꾸룩!', '도토리섬으로 돌아갈 준비가 되면 말해 줘요.']
          const choice = home ? (tickets > 0 ? { label: '🎫 티켓 내고 출발', action: 'trip-go' as const } : null) : { label: '⛵ 집으로 돌아가기', action: 'trip-back' as const }
          set({ panel: 'talk', prompt: null, dialog: { villagerId: 'pelican', name: '펠리', lines, index: 0, offer: null, choice } })
        },
        startCompanion(villagerId, mode = 'fish') {
          const s = get()
          if (s.companion) return s.notify('이미 같이 다니는 친구가 있어요')
          const v = VILLAGERS.find((x) => x.id === villagerId)
          if (!v) return
          const t = Date.now()
          set({ companion: { villagerId, until: t + COMPANION_MS, nextBite: t + biteDelaySeconds(Math.random) * 1000, catches: [], mode, clapAt: 0 } })
          s.notify(mode === 'fish' ? `🎣 ${josa(v.name, '이', '가')} 30분 동안 같이 낚시해요` : `🦋 ${josa(v.name, '이', '가')} 30분 동안 같이 벌레를 잡아요`)
        },
        recordCompanionCatch(fishId) {
          const c = get().companion
          if (!c) return
          const name = VILLAGERS.find((x) => x.id === c.villagerId)?.name ?? '주민'
          set({ companion: { ...c, catches: [...c.catches, fishId], nextBite: Date.now() + biteDelaySeconds(Math.random) * 1000 } })
          get().notify(`${josa(name, '이', '가')} ${ITEMS[fishId].icon} ${josa(ITEMS[fishId].name, '을', '를')} 잡았어요`)
        },
        tickCompanion() {
          const s = get()
          const c = s.companion
          if (!c) return
          // 시간이 다 됐거나 집에 들어가거나 여행을 떠나면 그 자리에서 끝난다
          if (companionRemaining(c.until, Date.now()) <= 0 || s.inHome || s.traveling) get().endCompanion()
        },
        endCompanion() {
          const s = get()
          const c = s.companion
          if (!c) return
          const name = VILLAGERS.find((x) => x.id === c.villagerId)?.name ?? '주민'
          const before = s.friendship[c.villagerId] ?? 0
          set({ companion: null, friendship: { ...s.friendship, [c.villagerId]: before + COMPANION_FRIENDSHIP } })
          const gift = companionGift(c.catches)
          if (!gift) return s.notify(`${josa(name, '과', '와')} 같이 낚시를 마쳤어요. 오늘은 못 잡았지만 더 친해졌어요`)
          const r = addItem(get().inventory, gift, 1, get().pocket)
          if (!r.added) return s.notify(`${josa(name, '과', '와')} 같이 낚시를 마쳤어요. 주머니가 꽉 차서 선물은 받지 못했어요`)
          set({ inventory: r.inv })
          play('success')
          s.notify(`${josa(name, '이', '가')} ${ITEMS[gift].icon} ${josa(ITEMS[gift].name, '을', '를')} 선물로 줬어요`)
        },
        chooseDialog(action) {
          const s = get()
          const picked = action ?? s.dialog?.choice?.action ?? s.dialog?.choices?.[0]?.action
          if (!picked || s.traveling) return
          if (picked === 'expand-house') {
            const v = s.dialog?.villagerId
            set({ dialog: null, panel: null })
            if (v) get().donateHouseExpand(v)
            return
          }
          if (picked === 'fish-along' || picked === 'bug-along') {
            const v = s.dialog?.villagerId
            set({ dialog: null, panel: null })
            if (v) get().startCompanion(v, picked === 'fish-along' ? 'fish' : 'bug')
            return
          }
          const c = { action: picked }
          if (c.action === 'trip-go') {
            const inv = removeOne(s.inventory, 'trip-ticket')
            if (!inv) return
            set({ inventory: inv })
            bump('trip')
          }
          const dest = DOCKS.find((d) => d.id === (c.action === 'trip-go' ? 'trip' : 'home'))!
          set({ dialog: null, panel: null, traveling: true })
          play('swish')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const p = runtime.player
            p.x = dest.arrive.x
            p.z = dest.arrive.z
            p.facing = dest.arrive.facing
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            // 떠나기 전 휘두르던 동작의 남은 효과가 도착한 섬에서 터지지 않게 비운다.
            runtime.impacts.length = 0
            runtime.shake = null
            // 여행 섬에 갈 때마다 아직 안 온 손님 몇 명이 다른 자리에 놀러 와 있다.
            const st = get()
            const tripGuests = dest.id === 'trip' ? tripGuestsFor(`${st.day}:${st.stats.trip ?? 0}:${Math.random()}`, [...st.recruits, ...st.houses]) : []
            set({ traveling: false, tripGuests, island: dest.id === 'trip' ? 'trip' : 'home' })
            const names = tripGuests.map((g) => VILLAGERS.find((v) => v.id === g.id)!.name)
            get().notify(
              dest.id === 'trip'
                ? names.length
                  ? `🏝️ 오렌지 섬에 도착했어요! ${[...names.slice(0, -1), josa(names[names.length - 1], '이', '가')].join('·')} 놀러 와 있어요`
                  : '🏝️ 오렌지 섬에 도착했어요! 부두의 펠리에게 말하면 돌아가요'
                : '🏡 도토리섬으로 돌아왔어요',
            )
          }, 700)
        },

        enterHouse(villagerId) {
          const i = VILLAGERS.findIndex((v) => v.id === villagerId)
          const v = VILLAGERS[i]
          if (!v || !get().houses.includes(v.id)) return
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const c = roomCenter(i)
            const p = runtime.player
            p.x = c.x + ROOM_ENTRY.x
            p.z = c.z + ROOM_ENTRY.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            set({ inside: v.id, doorFade: false })
            if (!isHomeAt(v, currentHour(), get().houses)) get().notify(`${josa(v.name, '은', '는')} 산책 나갔나 봐요. 살짝 구경만 할까요?`)
          }, 420)
        },
        leaveHouse() {
          const v = VILLAGERS.find((x) => x.id === get().inside)
          if (!v) return
          set({ doorFade: true, prompt: null })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            p.x = v.house.x + Math.sin(v.house.rot) * (HOUSE_R + 1)
            p.z = v.house.z + Math.cos(v.house.rot) * (HOUSE_R + 1)
            p.facing = v.house.rot
            runtime.snapCamera = true
            set({ inside: null, doorFade: false })
          }, 420)
        },
        closeCaption() {
          if (get().caption) set({ caption: null })
        },
        toggleBag(open) {
          const next = open ?? !get().bagOpen
          if (next !== get().bagOpen) play('bag')
          set({ bagOpen: next })
        },
        openCloset(shop) {
          if (!get().panel) play('open')
          set({ panel: 'closet', closetShop: shop, prompt: null, dialog: null, bagOpen: false })
        },
        buyWear(id) {
          const s = get()
          const w = WEAR_BY_ID[id]
          if (!w || s.closet.includes(id) || !s.closetShop) return
          if (s.shop.tier < (w.minTier ?? 0)) return s.notify('상점을 더 키우면 살 수 있어요')
          if (s.money < w.price) {
            play('fail')
            return s.notify('도토리가 모자라요')
          }
          set({ money: s.money - w.price, closet: [...s.closet, id] })
          bump('spent', w.price)
          play('coin')
          s.notify(`${w.icon} ${josa(w.name, '을', '를')} 샀어요!`)
          get().putOn(id)
        },
        putOn(id) {
          const s = get()
          if (id === null) {
            runtime.dress = { t0: now() }
            return set({ wear: { ...s.wear, hat: null } })
          }
          const w = WEAR_BY_ID[id]
          if (!w || !s.closet.includes(id)) return
          set({ wear: w.slot === 'hat' ? { ...s.wear, hat: s.wear.hat === id ? null : id } : { ...s.wear, outfit: id } })
          // 갈아입기 연출: 제자리에서 한 바퀴 돌고, 연기 속에서 옷이 바뀐다(Player 가 DRESS_SWAP 뒤에 새 옷을 그린다)
          runtime.dress = { t0: now() }
          play('pop')
        },
        readLetter(id) {
          set({ letters: get().letters.map((l) => (l.id === id ? { ...l, read: true } : l)) })
        },
        makeWish() {
          const s = get()
          if (s.wishNight === s.day) return s.notify('오늘 밤 소원은 이미 빌었어요')
          set({ wishNight: s.day })
          play('success')
          s.notify('✨ 별똥별에 소원을 빌었어요. 내일 아침 좋은 소식이 올지도 몰라요')
        },
        startTourney() {
          const s = get()
          const hour = currentHour()
          if (!tourneyWindow(s.day, hour)) return s.notify('낚시 대회는 일요일 9시부터 6시 전까지 열려요')
          if (runtime.tourney) return s.notify('대회가 진행 중이에요')
          if (s.tourney.lastDay === s.day) return s.notify('오늘은 이미 대회에 나갔어요. 내일 또 나와요')
          if (!canJoin(s.tourney, s.day, hour, false)) return
          runtime.tourney = startRun(s.day, Date.now())
          set({ tourney: { ...s.tourney, lastDay: s.day } })
          play('pop')
          s.notify('🎣 낚시 대회 시작! 3분 동안 잡은 물고기를 세요')
        },
        finishTourney() {
          const s = get()
          const run = runtime.tourney
          if (!run) return
          const now = Date.now()
          // 시간이 다 됐거나, 대회 시간이 끝났으면 지금까지 잡은 것으로 마친다
          if (!runOver(run, now) && tourneyWindow(s.day, currentHour())) return
          runtime.tourney = null
          const next = finishRun(s.tourney, run)
          set({ tourney: next })
          play('success')
          s.notify(`🏁 대회 끝! ${run.count}마리 · ${medalOf(run.count)} · 포인트 +${next.points - s.tourney.points}`, true)
        },
        exchangeTourney(id) {
          const s = get()
          const r = canExchange(id, s.tourney.points)
          if (!r.ok) return s.notify(r.reason)
          if (!give(id)) return
          set({ tourney: { ...get().tourney, points: get().tourney.points - r.cost } })
          play('success')
          s.notify(`${ITEMS[id].icon} ${josa(ITEMS[id].name, '을', '를')} 받았어요`)
        },
        saveDesign(cells, id) {
          const s = get()
          const cellsStr = encodeCells(cells)
          if (id) {
            if (!s.designs.some((d) => d.id === id)) return null
            set({ designs: s.designs.map((d) => (d.id === id ? { ...d, cells: cellsStr } : d)) })
            play('pop')
            s.notify('디자인을 고쳐 저장했어요')
            return id
          }
          const nid = newDesignId()
          const next = addDesign(s.designs, { id: nid, name: nextDesignName(s.designs), cells: cellsStr })
          if (!next) {
            s.notify('디자인은 여섯 장까지 저장할 수 있어요. 하나 지우고 저장해요')
            return null
          }
          set({ designs: next })
          play('success')
          s.notify(`${josa(next[next.length - 1].name, '을', '를')} 저장했어요`)
          return nid
        },
        deleteDesign(id) {
          const s = get()
          const name = s.designs.find((d) => d.id === id)?.name
          if (!name) return
          set({
            designs: s.designs.filter((d) => d.id !== id),
            ...(s.flagDesign === id && { flagDesign: null }),
            ...(s.shirtDesign === id && { shirtDesign: null }),
          })
          s.notify(`${josa(name, '을', '를')} 지웠어요`)
        },
        setFlagDesign(id) {
          const s = get()
          if (id && !s.designs.some((d) => d.id === id)) return
          set({ flagDesign: id })
          play('pop')
          s.notify(id ? '광장 깃발에 디자인을 달았어요' : '광장 깃발을 기본 색으로 돌렸어요')
        },
        setShirtDesign(id) {
          const s = get()
          if (id && !s.designs.some((d) => d.id === id)) return
          set({ shirtDesign: id })
          play('pop')
          s.notify(id ? '무지 티셔츠에 디자인을 입혔어요' : '무지 티셔츠를 무늬 없이 돌렸어요')
        },
        reformFurniture(src, variant) {
          const s = get()
          if (s.shop.tier < REFORM_TIER) {
            s.notify('리폼 코너는 상점이 두 단계로 커지면 열려요')
            return false
          }
          const target = src.from === 'bag' ? s.inventory[src.index] : src.from === 'storage' ? s.homeStorage[src.index] : s.homeFurniture.find((x) => x.id === src.id)
          if (!target) return false
          if (target.variant === variant) {
            s.notify('이미 그 색이에요')
            return false
          }
          const itemId = 'itemId' in target ? target.itemId : target.id
          const r = canReform(itemId, variant, s.money, countOf(s.inventory, 'wood'), s.shop.tier)
          if (!r.ok) {
            s.notify(r.reason)
            return false
          }
          // 가구 칸·방 가구에 변형을 적고, 목재는 주머니에서 뺀다. 칸 순서는 변형 적용 뒤에 바꾸므로 지금 인덱스가 맞다.
          const marked = src.from === 'bag'
            ? s.inventory.map((x, i) => (i === src.index ? { ...x, variant } : x))
            : s.inventory
          const inv = removeOne(marked, 'wood')
          if (!inv) return false
          const homeFurniture = src.from === 'home' ? s.homeFurniture.map((x) => (x.id === src.id ? { ...x, variant } : x)) : s.homeFurniture
          const homeStorage = src.from === 'storage' ? s.homeStorage.map((x, i) => (i === src.index ? { ...x, variant } : x)) : s.homeStorage
          set({ inventory: inv, homeFurniture, homeStorage, money: s.money - r.acorns })
          bump('spentReform', r.acorns)
          play('pop')
          s.notify(`${josa(ITEMS[itemId].name, '을', '를')} ${variantById(variant)?.name ?? variant} 색으로 바꿨어요`)
          return true
        },
        seeConstellation(id) {
          const s = get()
          if (!isNewSighting(s.starsSeen, id)) return false
          const seen = [...s.starsSeen, id]
          set({ starsSeen: seen })
          play('coin')
          s.notify(`✨ ${CONSTELLATIONS.find((c) => c.id === id)?.name ?? '별자리'} 자리를 도감에 기록했어요`)
          // 열두 개를 다 보면 편지로 별 모양 조명을 보낸다(편지의 선물로 받는다)
          if (starsComplete(seen)) {
            set({ letters: [starsLetter(s.day), ...get().letters].slice(0, MAILBOX_MAX) })
            s.notify('별자리 열두 개를 다 봤어요! 편지를 확인해 보세요')
          }
          return true
        },
        seeRainbow() {
          const s = get()
          if (s.rainbowSeen) return
          set({ rainbowSeen: true })
          play('coin')
          s.notify('🌈 무지개를 봤어요')
        },
        watchFireworks() {
          const s = get()
          if (!s.night) return s.notify('불꽃은 밤에 터져요')
          stepFestival('sit')
          s.notify('불꽃이 잘 보이는 자리예요. 움직이면 일어나요')
        },
        festivalOffer(itemId) {
          const s = get()
          const f = festivalOn(s.day)
          if (!f || f.task !== 'offer' || s.festival.claimed.includes(s.day)) return s.notify('지금은 바칠 수 있는 축제가 없어요')
          if (ITEMS[itemId]?.kind !== 'fruit') return s.notify('과일만 바칠 수 있어요')
          const offered = s.festival.day === s.day ? s.festival.offered : []
          const inv = removeOne(s.inventory, itemId)
          if (!inv) return s.notify(`${josa(ITEMS[itemId].name, '이', '가')} 없어요`)
          const next = [...offered, itemId]
          set({ inventory: inv, festival: { day: s.day, n: next.length, offered: next, claimed: s.festival.claimed } })
          play('pop')
          s.notify(`${josa(ITEMS[itemId].name, '을', '를')} 바쳤어요 (${next.length}/${f.target})`)
          if (festivalDone(f, next.length)) claimFestival(f)
        },
        claimLetter(id) {
          const s = get()
          const l = s.letters.find((x) => x.id === id)
          if (!l?.gift || l.claimed) return
          if (!give(l.gift)) return
          set({ letters: get().letters.map((x) => (x.id === id ? { ...x, claimed: true, read: true } : x)) })
          play('success')
          s.notify(`${ITEMS[l.gift].icon} ${josa(ITEMS[l.gift].name, '을', '를')} 받았어요`)
        },

        upgradeShop() {
          const s = get()
          // 공사 중에 누르면 남은 날을 알려 준다(버튼이 눌려야 안내가 뜬다)
          if (s.shop.order) {
            const left = shopDaysLeft(s.shop.order.day, s.day)
            if (left > 0) return s.notifyBuild(shopPendingText(tierDef(s.shop.order.to).name, left))
          }
          const r = startUpgrade(s.shop, { sold: s.stats.earn ?? 0, spent: s.stats.spent ?? 0, questsDone: s.questsDone, stars: s.rating.stars }, s.money, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ money: s.money - r.cost, shop: r.state })
          play('build')
          s.notifyBuild(`🚧 ${tierDef(r.to).name} 공사를 시작했어요. 내일은 문을 닫고 모레 새 간판을 달아요`)
        },
        orderHome() {
          const s = get()
          const r = startHomeUpgrade(s.home, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ home: r.state, loanHistory: recordBorrow(s.loanHistory ?? EMPTY_LOAN_HISTORY, r.state.loan) })
          play('build')
          s.notifyBuild(`🏗️ ${homeDef(r.to).name} 짓기를 맡겼어요. 대출 도토리 ${r.state.loan.toLocaleString()}개는 ATM에서 갚아요. 내일 아침 완성돼요`)
        },
        buySongi(bundles = 1) {
          const s = get()
          if (!songiOpen(s.day, currentHour())) return s.notify('송이 상인은 일요일 아침 5시부터 12시까지만 있어요')
          const week = songiWeekOf(s.day)
          if (!week) return
          const left = songiBundlesLeft(s.songiBuy ?? null, week)
          if (left < 1) return s.notify('이번 주 송이는 다 샀어요. 다음 일요일에 다시 와요')
          const n = Math.min(Math.max(1, Math.floor(bundles)), left)
          const cost = n * SONGI_BUNDLE_PRICE
          if (s.money < cost) {
            play('fail')
            return s.notify(`도토리가 ${cost.toLocaleString()}개 필요해요`)
          }
          const count = n * SONGI_BUNDLE
          const { inv, added } = addItem(s.inventory, SONGI_ID, count, s.pocket)
          if (added < count) {
            play('fail')
            return s.notify('주머니에 송이 넣을 자리가 모자라요. 몇 개 내려놓고 다시 와 볼까요?')
          }
          const used = s.songiBuy?.week === week ? s.songiBuy.n : 0
          set({ inventory: inv, money: s.money - cost, songiBuy: { week, n: used + n } })
          play('coin')
          s.notify(`송이 ${count}개를 샀어요. 다음 일요일이 되면 상해요`)
        },
        setPlayerBirthday(bd) {
          const clean = cleanPlayerBirthday(bd)
          set({ playerBirthday: clean })
          get().notify(clean ? `🎂 내 생일을 ${clean.month}월 ${clean.day}일로 정했어요` : '🎂 내 생일을 지웠어요')
        },

        buyGardenPermit(by) {
          const s = get()
          if (s.gardenPermit) return s.notify('정원 꾸미기 허가는 이미 받았어요')
          if (!HOME_SITE) return s.notify('집이 있어야 정원을 꾸밀 수 있어요')
          if (by === 'money' && s.money < GARDEN_PERMIT.money) {
            play('fail')
            return s.notify(`도토리가 ${GARDEN_PERMIT.money.toLocaleString()}개 필요해요`)
          }
          if (by === 'miles' && s.miles < GARDEN_PERMIT.miles) {
            play('fail')
            return s.notify(`${formatMiles(GARDEN_PERMIT.miles)} 필요해요`)
          }
          const { inv, added } = addItem(s.inventory, 'fence', GARDEN_PERMIT.pieces, s.pocket)
          if (added === 0) {
            play('fail')
            return s.notify('주머니가 가득 찼어요. 몇 개 내려놓고 다시 와 볼까요?')
          }
          set({
            inventory: inv,
            gardenPermit: true,
            money: by === 'money' ? s.money - GARDEN_PERMIT.money : s.money,
            miles: by === 'miles' ? s.miles - GARDEN_PERMIT.miles : s.miles,
          })
          play('build')
          s.notify(`정원 꾸미기 허가를 받았어요. 울타리 ${GARDEN_PERMIT.pieces}개를 주머니에 넣었어요`)
        },
        buyFence(kind) {
          const s = get()
          if (!s.gardenPermit) return s.notify('정원 꾸미기 허가부터 받아요')
          const price = FENCE_FOR_SALE[kind] ?? 0
          if (s.money < price) {
            play('fail')
            return s.notify(`도토리가 ${price.toLocaleString()}개 필요해요`)
          }
          const { inv, added } = addItem(s.inventory, kind, FENCE_PIECES, s.pocket)
          if (added === 0) {
            play('fail')
            return s.notify('주머니가 가득 찼어요. 몇 개 내려놓고 다시 와 볼까요?')
          }
          set({ inventory: inv, money: s.money - price })
          play('pop')
          s.notify(`${ITEMS[kind].name} ${FENCE_PIECES}개를 주머니에 넣었어요`)
        },
        paintHome(part, index) {
          const s = get()
          if (s.home.stage === 0) return s.notify('작은 집부터 바깥 색을 바꿀 수 있어요')
          if (s.home.order) return s.notify('짓는 중에는 색을 고를 수 없어요')
          const opt = PAINT_OPTIONS[part][index]
          if (!opt) return
          const cur = s.homePaint ?? DEFAULT_PAINT
          if (cur[part] === index) return s.notify(`이미 ${opt.name} 색이에요`)
          const price = PAINT_COST[part]
          if (s.money < price) {
            play('fail')
            return s.notify(`도토리가 ${price.toLocaleString()}개 필요해요`)
          }
          set({ homePaint: { ...cur, [part]: index }, money: s.money - price, homePaintAt: Date.now() })
          play('build')
          s.notify(`${josa(PAINT_PART_NAME[part], '을', '를')} ${opt.name} 색으로 바꿨어요 · 🌰 ${price.toLocaleString()}`)
        },
        paintInterior(index) {
          const s = get()
          if (s.home.stage === 0) return s.notify('집이 생긴 뒤에 벽지를 고를 수 있어요')
          if (s.home.order) return s.notify('짓는 중에는 벽지를 고를 수 없어요')
          const opt = INTERIOR_WALLS[index]
          if (!opt) return
          if (s.interiorWall === index) return s.notify(`이미 ${opt.name} 벽지예요`)
          if (s.money < INTERIOR_WALL_COST) {
            play('fail')
            return s.notify(`도토리가 ${INTERIOR_WALL_COST.toLocaleString()}개 필요해요`)
          }
          set({ interiorWall: index, money: s.money - INTERIOR_WALL_COST })
          play('build')
          s.notify(`방 벽지를 ${opt.name} 색으로 바꿨어요 · 🌰 ${INTERIOR_WALL_COST.toLocaleString()}`)
        },
        startGardenPaint(kind) {
          const s = get()
          if (!s.gardenPermit) return s.notify('정원 꾸미기 허가부터 받아요')
          set({ placing: GARDEN_ITEM[kind], placingVariant: undefined, placingRot: 0, placeCell: null, panel: null })
          s.notify(`${GARDEN_TILE_NAME[kind]} · E 로 바라보는 칸에 깔아요. 같은 칸에서 한 번 더 E 하면 걷어요`)
        },
        enterHome() {
          if (!HOME_SITE) return
          // 완성된 날 처음 들어갈 때 한 번 안내한다(가구 칸이 얼마로 늘었는지 함께)
          const greet = newHomeGreeting(get().homeNew ?? null, get().day, get().home.stage)
          if (greet) {
            set({ homeNew: greet.next })
            // 문 앞에서 들어온 것에 바로 답하는 안내라, 쌓인 편지 알림보다 먼저 보인다
            get().notify(greet.text, true)
          }
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const c = roomCenter(HOME_ROOM)
            const p = runtime.player
            const entry = entryOf(HOME_ROOM_SIZES[get().home.stage])
            p.x = c.x + entry.x
            p.z = c.z + entry.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            setHomeFloor(0)
            set({ inHome: true, doorFade: false, placing: null, placingVariant: undefined, homeFloor: 0 })
          }, 420)
        },
        leaveHome() {
          const site = HOME_SITE
          if (!site) return
          set({ doorFade: true, prompt: null, homePlacing: null, homePlacingVariant: undefined })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            p.x = site.door.x
            p.z = site.door.z
            // 현관에서 집 쪽을 본다
            p.facing = site.rot + Math.PI
            runtime.snapCamera = true
            setHomeFloor(0)
            set({ inHome: false, doorFade: false, homeFloor: 0 })
          }, 420)
        },
        climbHome() {
          const s = get()
          if (!hasAttic(s.home.stage)) return
          const up = s.homeFloor === 0
          const floor = up ? 1 : 0
          const c = roomCenter(HOME_ROOM)
          const p = runtime.player
          // 사다리 위나 아래의 서는 자리로 옮긴다. 층이 바뀌니 가구 부딪힘도 같이 바꾼다.
          p.x = c.x + ATTIC.ladderX
          p.z = c.z + (up ? ATTIC.climbZ : ATTIC.descendZ)
          runtime.snapCamera = true
          const first = isFirstRoomVisit(s.homeNew ?? null, floor)
          setHomeFloor(floor)
          set({ homeFloor: floor })
          roomSolids.home = homeSolids(s.homeFurniture, s.home.stage, floor)
          play('pop')
          s.notify(floorArrivalText(up ? 0 : 1, floor, up && first))
        },
        moveHomeArea(to) {
          const s = get()
          const move = HOME_MOVES.find((m) => m.from === s.homeFloor && m.to === to)
          if (!move || !floorOpen(s.home.stage, to)) return
          const c = roomCenter(HOME_ROOM)
          const p = runtime.player
          // 처음 가는 새 방인지는 방에 들어가 기록하기 전에 본다
          const first = isFirstRoomVisit(s.homeNew ?? null, to)
          // 문이나 계단 앞에서 옮겨 간다. 자리가 바뀌니 가구 부딪힘도 그 자리 것으로 바꾼다.
          p.x = c.x + move.arrive.x
          p.z = c.z + move.arrive.z
          runtime.snapCamera = true
          setHomeFloor(to)
          set({ homeFloor: to })
          play('pop')
          // 토스트 문구는 실제 이동 방향에 맞춘다. 줄에 남은 옛 이동 알림은 지워서 방향이 어긋난 문구가 뒤늦게 뜨지 않게 한다.
          const text = floorArrivalText(s.homeFloor, to, first)
          const now = get()
          const moved = (t: { text: string } | null) => !!t && isAreaArrivalText(t.text)
          set({ toast: moved(now.toast) ? null : now.toast, toastQueue: now.toastQueue.filter((t) => !isAreaArrivalText(t.text)) })
          get().notify(text, true)
        },
        moveToStorage(index) {
          const s = get()
          const slot = s.inventory[index]
          if (!slot) return
          const r = addItem(s.homeStorage, slot.id, slot.count, storageSlots(s.home.stage), slot.variant)
          if (r.added === 0) return s.notify('보관함이 꽉 찼어요. 집을 넓히면 더 넣을 수 있어요')
          let inv = s.inventory
          for (let i = 0; i < r.added; i++) inv = removeOneOf(inv, slot.id, slot.variant) ?? inv
          set({ inventory: inv, homeStorage: r.inv })
          play('pop')
        },
        takeFromStorage(index) {
          const s = get()
          const slot = s.homeStorage[index]
          if (!slot) return
          const r = addItem(s.inventory, slot.id, slot.count, s.pocket, slot.variant)
          if (r.added === 0) return pocketFull('주머니가 가득 찼어요. 먼저 팔고 올까요?')
          let stored = s.homeStorage
          for (let i = 0; i < r.added; i++) stored = removeOneOf(stored, slot.id, slot.variant) ?? stored
          set({ inventory: r.inv, homeStorage: stored })
          play('pop')
        },
        placeInHome(x, z, wall) {
          const s = get()
          if (!s.homePlacing) return
          const why = wall ? wallBlocker(x, z, wall, s.home.stage, s.homeFloor, s.homeFurniture) : homePlaceBlocker(x, z, s.home.stage, s.homeFurniture, s.homeFloor)
          if (why) return s.notify(why)
          const pickedVariant = placingVariantOf(s.inventory, s.homePlacing, s.homePlacingVariant)
          const inv = removeOneOf(s.inventory, s.homePlacing, pickedVariant)
          if (!inv) return set({ homePlacing: null, homePlacingVariant: undefined })
          const still = hasVariant(inv, s.homePlacing, pickedVariant) ? s.homePlacing : null
          const stillVariant = still ? pickedVariant : undefined
          const hid = uid('h')
          runtime.justPlaced = { id: hid, at: performance.now() }
          set({
            inventory: inv,
            homePlaceCell: null,
            homeFurniture: [...s.homeFurniture, { id: hid, itemId: s.homePlacing, x, z, rot: wall ? 0 : s.homePlacingRot, variant: pickedVariant, floor: s.homeFloor, ...(wall && { wall }) }],
            homePlacing: still,
            homePlacingVariant: stillVariant,
          })
          bump('place')
          // 처음 한 번만 넣는 법을 알려 준다(가구를 놓은 뒤 되돌리는 방법)
          get().showFirstHint('stow')
        },
        pickUpHome(id) {
          const s = get()
          const p = s.homeFurniture.find((x) => x.id === id)
          if (!p || !give(p.itemId, 1, p.variant)) return
          set({ homeFurniture: get().homeFurniture.filter((x) => x.id !== id) })
          s.notify(`${josa(ITEMS[p.itemId].name, '을', '를')} 주머니에 넣었어요`)
        },
        setPlaceCell(cell) {
          const cur = get().placeCell
          if (get().placing && (cur?.x !== cell?.x || cur?.z !== cell?.z)) set({ placeCell: cell })
        },
        setHomePlaceCell(cell) {
          // 스틱 이동 중에도 자주 불리니 바뀔 때만 쓴다
          const cur = get().homePlaceCell
          if (get().homePlacing && (cur?.x !== cell?.x || cur?.z !== cell?.z)) set({ homePlaceCell: cell })
        },
        rotateHomePlacing() {
          const held = get().homePlacing
          if (held && isWallItem(held)) return get().notify('벽에 거는 물건은 돌리지 않아요. 벽을 보고 있으면 그대로 걸려요')
          set({ homePlacingRot: (get().homePlacingRot + 1) % 4 })
        },
        bankDeposit(amount) {
          const s = get()
          const r = deposit(s.bank, s.money, amount, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ bank: r.state, money: r.money })
          bump('atmOut', s.money - r.money)
          play('coin')
          s.notify(`통장에 도토리 ${amount.toLocaleString()}개를 넣었어요`, true)
        },
        bankWithdraw(amount) {
          const s = get()
          const r = withdraw(s.bank, amount, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ bank: r.state, money: s.money + r.gained })
          bump('atmIn', r.gained)
          play('coin')
          s.notify(`도토리 ${r.gained.toLocaleString()}개를 꺼냈어요`, true)
        },
        depositOpen(amount, days) {
          const s = get()
          const r = openDeposit(s.deposit ?? null, s.money, amount, days, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ deposit: r.deposit, money: r.money })
          bump('atmOut', s.money - r.money)
          play('coin')
          s.notify(`${days}일 예금을 맡겼어요. ${r.deposit.due.slice(5, 7)}월 ${r.deposit.due.slice(8)}일 아침에 이자 도토리 ${depositInterest(amount, days).toLocaleString()}개를 더해 통장에 들어가요`, true)
        },
        donateGift(amount) {
          const s = get()
          const r = giftDonate(s.islandGift ?? NEW_ISLAND_GIFT, s.miles, amount, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ islandGift: r.state, miles: r.miles })
          play('coin')
          s.notify(r.done ? `🏗 기부를 다 모았어요. 내일 아침에 완성돼요` : `🏗 ${formatMiles(amount)}을 기부했어요${r.credited !== amount ? ` · 적립 ${formatMiles(r.credited)}` : ''}`)
        },
        donateAcornGift(amount) {
          const s = get()
          if (currentGift(s.islandGift ?? NEW_ISLAND_GIFT) !== null) return s.notify('먼저 1차 섬 가꾸기를 마쳐야 해요')
          // 2차는 도토리(money)로 낸다. 따뜻한 모금 1.2배는 적용하지 않는다.
          const r = giftDonate(s.islandAcorn ?? NEW_ISLAND_GIFT, s.money, amount, s.day, GIFT_PROJECTS_2, false)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          set({ islandAcorn: r.state, money: r.miles })
          bump('spentGift', s.money - r.miles)
          play('coin')
          s.notify(r.done ? `🏗 2차 기부를 다 모았어요. 내일 아침에 완성돼요` : `🏗 도토리 ${amount.toLocaleString()}개를 2차 섬 가꾸기에 기부했어요`)
        },
        depositBreak() {
          const s = get()
          const r = breakDeposit(s.deposit ?? null, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ deposit: null, bank: { ...s.bank, savings: s.bank.savings + r.principal } })
          play('coin')
          s.notify(`예금 원금 도토리 ${r.principal.toLocaleString()}개를 통장에 넣었어요. 이자는 없어요`, true)
        },
        loanCleared() {
          const s = get()
          const nxt = nextStage(s.home.stage)
          const day = s.day
          const letter = loanPaidLetter(day, nxt ? { name: nxt.name, loan: nxt.loan } : null)
          if (!s.letters.some((l) => l.id === letter.id)) set({ letters: [letter, ...s.letters].slice(0, MAILBOX_MAX) })
          play('success')
          // 창은 그대로 둔다. 상환은 ATM 창 안에서만 하므로 축하는 대출 탭의 카드가 말하고, 토스트로 같은 말을 또 하지 않는다.
          // 축하 효과는 지금 서 있는 자리에서 터뜨린다(집 안이든 바깥이든)
          burst({ kind: 'confetti', x: runtime.player.x, y: runtime.player.y + 2.4, z: runtime.player.z })
        },
        toggleHomeLight(id) {
          const p = get().homeFurniture.find((x) => x.id === id)
          if (!p) return
          set({ homeFurniture: get().homeFurniture.map((x) => (x.id === id ? { ...x, off: !x.off } : x)) })
          play('pop')
          get().notify(p.off ? `${josa(ITEMS[p.itemId].name, '을', '를')} 켰어요` : `${josa(ITEMS[p.itemId].name, '을', '를')} 껐어요`)
        },
        donate(itemId) {
          const s = get()
          const r = canDonate(itemId, s.dex, s.museum, countOf(s.inventory, itemId))
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason)
          }
          const inv = removeOne(s.inventory, itemId)
          if (!inv) return
          const d = museumDonate(s.museum, itemId)
          set({ inventory: inv, museum: d.donated, miles: s.miles + d.miles })
          play('success')
          gainMileToast(d.miles, '박물관 기증', '건')
          if (d.zone) s.notify(`🏛 ${ZONE_NAME[d.zone]} 구역을 다 채웠어요! 🏅 ${formatMiles(ZONE_MILES)}`)
        },
        enterCave() {
          if (!caveOpen(currentHour())) return get().notify('밀물이라 동굴 입구가 물에 잠겼어요')
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const c = roomCenter(CAVE_ROOM)
            const p = runtime.player
            p.x = c.x + ROOM_ENTRY.x
            p.z = c.z + ROOM_ENTRY.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            set({ inCave: true, doorFade: false, placing: null, placingVariant: undefined })
          }, 420)
        },
        endTitle() {
          if (!get().title) return
          runtime.titleEndAt = now()
          set({ title: false })
          get().showNews()
        },
        nextStoryFlash() {
          const q = get().storyFlashQueue
          if (q.length === 0) return
          set({ storyFlash: { text: q[0], key: Date.now() }, storyFlashQueue: q.slice(1) })
        },
        showNews() {
          const s = get()
          if (s.title) return
          const key = dateKey(new Date())
          let shown: string | null = null
          try {
            shown = localStorage.getItem(NEWS_KEY)
          } catch {
            shown = null
          }
          if (shown === key) return
          try {
            localStorage.setItem(NEWS_KEY, key)
          } catch {
            // 저장이 막혀도 이번 세션 동안은 한 번만 뜬다
          }
          const recap = weekRecapToday(key)
          const lines = newsFor({ day: key, houses: s.houses, shop: s.shop, home: s.home })
          set({ news: [...lines, ...recapBlock(recap)] })
          // 마을 방송이 나올 때 차임을 한 번 울리고, 지붕 스피커에서 음표가 떠오른다
          play('chime')
          if (HALL_SITE) burst({ kind: 'note', x: HALL_SITE.x, y: heightAt(HALL_SITE.x, HALL_SITE.z) + 3.4, z: HALL_SITE.z })
        },
        closeNews() {
          set({ news: null, newsFromHall: false })
        },
        catchBalloon() {
          const s = get()
          const prog = balloonProgress(s.day, currentHour())
          if (prog === null || runtime.balloonCaught === s.day) return
          // 선물은 날짜 시드로 정한다. 도토리 300개 또는 종이 등불 하나.
          const coin = mulberry32(hashString(`balloon-gift:${s.day}`))() < 0.5
          if (coin) {
            set({ money: s.money + 300 })
          } else if (!give('paper-lantern')) {
            return
          }
          runtime.balloonCaught = s.day
          play('coin')
          s.notify(coin ? '🎈 풍선 선물을 잡았어요! 도토리 300개를 받았어요' : '🎈 풍선 선물을 잡았어요! 종이 등불을 받았어요')
        },
        mineCave(node) {
          const s = get()
          if (!s.inCave) return
          if (s.tool !== 'shovel') return s.notify('삽을 들고 와야 광석을 캘 수 있어요')
          if (minesLeft(s.day, s.cave) <= 0) return s.notify('오늘은 광석을 다 캤어요. 내일 다시 와요')
          const used = s.cave.day === s.day ? s.cave.mined : 0
          const ore = oreFor(hashString(`cave-ore:${s.day}:${used}:${node}`))
          if (!give(ore.id)) return
          set({ cave: { day: s.day, mined: used + 1, chestWeek: s.cave.chestWeek } })
          record(ore.id)
          play('pop')
          s.notify(`${ore.icon} ${josa(ore.name, '을', '를')} 캤어요`)
        },
        openCaveChest() {
          const s = get()
          if (!s.inCave) return
          const week = chestWeek(dayIndex(s.day) ?? 0)
          if (!chestDue(dayIndex(s.day) ?? 0, s.cave.chestWeek)) return s.notify('상자는 일주일에 한 번 열어요. 다음 주에 다시 와요')
          const item = chestItem(week, s.recipes)
          if (item.kind === 'recipe') {
            set({ recipes: [...s.recipes, item.id] })
            s.notify(`📃 ${ITEMS[item.id].name} 레시피를 배웠어요`)
          } else {
            if (!give(item.id)) return
            s.notify(`${josa(ITEMS[item.id].name, '을', '를')} 찾았어요`)
          }
          set({ cave: { ...get().cave, chestWeek: week } })
          play('success')
        },
        leaveCave() {
          const site = caveSpot()
          set({ doorFade: true, prompt: null })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            // 입구 앞, 섬 안쪽을 보고 선다
            p.x = site.x + 1.4
            p.z = site.z
            p.facing = -Math.PI / 2
            runtime.snapCamera = true
            set({ inCave: false, doorFade: false })
          }, 420)
        },
        markCalendarOpened() {
          const day = get().day
          if (get().calendarOpenedDay !== day) set({ calendarOpenedDay: day })
        },
        showFirstHint(id) {
          const r = firstHintOnce(get().seenHints ?? [], id)
          if (!r) return
          set({ seenHints: r.seen })
          get().notify(r.text)
        },
        enterHall() {
          if (!HALL_SITE) return
          get().showFirstHint('hall')
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const c = roomCenter(HALL_ROOM)
            const p = runtime.player
            p.x = c.x + ROOM_ENTRY.x
            p.z = c.z + ROOM_ENTRY.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            set({ inHall: true, doorFade: false, placing: null, placingVariant: undefined })
          }, 420)
        },
        leaveHall() {
          const site = HALL_SITE
          if (!site) return
          set({ doorFade: true, prompt: null })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            p.x = site.door.x
            p.z = site.door.z
            // 문에서 건물 쪽을 본다
            p.facing = site.rot + Math.PI
            runtime.snapCamera = true
            set({ inHall: false, doorFade: false })
          }, 420)
        },
        replayNews() {
          const s = get()
          set({ news: [...newsFor({ day: dateKey(new Date()), houses: s.houses, shop: s.shop, home: s.home }), ...recapBlock(recapShownOn(dateKey(new Date())))], newsFromHall: true })
        },
        enterMuseum() {
          if (!MUSEUM_SITE || !museumOpen(get().dex)) return
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮겨야 순간이동이 보이지 않는다.
          setTimeout(() => {
            const c = roomCenter(MUSEUM_ROOM)
            const p = runtime.player
            p.x = c.x + ROOM_ENTRY.x
            p.z = c.z + ROOM_ENTRY.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            set({ inMuseum: true, doorFade: false, placing: null, placingVariant: undefined })
          }, 420)
        },
        enterShop() {
          set({ doorFade: true, prompt: null, bagOpen: false })
          play('door')
          // 화면이 덮인 뒤에 옮긴다. 문 종소리는 들어가는 순간 울린다.
          setTimeout(() => {
            const c = roomCenter(SHOP_ROOM)
            const p = runtime.player
            p.x = c.x + ROOM_ENTRY.x
            p.z = c.z + ROOM_ENTRY.z
            p.facing = Math.PI
            runtime.snapCamera = true
            runtime.fishing = { phase: 'idle' }
            // 진열대 수는 들어가는 순간의 상점 단계로 맞춘다
            shopRoom.tier = get().shop.tier
            set({ inShop: true, doorFade: false, placing: null, placingVariant: undefined })
            play('pop')
            get().notify(SHOP_BELL_TEXT)
          }, 420)
        },
        talkClerk(id) {
          const s = get()
          if (s.clerkSay) return
          // 주간 한정 물건은 진열에 보이는 것과 같은 칸을 가리킨다
          // 이번 주에 한정 물건을 이미 샀으면 소개하지 않는다
          const weekly = limitedPitch(s.shop.tier, s.day, s.weeklyBuy)?.name ?? null
          const ctx = { day: s.day, tier: s.shop.tier, songi: songiMood(s.day, currentHour()), weekly }
          set({ clerkSay: { id, text: clerkLine(id as 'garam' | 'narl', ctx) } })
          setTimeout(() => {
            set({ clerkSay: null })
            get().openPanel('shop')
          }, CLERK_SAY_MS)
        },
        talkShopGuest(id) {
          const s = get()
          const v = VILLAGERS.find((x) => x.id === id)
          if (s.shopGuestSay || !v) return
          set({ shopGuestSay: { id, text: shopGuestLine(v, s.day) } })
          setTimeout(() => set({ shopGuestSay: null }), GUEST_SAY_MS)
        },
        leaveShop() {
          set({ doorFade: true, prompt: null })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            p.x = SHOP_DOOR.x
            p.z = SHOP_DOOR.z + 1.4
            // 문에서 건물 쪽을 본다
            p.facing = Math.PI
            runtime.snapCamera = true
            set({ inShop: false, doorFade: false })
          }, 420)
        },
        leaveMuseum() {
          const site = MUSEUM_SITE
          if (!site) return
          set({ doorFade: true, prompt: null })
          play('door')
          setTimeout(() => {
            const p = runtime.player
            p.x = site.door.x
            p.z = site.door.z
            // 문에서 건물 쪽을 본다
            p.facing = site.rot + Math.PI
            runtime.snapCamera = true
            set({ inMuseum: false, doorFade: false })
          }, 420)
        },
        nap(hour = currentHour()) {
          const s = get()
          const sleep = isSleepHour(hour)
          const bonus = napBonus(s.napDay, s.day, hour)
          if (bonus) {
            set({ napDay: s.day, miles: s.miles + NAP_MILES })
            gainMileToast(NAP_MILES, '첫 잠')
          }
          play(sleep ? 'success' : 'pop')
          // 밤에 누우면 화면을 잠깐 덮었다 걷어 잠드는 느낌을 준다.
          if (sleep) {
            set({ doorFade: true, prompt: null })
            setTimeout(() => set({ doorFade: false }), 900)
          }
          s.notify(napLine(sleep, bonus))
        },
        toggleRoomLamp(key) {
          const off = get().roomLampsOff
          set({ roomLampsOff: off.includes(key) ? off.filter((k) => k !== key) : [...off, key] })
          play('pop')
        },
        repayFromPocket(amount) {
          const s = get()
          const r = payLoan(s.money, s.home.loan, amount)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ money: r.money, home: { ...s.home, loan: r.balance }, loanHistory: recordPayment(s.loanHistory ?? EMPTY_LOAN_HISTORY, s.day, r.paid, 'pocket') })
          bump('atmOut', r.paid)
          // 다 갚은 순간은 축하 소리(loanCleared)만 낸다. 동전 소리를 겹치지 않는다.
          if (r.balance) {
            play('coin')
            s.notify(`대출 도토리 ${r.paid.toLocaleString()}개를 갚았어요. ${loanLabel(r.balance)}`, true)
          } else get().loanCleared()
        },
        repayFromSavings(amount) {
          const s = get()
          const r = repayLoan(s.bank, s.home.loan, amount, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          set({ bank: r.state, home: { ...s.home, loan: r.loan }, loanHistory: recordPayment(s.loanHistory ?? EMPTY_LOAN_HISTORY, s.day, r.paid, 'savings') })
          if (r.loan) {
            play('coin')
            s.notify(`통장에서 대출 도토리 ${r.paid.toLocaleString()}개를 갚았어요. ${loanLabel(r.loan)}`, true)
          } else get().loanCleared()
        },
        buyAtm(id) {
          const s = get()
          const r = buyAtmProduct(s.bank, s.miles, id, s.day)
          if (!r.ok) {
            play('fail')
            return s.notify(r.reason, true)
          }
          // 쿠폰은 주머니에 들어가야 산 것이다. 자리가 없으면 마일을 쓰지 않는다.
          if (r.grant && addItem(s.inventory, r.grant.itemId, r.grant.count, s.pocket).added === 0) return pocketFull('주머니가 가득 찼어요')
          set({ bank: r.state, miles: r.miles })
          if (r.grant) give(r.grant.itemId, r.grant.count)
          play('success')
          s.notify(r.grant ? `${ITEMS[r.grant.itemId].icon} ${ITEMS[r.grant.itemId].name} ${r.grant.count}개를 받았어요` : '업그레이드했어요', true)
        },
        claimQuest(id) {
          const s = get()
          const entry = questBoard(s).find((q) => q.def.id === id)
          if (!entry?.done) return
          const q: QuestDef = entry.def
          grant(q.reward)
          if (id.startsWith('daily:')) {
            set({ dailyClaimed: [...get().dailyClaimed, id] })
          } else {
            const known = new Set([...s.questsDone, ...s.quests.map((a) => a.id)])
            const next = (q.next ?? []).filter((n) => !known.has(n)).map((n) => ({ id: n, baseline: { ...get().stats } }))
            set({ quests: [...get().quests.filter((a) => a.id !== id), ...next], questsDone: [...s.questsDone, id] })
          }
          play('success')
          s.notify(`보상을 받았어요: ${rewardParts(q.reward).join(' · ')}`)
        },
        // 사진 모드 상태는 저장하지 않는다
        photo: false,
        title: true,
        storyFlash: null,
        storyFlashQueue: [],
        pumpkinNightOn: false,
        storyEnding: null,
        news: null,
        newsFromHall: false,
        treasureMap: null,
        bagFullAt: 0,
        homeFloor: 0,
        wet: false,
        companion: null,
        photoPose: null,
        photoMood: null,
        photoFilter: 'basic',
      }
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => guardedLocal),
      partialize: saveOf,
      migrate: (persisted, version) => loadSave(persisted, version),
      // 같은 버전 저장은 migrate 를 거치지 않으므로, 상환 기록이 없으면 여기서 지금 빚으로 만든다
      merge: mergeSave,
    },
  ),
)

// 이행이 실패했으면 스토어를 만든 뒤에 알린다(스토어를 만드는 중에는 토스트를 띄울 수 없다)
if (loadFailed) useGame.getState().notify('저장을 불러오지 못해 백업해 뒀어요')

/** 저장된 축제 기록을 검증한다. 망가졌으면 빈 기록으로 둔다. */
function sanitizeFestival(raw: unknown): FestivalState {
  const f = (raw ?? {}) as Partial<FestivalState>
  const ok = (f.day === null || (typeof f.day === 'string' && dayIndex(f.day) !== null)) && typeof f.n === 'number' && f.n >= 0
  if (!ok) return { day: null, n: 0, offered: [], claimed: [] }
  return {
    day: f.day ?? null,
    n: f.n!,
    offered: Array.isArray(f.offered) ? f.offered.filter((x) => typeof x === 'string') : [],
    claimed: Array.isArray(f.claimed) ? f.claimed.filter((x) => typeof x === 'string') : [],
  }
}

/**
 * 축제 날의 할 일을 한 번 진행한다. 물 주기·밤 앉기·눈사람 놓기가 여기로 온다.
 * 목표에 닿으면 축제 선물을 편지함으로 보낸다. 같은 축제 날에는 한 번만 받는다.
 */
function stepFestival(task: FestivalTask, amount = 1) {
  const s = useGame.getState()
  const f = festivalOn(s.day)
  if (!f || f.task !== task || s.festival.claimed.includes(s.day)) return
  const n = progressOn(s.festival, s.day) + amount
  const offered = s.festival.day === s.day ? s.festival.offered : []
  useGame.setState({ festival: { day: s.day, n, offered, claimed: s.festival.claimed } })
  if (festivalDone(f, n)) claimFestival(f)
  else useGame.getState().notify(`${f.icon} ${f.name} ${Math.min(n, f.target)}/${f.target}`)
}

/** 축제 선물을 편지함으로 보내고 이 축제 날을 받은 것으로 기록한다. */
function claimFestival(f: Festival) {
  const s = useGame.getState()
  const letter = festivalRewardLetter(s.day, f)
  useGame.setState({
    festival: { ...s.festival, claimed: [...s.festival.claimed, s.day] },
    letters: [letter, ...s.letters].slice(0, MAILBOX_MAX),
  })
  play('success')
  useGame.getState().notify(`${f.icon} ${josa(f.name, '을', '를')} 끝냈어요! 편지함에 선물이 왔어요`)
}

/** 저장된 별점 기록을 검증한다. 망가졌으면 처음 상태로 둔다. */
function sanitizeRating(raw: unknown): RatingState {
  const r = (raw ?? {}) as Partial<RatingState>
  const ok = typeof r.stars === 'number' && r.stars >= 0 && r.stars <= 5 && typeof r.rewarded === 'number' && [0, 3, 5].includes(r.rewarded)
  const since = typeof r.since === 'string' && dayIndex(r.since) !== null ? r.since : null
  if (!ok) return { day: null, stars: 0, rewarded: 0, since }
  return { day: typeof r.day === 'string' && dayIndex(r.day) !== null ? r.day : null, stars: r.stars!, rewarded: r.rewarded!, since }
}

/**
 * 주간 섬 별점 편지. 점수와 조언은 그 순간의 섬 상태로 매기고, 처음 닿은 3★·5★ 보상을 한 번만 준다.
 * 같은 주(월요일 키)에는 한 번만 매긴다. 주의 첫 접속이 화요일이어도 그 주 편지가 온다.
 */
function weeklyRating(day: string) {
  const s = useGame.getState()
  const week = mondayOf(day)
  if (s.rating.day === week) return
  // 처음 시작한 사람은 사흘째(시작일부터 이틀 뒤)가 되어야 첫 편지를 받는다
  if (s.rating.day === null) {
    const since = s.rating.since ?? day
    if (!s.rating.since) useGame.setState({ rating: { ...s.rating, since } })
    if ((dayIndex(day) ?? 0) - (dayIndex(since) ?? 0) < 2) return
  }
  const input = ratingInputOf(s, TREES, (id) => ITEMS[id]?.kind === 'junk')
  const { stars } = islandRating(input)
  const tip = ratingTip(input)
  let recipes = s.recipes
  let miles = s.miles
  let goldCan = s.goldCan
  const lines: string[] = []
  for (const r of ratingRewards(stars, s.rating.rewarded)) {
    if (r === 'recipe') {
      const id = firstNewRecipe(recipes)
      if (id) {
        recipes = [...recipes, id]
        lines.push(`새 DIY 레시피 ${ITEMS[id].name}${ITEMS[id].icon} 을 알려 드려요.`)
      } else {
        miles += 150
        lines.push('레시피는 이미 다 알고 있어서 150마일을 드려요.')
      }
    } else {
      goldCan = true
      lines.push('별 다섯 개 기념으로 황금 물뿌리개를 드려요!')
    }
  }
  const letter = ratingLetter(week, stars, tip?.text ?? null, lines, day)
  const rating = { day: week, stars, rewarded: nextRewarded(stars, s.rating.rewarded), since: s.rating.since }
  useGame.setState({
    rating,
    recipes,
    miles,
    goldCan,
    letters: [letter, ...s.letters].slice(0, MAILBOX_MAX),
  })
  gainMileToast(miles - s.miles, '섬 평가 보상')
}

/** 주머니·도감 등 기존 칸은 그대로 두고, 상점·집·통장 칸이 없거나 망가졌으면 기본값을 채운다. */
/** 저장된 주민 부탁을 검증한다. 맞지 않는 항목은 버린다. */
function sanitizeRequests(raw: unknown): Record<string, Req> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, Req> = {}
  for (const [k, v] of Object.entries(raw)) {
    const r = sanitizeReq(v)
    if (r) out[k] = r
  }
  return out
}

/**
 * 저장 배열에서 빈 칸·숫자·글 같은 것을 뺀 객체 칸만 남긴다.
 * 함수 선언으로 둔다. persist 가 스토어를 만들 때 migrateSave 를 바로 부르는데, const 는 아직 초기화 전이라 부를 수 없다.
 */
function objectsOf<T extends object>(xs: unknown): T[] {
  return (Array.isArray(xs) ? (xs as unknown[]) : []).filter((x): x is T => !!x && typeof x === 'object')
}

/** 놓을 칸의 변형: 고른 변형 칸이 있으면 그것, 없으면 그 물건의 첫 칸(오래된 값이 남아도 놓기가 깨지지 않게) */
function placingVariantOf(inv: readonly Slot[], id: string | null, picked?: string): string | undefined {
  const hit = inv.find((x) => x.id === id && (x.variant ?? undefined) === picked)
  return (hit ?? inv.find((x) => x.id === id))?.variant
}

/** 이 변형의 칸이 아직 남아 있는가 */
function hasVariant(inv: readonly Slot[], id: string | null, variant?: string): boolean {
  return inv.some((x) => x.id === id && (x.variant ?? undefined) === variant)
}

/** 가구 칸·방 가구의 variant 를 아는 값만 남긴다. 모르는 색은 기본 가구가 된다. */
function cleanVariants<T extends { variant?: unknown }>(xs: unknown): T[] {
  return objectsOf<T>(xs).map((x) => ({ ...x, variant: sanitizeVariant(x.variant) }))
}

/**
 * 저장을 최신 모양으로 옮긴다. persist 는 스토어를 만들 때 이 함수를 부르고, zustand 는 여기서 던진 오류를 조용히 삼킨다.
 * 그래서 여기서 잡는다. 실패하면 원본 글을 백업 키에 남기고, 기본 상태로 시작한다.
 */
/**
 * 저장을 현재 상태에 합친다. zustand 기본과 같은 얕은 병합({...current, ...persisted})에,
 * 상환 기록이 없는 저장만 지금 빚으로 기록을 채운다. 다른 필드는 기본 병합과 똑같다.
 */
export function mergeSave(raw: unknown, current: GameState): GameState {
  const persisted = migrateVillagerIds(raw)
  const merged = { ...current, ...(persisted as object) } as GameState
  const h = merged.home as Partial<HomeState> | undefined
  if (persisted && !('loanHistory' in (persisted as object)) && h && isHomeStage(h.stage) && typeof h.loan === 'number') {
    merged.loanHistory = legacyLoanHistory(h as HomeState)
  }
  return merged
}

export function loadSave(persisted: unknown, version: number, migrate: (raw: unknown) => SaveData = migrateSave): SaveData {
  try {
    return migrate(migrateVillagerIds(persisted))
  } catch (e) {
    console.error('[dotori-isle] 저장 이행 실패. 원본을 백업합니다', e)
    backupSave(persisted, version)
    loadFailed = true
    return migrateSave({})
  }
}

/** 원본 저장 글(없으면 옮기기 전 상태)을 백업 키에 남기고 그 키를 돌려준다. 쓸 수 없으면 null. */
export function backupSave(persisted: unknown, version: number): string | null {
  const key = `${BACKUP_PREFIX}${version}-${Date.now()}`
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? JSON.stringify({ state: persisted, version })
    localStorage.setItem(key, raw)
    pruneBackups()
    return key
  } catch {
    return null
  }
}

/** 백업 키를 새것부터 돌려준다. 키 끝의 시각으로 정렬한다. */
export function backupKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(BACKUP_PREFIX)) keys.push(k)
    }
  } catch {
    return []
  }
  return keys.sort((a, b) => backupAt(b) - backupAt(a))
}

/** 키 끝에 붙은 시각(ms). 모양이 다르면 0 으로 친다. */
function backupAt(key: string): number {
  return Number(key.slice(key.lastIndexOf('-') + 1)) || 0
}

/** 최근 BACKUP_KEEP 개만 남기고 나머지는 지운다 */
function pruneBackups() {
  for (const k of backupKeys().slice(BACKUP_KEEP)) {
    try {
      localStorage.removeItem(k)
    } catch {
      // 지우지 못하면 다음 백업 때 다시 시도한다
    }
  }
}

/** 집 등급 기념 가구를 받은 별 번호만 남긴다(1~5, 중복 없음) */
function cleanHomeStars(raw: unknown): number[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 5))] : []
}

/** 저장을 읽고, 계단 자리에 걸친 가구·길·정원 타일을 정리한다(버전은 그대로 둔다). */
export function migrateSave(raw: unknown): SaveData {
  return clearStepSpotsSave(migrateSaveRaw(raw))
}

/**
 * 계단 자리 정리: 가구는 주머니, 주머니가 차면 집 보관함에 넣는다(둘 다 없으면 그대로 둔다).
 * 길·정원 칸은 그 칸만 지운다. 무언가 바뀐 때만 편지를 맨 앞에 넣고, 같은 날 id 가 있으면 다시 넣지 않는다.
 */
function clearStepSpotsSave(s: SaveData): SaveData {
  const r = clearStepSpots(s.placed, s.infra.paths, s.gardenTiles ?? '')
  const changed = r.pathsCleared + r.gardenCleared + r.back.length > 0
  if (!changed) return s
  let inv = s.inventory
  let storage = s.homeStorage
  const stay: Placed[] = []
  for (const p of r.back) {
    const bag = addItem(inv, p.itemId, 1, s.pocket, p.variant)
    if (bag.added > 0) {
      inv = bag.inv
      continue
    }
    const chest = addItem(storage, p.itemId, 1, storageSlots(s.home.stage), p.variant)
    if (chest.added > 0) storage = chest.inv
    else stay.push(p)
  }
  const letter = stepSpotLetter(s.day)
  const letters = s.letters.some((l) => l.id === letter.id) ? s.letters : [letter, ...s.letters].slice(0, MAILBOX_MAX)
  return {
    ...s,
    inventory: inv,
    homeStorage: storage,
    placed: [...r.placed, ...stay],
    infra: r.pathsCleared > 0 ? { ...s.infra, paths: r.pathsRaw } : s.infra,
    gardenTiles: r.gardenCleared > 0 ? r.gardenRaw : s.gardenTiles,
    letters,
  }
}

function migrateSaveRaw(raw: unknown): SaveData {
  const p = (raw ?? {}) as Partial<SaveData>
  // 깨졌거나 같은 id 인 디자인은 버리고, 여섯 장까지만 남긴다
  const designs = (Array.isArray(p.designs) ? p.designs : [])
    .map((d) => sanitizeDesign(d))
    .filter((d): d is SavedDesign => d !== null)
    .filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i)
    .slice(0, DESIGN_MAX)
  const day = typeof p.day === 'string' && dayIndex(p.day) !== null ? p.day : dateKey(new Date())
  const shopOk = !!p.shop && isShopTier(p.shop.tier)
  const homeOk = !!p.home && isHomeStage(p.home.stage) && typeof p.home.loan === 'number' && p.home.loan >= 0
  // 카메라 쪽 벽(s)에 걸렸던 벽걸이는 같은 칸의 다른 벽으로 옮기고, 못 옮기면 가방으로 돌려준다
  const wallFix = rehomeSouthWalls(
    Array.isArray(p.homeFurniture) ? cleanVariants<Placed>(p.homeFurniture).map(({ wall, ...x }) => ({ ...x, floor: homeFloorOf(x.floor), ...(isWallDir(wall) && { wall }) })) : [],
    homeOk ? (p.home as HomeState).stage : NEW_HOME.stage,
  )
  const bankOk = !!p.bank && typeof p.bank.savings === 'number' && p.bank.savings >= 0 && dayIndex(p.bank.day) !== null
  return {
    ...initial,
    ...p,
    // 속은 값이 아니면 기본값으로 바꾼다(...p 로 들어온 깨진 글이 그대로 남지 않게)
    money: typeof p.money === 'number' && Number.isFinite(p.money) && p.money >= 0 ? p.money : 0,
    day,
    canLevel: isCanLevel(p.canLevel) ? p.canLevel : 1,
    shop: shopOk ? (p.shop as ShopState) : NEW_SHOP,
    shopLog: sanitizeShopLog(p.shopLog),
    home: homeOk ? (p.home as HomeState) : NEW_HOME,
    inventory: [
      ...(Array.isArray(p.inventory) ? migrateItemIds(cleanVariants<Slot>(p.inventory)) : initial.inventory),
      ...wallFix.bag.map((b) => ({ id: b.itemId, count: 1, ...(b.variant && { variant: b.variant }) })),
    ],
    placed: Array.isArray(p.placed) ? cleanVariants<Placed>(p.placed) : initial.placed,
    homeFurniture: wallFix.items,
    homeStorage: Array.isArray(p.homeStorage) ? migrateItemIds(cleanVariants<Slot>(p.homeStorage)) : [],
    setsDone: Array.isArray(p.setsDone) ? p.setsDone.filter((id): id is string => typeof id === 'string') : completedSetIds(Array.isArray(p.homeFurniture) ? p.homeFurniture : []),
    homePaint: cleanPaint(p.homePaint),
    interiorWall: cleanInteriorWall(p.interiorWall),
    homeStars: cleanHomeStars(p.homeStars),
    dexRewarded: Array.isArray(p.dexRewarded)
      ? sanitizeDexRewards(p.dexRewarded)
      : doneDexKinds((p.dex ?? {}) as Record<string, number>, sanitizeSeen(p.furnitureSeen)),
    gardenPermit: p.gardenPermit === true,
    homeNew: cleanHomeNew(p.homeNew),
    seenHints: cleanSeenHints(p.seenHints),
    calendarOpenedDay: typeof p.calendarOpenedDay === 'string' && dayIndex(p.calendarOpenedDay) !== null ? p.calendarOpenedDay : null,
    dailyBase: cleanDailyBase(p.dailyBase),
    dailyMoney: cleanDailyMoney(p.dailyMoney),
    ledger: cleanLedger(p.ledger),
    // 기록이 없는 예전 저장은 지금 빚으로 기록을 만든다
    loanHistory: p.loanHistory === undefined ? legacyLoanHistory(homeOk ? (p.home as HomeState) : NEW_HOME) : cleanLoanHistory(p.loanHistory),
    storyChapter: cleanStoryChapter(p.storyChapter),
    storyEnded: p.storyEnded === true,
    weekly: cleanWeekly(p.weekly),
    weekMark: cleanWeekMark(p.weekMark),
    afterCelebrated: cleanAfterCelebrated(p.afterCelebrated),
    weekMilestones: cleanWeekMilestones(p.weekMilestones),
    afterMilestoneDays: cleanAfterDays(p.afterMilestoneDays),
    afterTalkDone: cleanAfterTalkDone(p.afterTalkDone),
    pumpkinDone: sanitizePumpkinDone(p.pumpkinDone),
    harvestFairDone: sanitizeDayKeys(p.harvestFairDone),
    // 예전 저장은 firstSnowYears(연도 목록)로 적었다. 겨울 키로 옮겨 읽는다.
    firstSnowWinters: cleanFirstSnowWinters(p.firstSnowWinters ?? (p as { firstSnowYears?: unknown }).firstSnowYears),
    birthdayChatDone: sanitizeDayKeys(p.birthdayChatDone),
    playerBirthday: cleanPlayerBirthday(p.playerBirthday),
    deposit: cleanDeposit(p.deposit),
    islandGift: cleanIslandGift(p.islandGift),
    islandAcorn: cleanIslandGift(p.islandAcorn, GIFT_PROJECTS_2),
    islandThanksDay: typeof p.islandThanksDay === 'string' && dayIndex(p.islandThanksDay) !== null ? p.islandThanksDay : null,
    shopNew: cleanShopNew(p.shopNew),
    weeklyBuy: cleanWeeklyBuy(p.weeklyBuy),
    houseExpand: cleanHouseExpand(p.houseExpand),
    expanded: cleanExpanded(p.expanded),
    houseThanks: cleanHouseThanks(p.houseThanks),
    salesLedger: cleanSalesLedger(p.salesLedger),
    shopMonth: cleanShopMonth(p.shopMonth),
    flowerWeek: cleanFlowerWeek(p.flowerWeek),
    orders: sanitizeOrders(p.orders),
    songiBuy: cleanSongiBuy(p.songiBuy),
    stampCard: cleanStampCard(p.stampCard),
    napDay: typeof p.napDay === 'string' && dayIndex(p.napDay) !== null ? p.napDay : null,
    islandStart: typeof p.islandStart === 'string' && dayIndex(p.islandStart) !== null ? p.islandStart : null,
    // 예전 저장에는 목록이 없다. 지금 가진 가구를 본 것으로 채운다.
    furnitureSeen: seenFurniture(
      sanitizeSeen(p.furnitureSeen),
      objectsOf<Slot>(p.inventory),
      objectsOf<Placed>(p.placed),
      objectsOf<Placed>(p.homeFurniture),
      objectsOf<Slot>(p.homeStorage),
      objectsOf<{ gift?: unknown }>(p.letters).map((l) => (typeof l.gift === 'string' ? l.gift : null)),
    ),
    museum: sanitizeDonated(p.museum),
    starsSeen: sanitizeStars(p.starsSeen),
    rainbowSeen: p.rainbowSeen === true,
    cave: sanitizeCave(p.cave),
    bank: bankOk ? { ...(p.bank as BankState), coupons: cleanCoupons(p.bank?.coupons) } : createBank(day),
    rating: sanitizeRating(p.rating),
    goldCan: p.goldCan === true,
    festival: sanitizeFestival(p.festival),
    wishNight: typeof p.wishNight === 'string' && dayIndex(p.wishNight) !== null ? p.wishNight : null,
    requests: sanitizeRequests(p.requests),
    album: sanitizeAlbum(p.album),
    wallPhoto: sanitizeWall(p.wallPhoto, sanitizeAlbum(p.album)),
    giftDay: p.giftDay && typeof p.giftDay === 'object' ? p.giftDay : {},
    birthdayThanks: Array.isArray(p.birthdayThanks) ? p.birthdayThanks.filter((t) => t && typeof t.villagerId === 'string' && typeof t.giftDay === 'string') : [],
    marketBought: Array.isArray(p.marketBought) ? p.marketBought.filter((x) => typeof x === 'string') : [],
    infra: sanitizeInfra(p.infra),
    // 예전 저장에는 목록이 없다. 그때 이미 열린 기능은 알린 것으로 치고, 새로 열리는 것만 편지로 알린다.
    tourney: sanitizeTourney(p.tourney),
    todo: sanitizeTodo(p.todo),
    designs,
    villagerWear: sanitizeVillagerWear(p.villagerWear),
    outLetters: sanitizeOutLetters(p.outLetters),
    moveTalk: sanitizeMoveTalk(p.moveTalk),
    lastMoveDay: typeof p.lastMoveDay === 'string' && dayIndex(p.lastMoveDay) !== null ? p.lastMoveDay : null,
    arrivals: sanitizeArrivals(p.arrivals),
    flagDesign: typeof p.flagDesign === 'string' && designs.some((d) => d.id === p.flagDesign) ? p.flagDesign : null,
    shirtDesign: typeof p.shirtDesign === 'string' && designs.some((d) => d.id === p.shirtDesign) ? p.shirtDesign : null,
    introduced: Array.isArray(p.introduced)
      ? [...new Set(p.introduced.filter((x: unknown): x is string => typeof x === 'string' && (SYSTEM_IDS as readonly string[]).includes(x)))]
      : SYSTEMS.filter((sys) => sys.open(ctxOf({ day, islandStart: typeof p.islandStart === 'string' && dayIndex(p.islandStart) !== null ? p.islandStart : null, questsDone: Array.isArray(p.questsDone) ? p.questsDone : [], dex: p.dex ?? {}, stats: p.stats ?? {} }))).map((sys) => sys.id),
  }
}

/** 섬 충돌과 방 가구 원을 저장 상태에 맞춘다. 상점 크기는 지금 단계로, 집은 지금 단계 몸체로 본다. */
/** 방의 층을 바꾸고 방 안 부딪힘을 그 층 것으로 맞춘다. */
function setHomeFloor(floor: HomeFloor) {
  homeRoom.floor = floor
  roomSolids.home = homeSolids(useGame.getState().homeFurniture, useGame.getState().home.stage, floor)
  // 새로 생긴 방에 처음 들어가면 가리킴을 끈다(첫 방문을 homeNew 에 적는다)
  const hn = useGame.getState().homeNew
  if (hn) {
    const seen = markRoomVisited(hn, floor)
    if (seen !== hn) useGame.setState({ homeNew: seen })
  }
}

function syncWorld(s: Pick<SaveData, 'shop' | 'day' | 'home' | 'homeFurniture' | 'museum' | 'dex' | 'infra'>) {
  // 섬 정비: 지어진 다리와 계단만 길로 친다
  extraBridges.length = 0
  extraBridges.push(...bridgeShapes(builtBridges(s.infra, s.day)))
  for (const k of Object.keys(extraRamps)) delete extraRamps[k]
  Object.assign(extraRamps, stairRamps(builtStairs(s.infra, s.day)))
  roomSolids.museum = museumSolids(museumLayout(s.museum))
  // 전시관 건물은 문(2.1) 바깥에 남도록 몸체 원을 1.75 로 잡는다. 문이 열린 뒤에만 막는다.
  live.museum = MUSEUM_SITE && museumOpen(s.dex) ? { x: MUSEUM_SITE.x, z: MUSEUM_SITE.z, r: 1.75 } : null
  const look = lookFor(upgradeState(s.shop, s.day).tier)
  setShopSize(look.w, look.d)
  live.home = HOME_SITE ? { x: HOME_SITE.x, z: HOME_SITE.z, r: homeRadius(s.home.stage) } : null
  homeRoom.stage = s.home.stage
  roomSolids.home = homeSolids(s.homeFurniture, s.home.stage, homeRoom.floor)
  unstickPlayer()
  nudgeFurniture()
}

/**
 * 언덕이 생기기 전에 놓은 가구가 절벽 띠 위에 걸려 있으면 가장 가까운 평지로 옮긴다(저장은 그대로 읽힌다).
 * 가구 칸은 다른 가구와 겹치는지 따지지 않는다. 옮긴 뒤 겹치면 사용자가 다시 놓을 수 있다.
 */
function nudgeFurniture() {
  const s = useGame.getState()
  const stuck = (x: number, z: number) => !isWalkable(x, z) || cliffFaceAt(x, z)
  if (!s.placed.some((x) => stuck(x.x, x.z))) return
  const placed = s.placed.map((x) => {
    if (!stuck(x.x, x.z)) return x
    const spot = nearestFreeSpot(x.x, x.z, (a, b) => !stuck(a, b))
    return spot ? { ...x, x: spot.x, z: spot.z } : x
  })
  useGame.setState({ placed })
}

/**
 * 상점이 커지거나 집이 생겨 서 있던 자리가 막히면 가장 가까운 걸을 수 있는 자리로 옮긴다.
 * 그대로 두면 어느 방향으로도 못 움직여 갇힌다. 집 안이나 여행 섬에서는 좌표계가 달라 건드리지 않는다.
 */
function unstickPlayer() {
  const s = useGame.getState()
  if (s.inHome || s.inside || s.island !== 'home') return
  const p = runtime.player
  if (canWalk(p.x, p.z)) return
  const spot = nearestFreeSpot(p.x, p.z, canWalk)
  if (spot) {
    p.x = spot.x
    p.z = spot.z
  }
}

useGame.subscribe((s, p) => {
  if (s.shop !== p.shop || s.day !== p.day || s.home !== p.home || s.homeFurniture !== p.homeFurniture || s.museum !== p.museum || s.infra !== p.infra || museumOpen(s.dex) !== museumOpen(p.dex)) syncWorld(s)
})
syncWorld(useGame.getState())
// 가구 도감: 주머니·배치·창고에 새로 들어온 가구를 본 목록에 더한다
// 가구 세트를 처음 완성하면 토스트를 한 번 띄운다(세트마다 한 번). 완성 목록은 setsDone 에 남긴다.
useGame.subscribe((s, p) => {
  if (s.homeFurniture === p.homeFurniture) return
  const fresh = newlyCompletedSets(s.setsDone ?? [], s.homeFurniture)
  if (!fresh.length) return
  // 세트마다 처음 완성할 때 마일을 한 번 준다. 기록(setsDone)에 있으면 다시 주지 않는다
  useGame.setState({ setsDone: [...(s.setsDone ?? []), ...fresh], miles: s.miles + SET_MILES * fresh.length })
  play('success')
  for (const id of fresh) {
    const name = HOME_SETS.find((set) => set.id === id)?.name ?? id
    s.notify(`✨ '${name}' 세트를 완성했어요 · 🏅 ${formatMiles(SET_MILES)}`)
  }
})

useGame.subscribe((s, p) => {
  if (s.inventory === p.inventory && s.placed === p.placed && s.homeFurniture === p.homeFurniture && s.homeStorage === p.homeStorage && s.letters === p.letters) return
  const next = seenFurniture(s.furnitureSeen, s.inventory, s.placed, s.homeFurniture, s.homeStorage, s.letters.map((l) => l.gift))
  if (next !== s.furnitureSeen) useGame.setState({ furnitureSeen: next })
})

// 도감 완성 보상: 물고기·벌레·가구 분류를 처음 다 채우면 마일리지를 분류마다 한 번 준다(core/dexReward.ts)
useGame.subscribe((s, p) => {
  if (s.dex === p.dex && s.furnitureSeen === p.furnitureSeen) return
  const fresh = newDexRewards(s.dexRewarded ?? [], s.dex, s.furnitureSeen)
  if (!fresh.length) return
  useGame.setState({ dexRewarded: [...(s.dexRewarded ?? []), ...fresh], miles: s.miles + DEX_BONUS * fresh.length })
  play('success')
  for (const _ of fresh) gainMileToast(DEX_BONUS, '도감 완성', '분류')
})

// 기능 소개: 새로 열린 기능마다 편지를 한 번 보낸다(core/unlocks.ts). 날·퀘스트·도감·가게가 바뀔 때만 본다.
function introduceUnlocks() {
  const s = useGame.getState()
  const fresh = newlyOpened(ctxOf(s), s.introduced)
  if (!fresh.length) return
  useGame.setState({
    introduced: [...s.introduced, ...fresh.map((f) => f.id)],
    letters: [...fresh.map((f) => introLetter(f, s.day)), ...s.letters].slice(0, MAILBOX_MAX),
  })
  const text = `📬 ${fresh[0].name} 소식이 편지함에 왔어요`
  // 날이 넘어가는 중이면 아침 알림 묶음에 넣어 한꺼번에 고른다
  if (morningSink) morningSink.push({ text, rank: 4 })
  else useGame.getState().notify(text)
}
useGame.subscribe((s, p) => {
  if (s.day === p.day && s.questsDone === p.questsDone && s.dex === p.dex && s.stats === p.stats && s.islandStart === p.islandStart) return
  introduceUnlocks()
})
// 새 섬이 장날에 시작하면 그날 장터 소개가 바로 와야 한다(예전 저장은 migrateSave 가 알린 것으로 채운다)
introduceUnlocks()

// 마일 토스트: 처음 쌓인 순간부터 1.5초 동안 들어온 마일을 한 줄로 합쳐 띄운다. 같은 이유는 횟수를 더한다.
// 토스트 보류(대화 중)와 줄 세우기는 notify 가 맡는다. 마일 값은 각 자리에서 이미 더했고, 여기는 알림만 모은다.
const MILE_TOAST_WAIT = 1500
let mileGains: MileGain[] = []
let mileTimer: ReturnType<typeof setTimeout> | null = null
export function gainMileToast(amount: number, name: string, unit = '개', count = 1) {
  if (amount <= 0) return
  mileGains = addMileGain(mileGains, { name, count, unit, amount })
  if (mileTimer) return
  mileTimer = setTimeout(flushMileToast, MILE_TOAST_WAIT)
}
/** 모인 마일을 지금 한 줄로 띄운다(창이 끝나기 전에 알려야 할 때와 테스트용). 모인 것이 없으면 아무것도 안 한다. */
export function flushMileToast() {
  if (mileTimer) clearTimeout(mileTimer)
  mileTimer = null
  if (!mileGains.length) return
  const gains = mileGains
  mileGains = []
  useGame.getState().notify(mileToastText(gains))
}

// 매주 월요일 아침: 집 꾸미기 점수 편지(core/homeScore.ts). 편지 id 로 같은 월요일에는 한 번만 보낸다. 저장 칸을 늘리지 않는다.
// 보상(도토리·마일리지)은 편지를 쓸 때 같이 준다. 한정 가구는 편지 선물로 받는다.
function sendHomeScoreLetter() {
  const s = useGame.getState()
  if (weekdayOf(s.day) !== 1) return
  const id = `home-score-${s.day}`
  if (s.letters.some((l) => l.id === id)) return
  const score = scoreHome({ stage: s.home.stage, furniture: s.homeFurniture, framed: frameHung(!!s.wallPhoto, s.homeFurniture), framedFloor: frameFloor(!!s.wallPhoto, s.homeFurniture), garden: gardenStats(s.placed, decodeGarden(s.gardenTiles), HOME_SITE) })
  const tier = tierOf(score.total)
  const given = s.homeStars ?? []
  // 처음 오른 별 등급이면 그 등급을 받은 것으로 적는다. 같은 등급은 다음 주에도 선물이 없다.
  const starGift = starGiftFor(starsOf(score.total), given)
  useGame.setState({
    money: s.money + (tier?.reward.acorns ?? 0),
    miles: s.miles + (tier?.reward.miles ?? 0),
    homeStars: starGift ? [...given, starsOf(score.total)] : given,
    letters: [homeScoreLetter(score, s.day, given, firstScoreWeek(s.islandStart, s.day)), ...s.letters].slice(0, MAILBOX_MAX),
  })
  gainMileToast(tier?.reward.miles ?? 0, '집 꾸미기 점수')
}
useGame.subscribe((s, p) => {
  if (s.day !== p.day) sendHomeScoreLetter()
})
sendHomeScoreLetter()

// 섬 이야기 이후 목표를 채운 순간: 축하 토스트를 한 번 띄우고, 이번 주 소식에 한 줄 남긴다(같은 목표는 한 번만)
useGame.subscribe((s, p) => {
  if (s.shop === p.shop && s.dex === p.dex && s.rating === p.rating && s.home === p.home && s.homeFurniture === p.homeFurniture && s.placed === p.placed && s.gardenTiles === p.gardenTiles && s.wallPhoto === p.wallPhoto && s.storyChapter === p.storyChapter) return
  const now = afterProgressOf(s)
  const fresh = newAfterMilestones(afterProgressOf(p), now, s.afterCelebrated ?? [])
  if (fresh.length === 0) return
  const next = nearestAfterGoals(now)[0] ?? null
  useGame.setState({
    afterCelebrated: cleanAfterCelebrated([...(s.afterCelebrated ?? []), ...fresh]),
    weekMilestones: cleanWeekMilestones([...(s.weekMilestones ?? []), ...fresh.map(milestoneWeekLine)]),
    afterMilestoneDays: cleanAfterDays({ ...(s.afterMilestoneDays ?? {}), ...Object.fromEntries(fresh.map((k) => [k, s.day])) }),
  })
  for (const key of fresh) useGame.getState().notify(milestoneText(key, next))
})

// 답장 편지: 답장 날이 되면 그 주민의 편지로 우편함에 넣는다. 한 번만 넣도록 replied 표시를 함께 적는다.
function deliverReplies() {
  const s = useGame.getState()
  const due = repliesDue(s.outLetters, s.day)
  if (!due.length) return
  const letters = due
    .map((o) => {
      const v = VILLAGERS.find((x) => x.id === o.to)
      return v ? { id: `reply-${o.id}`, from: v.id, fromName: v.name, day: s.day, text: o.replyText, gift: null, read: false, claimed: false } : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
  const done = new Set(due.map((o) => o.id))
  useGame.setState({
    letters: [...letters, ...s.letters].slice(0, MAILBOX_MAX),
    outLetters: s.outLetters.map((o) => (done.has(o.id) ? { ...o, replied: true } : o)),
  })
}
useGame.subscribe((s, p) => {
  if (s.day !== p.day) deliverReplies()
})
deliverReplies()

// 이사 오고 가기(core/moving.ts): 날이 바뀔 때 떠날 주민, 올 손님, 새 고민을 본다.
function tickMoving() {
  const s = useGame.getState()
  let houses = s.houses
  let letters = s.letters
  let arrivals = s.arrivals
  let moveTalk = s.moveTalk
  let lastMoveDay = s.lastMoveDay
  const left = moveTalk && leaveDayOf(moveTalk.since) !== null && s.day >= leaveDayOf(moveTalk.since)! ? VILLAGERS.find((v) => v.id === moveTalk!.id) : undefined
  if (left) {
    houses = houses.filter((id) => id !== left.id)
    letters = [{ id: `farewell-${left.id}-${s.day}`, from: left.id, fromName: left.name, day: s.day, text: farewellText(left.name, left.tic), gift: 'photo-frame', read: false, claimed: false }, ...letters]
    // 떠난 주민은 다시 고르지 않는다
    const replacement = pickReplacement(VILLAGERS.filter((v) => v.guest && v.id !== left.id), houses, arrivals, s.day)
    const arrive = arrivalDayOf(s.day)
    if (replacement && arrive) arrivals = [...arrivals, { id: replacement, day: arrive }]
    moveTalk = null
    useGame.getState().notify(`${josa(left.name, '이', '가')} 이사를 갔어요. 빈 집터에 곧 새 이웃이 올 거예요`)
  }
  const due = arrivals.filter((a) => a.day <= s.day)
  if (due.length) {
    arrivals = arrivals.filter((a) => a.day > s.day)
    for (const a of due) {
      const v = VILLAGERS.find((x) => x.id === a.id)
      if (!v || houses.includes(v.id)) continue
      houses = [...houses, v.id]
      letters = [{ id: `welcome-${v.id}-${s.day}`, from: v.id, fromName: v.name, day: s.day, text: welcomeText(v.name, v.tic), gift: null, read: false, claimed: false }, ...letters]
    }
  }
  if (canThinkOfMoving({ day: s.day, islandStart: s.islandStart, lastMoveDay, moveTalk })) {
    const pick = pickMover(movers(VILLAGERS, houses).map((v) => ({ id: v.id, friendship: s.friendship[v.id] ?? 0 })), s.day)
    if (pick) {
      moveTalk = { id: pick, since: s.day }
      lastMoveDay = s.day
    }
  }
  if (houses !== s.houses || letters !== s.letters || arrivals !== s.arrivals || moveTalk !== s.moveTalk || lastMoveDay !== s.lastMoveDay) {
    useGame.setState({ houses, letters: letters.slice(0, MAILBOX_MAX), arrivals, moveTalk, lastMoveDay })
  }
}
useGame.subscribe((s, p) => {
  if (s.day !== p.day) tickMoving()
})
tickMoving()

// 2일차 아침: 모카의 편지와 바닷가 조개 부탁을 한 번 넣는다. 날이 바뀔 때와 불러올 때 확인한다.
// 2일차에 못 연 채 며칠 뒤에 들어와도 빠지지 않도록 '2일차 이후'면 넣는다(한 번만).
function tickDayTwo() {
  const s = useGame.getState()
  if (!shoreDue(daysSinceStart(s), s.questsDone, s.quests)) return
  const hasLetter = s.letters.some((l) => l.id === SHORE_LETTER)
  const letter = { id: SHORE_LETTER, from: 'mocha', fromName: '모카', day: s.day, text: SHORE_LETTER_TEXT, gift: null, read: false, claimed: false }
  useGame.setState({
    letters: hasLetter ? s.letters : [letter, ...s.letters].slice(0, MAILBOX_MAX),
    quests: [...s.quests, { id: SHORE_QUEST, baseline: { ...s.stats } }],
  })
}
useGame.subscribe((s, p) => {
  if (s.day !== p.day) tickDayTwo()
})
tickDayTwo()

// 섬 이야기: 조건을 채운 장을 차례로 넘기고 보상·위원회 편지를 준다. 여러 장이 한꺼번에 채워졌으면(예전 저장) 한 번에 넘기고 연출은 마지막 장만 띄운다.
function tickStory() {
  const s = useGame.getState()
  const cleared = s.storyChapter ?? 0
  const next = storyClearedCount(cleared, storyCtxOf(s))
  if (next === cleared) return
  const got = storyRewards(cleared, next)
  const letters = STORY_CHAPTERS.slice(cleared, next).map((ch) => ({
    id: `story-${ch.no}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day: s.day,
    text: `${ch.no}장 · ${josa(ch.title, '을', '를')} 마쳤어요. ${ch.letter}`,
    gift: ch.gift,
    read: false,
    claimed: false,
  }))
  const flashes = storyBannerTexts(cleared, next)
  // 5장을 마치면 감사 편지를 한 통 보내고 에필로그를 한 번 튼다(storyEnded 로 기억한다)
  const ending = next >= STORY_CHAPTERS.length && !s.storyEnded
  const endLetter = {
    id: 'story-end',
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day: s.day,
    text: '섬 이야기를 모두 마쳤어요. 여기까지 함께 와 주셔서 고마워요. 섬의 하루는 앞으로도 계속될 거예요.',
    gift: null,
    read: false,
    claimed: false,
  }
  useGame.setState({
    storyChapter: next,
    money: s.money + got.money,
    miles: s.miles + got.miles,
    letters: [...(ending ? [endLetter] : []), ...letters, ...s.letters].slice(0, MAILBOX_MAX),
    storyFlash: { text: flashes[0], key: Date.now() },
    storyFlashQueue: flashes.slice(1),
    ...(ending ? { storyEnded: true, storyEnding: Date.now() } : {}),
  })
  play('success')
  useGame.getState().notify(`📖 ${STORY_CHAPTERS[next - 1].title} 장을 마쳤어요 · 🌰 ${got.money}${got.miles ? ` · 🏅 ${formatMiles(got.miles)}` : ''}`)
}
useGame.subscribe((s, p) => {
  if (s.day === p.day && s.questsDone === p.questsDone && s.stats === p.stats && s.dex === p.dex && s.islandStart === p.islandStart && s.rating === p.rating) return
  tickStory()
})
tickStory()

// 이번 주 목표: 월요일이 되면 새 목표 셋을 뽑고(주 시작 통계를 기준으로), 채운 목표마다 마일리지를, 셋을 다 채우면 도토리와 편지를 준다.
function tickWeekly() {
  const s = useGame.getState()
  // 섬 이야기 5장을 마치기 전에는 이번 주 목표가 시작되지 않는다
  if (!weeklyOpen(s.storyChapter ?? 0)) return
  const week = mondayOf(s.day)
  if (!s.weekly || s.weekly.week !== week) {
    useGame.setState({ weekly: newWeekly(week, s.stats) })
    return
  }
  const w = s.weekly
  const view = weeklyView(w, s.day, s.stats)
  const fresh = view.rows.filter((r) => r.done && !w.got.includes(r.stat))
  const payBonus = view.rows.every((r) => r.done) && !w.bonus
  if (!fresh.length && !payBonus) return
  const letters = payBonus
    ? [{ id: `weekly-${week}`, from: 'committee', fromName: '섬 가꾸기 위원회', day: s.day, text: '이번 주 목표를 모두 채웠어요. 작은 하루하루가 섬을 가꿔요. 다음 주에도 함께해요.', gift: null, read: false, claimed: false }]
    : []
  useGame.setState({
    weekly: { ...w, got: [...w.got, ...fresh.map((r) => r.stat)], bonus: w.bonus || payBonus },
    miles: s.miles + WEEKLY_MILES * fresh.length,
    money: s.money + (payBonus ? WEEKLY_BONUS_MONEY : 0),
    letters: [...letters, ...s.letters].slice(0, MAILBOX_MAX),
  })
  play('success')
  s.notify(payBonus ? `🎯 이번 주 목표를 모두 채웠어요 · 🌰 ${WEEKLY_BONUS_MONEY}` : `🎯 이번 주 목표를 채웠어요 · 🏅 ${formatMiles(WEEKLY_MILES * fresh.length)}`)
}
useGame.subscribe((s, p) => {
  if (s.day === p.day && s.stats === p.stats && s.storyChapter === p.storyChapter) return
  tickWeekly()
})
tickWeekly()

// 오늘의 할 일: 해낸 항목에 마일리지를 준다(하루 상한은 core/todo.ts). 날이 바뀌면 정산 목록을 비운다.
let digsCache: { day: string; ids: string[] } | null = null
function digIdsOn(day: string): string[] {
  if (digsCache?.day !== day) digsCache = { day, ids: generateDay(day).digs.map((d) => d.id) }
  return digsCache.ids
}
export function todoCtxOf(s: GameState): TodoCtx {
  return {
    day: s.day,
    hour: currentHour(),
    weather: weatherFor(s.day),
    villagerIds: VILLAGERS.map((v) => v.id),
    nameOf: (id) => VILLAGERS.find((v) => v.id === id)?.name ?? '주민',
    giftDay: s.giftDay,
    talked: s.talked,
    marketBought: s.marketBought,
    tourneyLastDay: s.tourney.lastDay,
    wishNight: s.wishNight,
    plantCount: s.plants.length,
    plantsDry: s.plants.filter((p) => !p.watered).length,
    digIds: digIdsOn(s.day),
    dug: s.dug,
    fishToday: todayOf(s).fish,
    bugToday: todayOf(s).bug,
    letters: s.letters,
    outLetters: s.outLetters,
  }
}
/** 오늘 기록. 날이 바뀌었으면 빈 기록이다. */
function todayOf(s: GameState): TodoState {
  return s.todo.day === s.day ? s.todo : freshTodo(s.day)
}
/** 오늘 잡은 물고기나 벌레를 하나 센다. 정산은 todo 구독이 맡는다. */
function countCatchToday(kind: 'fish' | 'bug') {
  const s = useGame.getState()
  const cur = todayOf(s)
  useGame.setState({ todo: { ...cur, [kind]: cur[kind] + 1 } })
}
function settleTodos() {
  const s = useGame.getState()
  const today = todayOf(s)
  const { settle, miles } = rewardTodos(todayTodos(todoCtxOf(s)), today.settled, today.miles)
  if (!settle.length && today === s.todo) return
  useGame.setState({ todo: { ...today, day: s.day, settled: [...today.settled, ...settle], miles: today.miles + miles }, miles: s.miles + miles })
  gainMileToast(miles, '할 일', '개', settle.length)
}
useGame.subscribe((s, p) => {
  if (s.day !== p.day || s.talked !== p.talked || s.giftDay !== p.giftDay || s.marketBought !== p.marketBought || s.tourney !== p.tourney || s.wishNight !== p.wishNight || s.plants !== p.plants || s.dug !== p.dug || s.letters !== p.letters || s.outLetters !== p.outLetters || s.todo !== p.todo) settleTodos()
})
settleTodos()

// 섬 첫 날씨: 저장을 불러온 뒤 한 번 맞추고, 섬에 처음 온 날이 바뀔 때마다 다시 맞춘다
setIslandStart(useGame.getState().islandStart)
useGame.subscribe((s, p) => {
  if (s.islandStart !== p.islandStart) setIslandStart(s.islandStart)
})

// 저장된 주머니에 든 보물 지도를 불러올 때 아이템 정의를 맞춘다
useGame.getState().inventory.forEach((slot) => registerMapItem(slot.id))
