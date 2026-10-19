import { TOOLS, type ToolId } from '../core/items'

/** 잠자리채·삽·물뿌리개는 기기마다 이모지가 없거나 다르게 보여 직접 그린다. */
export function ToolIcon({ id }: { id: ToolId }) {
  switch (id) {
    case 'net':
      return (
        <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="4" y1="21" x2="12.5" y2="11.5" stroke="#b07a45" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="16" cy="8" rx="5.5" ry="5" fill="#ffffff" stroke="#6e5a44" strokeWidth="1.8" />
          <path d="M12 6.5h8M11.5 9.5h9M14 3.5v9M17.5 3.3v9.4" stroke="#c9b8a0" strokeWidth="0.9" />
        </svg>
      )
    case 'shovel':
      return (
        <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="5" y1="5" x2="14" y2="14" stroke="#b07a45" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M3 3h5v2.5H3z" fill="#b07a45" transform="rotate(45 5.5 4.2)" />
          <path d="M13 12.5l6.5 0.5 1.5 6.5-6.5-1.5z" fill="#9fb4c4" stroke="#6e5a44" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )
    case 'can':
      return (
        <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 10h10v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#7ec8e3" stroke="#3f7f99" strokeWidth="1.4" />
          <path d="M15 13l6-5" stroke="#3f7f99" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 10a3 3 0 0 1 6 0" fill="none" stroke="#3f7f99" strokeWidth="1.6" />
          <circle cx="22" cy="5" r="1" fill="#7ec8e3" />
          <circle cx="20.5" cy="3.3" r="0.8" fill="#7ec8e3" />
        </svg>
      )
    default:
      return <>{TOOLS[id].icon}</>
  }
}
