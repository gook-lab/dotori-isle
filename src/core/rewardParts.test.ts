import { describe, expect, it } from 'vitest'
import { rewardParts } from './quests'

describe('보상 줄 조각', () => {
  it('돈과 도구를 보상 받기 줄과 받은 뒤 토스트가 같은 말로 보여 준다', () => {
    expect(rewardParts({ money: 100, tools: ['shovel'] })).toEqual(['🌰 100', '삽'])
  })

  it('물건·레시피·마일은 빠지지 않고 붙고, 비어 있는 보상은 빈 배열이다', () => {
    const parts = rewardParts({ items: [['lamp', 2]], recipes: ['iron-lamp'], miles: 10 })
    expect(parts).toHaveLength(3)
    expect(parts[0]).toContain('×2')
    expect(parts[1]).toMatch(/^📃.+ 레시피$/)
    expect(parts[2]).toBe('🏅 10마일')
    expect(rewardParts({})).toEqual([])
  })
})
