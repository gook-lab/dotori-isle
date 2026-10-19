import { describe, expect, it } from 'vitest'

// 스타일·컴포넌트 파일을 직접 읽는다(테스트 환경은 CSS 를 비워 두므로 ?raw 로는 글을 못 얻는다)
type NodeProcess = { getBuiltinModule: (id: 'node:fs') => { readFileSync: (path: URL, enc: 'utf8') => string } }
const fs = (globalThis as unknown as { process: NodeProcess }).process.getBuiltinModule('node:fs')
const read = (name: string) => fs.readFileSync(new URL(name, import.meta.url), 'utf8')
const css = read('../styles.css')
const hud = read('./Hud.tsx')
// 휴대폰 버튼은 Phone.tsx 에 있지만 .hud 안에 그려지므로 PhoneButton 함수만 같이 검사한다
const phone = read('./Phone.tsx')
const phoneButton = phone.slice(phone.indexOf('export function PhoneButton'), phone.indexOf('\n}\n', phone.indexOf('export function PhoneButton')))

// .hud 는 pointer-events: none 이라, 그 안의 버튼은 자기 클래스 중 하나의 규칙에 pointer-events: auto 가 있어야 마우스로 누른다.
// 버튼마다 적어 두면 빠뜨리기 쉬워서, Hud.tsx 의 <button> 을 모아 한꺼번에 검사한다.
const buttons = (src: string) =>
  [...src.matchAll(/<button([^<]*?)className=(?:"([^"]+)"|\{`([^`]+)`\})/g)].map((m) => (m[2] ?? m[3] ?? '').split(/\s+/).filter((tok) => /^[a-z][\w-]*$/.test(tok)))

// 셀렉터에 .클래스 가 들어간 규칙 중 pointer-events: auto 가 하나라도 있는지
const hasAutoRule = (cls: string) => {
  const re = new RegExp(`\\.${cls}(?![\\w-])`)
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(([, sel, body]) => re.test(sel) && /pointer-events:\s*auto/.test(body))
}

// 자기 규칙은 없지만 감싸는 칸이 pointer-events: auto 를 주어 받는 버튼(주머니 칸은 .inventory 가 연다)
const WRAPPED_BY: Record<string, string> = { slot: 'inventory' }

describe('HUD 버튼 누름', () => {
  it('Hud.tsx 의 버튼을 모두 찾는다', () => {
    const list = buttons(hud + phoneButton).map((cls) => cls.join(' '))
    expect(list.length).toBeGreaterThan(5)
    expect(list.some((c) => c.includes('pill'))).toBe(true)
    expect(list.some((c) => c.includes('phone-button'))).toBe(true)
  })

  it('HUD 버튼은 모두 자기 클래스 중 하나가 pointer-events: auto 규칙을 가진다', () => {
    const missing = buttons(hud + phoneButton)
      .filter((cls) => cls.length > 0 && !cls.some((c) => hasAutoRule(c) || (WRAPPED_BY[c] !== undefined && hasAutoRule(WRAPPED_BY[c]))))
      .map((cls) => cls.join(' '))
    expect(missing).toEqual([])
  })
})
