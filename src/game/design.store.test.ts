import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { blankCells, DESIGN_MAX, encodeCells } from '../core/design'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const painted = () => Array.from({ length: 256 }, (_, i) => (i % 12))

beforeEach(() => {
  useGame.setState({ ...fresh, designs: [], flagDesign: null, shirtDesign: null })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('마이 디자인 저장', () => {
  it('새 디자인은 기본 이름으로 저장하고 id 를 돌려준다', () => {
    const id = useGame.getState().saveDesign(painted())
    expect(id).toBeTruthy()
    const d = useGame.getState().designs[0]
    expect(d).toMatchObject({ id, name: '디자인 1', cells: encodeCells(painted()) })
  })

  it('여섯 장을 넘기면 저장하지 않고 null 을 돌려준다', () => {
    for (let i = 0; i < DESIGN_MAX; i++) expect(useGame.getState().saveDesign(blankCells())).toBeTruthy()
    expect(useGame.getState().saveDesign(blankCells())).toBeNull()
    expect(useGame.getState().designs).toHaveLength(DESIGN_MAX)
  })

  it('id 를 주면 그 디자인을 고쳐 쓴다', () => {
    const id = useGame.getState().saveDesign(blankCells())!
    useGame.getState().saveDesign(painted(), id)
    expect(useGame.getState().designs).toHaveLength(1)
    expect(useGame.getState().designs[0].cells).toBe(encodeCells(painted()))
  })

  it('지운 디자인이 달린 깃발과 티셔츠는 기본으로 돌아간다', () => {
    const id = useGame.getState().saveDesign(blankCells())!
    useGame.getState().setFlagDesign(id)
    useGame.getState().setShirtDesign(id)
    useGame.getState().deleteDesign(id)
    const s = useGame.getState()
    expect(s.designs).toHaveLength(0)
    expect(s.flagDesign).toBeNull()
    expect(s.shirtDesign).toBeNull()
  })

  it('없는 디자인은 깃발이나 티셔츠에 달 수 없다', () => {
    useGame.getState().setFlagDesign('nope')
    useGame.getState().setShirtDesign('nope')
    expect(useGame.getState().flagDesign).toBeNull()
    expect(useGame.getState().shirtDesign).toBeNull()
  })
})

describe('마이 디자인 저장 정리(migrateSave)', () => {
  it('깨진 그림과 같은 id 는 버리고, 없는 디자인을 가리키는 깃발은 기본으로 돌린다', () => {
    const good = { id: 'a', name: '좋은 그림', cells: encodeCells(painted()) }
    const s = migrateSave({
      designs: [good, { id: 'a', name: '같은 id', cells: encodeCells(painted()) }, { id: 'b', name: '깨짐', cells: 'xyz' }],
      flagDesign: 'b',
      shirtDesign: 'a',
    })
    expect(s.designs.map((d) => d.id)).toEqual(['a'])
    expect(s.flagDesign).toBeNull()
    expect(s.shirtDesign).toBe('a')
  })

  it('여섯 장을 넘는 저장은 앞의 여섯 장만 남긴다', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, name: `디자인 ${i}`, cells: encodeCells(blankCells()) }))
    expect(migrateSave({ designs: many }).designs).toHaveLength(DESIGN_MAX)
  })
})
