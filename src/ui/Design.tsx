import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { blankCells, cellIndex, DESIGN_MAX, DESIGN_SIZE, decodeCells, floodFill, inGrid, PALETTE, paintLine, popUndo, pushUndo, type SavedDesign } from '../core/design'
import { useGame } from '../game/store'
import { Modal } from './Panels'

/** 칸 배열을 캔버스에 그린다. 투명 칸은 그리지 않아 뒤의 바둑판 무늬가 보인다. */
function drawCells(canvas: HTMLCanvasElement, cells: readonly number[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
  cells.forEach((v, i) => {
    const color = PALETTE[v]
    if (!color) return
    ctx.fillStyle = color
    ctx.fillRect(i % DESIGN_SIZE, Math.floor(i / DESIGN_SIZE), 1, 1)
  })
}

/** 저장된 그림의 작은 미리보기 */
function DesignThumb({ cells, size }: { cells: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const px = decodeCells(cells)
    if (ref.current && px) drawCells(ref.current, px)
  }, [cells])
  return <canvas ref={ref} width={DESIGN_SIZE} height={DESIGN_SIZE} className="design-thumb" style={{ width: size, height: size }} aria-hidden="true" />
}

type Tool = 'brush' | 'fill' | 'erase'
const TOOL_NAME: Record<Tool, string> = { brush: '붓', fill: '채우기', erase: '지우개' }

/** 마이 디자인 화면: 목록과 16×16 편집기를 번갈아 보여 준다 */
export function DesignPanel() {
  const designs = useGame((s) => s.designs)
  const flagDesign = useGame((s) => s.flagDesign)
  const shirtDesign = useGame((s) => s.shirtDesign)
  const deleteDesign = useGame((s) => s.deleteDesign)
  const setFlagDesign = useGame((s) => s.setFlagDesign)
  const setShirtDesign = useGame((s) => s.setShirtDesign)
  const [editing, setEditing] = useState<{ id?: string; cells: number[] } | null>(null)
  const [askDelete, setAskDelete] = useState<string | null>(null)
  const full = designs.length >= DESIGN_MAX

  if (editing) {
    return (
      <Modal title="마이 디자인 그리기" tall>
        <DesignEditor key={editing.id ?? 'new'} id={editing.id} initial={editing.cells} onDone={() => setEditing(null)} />
      </Modal>
    )
  }
  return (
    <Modal title="마이 디자인" tall>
      {designs.length > 0 && <p className="note">{designs.length}/{DESIGN_MAX}장 저장했어요. 광장 깃발과 무지 티셔츠 앞판에 달 수 있어요.</p>}
      <div className="tab-body">
        <button className="primary" disabled={full} onClick={() => setEditing({ cells: blankCells() })}>
          {full ? '여섯 장을 다 썼어요. 하나 지우고 그려요' : '새로 그리기'}
        </button>
      </div>
      {designs.length === 0 && <p className="note">아직 그린 디자인이 없어요. {DESIGN_MAX}장까지 저장할 수 있어요.</p>}
      <ul className="buy-list">
        {designs.map((d: SavedDesign) => {
          const onFlag = flagDesign === d.id
          const onShirt = shirtDesign === d.id
          return (
            <li key={d.id}>
              <span className="big">
                <DesignThumb cells={d.cells} size={44} />
              </span>
              <span className="name">
                {d.name}
                <small className="note">{[onFlag && '깃발에 달림', onShirt && '티셔츠에 입힘'].filter(Boolean).join(' · ') || '아직 달지 않았어요'}</small>
              </span>
              <span className="design-actions">
                <button onClick={() => setEditing({ id: d.id, cells: [...(decodeCells(d.cells) ?? blankCells())] })}>고치기</button>
                <button aria-pressed={onFlag} onClick={() => setFlagDesign(onFlag ? null : d.id)}>
                  {onFlag ? '깃발에서 떼기' : '깃발에 달기'}
                </button>
                <button aria-pressed={onShirt} onClick={() => setShirtDesign(onShirt ? null : d.id)}>
                  {onShirt ? '티셔츠에서 떼기' : '티셔츠에 입히기'}
                </button>
                {askDelete === d.id ? (
                  <button className="primary" onClick={() => { deleteDesign(d.id); setAskDelete(null) }}>정말 지울까요?</button>
                ) : (
                  <button onClick={() => setAskDelete(d.id)}>지우기</button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

/** 16×16 편집기. 마우스와 터치 모두 드래그로 칠한다. 되돌리기는 열 단계까지다. */
function DesignEditor({ id, initial, onDone }: { id?: string; initial: number[]; onDone: () => void }) {
  const saveDesign = useGame((s) => s.saveDesign)
  const [cells, setCells] = useState<number[]>(initial)
  const [undo, setUndo] = useState<number[][]>([])
  const [tool, setTool] = useState<Tool>('brush')
  // 0번은 투명(지우개와 같다). 붓은 1번부터 고른다.
  const [color, setColor] = useState(1)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<{ last: { x: number; y: number } | null; active: boolean }>({ last: null, active: false })

  useEffect(() => {
    if (canvas.current) drawCells(canvas.current, cells)
  }, [cells])

  /** 캔버스 안의 칸 좌표. 화면 밖이면 null. */
  const cellAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * DESIGN_SIZE)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * DESIGN_SIZE)
    return inGrid(x, y) ? { x, y } : null
  }

  const paintValue = tool === 'erase' ? 0 : color

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = cellAt(e)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    // 한 번 누르고 떼는 것이 한 단계다. 채우기는 바로 한 번에 칠한다.
    if (tool === 'fill') {
      if (cells[cellIndex(p.x, p.y)] === paintValue) return
      setUndo((u) => pushUndo(u, cells))
      setCells((c) => floodFill(c, p.x, p.y, paintValue))
      return
    }
    stroke.current = { last: null, active: true }
    setUndo((u) => pushUndo(u, cells))
    setCells((c) => paintLine(c, null, p, paintValue))
    stroke.current.last = p
  }

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!stroke.current.active || tool === 'fill') return
    const p = cellAt(e)
    if (!p) return
    const from = stroke.current.last
    if (from && from.x === p.x && from.y === p.y) return
    setCells((c) => paintLine(c, from, p, paintValue))
    stroke.current.last = p
  }

  const onUp = () => {
    stroke.current = { last: null, active: false }
  }

  const doUndo = () => {
    const r = popUndo(undo)
    if (!r) return
    setUndo(r.stack)
    setCells(r.cells)
  }

  const clearAll = () => {
    if (cells.every((v) => v === 0)) return
    setUndo((u) => pushUndo(u, cells))
    setCells(blankCells())
  }

  const save = () => {
    const saved = saveDesign(cells, id)
    if (saved) onDone()
  }

  return (
    <div className="design-editor">
      <div className="design-canvas-wrap">
        <canvas
          ref={canvas}
          width={DESIGN_SIZE}
          height={DESIGN_SIZE}
          className="design-canvas"
          role="img"
          aria-label="16 × 16 그림판"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <div className="design-tools" role="group" aria-label="도구">
        {(Object.keys(TOOL_NAME) as Tool[]).map((t) => (
          <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)}>
            {TOOL_NAME[t]}
          </button>
        ))}
        <button disabled={undo.length === 0} onClick={doUndo}>
          되돌리기 {undo.length}/10
        </button>
        <button onClick={clearAll}>모두 지우기</button>
      </div>
      <div className="design-palette" role="group" aria-label="팔레트">
        {PALETTE.map((c, i) => (
          <button
            key={i}
            className={c ? 'swatch-btn' : 'swatch-btn clear'}
            aria-label={c ? `색 ${i}` : '투명'}
            aria-pressed={color === i && tool !== 'erase'}
            style={c ? { background: c } : undefined}
            onClick={() => {
              setColor(i)
              if (i === 0) setTool('erase')
              else if (tool === 'erase') setTool('brush')
            }}
          />
        ))}
      </div>
      <div className="design-footer">
        <button onClick={onDone}>목록으로</button>
        <button className="primary" onClick={save}>
          {id ? '고쳐 저장' : '저장'}
        </button>
      </div>
    </div>
  )
}
