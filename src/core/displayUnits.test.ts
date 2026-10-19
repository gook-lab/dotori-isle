import { describe, expect, it } from 'vitest'

/**
 * 화면 문구의 단위 표기를 소스 문자열에서 훑는 정적 검사.
 * - 🌰 뒤에 "개"를 붙이지 않는다(도토리는 문장에선 "도토리 N개", 가격 칸에선 "🌰 N").
 * - 도토리 N개와 N마일은 천 단위 콤마를 찍는다(toLocaleString 이나 formatMiles 를 쓴다).
 * 정규식으로 찾는 것이라 드물게 오탐할 수 있다. 오탐이 나면 줄을 고치기보다 이 목록에 사유와 함께 적는다.
 */
const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const RULES: { name: string; re: RegExp }[] = [
  { name: '🌰 뒤에 개', re: /🌰 ?\$\{[^}]*\}개|🌰 ?\d[\d,]*개/ },
  { name: '마일 앞 숫자에 콤마 없음', re: /\$\{(?![^}]*toLocaleString)[^}]*\}마일/ },
  { name: '도토리 N개에 콤마 없음', re: /도토리 \$\{(?![^}]*toLocaleString)[^}]*\}개/ },
  { name: '마일 앞 공백', re: /(\}|<\/strong>)\s마일/ },
  // 주간 목표 보상 WEEKLY_MILES(40)는 천 단위가 없어 콤마 대상이 아니다(Panels.tsx 오탐 사유)
  { name: '🏅 마일 값에 콤마 없음', re: /🏅 ?\$?\{(?![^}]*(toLocaleString|formatMiles|WEEKLY_MILES))[^}]*\}/ },
  { name: '지갑·통장 잔액 🌰 에 콤마 없음', re: /🌰 ?\{(money|savings|loan|pending|cap|out)\}/ },
  { name: '🌰 가격에 콤마 없음', re: /🌰 ?\$?\{(?![^}]*toLocaleString)[^}]*(price|acorns|cost|[vV]alue)[^}]*\}/ },
]

/** 검사 대상: 테스트와 임시 파일을 뺀 소스. 한 줄씩 보고 위치를 남긴다. */
function hits(re: RegExp): string[] {
  const out: string[] = []
  for (const [path, text] of Object.entries(sources)) {
    if (/\.(test|scratch)\./.test(path)) continue
    text.split('\n').forEach((line, i) => {
      if (re.test(line)) out.push(`${path}:${i + 1} ${line.trim().slice(0, 120)}`)
    })
  }
  return out
}

describe('화면 문구 단위 표기', () => {
  for (const rule of RULES) {
    it(`${rule.name} 없음`, () => {
      expect(hits(rule.re)).toEqual([])
    })
  }
})
