import { useRef, useState } from 'react'
import { setVolume, volumes, type Volumes } from '../game/audioPrefs'
import { clearSave, exportSaveFile, listBackups, parseSaveFile, restoreBackup, writeSave } from '../game/saveFile'
import { setQuality, useQuality } from '../game/quality'
import { useGame } from '../game/store'
import { PLAYER_BIRTHDAY_DAYS, PLAYER_BIRTHDAY_MONTHS, playerBirthdayLabel, type PlayerBirthday } from '../core/playerBirthday'
import { QUALITY_NAME, type Quality } from '../core/quality'
import type { SaveData } from '../game/store'
import { Modal } from './Panels'

/** 배경음과 효과음 크기를 따로 조절한다. 설정은 기기에 남는다. */
export function SoundSliders() {
  const [vols, setVols] = useState<Volumes>(volumes)
  const row = (kind: keyof Volumes, label: string) => (
    <label className="photo-sound-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(vols[kind] * 100)}
        aria-label={`${label} 크기`}
        onChange={(e) => {
          setVolume(kind, Number(e.target.value) / 100)
          setVols({ ...volumes() })
        }}
      />
      <small>{Math.round(vols[kind] * 100)}</small>
    </label>
  )
  return (
    <div className="photo-sound" role="group" aria-label="소리 크기">
      {row('bgm', '🎵 배경음')}
      {row('sfx', '🔔 효과음')}
    </div>
  )
}

const QUALITY_HINT: Record<Quality, string> = {
  high: '그림자와 풀을 모두 그리고, 화면 선명도를 가장 높게 써요.',
  normal: '그림자와 풀은 그대로, 화면 선명도는 조금 낮춰요.',
  low: '그림자를 끄고 풀을 절반만 그려요. 화면 선명도는 가장 낮아요.',
}

function QualityChoice() {
  const { quality: q } = useQuality()
  return (
    <>
      <div className="settings-seg" role="group" aria-label="그래픽 품질">
        {(['high', 'normal', 'low'] as const).map((v) => (
          <button key={v} className={q === v ? 'on' : ''} aria-pressed={q === v} onClick={() => setQuality(v)}>
            {QUALITY_NAME[v]}
          </button>
        ))}
      </div>
      <p className="settings-note">{QUALITY_HINT[q]} 이 기기에서 처음 고른 값은 기기 성능으로 정했고, 여기서 바꾸면 기억해요.</p>
    </>
  )
}

const KEYS: [string, string][] = [
  ['이동', 'WASD 또는 방향키'],
  ['달리기', 'Shift'],
  ['행동 (말 걸기·줍기·캐기)', 'E'],
  ['도구 고르기', '1 ~ 7'],
  ['가구 돌리기 (놓는 중)', 'R'],
  ['주머니 · 도감 · 수첩', 'I · Tab · J'],
  ['마일리지 · 옷장 · 사진 모드', 'M · C · P'],
  ['그만두기 · 창 닫기', 'Esc'],
  ['화면 확대 · 축소', '마우스 휠'],
]

const TOUCH: [string, string][] = [
  ['이동', '왼쪽 원을 밀어요'],
  ['행동', '오른쪽 아래 큰 행동 버튼'],
  ['도구 바꾸기', '손·도구 버튼을 차례로 눌러요'],
  ['가구 돌리기 · 넣기', '놓는 중에는 돌리기 버튼이 나와요'],
  ['휴대폰', '📱 버튼(미션·도감·마일리지·카메라 등)'],
]

function Controls() {
  return (
    <div className="settings-keys">
      <table>
        <caption>키보드</caption>
        <tbody>
          {KEYS.map(([what, key]) => (
            <tr key={what}>
              <th scope="row">{what}</th>
              <td>
                <kbd>{key}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <caption>터치</caption>
        <tbody>
          {TOUCH.map(([what, how]) => (
            <tr key={what}>
              <th scope="row">{what}</th>
              <td>{how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function summary(s: SaveData): string {
  return `돈 🌰 ${s.money.toLocaleString()} · ${s.day} 날짜의 섬`
}

function SaveTools() {
  const [pending, setPending] = useState<SaveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetStep, setResetStep] = useState<0 | 1>(0)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [backups] = useState(() => listBackups())
  // 백업 되살리기는 두 번 누른다: 처음 누르면 확인 상태로 바뀐다
  const [armed, setArmed] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const restore = (key: string) => {
    if (!restoreBackup(key)) {
      setRestoreError('이 백업은 읽을 수 없어요')
      return
    }
    location.reload()
  }
  // 파일을 연달아 고르면 먼저 읽힌 결과가 나중 것을 덮지 않도록, 가장 최근에 고른 파일만 반영한다
  const pickSeq = useRef(0)
  const pick = async (file: File | undefined) => {
    if (!file) return
    const seq = ++pickSeq.current
    setError(null)
    setPending(null)
    const r = parseSaveFile(await file.text())
    if (seq !== pickSeq.current) return
    if (r.ok) setPending(r.state)
    else setError(r.why)
  }
  return (
    <div className="settings-save">
      <div className="settings-row">
        <button onClick={() => setExportMsg(exportSaveFile() ? null : '아직 내보낼 저장이 없어요')}>저장 내보내기</button>
        {exportMsg && <span className="settings-note">{exportMsg}</span>}
      </div>

      <div className="settings-row">
        <label className="settings-file">
          <span>저장 가져오기 (파일 고르기)</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              // 값을 비워 두어야 같은 파일을 다시 골라도 change 가 뜬다
              const file = e.target.files?.[0]
              e.target.value = ''
              pick(file)
            }}
          />
        </label>
      </div>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {pending && (
        <div className="settings-confirm" role="alertdialog" aria-label="저장 덮어쓰기 확인">
          <p>이 파일의 저장으로 바꿀까요? 지금 저장은 사라져요.</p>
          <p className="settings-note">{summary(pending)}</p>
          <div className="settings-row">
            <button className="primary" onClick={() => { writeSave(pending); location.reload() }}>
              덮어쓰고 다시 시작
            </button>
            <button onClick={() => setPending(null)}>취소</button>
          </div>
        </div>
      )}

      <div className="settings-row">
        {resetStep === 0 ? (
          <button className="danger" onClick={() => setResetStep(1)}>
            처음부터 다시
          </button>
        ) : (
          <div className="settings-confirm" role="alertdialog" aria-label="처음부터 다시 확인">
            <p>정말 지울까요? 섬과 주머니, 돈이 모두 사라지고 되돌릴 수 없어요.</p>
            <div className="settings-row">
              <button className="danger" onClick={() => { clearSave(); location.reload() }}>
                지우고 처음부터
              </button>
              <button onClick={() => setResetStep(0)}>아니요</button>
            </div>
          </div>
        )}
      </div>
      {backups.length > 0 && (
        <div className="settings-backups">
          <h4>백업에서 되살리기</h4>
          <p className="settings-note">저장을 불러오지 못했을 때 남긴 원본이에요. 최근 몇 개만 남아요.</p>
          {backups.map((b) => (
            <div className="settings-row settings-backup" key={b.key}>
              <span>
                {new Date(b.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · v{b.version} ·{' '}
                {b.ok ? `🌰 ${b.money.toLocaleString()} · ${b.day}` : '읽을 수 없어요'}
              </span>
              {b.ok &&
                (armed === b.key ? (
                  <button className="danger" onClick={() => restore(b.key)}>
                    한 번 더 누르면 되살려요
                  </button>
                ) : (
                  <button onClick={() => { setRestoreError(null); setArmed(b.key) }}>되살리기</button>
                ))}
            </div>
          ))}
          {armed && <p className="settings-note">지금 저장은 사라지고, 백업으로 바꾼 뒤 다시 시작해요.</p>}
          {restoreError && <p className="settings-error" role="alert">{restoreError}</p>}
        </div>
      )}
      <p className="settings-note">소리와 그래픽 설정은 지워지지 않아요.</p>
    </div>
  )
}

/** 휴대폰 앱의 설정. 소리·그래픽 품질·조작 안내·저장 관리를 한곳에 모았다. */
/** 내 생일을 월과 일로 고른다. 일은 1~28일만 쓴다. 정하지 않음을 고르면 축하가 오지 않는다. */
function BirthdayPicker() {
  const bd = useGame((s) => s.playerBirthday ?? null)
  const set = (next: PlayerBirthday | null) => useGame.getState().setPlayerBirthday(next)
  const months = Array.from({ length: PLAYER_BIRTHDAY_MONTHS }, (_, i) => i + 1)
  const days = Array.from({ length: PLAYER_BIRTHDAY_DAYS }, (_, i) => i + 1)
  return (
    <div className="birthday-picker">
      <p className="settings-note">생일 날 아침에 편지와 작은 화분이 오고, 주민들이 축하해요. 현재: {playerBirthdayLabel(bd)}</p>
      <select aria-label="생일 월" value={bd?.month ?? ''} onChange={(e) => (e.target.value ? set({ month: Number(e.target.value), day: bd?.day ?? 1 }) : set(null))}>
        <option value="">정하지 않음</option>
        {months.map((m) => <option key={m} value={m}>{m}월</option>)}
      </select>
      <select aria-label="생일 일" value={bd?.day ?? ''} disabled={!bd} onChange={(e) => bd && set({ month: bd.month, day: Number(e.target.value) })}>
        {days.map((d) => <option key={d} value={d}>{d}일</option>)}
      </select>
    </div>
  )
}

export function SettingsPanel() {
  return (
    <Modal title="⚙️ 설정" tall>
      <section className="settings-section">
        <h3>🔊 소리</h3>
        <SoundSliders />
      </section>
      <section className="settings-section">
        <h3>🎨 그래픽 품질</h3>
        <QualityChoice />
      </section>
      <section className="settings-section">
        <h3>🎂 내 생일</h3>
        <BirthdayPicker />
      </section>
      <section className="settings-section">
        <h3>🎮 조작 안내</h3>
        <Controls />
      </section>
      <section className="settings-section">
        <h3>💾 저장 관리</h3>
        <SaveTools />
      </section>
    </Modal>
  )
}
