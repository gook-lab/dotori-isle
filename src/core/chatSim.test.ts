import { describe, expect, it } from 'vitest'
import { analyzeTalks, simulateTalks, type TalkRecord } from './chatSim'
import { isBirthday } from './birthdays'
import { TOPIC_IDS } from './chat'

/**
 * 주민 수다 회귀 점검: 새 저장으로 30일 동안 주민 여섯 명에게 하루 2~3번 말을 건 흐름을 흉내 낸다.
 * 대사나 화제를 더할 때 같은 줄이 자주 나오거나 한 화제가 판을 차지하면 여기서 잡힌다.
 * 상한은 현재 값에서 조금 여유를 둔 것이다. 넘으면 recent 규칙이나 가중치를 먼저 본다.
 */
const WINDOWS = ['2026-10-19', '2026-11-15', '2026-09-01']
/** 날짜나 시각 조건이 맞아야만 나오는 화제. 이 두 창에서 못 나와도 된다. */
const CONDITIONAL_TOPICS = ['songi-today', 'pumpkin-night', 'harvest-today', 'birthday-talk', 'player-birthday', 'first-snow-today', 'after-milestone', 'milestone-talk', 'island-wallpaper', 'island-set', 'island-pebble', 'island-ledger', 'island-stairs', 'island-facility', 'island-porch']
const MAX_TOPIC_SHARE = 0.3
const MAX_REPEAT7_RATIO = 0.25

describe('주민 수다 반복', () => {
  for (const start of WINDOWS) {
    const stats = analyzeTalks(simulateTalks({ start, days: 30, seed: 7 }), TOPIC_IDS)

    it(`${start} 부터 30일: 같은 줄이 사흘 안에 다시 나오지 않는다`, () => {
      expect(stats.repeat3).toBe(0)
    })

    it(`${start} 부터 30일: 이레 안에 같은 줄이 나오는 비율이 상한 안이다`, () => {
      expect(stats.repeat7 / stats.lines).toBeLessThanOrEqual(MAX_REPEAT7_RATIO)
    })

    it(`${start} 부터 30일: 한 화제가 30%를 넘지 않는다`, () => {
      for (const [topic, ratio] of Object.entries(stats.share)) {
        expect(ratio, topic).toBeLessThanOrEqual(MAX_TOPIC_SHARE)
      }
    })

    it(`${start} 부터 30일: 생일 날 두 번째 대화까지는 생일 수다가 나온다`, () => {
      const byKey = new Map<string, TalkRecord[]>()
      for (const r of simulateTalks({ start, days: 30, seed: 7 })) {
        const k = `${r.day}:${r.villager}`
        byKey.set(k, [...(byKey.get(k) ?? []), r])
      }
      for (const [k, list] of byKey) {
        const [day, villager] = k.split(':') as [string, string]
        if (!isBirthday(villager, day) || list.length < 2) continue
        // 첫 대화에서 이미 생일 수다를 뽑았으면 두 번째는 다른 화제여도 된다
        expect(list.slice(0, 2).map((r) => r.topic), k).toContain('birthday-talk')
      }
    })

    it(`${start} 부터 30일: 조건 없이 나와야 할 화제는 모두 나온다`, () => {
      for (const topic of stats.unseen) expect(CONDITIONAL_TOPICS).toContain(topic)
    })
  }
})
