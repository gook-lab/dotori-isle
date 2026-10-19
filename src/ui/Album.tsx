import { useState } from 'react'
import { ALBUM_MAX, type AlbumPhoto } from '../core/album'
import { useGame } from '../game/store'

/** 앨범 화면: 썸네일 격자. 한 장을 누르면 크게 보고, 벽에 걸거나 내리거나 지울 수 있다. */
export function AlbumView({ onClose }: { onClose: () => void }) {
  const album = useGame((s) => s.album)
  const wallPhoto = useGame((s) => s.wallPhoto)
  const [openId, setOpenId] = useState<string | null>(null)
  const [askDelete, setAskDelete] = useState(false)
  const shot = album.find((p) => p.id === openId) ?? null
  const st = useGame.getState

  const close = () => {
    setOpenId(null)
    setAskDelete(false)
    onClose()
  }

  const remove = (p: AlbumPhoto) => {
    st().removeAlbumPhoto(p.id)
    setOpenId(null)
    setAskDelete(false)
  }

  return (
    <div className="album" role="dialog" aria-label="사진 앨범">
      <div className="album-top">
        {shot ? (
          <button className="album-back" onClick={() => { setOpenId(null); setAskDelete(false) }}>
            ‹ 앨범
          </button>
        ) : (
          <span className="album-title">🖼 사진 앨범 · {album.length}/{ALBUM_MAX}</span>
        )}
        <button className="album-close" onClick={close} aria-label="앨범 닫기">
          ✕ 닫기
        </button>
      </div>

      {!shot && album.length === 0 && (
        <p className="album-empty">아직 찍은 사진이 없어요. 사진 모드(P)에서 찍으면 여기에 모여요.</p>
      )}

      {!shot && album.length > 0 && (
        <div className="album-grid">
          {album.map((p) => (
            <button key={p.id} className="album-cell" onClick={() => setOpenId(p.id)} aria-label={`${p.day} 사진 보기`}>
              <img src={p.src} alt={`${p.day} 사진`} />
              {wallPhoto === p.id && <span className="album-tag">벽에 걸림</span>}
            </button>
          ))}
        </div>
      )}

      {shot && (
        <div className="album-detail">
          <img src={shot.src} alt={`${shot.day} 사진`} />
          <p className="album-day">{shot.day.replace(/-/g, '.')} · 도토리섬</p>
          <div className="album-actions">
            {wallPhoto === shot.id ? (
              <button onClick={() => st().hangPhoto(null)}>벽에서 내리기</button>
            ) : (
              <button className="primary" onClick={() => st().hangPhoto(shot.id)}>
                🖼 집 벽에 걸기
              </button>
            )}
            {askDelete ? (
              <>
                <button className="danger" onClick={() => remove(shot)}>
                  정말 지워요
                </button>
                <button onClick={() => setAskDelete(false)}>그만두기</button>
              </>
            ) : (
              <button onClick={() => setAskDelete(true)}>지우기</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
