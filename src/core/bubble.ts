/**
 * 말풍선 한 줄을 여러 줄로 나누는 순수 로직. 캔버스 그리기와 글자 재기는 scene 이 맡는다.
 * 낱말 사이에서만 나누고(keep-all, 한글 글자 중간은 안 나눈다), 줄 수를 가장 적게 하면서 가장 긴 줄이 가장 짧아지게 나눈다(balance).
 */

/** 말풍선 한 줄의 최대 글자 너비(px). 넘으면 줄을 바꾼다. */
export const BUBBLE_MAX_LINE_W = 460
/** 줄 수의 상한. 이보다 길면 마지막 줄에 나머지를 모은다. */
export const BUBBLE_MAX_LINES = 4

/** 낱말 경계 가운데 k 개를 고른 모든 조합. 각 값은 그 낱말 앞에서 자르는 자리(1 이상)다. */
function* cutSets(count: number, k: number, from = 1): Generator<number[]> {
  if (k === 0) {
    yield []
    return
  }
  for (let i = from; i <= count - k; i++) {
    for (const rest of cutSets(count, k - 1, i + 1)) yield [i, ...rest]
  }
}

/**
 * 말을 줄 배열로 나눈다. 한 줄에 들어가면 그대로 한 줄이다.
 * measure 는 글자 하나 묶음의 너비(px)를 돌려준다.
 */
export function balanceLines(text: string, measure: (s: string) => number, maxW = BUBBLE_MAX_LINE_W, maxLines = BUBBLE_MAX_LINES): string[] {
  const words = text.split(' ').filter((w) => w.length > 0)
  if (words.length < 2 || measure(words.join(' ')) <= maxW) return [words.join(' ')]
  let fallback: string[] = [words.join(' ')]
  let fallbackW = Infinity
  for (let n = 2; n <= Math.min(maxLines, words.length); n++) {
    let best: string[] | null = null
    let bestW = Infinity
    for (const cuts of cutSets(words.length, n - 1)) {
      const bounds = [0, ...cuts, words.length]
      const lines = bounds.slice(1).map((end, i) => words.slice(bounds[i], end).join(' '))
      const widths = lines.map(measure)
      const widest = Math.max(...widths)
      if (widest < fallbackW && n === maxLines) {
        fallbackW = widest
        fallback = lines
      }
      if (widest <= maxW && widest < bestW) {
        bestW = widest
        best = lines
      }
    }
    // 줄 수가 적은 쪽이 먼저다. 이 줄 수로 맞는 나눔이 있으면 그 가운데 가장 고른 것을 쓴다.
    if (best) return best
  }
  return fallback
}
