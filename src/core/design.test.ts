import { describe, expect, it } from 'vitest'
import {
  addDesign,
  blankCells,
  cellIndex,
  DESIGN_CELLS,
  DESIGN_MAX,
  decodeCells,
  encodeCells,
  floodFill,
  nextDesignName,
  paintLine,
  popUndo,
  pushUndo,
  sanitizeDesign,
  UNDO_MAX,
} from './design'

describe('디자인 저장 형식', () => {
  it('빈 그림은 256자 0 이다', () => {
    const s = encodeCells(blankCells())
    expect(s).toBe('0'.repeat(DESIGN_CELLS))
  })

  it('인코딩하고 다시 풀면 같다. 0~b 를 모두 쓴다', () => {
    const cells = Array.from({ length: DESIGN_CELLS }, (_, i) => i % 12)
    const s = encodeCells(cells)
    expect(s).toHaveLength(DESIGN_CELLS)
    expect(decodeCells(s)).toEqual(cells)
  })

  it('길이가 다르거나 모르는 글자가 있으면 풀지 않는다', () => {
    expect(decodeCells('0'.repeat(255))).toBeNull()
    expect(decodeCells('c' + '0'.repeat(255))).toBeNull()
    expect(decodeCells('G' + '0'.repeat(255))).toBeNull()
    expect(decodeCells(42)).toBeNull()
  })

  it('저장된 디자인은 id 와 이름을 맞추고, 깨진 것은 버린다', () => {
    const ok = sanitizeDesign({ id: 'd1', name: '  나무  ', cells: '0'.repeat(256) })
    expect(ok).toEqual({ id: 'd1', name: '나무', cells: '0'.repeat(256) })
    expect(sanitizeDesign({ id: 'd2', cells: '0'.repeat(256) })?.name).toBe('디자인')
    expect(sanitizeDesign({ id: '', cells: '0'.repeat(256) })).toBeNull()
    expect(sanitizeDesign({ id: 'd3', cells: 'xyz' })).toBeNull()
  })
})

describe('채우기', () => {
  it('같은 색으로 이어진 칸만 칠한다', () => {
    // 가운데 세로선으로 두 구역을 나눈다
    let cells = blankCells()
    for (let y = 0; y < 16; y++) cells[cellIndex(8, y)] = 1
    const out = floodFill(cells, 0, 0, 4)
    expect(out[cellIndex(7, 15)]).toBe(4)
    expect(out[cellIndex(9, 0)]).toBe(0)
    expect(out[cellIndex(8, 3)]).toBe(1)
  })

  it('같은 색으로 채우면 그대로다. 밖의 좌표도 무시한다', () => {
    const cells = blankCells()
    expect(floodFill(cells, 3, 3, 0)).toEqual(cells)
    expect(floodFill(cells, -1, 0, 5)).toEqual(cells)
  })
})

describe('선 긋기', () => {
  it('두 끝 칸을 포함해 빈틈없이 잇는다', () => {
    const out = paintLine(blankCells(), { x: 1, y: 1 }, { x: 5, y: 1 }, 3)
    for (let x = 1; x <= 5; x++) expect(out[cellIndex(x, 1)]).toBe(3)
    expect(out.filter((v) => v === 3)).toHaveLength(5)
  })

  it('대각선도 끊기지 않는다', () => {
    const out = paintLine(blankCells(), { x: 0, y: 0 }, { x: 4, y: 4 }, 2)
    expect(out.filter((v) => v === 2)).toHaveLength(5)
  })

  it('이전 칸이 없으면 그 한 칸만 칠한다', () => {
    const out = paintLine(blankCells(), null, { x: 7, y: 7 }, 9)
    expect(out.filter((v) => v === 9)).toHaveLength(1)
    expect(out[cellIndex(7, 7)]).toBe(9)
  })
})

describe('되돌리기', () => {
  it('열 번까지만 쌓고 가장 오래된 것부터 뺀다', () => {
    let stack: number[][] = []
    for (let i = 0; i < UNDO_MAX + 3; i++) stack = pushUndo(stack, [i])
    expect(stack).toHaveLength(UNDO_MAX)
    expect(stack[0]).toEqual([3])
    expect(stack[UNDO_MAX - 1]).toEqual([UNDO_MAX + 2])
  })

  it('마지막 그림을 꺼내고, 빈 기록이면 null', () => {
    const r = popUndo([[1], [2]])
    expect(r).toEqual({ stack: [[1]], cells: [2] })
    expect(popUndo([])).toBeNull()
  })
})

describe('디자인 목록', () => {
  const d = (id: string, name: string) => ({ id, name, cells: '0'.repeat(256) })

  it('여섯 장을 넘기지 않는다', () => {
    let list: ReturnType<typeof d>[] = []
    for (let i = 0; i < DESIGN_MAX; i++) list = addDesign(list, d(`d${i}`, `디자인 ${i + 1}`)) ?? []
    expect(list).toHaveLength(DESIGN_MAX)
    expect(addDesign(list, d('x', '더'))).toBeNull()
  })

  it('기본 이름은 아직 안 쓴 가장 작은 번호다', () => {
    expect(nextDesignName([])).toBe('디자인 1')
    expect(nextDesignName([d('a', '디자인 1'), d('b', '디자인 3')])).toBe('디자인 2')
  })
})
