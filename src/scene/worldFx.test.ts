import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { withCloudShadows, withNightTone, withWind } from './worldFx'

/** 컴파일 자리만 흉내 낸 셰이더 한 벌. 실제 include 문자열 그대로 둔다. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '#include <common>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>',
  }
}

/** three 가 컴파일 때 부르는 onBeforeCompile 을 직접 부른다(렌더러는 쓰지 않는다) */
function compile(mat: THREE.Material, shader: ReturnType<typeof fakeShader>) {
  mat.onBeforeCompile(shader as never, {} as never)
  return shader
}

describe('땅 셰이더 효과 — 체인과 캐시 키', () => {
  it('밤 톤을 먼저 붙인 재질에 구름 그림자를 더해도 밤 함수는 한 번만 들어간다', () => {
    const mat = withCloudShadows(withNightTone(new THREE.MeshBasicMaterial(), 'field'))
    const shader = compile(mat, fakeShader())
    expect(shader.fragmentShader.split('vec3 nightTone(')).toHaveLength(2)
    expect(shader.fragmentShader.split('nightTone(diffuseColor.rgb, 1.0)')).toHaveLength(2)
    expect(shader.uniforms.uCloud).toBeDefined()
  })

  it('구름 그림자만 붙이면 밤 함수와 밤 호출이 각각 한 번씩 있다', () => {
    const shader = compile(withCloudShadows(new THREE.MeshBasicMaterial()), fakeShader())
    expect(shader.fragmentShader.split('vec3 nightTone(')).toHaveLength(2)
    expect(shader.fragmentShader.split('nightTone(diffuseColor.rgb, 1.0)')).toHaveLength(2)
  })

  it('앞에 있던 onBeforeCompile 을 버리지 않고 이어 부른다', () => {
    const mat = new THREE.MeshBasicMaterial()
    mat.onBeforeCompile = (s) => {
      s.uniforms.marker = { value: 7 }
    }
    const shader = compile(withCloudShadows(mat), fakeShader())
    expect(shader.uniforms.marker).toEqual({ value: 7 })
  })

  it('캐시 키는 효과 이름을 이어 붙인다(함수 소스를 키로 쓰지 않는다)', () => {
    const mat = withCloudShadows(withNightTone(new THREE.MeshBasicMaterial(), 'field'))
    expect(mat.customProgramCacheKey()).toBe('|night-field|field')
  })

  it('바람 흔들림도 앞에 붙은 밤 톤을 살리고, 키에 둘 다 남는다', () => {
    const mat = withWind(withNightTone(new THREE.MeshBasicMaterial(), 'field'))
    expect(mat.customProgramCacheKey()).toBe('|night-field|wind:-0.17:0.34')
    const shader = compile(mat, {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>',
    })
    expect(shader.fragmentShader.split('vec3 nightTone(')).toHaveLength(2)
    expect(shader.uniforms.uWind).toBeDefined()
  })
})
