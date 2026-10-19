import { describe, expect, it } from 'vitest'
import { ALBUM_MAX, addPhoto, albumId, removePhoto, sanitizeAlbum, sanitizeWall, type AlbumPhoto } from './album'

const SRC = 'data:image/jpeg;base64,AAAA'
const photo = (id: string, day = '2026-10-19'): AlbumPhoto => ({ id, day, src: SRC })

describe('albumId', () => {
  it('같은 밀리초에 찍은 사진도 id 가 겹치지 않는다', () => {
    const a = photo(albumId(1000, []))
    const b = albumId(1000, [a])
    expect(b).not.toBe(a.id)
  })
})

describe('addPhoto / removePhoto', () => {
  it('열두 장이 차면 더 넣지 않는다', () => {
    const full = Array.from({ length: ALBUM_MAX }, (_, i) => photo(`p${i}`))
    expect(addPhoto(full, photo('x'))).toBeNull()
    expect(addPhoto(full.slice(1), photo('x'))?.length).toBe(ALBUM_MAX)
  })

  it('지우면 그 사진만 빠진다', () => {
    const album = [photo('a'), photo('b')]
    expect(removePhoto(album, 'a').map((p) => p.id)).toEqual(['b'])
    expect(removePhoto(album, 'zzz')).toBe(album)
  })
})

describe('sanitizeAlbum', () => {
  it('형식이 어긋난 항목은 버린다', () => {
    const out = sanitizeAlbum([
      photo('ok'),
      { id: 'bad-day', day: '19-10-2026', src: SRC },
      { id: 'bad-src', day: '2026-10-19', src: 'https://example.com/a.png' },
      { id: 'ok', day: '2026-10-19', src: SRC },
      null,
      42,
    ])
    expect(out.map((p) => p.id)).toEqual(['ok'])
  })

  it('지나치게 큰 썸네일과 열세 번째 이후는 남기지 않는다', () => {
    const big = { id: 'big', day: '2026-10-19', src: `data:image/jpeg;base64,${'A'.repeat(200_001)}` }
    const many = Array.from({ length: ALBUM_MAX + 3 }, (_, i) => photo(`p${i}`))
    const out = sanitizeAlbum([big, ...many])
    expect(out.length).toBe(ALBUM_MAX)
    expect(out.some((p) => p.id === 'big')).toBe(false)
  })

  it('배열이 아니면 빈 앨범', () => {
    expect(sanitizeAlbum(undefined)).toEqual([])
  })
})

describe('sanitizeWall', () => {
  it('앨범에 있는 사진 id 만 벽에 걸린다', () => {
    const album = [photo('a')]
    expect(sanitizeWall('a', album)).toBe('a')
    expect(sanitizeWall('gone', album)).toBeNull()
    expect(sanitizeWall(3, album)).toBeNull()
  })
})
