import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose(): void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // Focus the first field ONCE on open (prefer a real input over the × button).
  // Must not depend on onClose — a caller passing a fresh onClose each render
  // would otherwise re-run this on every keystroke and steal focus.
  useEffect(() => {
    const root = ref.current
    const target = root?.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[contenteditable]') ?? root?.querySelector<HTMLElement>('button:not([disabled])')
    target?.focus()
  }, [])
  // Keydown handler set up once; reads the latest onClose via ref.
  useEffect(() => {
    const root = ref.current
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab' || !root) return
      const elements = [...root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')]
      if (!elements.length) return
      const first = elements[0]; const last = elements.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="닫기" title="닫기">×</button></header>
      {children}
    </div>
  </div>
}
