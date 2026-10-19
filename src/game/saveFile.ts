import { backupKeys, BACKUP_KEEP, BACKUP_PREFIX, migrateSave, pauseSaveWrites, SAVE_KEY, SAVE_VERSION, type SaveData } from './store'

/** 지금 저장을 JSON 파일로 내려받는다. 저장 키에 든 문자열을 그대로 쓴다. */
export function exportSaveFile(): boolean {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    raw = null
  }
  if (!raw) return false
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `도토리섬-저장-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export type ParsedSave = { ok: true; state: SaveData } | { ok: false; why: string }

/**
 * 가져올 파일을 검사한다. 저장 래퍼({state, version})와 맨 상태 둘 다 받는다.
 * 깨졌거나 도토리섬 저장이 아니면 이유를 돌려준다. 통과하면 migrateSave 로 옛 저장까지 맞춘 상태를 준다.
 */
export function parseSaveFile(text: string): ParsedSave {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, why: '파일을 읽을 수 없어요. 도토리섬 저장 파일(.json)인지 봐 주세요' }
  }
  const wrap = obj && typeof obj === 'object' ? (obj as { state?: unknown }) : null
  const raw = wrap && wrap.state && typeof wrap.state === 'object' ? wrap.state : obj
  if (!raw || typeof raw !== 'object') return { ok: false, why: '도토리섬 저장이 아니에요' }
  const p = raw as { money?: unknown; inventory?: unknown; day?: unknown }
  if (typeof p.money !== 'number' || !Array.isArray(p.inventory) || typeof p.day !== 'string') {
    return { ok: false, why: '도토리섬 저장이 아니에요' }
  }
  // 겉모양만 맞고 속이 깨진 파일은 옮기는 중에 던질 수 있다. 화면까지 올리지 않고 이유를 돌려준다.
  try {
    return { ok: true, state: migrateSave(raw) }
  } catch {
    return { ok: false, why: '저장 내용을 읽을 수 없어요. 다른 파일을 골라 주세요' }
  }
}

/** 검사를 마친 상태를 저장 키에 쓴다. 쓴 뒤에는 화면을 새로 불러와 그 저장으로 시작한다. */
export function writeSave(state: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ state, version: SAVE_VERSION }))
  pauseSaveWrites()
}

/** 저장을 지운다. 그림·소리·품질 설정은 남는다. 지운 뒤에는 저장 쓰기를 멈춘다(리로드 전 재기록 방지). */
export function clearSave() {
  localStorage.removeItem(SAVE_KEY)
  pauseSaveWrites()
}

/** 설정 창에 보여 줄 백업 한 줄. 읽을 수 없으면 ok 가 false 다. */
export type BackupInfo = { key: string; version: number; at: number; ok: boolean; money: number; day: string }

/** 최근 BACKUP_KEEP 개의 백업을 새것부터 풀어서 미리보기 정보를 만든다. 백업이 없으면 빈 배열이다. */
export function listBackups(): BackupInfo[] {
  return backupKeys().slice(0, BACKUP_KEEP).map((key) => {
    const m = /-(\d+)-(\d+)$/.exec(key)
    const version = m ? Number(m[1]) : 0
    const at = m ? Number(m[2]) : 0
    const raw = safeGet(key)
    const r = raw ? parseSaveFile(raw) : null
    return r?.ok ? { key, version, at, ok: true, money: r.state.money, day: r.state.day } : { key, version, at, ok: false, money: 0, day: '' }
  })
}

/** 백업 글을 저장 키에 옮긴다. 옮긴 뒤 새로고침하면 보통의 이행 경로(loadSave)로 읽힌다. 읽을 수 없으면 false. */
export function restoreBackup(key: string): boolean {
  if (!key.startsWith(BACKUP_PREFIX)) return false
  const raw = safeGet(key)
  if (!raw || !parseSaveFile(raw).ok) return false
  try {
    localStorage.setItem(SAVE_KEY, raw)
  } catch {
    return false
  }
  pauseSaveWrites()
  return true
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
