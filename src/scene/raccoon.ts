import type { Look } from './Chibi'

/**
 * 너구리 점원의 몸 색. 직접 만든 모습이다. 회갈색 털, 눈 둘레를 가로지르는 검은 눈가 마스크,
 * 입 주변은 밝은 주둥이, 앞치마(외투 색)로 그린다. 상점 실내와 바깥 공사·재개장 연출이 같이 쓴다.
 */
export const RACCOON_LOOK: Record<string, Look> = {
  garam: { skin: '#8a7560', outfit: '#f4ead8', ears: 'round', mask: '#f3e6d0', beak: '#2b2320', belly: '#d9c7a8', earInner: '#2b2320' },
  narl: { skin: '#9c8670', outfit: '#e4d3b2', ears: 'round', mask: '#f3e6d0', beak: '#2b2320', belly: '#e0cfb0', earInner: '#2b2320' },
}
