import { useEffect, useState } from 'react'
import { epilogueStage, EPILOGUE_MS } from '../core/story'
import { useGame } from '../game/store'

/** 5장을 모두 마친 뒤 한 번 뜨는 끝 장면. 화면이 어두워지고 끝 글이 3초 떠 있다가 밝아진다(core/story.ts epilogueStage). */
export function Epilogue() {
  const start = useGame((s) => s.storyEnding)
  const [ms, setMs] = useState(0)
  useEffect(() => {
    if (start === null) return
    const id = setInterval(() => {
      const e = Date.now() - start
      setMs(e)
      if (e >= EPILOGUE_MS) {
        clearInterval(id)
        useGame.setState({ storyEnding: null })
      }
    }, 50)
    return () => clearInterval(id)
  }, [start])
  if (start === null) return null
  const st = epilogueStage(ms)
  return (
    <div className="epilogue" style={{ background: `rgb(27 21 16 / ${st.dark})` }} aria-hidden={st.text === 0}>
      <div className="epilogue-band" role="status" style={{ opacity: st.text }}>
        <strong>도토리섬 이야기 · 끝</strong>
        <span>그래도 섬의 하루는 계속돼요</span>
      </div>
    </div>
  )
}
