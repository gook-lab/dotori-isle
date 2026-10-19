import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALBUM_MAX, type AlbumPhoto } from '../core/album'
import { migrateSave, useGame } from './store'

const DAY = '2026-10-19'
const SRC = 'data:image/jpeg;base64,AAAA'

const photo = (id: string): AlbumPhoto => ({ id, day: DAY, src: SRC })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  useGame.setState({ day: DAY, album: [], wallPhoto: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('photo album', () => {
  it('adds a thumbnail and refuses the thirteenth photo', () => {
    const { addAlbumPhoto } = useGame.getState()
    for (let i = 0; i < ALBUM_MAX; i++) {
      vi.setSystemTime(new Date(2026, 9, 19, 12, 0, i))
      expect(useGame.getState().addAlbumPhoto(SRC)).toBe(true)
    }
    expect(useGame.getState().album.length).toBe(ALBUM_MAX)
    expect(addAlbumPhoto(SRC)).toBe(false)
    expect(useGame.getState().album.length).toBe(ALBUM_MAX)
  })

  it('removing a photo takes it off the wall too', () => {
    useGame.setState({ album: [photo('a'), photo('b')], wallPhoto: 'a' })
    useGame.getState().removeAlbumPhoto('a')
    expect(useGame.getState().album.map((p) => p.id)).toEqual(['b'])
    expect(useGame.getState().wallPhoto).toBeNull()
  })

  it('only a photo in the album can hang on the wall', () => {
    useGame.setState({ album: [photo('a')] })
    useGame.getState().hangPhoto('a')
    expect(useGame.getState().wallPhoto).toBe('a')
    useGame.getState().hangPhoto('ghost')
    expect(useGame.getState().wallPhoto).toBeNull()
  })

  it('an older save without an album loads with an empty one', () => {
    const save = migrateSave({ day: DAY })
    expect(save.album).toEqual([])
    expect(save.wallPhoto).toBeNull()
  })

  it('a saved album keeps valid photos and a wall pick that still exists', () => {
    const save = migrateSave({
      album: [photo('a'), { id: 'broken', day: 'x', src: 'https://nope' }],
      wallPhoto: 'a',
    })
    expect(save.album.map((p) => p.id)).toEqual(['a'])
    expect(save.wallPhoto).toBe('a')
  })

  it('drops a wall pick whose photo was not saved', () => {
    const save = migrateSave({ album: [photo('a')], wallPhoto: 'gone' })
    expect(save.wallPhoto).toBeNull()
  })
})
