import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InfraPanel } from './Infra'
import { QuestPanel } from './Panels'
import { MilesPanel } from './Workshop'

// 390 경제 흐름 QA에서 나온 표기 규칙: 마일은 formatMiles(공백 없이 "마일"), 도토리 값은 천 단위 쉼표
// 서버 렌더링은 스토어 초기값을 쓰므로 초기 상태(마일 0, 도토리 0)에서 확인한다
describe('경제 화면 표기', () => {
  it('마일리지 잔액은 formatMiles 형식(0마일, 공백 없음)으로 보인다', () => {
    const html = renderToStaticMarkup(<MilesPanel />)
    expect(html).toContain('<strong>0마일</strong>')
    expect(html).not.toContain('0 마일')
  })

  it('섬 정비의 길 공사 허가 금액은 천 단위 쉼표를 쓴다', () => {
    const html = renderToStaticMarkup(<InfraPanel />)
    expect(html).toContain('🌰 1,000 필요해요')
    expect(html).not.toMatch(/🌰 1000/)
  })
})

describe('할 일 마일 표기', () => {
  it('하루 한도와 오늘 받은 마일은 formatMiles 형식(10마일, 공백 없음)으로 적는다', () => {
    const html = renderToStaticMarkup(<QuestPanel />)
    expect(html).toContain('하루에 최대 50마일까지 받아요. 오늘 0마일 받았어요')
    expect(html).not.toContain(' 마일 받았어요')
  })
})
