import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns'

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
export const localInput = (iso: string): string => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
export const inputToIso = (value: string): string => new Date(value).toISOString()
export const formatEventTime = (iso: string): string => format(parseISO(iso), 'HH:mm')
export const weekDates = (anchor: Date): Date[] => Array.from({ length: 7 }, (_, index) => addDays(startMonday(anchor), index))
