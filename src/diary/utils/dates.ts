import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

export const KOREA_TIMEZONE = 'Asia/Seoul'
export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd')
export const startMonday = (date: Date): Date => startOfWeek(date, { weekStartsOn: 1 })
export const monthGrid = (anchor: Date): Date[] => {
  const start = startMonday(startOfMonth(anchor))
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const dates: Date[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor)
  while (dates.length < 42) dates.push(addDays(dates.at(-1)!, 1))
  return dates
}
export const monthNameSpaced = (date: Date): string => format(date, 'MMMM').toUpperCase().split('').join(' ')
export const moveMonth = (date: Date, delta: number): Date => addMonths(date, delta)
export const eventOnDate = (startAt: string, date: Date): boolean => isSameDay(parseISO(startAt), date)

// --- Recurrence + multi-day span ---
interface Recurrence { freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'; interval: number }
export function parseRecurrence(rule: string): Recurrence | null {
  if (!rule) return null
  const freq = /FREQ=DAILY/i.test(rule) ? 'DAILY' : /FREQ=WEEKLY/i.test(rule) ? 'WEEKLY' : /FREQ=MONTHLY/i.test(rule) ? 'MONTHLY' : null
  if (!freq) return null
  const m = rule.match(/INTERVAL=(\d+)/i)
  return { freq, interval: m ? Math.max(1, +m[1]) : 1 }
}
type SpanEvent = { startAt: string; endAt: string; recurrenceRule: string }
// True when an occurrence of the event STARTS on `date` (used for timed placement).
export function occursStartingOn(event: { startAt: string; recurrenceRule: string }, date: Date): boolean {
  const start = startOfDay(parseISO(event.startAt)), d = startOfDay(date), rule = parseRecurrence(event.recurrenceRule)
  if (!rule) return isSameDay(start, date)
  if (d < start) return false
  const diff = differenceInCalendarDays(d, start)
  if (rule.freq === 'DAILY') return diff % rule.interval === 0
  if (rule.freq === 'WEEKLY') return diff % (7 * rule.interval) === 0
  if (d.getDate() !== start.getDate()) return false
  const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
  return months >= 0 && months % rule.interval === 0
}
// All date keys the event covers within [rangeStart, rangeEnd], expanding recurrence and multi-day spans.
export function eventCoveredKeys(event: SpanEvent, rangeStart: Date, rangeEnd: Date): string[] {
  const start = startOfDay(parseISO(event.startAt)), end = startOfDay(parseISO(event.endAt))
  const spanDays = Math.max(0, differenceInCalendarDays(end, start)), rule = parseRecurrence(event.recurrenceRule)
  const rStart = startOfDay(rangeStart), rEnd = startOfDay(rangeEnd), keys: string[] = []
  const addSpan = (occStart: Date) => { for (let i = 0; i <= spanDays; i++) { const dd = addDays(occStart, i); if (dd >= rStart && dd <= rEnd) keys.push(toDateKey(dd)) } }
  if (!rule) { if (!(addDays(start, spanDays) < rStart || start > rEnd)) addSpan(start); return keys }
  let occ = start, guard = 0
  if (rule.freq === 'DAILY' || rule.freq === 'WEEKLY') {
    const step = rule.freq === 'DAILY' ? rule.interval : 7 * rule.interval
    const gap = differenceInCalendarDays(rStart, occ) - spanDays
    if (gap > 0) occ = addDays(occ, Math.floor(gap / step) * step)
    while (occ <= rEnd && guard++ < 800) { addSpan(occ); occ = addDays(occ, step) }
  } else {
    while (addDays(occ, spanDays) < rStart && guard++ < 1200) occ = addMonths(occ, rule.interval)
    guard = 0
    while (occ <= rEnd && guard++ < 800) { addSpan(occ); occ = addMonths(occ, rule.interval) }
  }
  return keys
}
export const localInput = (iso: string): string => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
export const inputToIso = (value: string): string => new Date(value).toISOString()
export const formatEventTime = (iso: string): string => format(parseISO(iso), 'HH:mm')
export const weekDates = (anchor: Date): Date[] => Array.from({ length: 7 }, (_, index) => addDays(startMonday(anchor), index))
