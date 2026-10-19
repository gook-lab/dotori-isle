import { describe, expect, it } from 'vitest'
import { arrivalNotice } from './letters'

describe('하루 넘김 편지 알림 한 줄', () => {
  it('새 편지가 없으면 알림이 없다', () => {
    expect(arrivalNotice([])).toBeNull()
  })

  it('한 통이면 보낸 이 이름으로 알린다', () => {
    expect(arrivalNotice([{ id: 'a', fromName: '다람이' }])).toBe('📮 다람이에게서 편지가 왔어요')
  })

  it('여러 통이면 통수로 한 줄만 낸다', () => {
    expect(arrivalNotice([{ id: 'a', fromName: '다람이' }, { id: 'b', fromName: '점장' }, { id: 'c', fromName: '하루' }])).toBe('📮 편지 3통이 왔어요')
  })

  it('결산 편지가 한 통이면 결산 편지로 알린다', () => {
    expect(arrivalNotice([{ id: 'shop-month-2026-10', fromName: '점장' }])).toBe('📮 점장님 결산 편지가 왔어요')
  })

  it('결산 편지가 섞이면 결산을 앞에 두고 나머지 통수를 붙인다', () => {
    expect(arrivalNotice([{ id: 'a', fromName: '다람이' }, { id: 'shop-month-2026-10', fromName: '점장' }, { id: 'c', fromName: '하루' }])).toBe('📮 점장님 결산 편지 외 2통이 왔어요')
  })
})
