import { describe, expect, it } from 'vitest'
/**
 * 조사 정적 검사: 템플릿 리터럴에서 `${...}` 바로 뒤에 조사를 손으로 붙인 곳을 찾는다.
 * 받침에 따라 달라지는 조사는 josa(word, 받침 있을 때, 없을 때)로 고른다.
 * 정답이 고정인 경우(숫자, 마일, 아이콘, 길이처럼 항상 같은 받침인 값)는 허용한다.
 * 허용하는 방법: 변수 이름이 아래 패턴에 맞거나, 그 줄에 `// josa-ok` 주석을 단다(사유를 함께 적는다).
 * 정규식으로 찾는 것이라 드물게 오탐할 수 있다. 줄을 억지로 고치기보다 주석으로 사유를 남긴다.
 */
const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** 조사 뒤에 한글이 바로 이어지면 다른 낱말이라 뺀다(예: 이에요·이야는 별도 alternation 으로 잡는다) */
const PARTICLE_RE = /\$\{([^}]*)\}(이에요|예요|이야|야|이었어|였어|으로|로|을|를|이|가|은|는|과|와)(?![가-힣])/g

/** 값이 항상 같은 받침을 가져 조사가 정해진 경우: 숫자·마일·아이콘·길이 */
const FIXED_RE = /formatMiles|toLocaleString|icon|Icon|emoji|length|count|amount|price|cost|miles|Miles|stars|total|score|\bn\b|\bno\b|\bday\b|\bdays\b|\bpct\b|\bsec\b|\bmin\b|\bhour\b|\bstep\b|\bslot\b|\bidx\b|\bi\b|\bk\b|\bn\b|\bcards\b/

/** JSX 글자 사이에 쓴 `{값}조사` 도 같은 실수다(.tsx 만 본다). 뒤에 한글이 이어지면 다른 낱말이라 뺀다. */
const JSX_PARTICLE_RE = /\{([^{}]*)\}(이에요|예요|으로|로|을|를|이|가|은|는|과|와)(?![가-힣])/g

function hits(): string[] {
  const out: string[] = []
  for (const [path, text] of Object.entries(sources)) {
    if (/\.(test|scratch)\./.test(path)) continue
    const jsx = path.endsWith('.tsx')
    text.split('\n').forEach((line, i) => {
      if (line.includes('josa-ok')) return
      for (const m of line.matchAll(PARTICLE_RE)) {
        if (FIXED_RE.test(m[1])) continue
        out.push(`${path}:${i + 1} ${line.trim().slice(0, 120)}`)
      }
      if (!jsx) return
      for (const m of line.matchAll(JSX_PARTICLE_RE)) {
        if (FIXED_RE.test(m[1])) continue
        out.push(`${path}:${i + 1} (JSX) ${line.trim().slice(0, 120)}`)
      }
    })
  }
  return out
}

describe('조사 정적 검사', () => {
  it('변수 뒤 조사는 josa 로 고르거나 josa-ok 로 사유를 단다', () => {
    expect(hits()).toEqual([])
  })
})
