/**
 * 다음에 붙일 섬 기능 제안 (데이터만, 구현 없음).
 *
 * 각 항목은 같은 틀로 적는다.
 * - state:   store 에 새로 들어갈 필드(기존 SaveData 에 추가할 것)
 * - actions: store 액션 이름
 * - ui:      패널·HUD 변경
 * - scene:   씬에 놓일 오브젝트
 * - effort:  S(하루 이내) · M(사흘 이내) · L(한 주 이상)
 *
 * 우선순위는 위에서 아래 순서다. 1번은 기존 수집 루프(도감·퀘스트)를 그대로 써서 가장 싸다.
 * 가격·보상 숫자는 items.ts, quests.ts, miles.ts 의 현재 값에 맞췄다.
 */

export interface RoadmapItem {
  id: string
  title: string
  /** 한 줄 취지 */
  pitch: string
  state: string[]
  actions: string[]
  ui: string[]
  scene: string[]
  effort: 'S' | 'M' | 'L'
}

export const ROADMAP: readonly RoadmapItem[] = [
  {
    id: 'museum-donation',
    title: '자연사 전시관 기증',
    pitch: '도감에 오른 벌레·물고기·화석을 전시관에 기증하면 마일과 칭호가 쌓인다. 도감을 채우는 이유를 준다.',
    state: ['museumDonated: string[] (기증한 itemId)', 'museumRewardsClaimed: number (완성 구역 수)'],
    actions: ['donate(itemId)', 'claimMuseumReward(zone)'],
    // 기증 한 건은 마일을 주지 않는다(도감 기록이 이미 보상). 구역을 채울 때만 마일을 준다.
    ui: ['도감(dex) 패널에 "기증" 탭 추가', '구역 완성 시 miles +200·300 (miles.ts 의 단계 보상과 같은 크기)'],
    scene: ['전시관 건물 1개(벽 진열대 4칸)', '기증한 물건을 진열대에 얹는 장식 메시'],
    effort: 'M',
  },
  {
    id: 'island-rating',
    title: '섬 별점',
    pitch: '꾸밈·주민 친밀도·다양성(도감 종 수)을 별 1~5개로 보여 준다. 목표가 눈에 보이는 한 줄 지표다.',
    state: ['없음: stats 와 friendship, dex, placed 에서 계산 (파생값)'],
    actions: ['없음 (순수 계산 함수 islandRating(state) 로 충분)'],
    ui: ['HUD 우상단에 별 아이콘 한 줄', 'J 수첩에 세부 항목 세 줄(꾸밈 · 이웃 · 도감)'],
    scene: ['없음 (깃발·현판은 선택 사항)'],
    effort: 'S',
  },
  {
    id: 'weekday-market',
    title: '요일 장터',
    pitch: '이름 없는 장터 가판대가 날짜 시드로 제철 물건 값을 매일 바꿔 판다. 상점 진열(shopTiers)과 짝을 이룬다.',
    state: ['없음: dailyStock 과 같은 날짜 시드 규칙으로 계산'],
    actions: ['sellAtMarket(index)'],
    ui: ['상점 패널 "장터" 탭: 오늘의 값 표시(±30%)'],
    scene: ['장터 가판대 1개(상점 옆 빈 자리 — 옷 가판대와 대칭)'],
    effort: 'S',
  },
  {
    id: 'villager-birthday',
    title: '주민 생일',
    pitch: '주민마다 정해진 날짜에 생일 편지와 선물이 온다. 집을 지은 주민만 챙긴다.',
    state: ['없음: VillagerDef.birthday(MM-DD) 를 정의에 추가', 'birthdaysClaimed: string[] (연도-주민)'],
    actions: ['claimBirthday(villagerId)'],
    ui: ['편지함(mail) 에 생일 편지 자동 추가 (letters.ts 의 morningLetter 경로)'],
    scene: ['생일 날 주민 머리 위 케이크 이모지 1개(Chibi 말풍선)'],
    effort: 'S',
  },
  {
    id: 'seasonal-festival',
    title: '계절 축제',
    pitch: '계절이 바뀔 때 섬 광장에 3일짜리 축제가 열린다. 축제 기간에만 파는 물건과 계절 퀘스트가 있다.',
    state: ['festivalDays: string[] (참여한 날짜 키)', '없음 나머지: season.ts 와 날짜 키 계산 재사용'],
    actions: ['joinFestival()', 'claimFestivalReward(day)'],
    ui: ['HUD 에 "축제 D-2" 배지', '축제 전용 퀘스트 두 개를 quests.ts 의 DAILY_POOL 과 같은 방식으로 뽑기'],
    scene: ['광장 장식(현수막·조명 줄) — 계절 색을 season.ts 의 SEASON_INFO 에서 가져오기'],
    effort: 'L',
  },
]
