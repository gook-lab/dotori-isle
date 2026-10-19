import * as THREE from 'three'
import { waterUniforms } from './waterMaterial'

/** 밤의 정도 0(낮)~1(한밤). 물 셰이더와 같은 값을 써서 반짝임·빛 번짐·그림자가 같은 시각에 바뀐다. */
export const nightLevel = () => waterUniforms.uNight.value

let tex: THREE.Texture | null = null
/** 가운데가 밝고 가장자리로 흐려지는 흰 점. 한 번만 그려 모든 번짐이 나눠 쓴다. */
function glowTexture(): THREE.Texture {
  if (tex) return tex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  tex = new THREE.CanvasTexture(c)
  return tex
}

const glows = new Map<string, THREE.SpriteMaterial>()
/** 빛 번짐 재질. 조명을 받지 않고 더해져서 어두운 땅에서만 또렷하다. 색마다 한 개를 모든 물건이 공유한다. */
export function glowMaterial(color: string): THREE.SpriteMaterial {
  let m = glows.get(color)
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
    glows.set(color, m)
  }
  return m
}
