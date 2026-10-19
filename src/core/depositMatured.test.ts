import { describe, expect, it } from 'vitest'
import { depositMaturedLine } from './deposit'
import { cleanSeenHints, firstHintOnce } from './firstHints'

describe('정기 예금 만기 토스트', () => {
  it('처음 만기에는 입출금 탭 안내 꼬리를 붙인다', () => {
    expect(depositMaturedLine(7, 300, true)).toBe('🏦 7일 예금이 만기됐어요. 이자 도토리 300개를 더해 통장에 넣었어요. 입출금 탭에서 꺼내요.')
  })

  it('가장 긴 경우(7일, 이자 300)도 60자 안에 든다', () => {
    expect(Array.from(depositMaturedLine(7, 300, true)).length).toBeLessThanOrEqual(60)
  })

  it('두 번째 만기부터는 짧은 한 줄로 알린다', () => {
    expect(depositMaturedLine(3, 40, false)).toBe('💰 3일 예금이 끝나 이자 도토리 40개가 통장에 들어왔어요')
  })

  it('처음 여부는 본 안내 목록으로 정한다(한 번 보면 다시 붙지 않는다)', () => {
    const first = firstHintOnce(cleanSeenHints([]), 'deposit')
    expect(first).not.toBeNull()
    expect(firstHintOnce(first?.seen ?? [], 'deposit')).toBeNull()
  })
})
