import type { CalendarPreferences, PlannerEvent, StudyGoal, StudyTask } from '../types'

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (iso: string) => iso.slice(0, 10).replace(/-/g, '')

export function eventsToIcs(events: PlannerEvent[], calendarName = 'DEAR MY DIARY', tasks:StudyTask[]=[], goals:StudyGoal[]=[], preferences?:CalendarPreferences): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DEAR MY DIARY//Calendar//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escape(calendarName)}`, 'X-WR-TIMEZONE:Asia/Seoul']
  for (const event of (preferences?.appleIncludeEvents===false?[]:events.filter(item => !item.deletedAt))) {
    lines.push('BEGIN:VEVENT', `UID:${event.id}@dear-my-diary`, `DTSTAMP:${stamp(event.updatedAt)}`)
    if (event.allDay) lines.push(`DTSTART;VALUE=DATE:${day(event.startAt)}`, `DTEND;VALUE=DATE:${day(event.endAt)}`)
    else lines.push(`DTSTART:${stamp(event.startAt)}`, `DTEND:${stamp(event.endAt)}`)
    lines.push(`SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`)
    if (event.recurrenceRule) lines.push(`RRULE:${event.recurrenceRule}`)
    lines.push('END:VEVENT')
  }
  if(preferences?.appleIncludeStudy!==false)for(const task of tasks.filter(item=>!item.deletedAt&&(preferences?.appleIncludeCompleted||item.status!=='completed'))){const goal=goals.find(item=>item.id===task.goalId);if(!goal?.appleFeedEnabled)continue;const description=[preferences?.appleIncludeNotes&&task.notes,preferences?.appleIncludeEstimatedTime&&`예상 소요 시간: ${task.estimatedMinutes}분`].filter(Boolean).join('\n');lines.push('BEGIN:VEVENT',`UID:study-${task.id}@dear-my-diary`,`DTSTAMP:${stamp(task.updatedAt)}`,`DTSTART;VALUE=DATE:${task.scheduledDate.replaceAll('-','')}`,`DTEND;VALUE=DATE:${new Date(new Date(`${task.scheduledDate}T00:00:00`).getTime()+86400000).toISOString().slice(0,10).replaceAll('-','')}`,`SUMMARY:${escape(`${task.status==='completed'?'[완료] ':''}${task.title}`)}`,`DESCRIPTION:${escape(description)}`,'END:VEVENT')}
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
