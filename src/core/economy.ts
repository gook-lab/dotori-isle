/**
 * 경제 시스템 공용 조각 — 실패 사유를 담는 결과 타입, 날짜 키 계산, 금액 검증.
 * 상점 단계·집 대출·은행이 같은 규칙(해요체 사유, 로컬 날짜 키)을 쓰도록 한곳에 모았다.
 * 다른 게임 모듈을 import 하지 않아 순환 참조가 생기지 않는다.
 */

/**
 * 성공이면 `{ ok: true, ...값 }`, 실패면 화면에 그대로 띄울 `reason` 을 돌려준다.
 * 호출하는 쪽이 `if (!r.ok) return notify(r.reason)` 한 줄로 끝나게 하려는 형태다.
 */
export type Result<T> = ({ ok: true } & T) | { ok: false; reason: string }

const DAY_MS = 86_400_000
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 날짜 키(YYYY-MM-DD)를 1970-01-01 이후 일수로 바꾼다.
 * UTC 자정으로 세므로 시간대·서머타임 때문에 하루가 밀리지 않는다.
 * 형식이 틀리거나 없는 날짜(2월 30일)면 null.
 */
export function dayIndex(key: string): number | null {
  const m = KEY.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  // Date 는 2월 30일을 3월 2일로 넘긴다. 되돌려 같은 날인지 확인해 없는 날짜를 걸러낸다.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt.getTime() / DAY_MS
}

/** `key` 에서 `n` 일 뒤(음수면 앞)의 날짜 키. 잘못된 입력이면 null. */
export function addDays(key: string, n: number): string | null {
  const i = dayIndex(key)
  if (i === null || !Number.isSafeInteger(n)) return null
  const d = new Date((i + n) * DAY_MS)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** `to - from` 일수. 어느 한쪽이라도 잘못되면 null. 음수면 과거다. */
export function dayDiff(from: string, to: string): number | null {
  const a = dayIndex(from)
  const b = dayIndex(to)
  if (a === null || b === null) return null
  return b - a
}

/** 도토리 금액으로 쓸 수 있는 값: 1 이상의 안전한 정수. */
export function isWholeAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0
}

/** 잔액처럼 0 도 허용하는 음이 아닌 정수. */
export function isNonNegativeAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
}

export const BAD_AMOUNT = '금액은 1 이상의 정수로 입력해 주세요'
export const BAD_DAY = '날짜가 잘못됐어요'
