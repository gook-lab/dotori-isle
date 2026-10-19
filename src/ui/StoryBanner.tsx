import { useEffect, useState } from 'react'
import { useGame } from '../game/store'

/** 장이 바뀔 때 화면 가운데에 잠깐 띄우는 제목 */
const SHOW_MS = 1500

/** 섬 이야기 장 연출: 새 장의 제목을 1.5초 가운데에 띄운다. 효과음은 장을 넘길 때 store 가 낸다. */
export function StoryBanner() {
  const flash = useGame((s) => s.storyFlash)
  const [shown, setShown] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    if (!flash) return
    setShown(flash)
    // 줄 세운 다음 장 배너가 있으면 바로 이어서 띄운다(store 의 storyFlashQueue)
    const id = setTimeout(() => {
      setShown(null)
      useGame.getState().nextStoryFlash()
    }, SHOW_MS)
    return () => clearTimeout(id)
  }, [flash])
  if (!shown) return null
  return (
    <div key={shown.key} className="story-flash" role="status" aria-live="polite">
      <small>섬 이야기</small>
      <strong>{shown.text}</strong>
    </div>
  )
}
