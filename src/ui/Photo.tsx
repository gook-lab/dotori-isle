import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { clampOrbit, DEFAULT_ORBIT, filterCss, PHOTO_FILTERS, PHOTO_MOODS, PHOTO_POSES, photoFileName, type PhotoFilter, type PhotoPose } from '../core/photo'
import type { Mood } from '../core/villagers'
import { isHeld } from '../game/input'
import { play } from '../game/sfx'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { capturePng, composePhoto, thumbnailOf } from '../scene/photoCapture'
import { THUMB_WIDTH } from '../core/album'
import { AlbumView } from './Album'

/** 카메라 조작: 한 손가락 끌기로 돌리고, 휠이나 두 손가락 벌리기·오므리기로 가까이·멀리. WASD 로도 돈다. */
function useOrbitInput(on: boolean) {
  useEffect(() => {
    if (!on) return
    // 처음엔 플레이어 앞쪽에서 얼굴과 자세가 보이게 잡는다
    runtime.photoOrbit = { ...DEFAULT_ORBIT, yaw: runtime.player.facing }
    const canvas = document.querySelector('canvas')
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    let pinchDist = 0
    const onDown = (e: PointerEvent) => {
      if (e.target !== canvas) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
        pinchDist = runtime.photoOrbit.dist
      }
    }
    const onMove = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId)
      if (!prev) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size >= 2 && pinch > 0) {
        const [a, b] = [...pts.values()]
        const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        runtime.photoOrbit = clampOrbit({ ...runtime.photoOrbit, dist: (pinchDist * pinch) / d })
      } else if (pts.size === 1) {
        const dx = e.clientX - prev.x
        const dy = e.clientY - prev.y
        runtime.photoOrbit = clampOrbit({ yaw: runtime.photoOrbit.yaw - dx * 0.008, pitch: runtime.photoOrbit.pitch + dy * 0.005, dist: runtime.photoOrbit.dist })
      }
    }
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
    }
    const onWheel = (e: WheelEvent) => {
      if (e.target !== canvas) return
      e.preventDefault()
      runtime.photoOrbit = clampOrbit({ ...runtime.photoOrbit, dist: runtime.photoOrbit.dist * Math.exp(e.deltaY * 0.001) })
    }
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const turn = (isHeld('KeyA', 'ArrowLeft') ? 1 : 0) - (isHeld('KeyD', 'ArrowRight') ? 1 : 0)
      const tilt = (isHeld('KeyW', 'ArrowUp') ? 1 : 0) - (isHeld('KeyS', 'ArrowDown') ? 1 : 0)
      if (turn || tilt) runtime.photoOrbit = clampOrbit({ yaw: runtime.photoOrbit.yaw + turn * dt * 1.6, pitch: runtime.photoOrbit.pitch + tilt * dt * 0.9, dist: runtime.photoOrbit.dist })
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('wheel', onWheel, { passive: false })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
    }
  }, [on])
}

/** 사진 모드 화면: 자세·표정·필터 고르기, 셔터, 찍은 사진 저장. 사진 모드가 아닐 때는 휴대폰 버튼만 보인다. */
export function PhotoMode() {
  const photo = useGame((s) => s.photo)
  const day = useGame((s) => s.day)
  const pose = useGame((s) => s.photoPose)
  const mood = useGame((s) => s.photoMood)
  const filter = useGame((s) => s.photoFilter)
  const [shot, setShot] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const albumOpen = useGame((s) => s.albumOpen)
  useOrbitInput(photo)

  // 미리보기는 캔버스에 같은 필터를 CSS 로 건다. 사진 모드가 끝나면 되돌린다.
  useEffect(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')
    if (c) c.style.filter = photo ? filterCss(filter) : ''
  }, [photo, filter])

  // 사진·설정 메뉴는 휴대폰으로 옮겼다. 사진 모드가 아닐 때는 앨범 화면만 남긴다.
  if (!photo) {
    return albumOpen ? createPortal(<AlbumView onClose={() => useGame.getState().setAlbumOpen(false)} />, document.body) : null
  }

  const shoot = () => {
    const raw = capturePng()
    if (!raw) return
    play('shutter')
    setFlash(true)
    setTimeout(() => setFlash(false), 320)
    composePhoto(raw, filter, day).then(setShot).catch(() => setShot(null))
  }

  const save = () => {
    if (!shot) return
    const a = document.createElement('a')
    a.href = shot
    a.download = photoFileName(day)
    a.click()
  }

  const st = useGame.getState
  return (
    <div className="photo-layer">
      <div className="photo-frame" aria-hidden="true">
        <span className="photo-stamp">도토리섬 · {day.replace(/-/g, '.')}</span>
      </div>
      <div className="photo-top">
        <span className="photo-pill">📷 사진 모드</span>
        <button className="photo-exit" onClick={() => st().setPhoto(false)} aria-label="사진 모드 나가기">
          ✕ 나가기
        </button>
      </div>
      <div className="photo-dock">
        <div className="photo-row" role="group" aria-label="자세">
          {PHOTO_POSES.map((p: { id: PhotoPose; label: string; icon: string }) => (
            <button key={p.id} aria-pressed={pose === p.id} onClick={() => st().setPhotoPose(pose === p.id ? null : p.id)}>
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
        <div className="photo-row" role="group" aria-label="표정">
          {PHOTO_MOODS.map((m: { id: Mood; label: string }) => (
            <button key={m.id} aria-pressed={mood === m.id} onClick={() => st().setPhotoMood(mood === m.id ? null : m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="photo-row" role="group" aria-label="필터">
          {PHOTO_FILTERS.map((f: { id: PhotoFilter; label: string }) => (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => st().setPhotoFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="photo-row photo-shutter-row">
          <button className="photo-shutter" onClick={shoot} aria-label="찍기">
            📸 찍기
          </button>
        </div>
      </div>
      {flash && <div className="photo-flash" aria-hidden="true" />}
      {shot && (
        <div className="photo-preview" role="dialog" aria-label="찍은 사진">
          <img src={shot} alt="찍은 사진" />
          <div className="photo-preview-actions">
            <button className="primary" onClick={save}>
              💾 사진 저장
            </button>
            <button onClick={() => thumbnailOf(shot, THUMB_WIDTH).then((src) => useGame.getState().addAlbumPhoto(src)).catch(() => useGame.getState().notify('앨범에 넣지 못했어요'))}>
              🖼 앨범에 넣기
            </button>
            <button onClick={() => setShot(null)}>다시 찍기</button>
          </div>
        </div>
      )}
    </div>
  )
}
