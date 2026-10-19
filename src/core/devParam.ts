/** 개발 확인용 URL 값(?hour= ?weather= ?season= ?sky= ?unlock=). 개발 빌드에서만 읽고 배포 빌드에서는 null 이다. */
export function devParam(name: string): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}
