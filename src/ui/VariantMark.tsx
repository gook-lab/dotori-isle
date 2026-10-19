import { isFinish, variantById } from '../core/reform'

/** 칸 아이콘 옆 작은 표시. 마감은 ✨, 색 변형은 색 점이다. 기본 가구면 아무것도 그리지 않는다. */
export function VariantMark({ id }: { id: string | null | undefined }) {
  const v = variantById(id)
  if (!v) return null
  if (isFinish(v.id)) return <small className="variant-mark finish" aria-hidden="true">✨</small>
  return <span className="variant-mark" style={{ background: v.color }} aria-hidden="true" />
}
