import { useEffect, useRef, useState } from 'react'
import type { DocBlock, DocBlockType } from '../types'

const BLOCK_TYPES: { type: DocBlockType; label: string }[] = [
  { type: 'title', label: '제목' }, { type: 'subtitle', label: '부제목' }, { type: 'heading', label: '소제목' }, { type: 'bullet', label: '• 글머리' }, { type: 'body', label: '본문' }
]

// Block-based rich-text editor (title/subtitle/heading/bullet/body). Reused by
// the brainstorm document mode and the per-date brainstorming panel.
export function DocEditor({ blocks, onChange, compact }: { blocks: DocBlock[]; onChange(blocks: DocBlock[]): void; compact?: boolean }) {
  const [focused, setFocused] = useState<string>()
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const pending = useRef<string | undefined>(undefined)
  useEffect(() => { if (pending.current) { refs.current[pending.current]?.focus(); pending.current = undefined } })
  const setText = (id: string, text: string) => onChange(blocks.map(b => b.id === id ? { ...b, text } : b))
  const setType = (id: string, type: DocBlockType) => { onChange(blocks.map(b => b.id === id ? { ...b, type } : b)); refs.current[id]?.focus() }
  const add = (afterId?: string, type: DocBlockType = 'body') => { const nb: DocBlock = { id: crypto.randomUUID(), type, text: '' }; const idx = afterId ? blocks.findIndex(b => b.id === afterId) + 1 : blocks.length; pending.current = nb.id; onChange([...blocks.slice(0, idx), nb, ...blocks.slice(idx)]) }
  const remove = (id: string) => { const idx = blocks.findIndex(b => b.id === id); pending.current = blocks[idx - 1]?.id; onChange(blocks.filter(b => b.id !== id)) }
  const placeholder = (t: DocBlockType) => t === 'title' ? '제목' : t === 'subtitle' ? '부제목' : t === 'heading' ? '소제목' : t === 'bullet' ? '목록 항목' : '본문을 입력하세요'
  return <div className={`doc-editor ${compact ? 'compact' : ''}`}>
    <div className="doc-toolbar"><span>블록 서식:</span>{BLOCK_TYPES.map(bt => <button key={bt.type} disabled={!focused} className={focused && blocks.find(b => b.id === focused)?.type === bt.type ? 'active' : ''} title={bt.label} onMouseDown={e => { e.preventDefault(); if (focused) setType(focused, bt.type) }}>{bt.label}</button>)}<span className="doc-hint">Enter=새 블록 · Shift+Enter=줄바꿈 · 빈 블록에서 Backspace=삭제</span></div>
    <div className="doc-body">{blocks.length === 0 && <button className="doc-empty" onClick={() => add(undefined, 'title')}>여기를 눌러 작성을 시작하세요</button>}
      {blocks.map(block => <div className={`doc-block doc-${block.type}`} key={block.id}>{block.type === 'bullet' && <span className="doc-bullet-mark">•</span>}<textarea ref={el => { refs.current[block.id] = el }} rows={Math.max(1, block.text.split('\n').length)} value={block.text} placeholder={placeholder(block.type)} onFocus={() => setFocused(block.id)} onChange={e => setText(block.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(block.id, block.type === 'bullet' ? 'bullet' : 'body') } else if (e.key === 'Backspace' && block.text === '' && blocks.length > 1) { e.preventDefault(); remove(block.id) } }} /></div>)}
      {blocks.length > 0 && <button className="doc-add-block" onClick={() => add(blocks.at(-1)?.id, 'body')}>＋ 블록 추가</button>}</div>
  </div>
}
