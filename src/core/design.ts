/**
 * 마이 디자인: 16×16 픽셀 그림. 팔레트 12칸(0번은 투명, 1~b 는 색)으로 칠하고, 256칸을 0~b 16진수 256자로 저장한다.
 * 깃발과 무지 티셔츠 앞판에 붙인다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

export const DESIGN_SIZE = 16
export const DESIGN_CELLS = DESIGN_SIZE * DESIGN_SIZE
/** 저장할 수 있는 디자인 수 */
export const DESIGN_MAX = 6
/** 되돌리기 단계 */
export const UNDO_MAX = 10

/** 팔레트 12칸. 0번은 투명(지우개), 나머지는 색이다. null 은 투명을 뜻한다. */
export const PALETTE: readonly (string | null)[] = [
  null,
  '#2b2018',
  '#ffffff',
  '#f0758a',
  '#e2412f',
  '#f5d25a',
  '#7cc576',
  '#3f8f4e',
  '#6aa9e9',
  '#3f6fb5',
  '#b49ae6',
  '#a0715a',
]

export interface SavedDesign {
  id: string
  name: string
  /** 256자, 각 글자는 팔레트 인덱스(0~b) */
  cells: string
}

export const blankCells = (): number[] => new Array<number>(DESIGN_CELLS).fill(0)

/** 칸 배열을 256자 문자열로 바꾼다. 인덱스 0~11 은 한 글자 16진수다. */
export function encodeCells(cells: readonly number[]): string {
  return cells.map((v) => v.toString(16)).join('')
}

/** 저장 문자열을 칸 배열로 바꾼다. 길이가 다르거나 모르는 글자가 있으면 null. */
export function decodeCells(s: unknown): number[] | null {
  if (typeof s !== 'string' || !/^[0-9a-b]+$/.test(s) || s.length !== DESIGN_CELLS) return null
  return [...s].map((c) => parseInt(c, 16))
}

/** 저장된 디자인 하나를 믿을 수 있는 값으로 맞춘다. 깨졌으면 null. */
export function sanitizeDesign(raw: unknown): SavedDesign | null {
  const r = (raw ?? {}) as Partial<SavedDesign>
  if (typeof r.id !== 'string' || !r.id) return null
  if (!decodeCells(r.cells)) return null
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 12) : '디자인'
  return { id: r.id, name, cells: r.cells as string }
}

/** 칸 번호와 좌표 */
export const cellIndex = (x: number, y: number): number => y * DESIGN_SIZE + x
export const inGrid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < DESIGN_SIZE && y < DESIGN_SIZE

/** 연결된 같은 색 칸을 한꺼번에 칠한다. 같은 색이면 그대로 둔다. */
export function floodFill(cells: readonly number[], x: number, y: number, color: number): number[] {
  const out = [...cells]
  if (!inGrid(x, y)) return out
  const from = out[cellIndex(x, y)]
  if (from === color) return out
  const stack = [[x, y]]
  while (stack.length) {
    const [cx, cy] = stack.pop()!
    if (!inGrid(cx, cy) || out[cellIndex(cx, cy)] !== from) continue
    out[cellIndex(cx, cy)] = color
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }
  return out
}

/** 두 칸 사이를 빈틈없이 잇는다(브레즌햄 선). 손으로 빨리 그어도 끊기지 않게 쓴다. 끝 칸은 포함한다. */
export function paintLine(cells: readonly number[], from: { x: number; y: number } | null, to: { x: number; y: number }, color: number): number[] {
  const out = [...cells]
  let x0 = from?.x ?? to.x
  let y0 = from?.y ?? to.y
  const dx = Math.abs(to.x - x0)
  const dy = -Math.abs(to.y - y0)
  const sx = x0 < to.x ? 1 : -1
  const sy = y0 < to.y ? 1 : -1
  let err = dx + dy
  for (;;) {
    if (inGrid(x0, y0)) out[cellIndex(x0, y0)] = color
    if (x0 === to.x && y0 === to.y) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
  return out
}

/** 되돌리기 쌓기: 지금 그림을 넣고, UNDO_MAX 단계를 넘으면 가장 오래된 것부터 뺀다. */
export function pushUndo(stack: readonly number[][], cells: readonly number[]): number[][] {
  return [...stack, [...cells]].slice(-UNDO_MAX)
}

/** 되돌리기: 마지막 그림을 꺼낸다. 쌓인 게 없으면 null. */
export function popUndo(stack: readonly number[][]): { stack: number[][]; cells: number[] } | null {
  if (stack.length === 0) return null
  return { stack: stack.slice(0, -1), cells: [...stack[stack.length - 1]] }
}

/** 디자인을 더한다. 여섯 장을 다 쓰면 null. */
export function addDesign(list: readonly SavedDesign[], design: SavedDesign): SavedDesign[] | null {
  if (list.length >= DESIGN_MAX) return null
  return [...list, design]
}

/** 기본 이름: 디자인 1, 디자인 2 … 중에서 아직 안 쓴 가장 작은 번호 */
export function nextDesignName(list: readonly SavedDesign[]): string {
  for (let n = 1; ; n++) {
    const name = `디자인 ${n}`
    if (!list.some((d) => d.name === name)) return name
  }
}

/** 새 디자인 id. 시각과 난수로 만든다. */
export const newDesignId = (): string => `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
