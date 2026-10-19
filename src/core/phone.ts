/**
 * 게임 안 휴대폰의 앱 목록. 앱을 누르면 기존 패널을 그대로 연다(새 화면을 만들지 않는다).
 * 어떤 앱이 보이는지만 정한다. 순수 함수라 React 에 의존하지 않는다.
 */

export type PhoneTarget = 'quest' | 'dex' | 'map' | 'miles' | 'calendar' | 'photo' | 'album' | 'closet' | 'design' | 'homeScore' | 'songi' | 'help' | 'settings' | 'notices' | 'life'

export interface PhoneApp {
  id: PhoneTarget
  name: string
  icon: string
  /** 아직 열리지 않은 기능(카메라 = 사진 모드). 눌러도 열리지 않고 열리는 조건을 보여 준다. */
  locked: boolean
}

export interface PhoneCtx {
  /** 사진 모드가 열렸는가(systemOpen('photo')) */
  photoOpen: boolean
  /** 일요일인가(송이 상인이 올 수 있는 날) */
  sunday: boolean
  /** 집 안에 있는가(꾸미기 점수는 집 안에서만 보인다) */
  inHome: boolean
}

const ALL: readonly Omit<PhoneApp, 'locked'>[] = [
  { id: 'quest', name: '미션', icon: '📜' },
  { id: 'dex', name: '도감', icon: '📖' },
  { id: 'map', name: '지도', icon: '🗺️' },
  { id: 'miles', name: '마일리지', icon: '🏅' },
  { id: 'calendar', name: '달력', icon: '📅' },
  { id: 'life', name: '섬 살림', icon: '🏝️' },
  { id: 'photo', name: '카메라', icon: '📷' },
  { id: 'album', name: '사진 앨범', icon: '🖼️' },
  { id: 'closet', name: '옷장', icon: '👕' },
  { id: 'design', name: '마이 디자인', icon: '🎨' },
  { id: 'homeScore', name: '꾸미기 점수', icon: '🏡' },
  { id: 'songi', name: '송이 상인', icon: '🍄' },
  { id: 'help', name: '단축키', icon: '⌨️' },
  { id: 'settings', name: '설정', icon: '⚙️' },
  { id: 'notices', name: '알림', icon: '🔔' },
]

/** 지금 보여 줄 앱. 카메라는 잠겨 있어도 보여 주고, 송이 상인은 일요일에만 나온다. 목록 순서가 화면 순서다. */
export function phoneApps(c: PhoneCtx): PhoneApp[] {
  return ALL.filter((a) => (a.id !== 'songi' || c.sunday) && (a.id !== 'homeScore' || c.inHome)).map((a) => ({ ...a, locked: a.id === 'photo' && !c.photoOpen }))
}
