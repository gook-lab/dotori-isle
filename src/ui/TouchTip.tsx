import { useEffect, useState } from 'react'
import { isTouchDevice } from './device'
import { useGame } from '../game/store'

const KEY = 'dotori-touch-tip'

/**
 * 터치 기기에서 처음 한 번만 3초 보여 주는 조작 안내. 본 뒤에는 localStorage 에 표시를 남긴다.
 * 타이틀이 끝난 뒤에 시작하고, 창이 열려 있거나 놓는 중이면 겹치지 않게 숨긴다.
 */
export function TouchTip() {
  const [show, setShow] = useState(false)
  const title = useGame((s) => s.title)
  const panel = useGame((s) => s.panel)
  // 놓는 중에는 버튼 줄이 두 줄로 늘어 이 안내와 겹치므로 숨긴다. 놓기 중 필요한 안내는 위쪽 프롬프트에 있다.
  const placing = useGame((s) => !!(s.placing || s.homePlacing))
  // 📦 넣기 버튼이 떠 있으면 그 자리와 겹치므로 숨긴다(버튼 자체가 같은 쪽을 가리킨다)
  const stowing = useGame((s) => !!s.prompt?.includes('넣기'))
  useEffect(() => {
    if (title || !isTouchDevice()) return
    try {
      if (localStorage.getItem(KEY)) return
    } catch {
      return
    }
    setShow(true)
    const id = setTimeout(() => {
      setShow(false)
      try {
        localStorage.setItem(KEY, '1')
      } catch {
        // 저장이 막혀도 안내는 한 번 보여 준 것으로 충분하다
      }
    }, 3000)
    return () => clearTimeout(id)
  }, [title])
  if (!show || panel !== null || placing || stowing) return null
  return (
    <div className="touch-tip" role="note">
      왼쪽 아래 끌어서 이동 · E 행동 · 📱 휴대폰
    </div>
  )
}
