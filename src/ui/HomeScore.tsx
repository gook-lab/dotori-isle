import { decodeGarden, gardenStats } from '../core/gardenTiles'
import { HOME_SITE } from '../core/home'
import { frameFloor, frameHung, HOME_MAX, nextStarLine, rewardText, scoreHome, setGainIfDone, setProgress, starProgress, tierOf, weeklyTip } from '../core/homeScore'
import { ITEMS, josa } from '../core/items'
import { useGame } from '../game/store'
import { Modal } from './Panels'

const ROWS: { key: keyof typeof HOME_MAX; label: string }[] = [
  { key: 'count', label: '가구 수' },
  { key: 'variety', label: '가구 종류' },
  { key: 'placement', label: '벽쪽과 가운데 배치' },
  { key: 'sets', label: '세트와 같은 색' },
  { key: 'light', label: '불빛' },
  { key: 'frame', label: '사진 액자' },
  { key: 'garden', label: '정원' },
]

/** 미완성 세트 줄 끝: 완성하면 칸이 오르는 만큼만 말한다 */
function gainText(gain: number): string {
  return gain > 0 ? ` · 완성하면 +${gain}점` : ' · 세트 칸은 이미 가득 찼어요'
}

/** 휴대폰 앱의 꾸미기 점수 창. 지금 점수와 별 진행, 이번 주 팁 한 줄을 보여 준다. */
export function HomeScorePanel() {
  const stage = useGame((s) => s.home.stage)
  const furniture = useGame((s) => s.homeFurniture)
  const framed = useGame((s) => frameHung(!!s.wallPhoto, s.homeFurniture))
  const framedFloor = useGame((s) => frameFloor(!!s.wallPhoto, s.homeFurniture))
  const placed = useGame((s) => s.placed)
  const tiles = useGame((s) => s.gardenTiles)
  const permit = useGame((s) => s.gardenPermit)
  const score = scoreHome({ stage, furniture, framed, framedFloor, garden: gardenStats(placed, decodeGarden(tiles), HOME_SITE) })
  const tier = tierOf(score.total)
  // 별 진행과 이번 주 팁은 월요일 편지와 같은 함수로 계산한다
  const progress = starProgress(score.total)
  const next = progress.next
  const tip = weeklyTip(score)
  const detail: Record<keyof typeof HOME_MAX, string> = {
    count: `${score.count}개`,
    variety: `${score.kinds}종`,
    placement: `벽쪽 ${score.wall}개 · 가운데 ${score.interior}개`,
    sets: `세트 ${score.doneSets.length}개 완성${score.sameColor ? ' · 같은 색 있음' : ''}`,
    light: score.lit ? '켜 둔 불빛 있음' : '불빛 없음',
    frame: score.framed ? '액자 걸림' : score.framedFloor ? '바닥 액자(절반)' : '액자 없음',
    garden: `울타리 ${score.garden.fenceLinks}쌍 이음 · 바닥 ${score.garden.tiles}칸`,
  }
  return (
    <Modal title="집 꾸미기 점수">
      <div className="home-score-head">
        {score.total > 0 ? (
          <>
            <span className="home-score-num">{score.total}</span>
            <span className="note">{tier ? `점 · 별 ${progress.stars} ${tier.name}` : '점 · 아직 별이 없어요'}</span>
          </>
        ) : (
          <p className="home-score-empty">아직 꾸민 가구가 없어요. 가구를 놓으면 점수가 생겨요</p>
        )}
      </div>
      {next ? (
        <>
          <div className="home-score-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label="다음 별까지">
            <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          <p className="note">
            {nextStarLine(score.total)}. 보상은 {josa(rewardText(next.reward), '이에요', '예요')}.
          </p>
        </>
      ) : (
        <p className="note">최고 구간이에요. 한정 가구까지 받았어요.</p>
      )}
      <p className={`home-score-tip${score.total === 0 ? ' strong' : ''}`}>이번 주 팁: {tip}</p>
      <ul className="buy-list">
        {ROWS.map((r) => (
          <li key={r.key}>
            <span className="name">
              {r.label}
              <small className="note">{detail[r.key]}</small>
            </span>
            <span className="price">
              {score.parts[r.key]}점 <small className="note">(최대 {HOME_MAX[r.key]})</small>
            </span>
          </li>
        ))}
      </ul>
      <section>
        <p className="note home-score-garden">
        정원: 울타리 옆으로 붙은 두 칸이 한 쌍이면 1점, 깐 바닥 세 칸이면 1점이에요(집 둘레 안만).{permit ? ' 집 패널의 정원 꾸미기에서 놓아요.' : ' 허가는 휴대폰 섬 살림의 집 줄에서 받아요.'}
      </p>
      <h3>가구 세트</h3>
        <ul className="buy-list">
          {setProgress(furniture).map((p) => (
            <li key={p.id}>
              <span className="name">{p.name}</span>
              <span className="price">{p.done ? '완성 ✨' : `${p.owned}/${p.total}${gainText(setGainIfDone(furniture, p.id))}`}</span>
              {!p.done && <small className="note set-missing">모자란 것: {p.missing.map((id) => ITEMS[id]?.name ?? id).join(', ')}</small>}
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  )
}
