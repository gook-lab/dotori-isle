/**
 * 예전 저장의 물건 id 를 새 id 로 옮긴다.
 * 종이 등불은 축제 가구(칸마다 한 개)와 백화점 재료(칸마다 최대 다섯 개)가 같은 id 를 써 왔다.
 * 여러 개 묶인 칸은 재료였으니 등롱(lantern-hanging)으로 옮기고, 한 개짜리 칸은 축제 가구로 둔다.
 */
export function migrateItemIds<T extends { id: string; count: number }>(slots: readonly T[]): T[] {
  return slots.map((s) => (s.id === 'paper-lantern' && s.count > 1 ? { ...s, id: 'lantern-hanging' } : s))
}
