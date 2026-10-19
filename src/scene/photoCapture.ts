/**
 * 사진 찍기: 캔버스를 한 번 다시 그린 직후 PNG 로 읽는다(preserveDrawingBuffer 를 켜 두지 않는다).
 * PhotoCam 이 캡처 함수를 등록하고, UI 가 찍을 때 부른다.
 */
import { filterCss, stampText, type PhotoFilter } from '../core/photo'

let capture: (() => string | null) | null = null

export function setCapture(fn: (() => string | null) | null) {
  capture = fn
}

/** 지금 장면을 PNG 데이터 주소로. 캡처 함수가 없으면 null. */
export function capturePng(): string | null {
  return capture ? capture() : null
}

/**
 * 찍은 사진에 필터·테두리·날짜 도장을 입혀 PNG 로 만든다.
 * 필터는 canvas 2D 의 filter 로 그림에만 걸고, 테두리와 도장은 필터 없이 그린다.
 */
export function composePhoto(src: string, filter: PhotoFilter, day: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const pad = Math.round(img.width * 0.03)
      const strip = Math.round(img.height * 0.09)
      const c = document.createElement('canvas')
      c.width = img.width + pad * 2
      c.height = img.height + pad * 2 + strip
      const g = c.getContext('2d')
      if (!g) return reject(new Error('no 2d context'))
      g.fillStyle = '#fff8e7'
      g.fillRect(0, 0, c.width, c.height)
      g.filter = filterCss(filter)
      g.drawImage(img, pad, pad, img.width, img.height)
      g.filter = 'none'
      g.strokeStyle = '#5a3a20'
      g.lineWidth = Math.max(2, Math.round(img.width * 0.004))
      g.strokeRect(pad, pad, img.width, img.height)
      g.fillStyle = '#5a3a20'
      g.font = `600 ${Math.round(strip * 0.42)}px system-ui, sans-serif`
      g.textBaseline = 'middle'
      g.fillText(stampText(day), pad, pad + img.height + strip / 2)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/**
 * 앨범용 작은 복사본: 가로 width 픽셀로 줄여 JPEG 데이터 주소로 만든다. 저장 용량을 아끼려고 PNG 대신 JPEG 를 쓴다.
 */
export function thumbnailOf(src: string, width: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const h = Math.round((img.height * width) / img.width)
      const c = document.createElement('canvas')
      c.width = width
      c.height = h
      const g = c.getContext('2d')
      if (!g) return reject(new Error('no 2d context'))
      g.drawImage(img, 0, 0, width, h)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}
