/**
 * 섬 이야기 이후 목표의 숫자와 키 형식. 화면 쪽 모듈 없이 쓰도록 import 가 없는 작은 모듈로 둔다.
 * 목표 키는 `home-stars:2`, `shop-tier:3`, `dex:50`, `island-stars:5` 꼴이다.
 */

/** 집 별 등급(1~5), 도토리 백화점 단계(3이 백화점), 섬 별점(5 만점). 목표 키 형식도 여기서 함께 정한다. */
export const HOME_STAR_MAX = 5
export const SHOP_DEPARTMENT_TIER = 3
export const ISLAND_STAR_MAX = 5
/** 도감 목표 종 수. 낮은 것부터 한 번에 하나만 보여 준다. */
export const DEX_MILESTONES = [50, 100, 150] as const
export const MILESTONE_KEY_RE = new RegExp(`^(home-stars:[1-5]|shop-tier:${SHOP_DEPARTMENT_TIER}|dex:(${DEX_MILESTONES.join('|')})|island-stars:${ISLAND_STAR_MAX})$`)
