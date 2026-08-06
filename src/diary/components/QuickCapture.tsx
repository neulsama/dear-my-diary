import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { newEvent, useDiaryStore } from '../store'
import { parseSchedule, aiConfigured, type ParsedEvent } from '../ai/parseSchedule'
import type { PlannerEvent } from '../types'

const recurrenceRule = (r: ParsedEvent['recurrence']) => r === 'daily' ? 'FREQ=DAILY' : r === 'weekly' ? 'FREQ=WEEKLY' : r === 'monthly' ? 'FREQ=MONTHLY' : ''
const addHour = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }

function toPlannerEvent(parsed: ParsedEvent): PlannerEvent {
  const base = newEvent()
  const [y, m, d] = parsed.date.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  if (parsed.allDay || !parsed.startTime) { start.setHours(0, 0, 0, 0) }
  else { const [h, min] = parsed.startTime.split(':').map(Number); start.setHours(h, min, 0, 0) }
  const end = new Date(start)
  if (parsed.endTime) { const [h, min] = parsed.endTime.split(':').map(Number); end.setHours(h, min, 0, 0) }
  else if (!parsed.allDay) end.setHours(end.getHours() + 1)
  else end.setHours(23, 59, 0, 0)
  return { ...base, title: parsed.title, description: parsed.description ?? '', location: parsed.location ?? '', allDay: parsed.allDay, startAt: start.toISOString(), endAt: end.toISOString(), recurrenceRule: recurrenceRule(parsed.recurrence) }
}

export function QuickCapture() {
  const store = useDiaryStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [source, setSource] = useState<'ai' | 'local'>()
  const [drafts, setDrafts] = useState<ParsedEvent[]>([])

  const run = async () => {
    if (!text.trim()) return
    setBusy(true); setNote(''); setDrafts([])
    const result = await parseSchedule(text, new Date())
    // Ensure timed events always show an end time (default: +1h) so 몇시~몇시 is editable.
    const events = result.events.map(e => (!e.allDay && e.startTime && !e.endTime) ? { ...e, endTime: addHour(e.startTime) } : e)
    setDrafts(events); setSource(result.source); setNote(result.note ?? (events.length ? '' : '일정을 찾지 못했습니다. 날짜나 시간을 포함해 다시 적어보세요.'))
    setBusy(false)
  }
  const update = (i: number, patch: Partial<ParsedEvent>) => setDrafts(d => d.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  const remove = (i: number) => setDrafts(d => d.filter((_, idx) => idx !== i))
  const save = async () => {
    for (const parsed of drafts) await store.saveEvent(toPlannerEvent(parsed))
    store.setToast(`${drafts.length}개 일정을 추가했습니다.`)
    setDrafts([]); setText(''); setOpen(false)
  }
  const reset = () => { setOpen(false); setText(''); setDrafts([]); setNote(''); setSource(undefined) }

  return <>
    <button className="quick-capture-open purple-button" onClick={() => setOpen(true)}>✎ 텍스트로 일정 추가</button>
    {open && <Modal title="텍스트로 일정 정리" onClose={reset} wide>
      <div className="quick-capture">
        <p className="quick-capture-hint">하고 싶은 일을 자유롭게 적으면 월간·주간 캘린더에 정리해 드립니다. 예: “내일 오후 3시 팀 회의, 8월 20일 치과 예약, 매주 월요일 아침 7시 운동”</p>
        <textarea rows={4} value={text} placeholder="예: 다음주 금요일 저녁 7시 저녁 약속, 8월 15일 여행" onChange={e => setText(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void run() }} />
        <div className="quick-capture-actions">
          <small>{import.meta.env.PROD ? '서버 AI 파싱' : (aiConfigured() ? 'AI 파싱 사용 중' : 'AI 키 없음 · 기본 파서 사용')}</small>
          <button className="purple-button" disabled={busy || !text.trim()} onClick={run}>{busy ? '정리 중…' : '정리하기'} <kbd>Ctrl+↵</kbd></button>
        </div>
        {note && <div className="notice" role="status">{note}</div>}
        {drafts.length > 0 && <>
          <div className="quick-capture-preview-head"><b>미리보기 ({drafts.length})</b>{source && <span className={`source-badge ${source}`}>{source === 'ai' ? 'AI 분석' : '기본 파서'}</span>}</div>
          <div className="quick-capture-list">
            {drafts.map((e, i) => <div className="quick-capture-item" key={i}>
              <input className="qc-title" value={e.title} onChange={ev => update(i, { title: ev.target.value })} />
              <input type="date" value={e.date} onChange={ev => update(i, { date: ev.target.value })} />
              <span className="qc-timerange"><input type="time" title="시작" value={e.startTime ?? ''} disabled={e.allDay} onChange={ev => update(i, { startTime: ev.target.value || undefined })} /><i>~</i><input type="time" title="종료" value={e.endTime ?? ''} disabled={e.allDay || !e.startTime} onChange={ev => update(i, { endTime: ev.target.value || undefined })} /></span>
              <label className="qc-allday"><input type="checkbox" checked={e.allDay} onChange={ev => update(i, { allDay: ev.target.checked, startTime: ev.target.checked ? undefined : e.startTime, endTime: ev.target.checked ? undefined : e.endTime })} />종일</label>
              <select value={e.recurrence ?? ''} onChange={ev => update(i, { recurrence: ev.target.value as ParsedEvent['recurrence'] })}><option value="">반복 없음</option><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option></select>
              <button className="qc-remove" title="제외" onClick={() => remove(i)}>×</button>
            </div>)}
          </div>
        </>}
      </div>
      <footer className="modal-actions"><span className="action-spacer" /><button onClick={reset}>취소</button><button className="purple-button" disabled={!drafts.length} onClick={save}>{drafts.length ? `${drafts.length}개 일정 추가` : '일정 추가'}</button></footer>
    </Modal>}
  </>
}
