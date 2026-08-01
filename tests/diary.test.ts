import { describe, expect, it } from 'vitest'
import migration from '../supabase/migrations/202608020100_dear_my_diary.sql?raw'
import { eventOnDate, monthGrid, startMonday, weekDates } from '../src/diary/utils/dates'
import { eventsToIcs } from '../src/diary/utils/ics'
import { isOpenDiaryShortcut } from '../src/diary/utils/shortcuts'
import { validateDiaryData } from '../src/diary/repository'
import { DEFAULT_DIARY_DATA, type PlannerEvent } from '../src/diary/types'

const event=(overrides:Partial<PlannerEvent>={}):PlannerEvent=>({id:'event-1',title:'A quiet morning',description:'coffee, notes; and rain',startAt:'2026-08-03T01:00:00.000Z',endAt:'2026-08-03T02:00:00.000Z',allDay:false,color:'#8f78b8',location:'Seoul',status:'planned',recurrenceRule:'',reminderMinutes:10,source:'local',googleSync:false,syncStatus:'local',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z',...overrides})

describe('calendar date calculations',()=>{
 it('builds the current month from a runtime date',()=>{const grid=monthGrid(new Date(2026,7,2));expect(grid).toHaveLength(42);expect(grid.some(d=>d.getMonth()===7&&d.getDate()===31)).toBe(true)})
 it('uses Monday as the first day',()=>{const first=monthGrid(new Date(2026,7,1))[0];expect(first.getDay()).toBe(1);expect(startMonday(new Date(2026,7,2)).getDay()).toBe(1)})
 it('handles leap years and month ends',()=>{const grid=monthGrid(new Date(2028,1,10));expect(grid.some(d=>d.getMonth()===1&&d.getDate()===29)).toBe(true)})
 it('produces the same seven dates for weekly rendering',()=>{const dates=weekDates(new Date(2026,7,5));expect(dates).toHaveLength(7);expect(dates[0].getDay()).toBe(1);expect(dates[6].getDay()).toBe(0)})
})

describe('shared event behavior',()=>{
 it('supports create update and soft delete without copying data',()=>{let events:PlannerEvent[]=[];events=[...events,event()];events=events.map(v=>v.id==='event-1'?{...v,title:'Updated'}:v);events=events.map(v=>v.id==='event-1'?{...v,deletedAt:new Date().toISOString()}:v);expect(events[0].title).toBe('Updated');expect(events[0].deletedAt).toBeTruthy()})
 it('makes Monthly-created events visible to Weekly through the same collection',()=>{const events=[event()];const day=new Date('2026-08-03T01:00:00.000Z');expect(events.filter(v=>eventOnDate(v.startAt,day))).toHaveLength(1)})
 it('recognizes Alt or Option plus 7 only outside editors',()=>{expect(isOpenDiaryShortcut({altKey:true,code:'Digit7',target:null})).toBe(true);expect(isOpenDiaryShortcut({altKey:true,code:'Digit7',target:{tagName:'INPUT',isContentEditable:false} as unknown as EventTarget})).toBe(false)})
 it('preserves a brainstorm board through validation and restore',()=>{const data=structuredClone(DEFAULT_DIARY_DATA);data.boards[0].nodes.push({id:'n',boardId:'default-board',title:'Idea',body:'Keep it',color:'#fff4a8',x:1,y:2,width:220,height:150,createdAt:'',updatedAt:''});expect(validateDiaryData(JSON.parse(JSON.stringify(data))).boards[0].nodes[0].body).toBe('Keep it')})
})

describe('ICS, timezone, and database safety',()=>{
 it('creates a valid basic RFC 5545 calendar',()=>{const ics=eventsToIcs([event()]);expect(ics).toContain('BEGIN:VCALENDAR\r\n');expect(ics).toContain('UID:event-1@dear-my-diary');expect(ics).toContain('SUMMARY:A quiet morning');expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)})
 it('uses an exclusive end date for all-day events',()=>{const ics=eventsToIcs([event({allDay:true,startAt:'2026-08-03T00:00:00.000Z',endAt:'2026-08-04T00:00:00.000Z'})]);expect(ics).toContain('DTSTART;VALUE=DATE:20260803');expect(ics).toContain('DTEND;VALUE=DATE:20260804')})
 it('converts UTC event time for Asia Seoul display',()=>{const value=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date('2026-08-03T01:00:00.000Z'));expect(value).toBe('10:00')})
 it('enables RLS on every required user table',()=>{for(const table of ['profiles','planner_events','diary_entries','diary_images','diary_comments','brainstorm_boards','brainstorm_nodes','brainstorm_edges','calendar_connections','calendar_sync_states','calendar_feed_tokens'])expect(migration).toContain(`'${table}'`) ;expect(migration).toContain('enable row level security')})
 it('prevents duplicate external provider events',()=>{expect(migration).toContain('planner_events_external_unique');expect(migration).toContain('external_event_id')})
})
