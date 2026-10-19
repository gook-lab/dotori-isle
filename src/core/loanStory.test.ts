import { describe, expect, it } from 'vitest'
import { homeRow } from './life'
import { firstScoreWeek, homeScoreLetter, scoreHome, type HomeScore } from './homeScore'

/** 가구 없는 빈 집의 점수(0점, 별 없음) */
const empty: HomeScore = scoreHome({ stage: 0, furniture: [], framed: false })

describe('집 점수 편지(별 없음)', () => {
  it('별이 없을 때 "별이 없어요예요" 같은 겹친 어미를 쓰지 않는다', () => {
    const text = homeScoreLetter(empty, '2026-10-19').text
    expect(text).toContain('지난주 집 점수는 0점, 아직 별이 없어요. 아직 시작이에요.')
    expect(text).not.toContain('없어요예요')
  })

  it('가구 놓기 권유를 한 편지에서 두 번 하지 않는다', () => {
    const text = homeScoreLetter(empty, '2026-10-19').text
    expect(text.match(/하나씩 놓아 보세요|더 들여 보세요|조금씩 더해 보세요/g) ?? []).toHaveLength(1)
  })
})

describe('집 줄 문구', () => {
  it('작은 집 이상은 다음 단계를 "다음 집"으로 부른다(증축이라고 하지 않는다)', () => {
    const row = homeRow(0, 2500)
    expect(row.line).toContain('다음 집을 맡길 수 있어요')
    expect(row.line).not.toContain('증축')
    expect(homeRow(0, 0).line).toContain('다음 집은 작은 집이에요')
  })
})

describe('집 점수 편지 첫 주', () => {
  it('섬이 채점하는 지난주 안에 시작했으면 첫 주다', () => {
    // 월요일 10-26 기준 지난주는 10-19~10-25. 10-21 에 시작했으면 지난주 기록이 없다.
    expect(firstScoreWeek('2026-10-21', '2026-10-26')).toBe(true)
    expect(firstScoreWeek('2026-10-25', '2026-10-26')).toBe(true)
  })

  it('지난주 내내 있었으면 첫 주가 아니다. islandStart 가 없으면 지난주가 있었다고 본다', () => {
    expect(firstScoreWeek('2026-10-19', '2026-10-26')).toBe(false)
    expect(firstScoreWeek('2026-10-12', '2026-10-26')).toBe(false)
    expect(firstScoreWeek(null, '2026-10-26')).toBe(false)
  })

  it('첫 주 편지는 "이번 주 집 점수는"으로 쓰고 "지난주"를 쓰지 않는다', () => {
    const first = homeScoreLetter(empty, '2026-10-26', [], true).text
    expect(first).toContain('이번 주 집 점수는 0점, 아직 별이 없어요.')
    expect(first).not.toContain('지난주')
    expect(homeScoreLetter(empty, '2026-10-26').text).toContain('지난주 집 점수는 0점')
  })
})
