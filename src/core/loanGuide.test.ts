import { describe, expect, it } from 'vitest'
import { homeDef, nextStage, type HomeStage } from './home'
import { homeNextLine, homeTopLine, loanClearedLine, loanPayoffLine, payableNow } from './loanGuide'

describe('대출 상환 문구', () => {
  it('빚을 다 갚은 뒤 다음 집이 있으면 그 이름을 알려 준다', () => {
    for (const stage of [1, 2, 3, 4] as HomeStage[]) {
      const next = nextStage(stage)!
      expect(loanClearedLine(stage)).toContain(`다음 집(${next.name})을 맡길 수 있어요`)
    }
  })

  it('가장 큰 집은 다음 집 얘기를 하지 않는다', () => {
    const line = loanClearedLine(5)
    expect(line).toContain('가장 큰 집')
    expect(line).not.toContain('맡길 수 있어요')
  })

  it('텐트는 빚이 없어도 다음 집을 안내한다', () => {
    expect(loanClearedLine(0)).toContain(`다음 집(${homeDef(1).name})`)
  })

  it('빚이 남았을 때 다음 집이 있으면 다 갚은 뒤 맡길 수 있다고 알려 준다', () => {
    for (const stage of [1, 2, 3, 4] as HomeStage[]) {
      expect(loanPayoffLine(stage)).toBe('다 갚으면 다음 집을 맡길 수 있어요.')
    }
  })

  it('가장 큰 집은 다음 집 안내를 하지 않는다', () => {
    expect(loanPayoffLine(5)).toBeNull()
  })

  it('갚을 금액은 남은 대출과 가진 돈을 넘지 않는다', () => {
    expect(payableNow(3000, 500, 1000)).toBe(500)
    expect(payableNow(3000, 2500, 1000)).toBe(1000)
    expect(payableNow(2000, 2500, 3000)).toBe(2000)
    expect(payableNow(0, 2500, 3000)).toBe(0)
    expect(payableNow(100, 0, 3000)).toBe(0)
  })

  it('목표 줄 아래 집 한 줄: 빚이 있으면 ATM, 다 갚았으면 다음 집, 가장 큰 집이면 없다', () => {
    expect(homeNextLine(2, 1500)).toBe('대출은 도토리 상점 안 ATM에서 갚아요')
    expect(homeNextLine(3, 0)).toBe('다 갚았어요. 집 상담에서 옆방 증축을 맡길 수 있어요')
    expect(homeNextLine(5, 0)).toBeNull()
  })

  it('짓는 중이면 완성 날을 알려 준다(빚보다 먼저)', () => {
    expect(homeNextLine(3, 7000, { to: 4 })).toBe('옆방 증축 짓는 중이에요. 내일 아침 완성돼요')
  })

  it('텐트는 빚이 없어도 "다 갚았어요" 없이 작은 집 맡기를 알려 준다', () => {
    expect(homeNextLine(0, 0)).toBe('집 상담에서 작은 집을 맡길 수 있어요')
    expect(homeNextLine(0, 0, null, true)).toBe('집 상담에서 작은 집을 맡길 수 있어요')
  })

  it('텐트에서 집 상담이 아직 잠겨 있으면 집 줄을 내지 않는다', () => {
    expect(homeNextLine(0, 0, null, false)).toBeNull()
  })
})

describe('가장 큰 집 이후 계속할 거리', () => {
  it('섬 가꾸기가 남았으면 기부를, 다 끝났으면 외관 칠하기를 한 줄로 알려 준다', () => {
    expect(homeTopLine(true)).toContain('마을회관')
    expect(homeTopLine(false)).toContain('칠할 수 있어요')
  })

  it('가장 큰 집이고 빚이 없으면 집 상담 줄은 비지 않는다', () => {
    expect(homeNextLine(5, 0)).toBeNull()
    expect(homeTopLine(true).length).toBeGreaterThan(0)
  })
})
