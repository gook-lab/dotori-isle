/**
 * 사진 앨범: 찍은 사진의 작은 복사본(240px 썸네일)을 최대 열두 장까지 저장한다.
 * 벽에 건 사진은 앨범 안의 id 한 개로 가리킨다. 앨범에서 지우면 벽에서도 내려간다.
 */

export const ALBUM_MAX = 12

/** 썸네일 가로 픽셀 */
export const THUMB_WIDTH = 240

/** 한 장의 썸네일이 이보다 크면 저장값을 버린다(손상된 저장 방지). 240px JPEG 는 보통 20~40KB. */
const SRC_MAX_LENGTH = 200_000

export interface AlbumPhoto {
  id: string
  /** 찍은 날 YYYY-MM-DD */
  day: string
  /** data:image/... 썸네일 주소 */
  src: string
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 새 사진 id. 같은 밀리초에 두 장을 찍어도 겹치지 않게 번호를 덧붙인다. */
export function albumId(now: number, taken: readonly AlbumPhoto[]): string {
  const base = `ph-${now.toString(36)}`
  let id = base
  for (let n = 2; taken.some((p) => p.id === id); n++) id = `${base}-${n}`
  return id
}

/** 앨범에 한 장 더한다. 가득 찼으면 null 을 돌려준다(지운 뒤에 다시 넣어야 한다). */
export function addPhoto(album: readonly AlbumPhoto[], photo: AlbumPhoto): AlbumPhoto[] | null {
  if (album.length >= ALBUM_MAX) return null
  return [...album, photo]
}

/** 한 장을 뺀다. 없는 id 면 같은 배열을 돌려준다. */
export function removePhoto(album: readonly AlbumPhoto[], id: string): AlbumPhoto[] {
  return album.some((p) => p.id === id) ? album.filter((p) => p.id !== id) : (album as AlbumPhoto[])
}

/** 저장값 검증: 형식이 맞는 사진만, id 중복 없이, 최대 열두 장까지 남긴다. */
export function sanitizeAlbum(raw: unknown): AlbumPhoto[] {
  if (!Array.isArray(raw)) return []
  const out: AlbumPhoto[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const p = x as Partial<AlbumPhoto>
    if (typeof p.id !== 'string' || !p.id || out.some((o) => o.id === p.id)) continue
    if (typeof p.day !== 'string' || !DAY_RE.test(p.day)) continue
    if (typeof p.src !== 'string' || !p.src.startsWith('data:image/') || p.src.length > SRC_MAX_LENGTH) continue
    out.push({ id: p.id, day: p.day, src: p.src })
    if (out.length >= ALBUM_MAX) break
  }
  return out
}

/** 벽에 건 사진 id 검증: 앨범에 있는 id 만 남긴다. */
export function sanitizeWall(raw: unknown, album: readonly AlbumPhoto[]): string | null {
  return typeof raw === 'string' && album.some((p) => p.id === raw) ? raw : null
}
