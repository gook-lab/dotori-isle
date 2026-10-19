import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { setCapture } from './photoCapture'

/** 찍는 순간에만 한 프레임을 다시 그려 캔버스를 읽는다. 평소에는 읽지 않는다. */
export function PhotoCam() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    setCapture(() => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
    return () => setCapture(null)
  }, [gl, scene, camera])
  return null
}
