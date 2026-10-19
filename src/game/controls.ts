import { TOOL_ORDER, TOOLS } from '../core/items'
import { cancelPaint, findAction, nearestHomePlaced, nearestPlaced, runAction, standUp, startWish, wishOpen } from './actions'
import { runtime, type ActKind } from './runtime'
import { firstClaimable, useGame } from './store'

/** 몸동작 중 E·R 을 막을 때 말할 동작 이름. "잠깐만요, ○○ 중이에요"로 쓴다. */
const ACT_BUSY: Record<ActKind, string> = {
  look: '둘러보는',
  shake: '나무 흔드는',
  swing: '휘두르는',
  dig: '땅 파는',
  water: '물 주는',
  hit: '내리치는',
  chop: '나무 베는',
  build: '짓는',
  pick: '줍는',
  show: '보여 주는',
  pat: '쓰다듬는',
  wipe: '닦는',
  peek: '들여다보는',
  sip: '마시는',
  eat: '먹는',
}

/** 키보드와 터치 버튼이 함께 쓰는 입력 처리. 코드 이름은 KeyboardEvent.code 를 따른다. */
export function onKey(code: string) {
  const s = useGame.getState()
  const act = code === 'KeyE' || code === 'Space' || code === 'Enter'
  // 화면이 덮여 자리를 옮기는 동안(여행·문 드나들기)엔 아무 입력도 받지 않는다. 티켓이 두 번 쓰이거나 패널이 남지 않게.
  if (s.traveling || s.doorFade) return
  // 사진 모드: Esc 나 P 로 나간다. 카메라는 WASD·끌기로 돌리니 나머지 키는 쓰지 않는다.
  if (s.photo) {
    if (code === 'Escape' || code === 'KeyP') s.setPhoto(false)
    return
  }
  if (code === 'KeyP' && !s.panel && !s.dialog) return s.setPhoto(true)

  // 잡은 것 자랑 자막: 누르면 남은 글자를 보여 주고, 다시 누르면 닫는다.
  if (s.caption && act) {
    if (runtime.typing) runtime.skipTyping = true
    else s.closeCaption()
    return
  }
  if (s.panel === 'talk') {
    if (code === 'Escape') return s.openPanel(null)
    // 질문 답 고르기: 위아래로 옮기고 숫자로 바로 고른다.
    const d0 = s.dialog
    if (d0?.ask && d0.index === d0.lines.length - 1 && !runtime.typing) {
      if (code === 'ArrowUp' || code === 'KeyW') return s.moveAsk(-1)
      if (code === 'ArrowDown' || code === 'KeyS') return s.moveAsk(1)
      const n = /^Digit([1-9])$/.exec(code)
      if (n) return s.answer(Number(n[1]) - 1)
      if (act) return s.answer()
    }
    if (act) {
      if (runtime.typing) {
        runtime.skipTyping = true
        return
      }
      const d = s.dialog
      const last = d && d.index === d.lines.length - 1
      if (last && d.offer) return s.giveRequest()
      if (last && (d.choice || d.choices?.length)) return s.chooseDialog()
      return s.advanceDialog()
    }
    return
  }
  // 수첩이 열려 있으면 Enter·E 로 맨 앞 보상을 받는다. 키보드만으로 퀘스트를 끝낼 수 있게 한다.
  if (s.panel === 'quest' && act) {
    const id = firstClaimable(s)
    if (id) s.claimQuest(id)
    return
  }
  if (code === 'Escape') {
    if (runtime.paintMode) return cancelPaint()
    if (s.placing || s.homePlacing) return s.startPlacing(null)
    if (s.bagOpen && !s.panel) return s.toggleBag(false)
    return s.openPanel(null)
  }
  // Tab 은 도감을 여는 키다. 패널이 열려 있으면 Tab 은 창 안의 포커스 이동에 쓰고, 닫기는 Esc 로 한다.
  // 가방이 열려 있으면 Tab 은 가방 안에서 돈다(Hud 의 Inventory 가 막는다). 도감을 열지 않는다.
  if (code === 'Tab') return s.panel || s.bagOpen ? undefined : s.openPanel('dex')
  // ` 키는 휴대폰을 여닫는다. 다른 패널이 열려 있으면 그대로 둔다.
  if (code === 'Backquote') return s.panel === 'phone' ? s.openPanel(null) : s.panel === null ? s.openPanel('phone') : undefined
  if (code === 'KeyM') return s.openPanel(s.panel === 'miles' ? null : s.panel === null ? 'miles' : s.panel)
  if (code === 'KeyC') return s.panel === 'closet' ? s.openPanel(null) : s.panel === null ? s.openCloset(false) : undefined
  if (code === 'KeyI') return s.panel === null && s.toggleBag()
  if (code === 'KeyJ') return s.openPanel(s.panel === 'quest' ? null : s.panel === null ? 'quest' : s.panel)
  if (code === 'KeyN') return s.openPanel(s.panel === 'map' ? null : s.panel === null ? 'map' : s.panel)
  if (s.panel) return
  // 몸동작(쓰임·줍기) 중에는 E·R 을 받지 않는다. 아무 반응이 없으면 고장처럼 보여서 짧게 알려 준다.
  if (runtime.act && (act || code === 'KeyR')) return s.notify(`잠깐만요, ${ACT_BUSY[runtime.act.kind]} 중이에요`)
  if (s.placing && code === 'KeyR') return s.rotatePlacing()
  if (s.homePlacing && code === 'KeyR') return s.rotateHomePlacing()
  if (code === 'KeyR' && !runtime.act) {
    // 유성우 밤에는 앉은 채로 R 을 눌러 소원을 빈다. 앉아 있을 땐 그 밖에 일어나기만 한다. 바로 이어서 넣으면 앉아 있던 의자가 주머니로 들어가 버린다.
    if (runtime.seat && wishOpen()) return startWish()
    if (runtime.seat) return standUp()
    standUp()
    // 집 방 안에서는 방 가구만 넣는다. 바깥 섬의 가구는 멀리 있어 닿지 않는다.
    if (s.inHome) {
      const home = nearestHomePlaced()
      if (home) return s.pickUpHome(home.id)
      return
    }
    const near = nearestPlaced()
    if (near) return s.pickUpPlaced(near.id)
  }
  if (runtime.fishing.phase === 'idle' && !runtime.act) {
    const tool = TOOL_ORDER.find((t) => code === `Digit${TOOLS[t].key}`)
    // 놓기 모드 중 도구 번호를 누르면 놓기를 접고 그 도구를 든다. 없는 도구면 놓기는 그대로 둔다.
    if (tool) {
      if ((s.placing || s.homePlacing) && (tool === 'hand' || s.tools.includes(tool))) s.startPlacing(null)
      return s.equip(tool)
    }
    if (code === 'KeyQ' && !s.placing) return s.cycleTool()
  }
  if (act && !runtime.act) {
    const action = findAction()
    if (action) runAction(action)
  }
}
