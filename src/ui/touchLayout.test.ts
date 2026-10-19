import { describe, expect, it } from 'vitest'

// 스타일 파일을 직접 읽는다(테스트 환경은 CSS 를 비워 두므로 ?raw 로는 글을 못 얻는다)
type NodeProcess = { getBuiltinModule: (id: 'node:fs') => { readFileSync: (path: URL, enc: 'utf8') => string } }
const fs = (globalThis as unknown as { process: NodeProcess }).process.getBuiltinModule('node:fs')
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

/** 같은 셀렉터의 규칙 본문을 모두 모은다(미디어 안의 덮어쓰기 블록도 포함) */
const blocks = (sel: string) => [...css.matchAll(new RegExp(`(?:^|\\n)${sel.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`, 'g'))].map((m) => m[1])
const block = (sel: string) => blocks(sel).join('\n')
const px = (body: string, prop: string) => Number((new RegExp(`${prop}:\\s*(-?\\d+)px`).exec(body) ?? [])[1])

// 손가락 스틱(왼쪽 아래)과 버튼 줄(오른쪽 아래)이 겹치면 놓기 중에 스틱을 끌 수 없다.
// 버튼 줄은 오른쪽 끝에서 (100vw - maxSubtract) 까지 차지하므로, 그 왼쪽 끝이 스틱 오른쪽 끝보다 오른쪽이어야 한다.
describe('터치 조작 배치', () => {
  it('놓기 중 버튼 줄은 스틱을 가리지 않는다', () => {
    const stick = block('.stick')
    const row = block('.touch-buttons.is-placing')
    const stickRight = px(stick, 'left') + px(stick, 'width')
    const rowRight = px(blocks('.touch-buttons').find((b) => b.includes('right:')) ?? '', 'right')
    const maxSubtract = Number((/max-width:\s*calc\(100vw - (\d+)px\)/.exec(row) ?? [])[1])
    expect(stickRight).toBe(148)
    expect(row).toContain('flex-wrap: wrap')
    expect(maxSubtract).toBeGreaterThan(0)
    // 뷰포트 너비와 무관하게 왼쪽 끝 = rowRight + (maxSubtract - rowRight)
    expect(maxSubtract).toBeGreaterThanOrEqual(stickRight + rowRight)
  })

  it('TouchControls 는 놓기 중에 is-placing 줄을 붙인다', () => {
    const src = fs.readFileSync(new URL('./TouchControls.tsx', import.meta.url), 'utf8')
    expect(src).toContain("is-placing")
  })
})
