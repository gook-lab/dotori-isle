/** 옷 가판대에서 파는 모자와 옷. 산 것은 언제든 옷장(C)에서 갈아입는다. */

export interface WearDef {
  id: string
  slot: 'hat' | 'outfit'
  name: string
  icon: string
  price: number
  /** 옷이면 셔츠 색, 모자면 주 색 */
  color: string
  /** 옷 가판대에 나오는 상점 단계(없으면 0단계부터) */
  minTier?: number
}

export const WEARS: WearDef[] = [
  { id: 'shirt-sky', slot: 'outfit', name: '하늘 셔츠', icon: '👕', price: 0, color: '#6aa9e9' },
  // 앞판에 마이 디자인을 입힐 수 있는 흰 티셔츠(core/design.ts, store.shirtDesign)
  { id: 'shirt-plain', slot: 'outfit', name: '무지 티셔츠', icon: '👕', price: 120, color: '#f4f1ea' },
  { id: 'shirt-berry', slot: 'outfit', name: '딸기 셔츠', icon: '👕', price: 200, color: '#f0758a' },
  { id: 'shirt-sprout', slot: 'outfit', name: '새싹 셔츠', icon: '👕', price: 200, color: '#7cc576' },
  { id: 'shirt-lemon', slot: 'outfit', name: '레몬 셔츠', icon: '👕', price: 200, color: '#f5d25a' },
  { id: 'shirt-lilac', slot: 'outfit', name: '라일락 셔츠', icon: '👕', price: 250, color: '#b49ae6' },
  { id: 'shirt-cocoa', slot: 'outfit', name: '코코아 셔츠', icon: '👕', price: 250, color: '#a0715a' },
  { id: 'swim-suit', slot: 'outfit', name: '수영복', icon: '🩱', price: 180, color: '#2fa8c9', minTier: 1 },
  { id: 'straw-hat', slot: 'hat', name: '밀짚모자', icon: '👒', price: 300, color: '#f2d38a' },
  { id: 'beanie', slot: 'hat', name: '방울 털모자', icon: '🧶', price: 350, color: '#e46a52' },
  { id: 'cap', slot: 'hat', name: '챙 모자', icon: '🧢', price: 350, color: '#3f6fb5' },
  { id: 'flower-crown', slot: 'hat', name: '꽃 화관', icon: '🌼', price: 500, color: '#ff9fb5' },
  { id: 'acorn-hat', slot: 'hat', name: '도토리 모자', icon: '🌰', price: 800, color: '#8a5a3b' },
]

export const WEAR_BY_ID: Record<string, WearDef> = Object.fromEntries(WEARS.map((w) => [w.id, w]))

export const DEFAULT_OUTFIT = 'shirt-sky'

export interface Wear {
  hat: string | null
  outfit: string
}
