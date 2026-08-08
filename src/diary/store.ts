import { create } from 'zustand'
import type { BrainstormBoard, BrainstormEdge, BrainstormNode, ChecklistItem, DiaryComment, DiaryData, DiaryEntry, PlannerEvent, StudyGoal, StudyTask, UserPreferences } from './types'
import { DEFAULT_DIARY_DATA } from './types'
import { diaryRepository, validateDiaryData } from './repository'
import { distributeStudyGoal } from './study/scheduler'

interface DiaryState extends DiaryData {
  ready:boolean; saveState:'Saved'|'Saving…'|'Save failed'; selectedEventId?:string; toast?:string
  init():Promise<void>; persist():Promise<void>; setToast(message?:string):void; selectEvent(id?:string):void
  saveEvent(event:PlannerEvent):Promise<void>; softDeleteEvent(id:string):Promise<void>; moveEvent(id:string,dateKey:string):Promise<void>
  saveEntry(entry:DiaryEntry):Promise<void>; saveComment(comment:DiaryComment):Promise<void>; deleteComment(id:string):Promise<void>
  saveBoard(board:BrainstormBoard):Promise<void>; deleteBoard(id:string):Promise<void>
  addChecklistItem(date:string,text:string):Promise<void>; updateChecklistItem(item:ChecklistItem):Promise<void>; deleteChecklistItem(id:string):Promise<void>
  updateProfile(profile:DiaryData['profile']):Promise<void>; updateCalendar(calendar:DiaryData['calendar']):Promise<void>
  updatePreferences(preferences:UserPreferences):Promise<void>; saveStudyGoal(goal:StudyGoal):Promise<void>; applyStudySchedule(goal:StudyGoal,tasks:StudyTask[]):Promise<void>
  updateStudyTask(task:StudyTask):Promise<void>; deleteStudyGoal(id:string):Promise<void>; rolloverOverdueTasks(today?:string):Promise<void>
  saveDailyMemo(date:string,content:string):Promise<void>; saveDateDiary(date:string,content:string):Promise<void>
  loadSample():Promise<void>; importData(value:unknown):Promise<void>; reset():Promise<void>
}
const snapshot=(state:DiaryState):DiaryData=>({events:state.events,entries:state.entries,comments:state.comments,boards:state.boards,checklists:state.checklists,profile:state.profile,calendar:state.calendar,preferences:state.preferences,studyGoals:state.studyGoals,studyTasks:state.studyTasks,dailyMemos:state.dailyMemos,dateDiaries:state.dateDiaries})
const now=()=>new Date().toISOString()
// 타이핑 중(메모·다이어리)에는 상태만 즉시 바꾸고 저장은 잠깐 미룬다.
// 키 입력마다 전체 스토어를 직렬화하면 폰에서 렉이 생겨 글자가 씹힐 수 있다.
let persistTimer:ReturnType<typeof setTimeout>|undefined

export const useDiaryStore=create<DiaryState>((set,get)=>({
  ...structuredClone(DEFAULT_DIARY_DATA),ready:false,saveState:'Saved',
  async init(){try{const data=await diaryRepository.load();set({...data,ready:true})}catch{set({...structuredClone(DEFAULT_DIARY_DATA),ready:true,saveState:'Save failed',toast:'저장소를 열지 못했습니다. Supabase 설정과 마이그레이션을 확인해 주세요.'})}},
  async persist(){set({saveState:'Saving…'});try{await diaryRepository.save(snapshot(get()));set({saveState:'Saved'})}catch{set({saveState:'Save failed',toast:'저장하지 못했습니다. 입력 내용은 현재 화면에 유지됩니다.'})}},
  setToast(toast){set({toast})},selectEvent(selectedEventId){set({selectedEventId})},
  async saveEvent(event){set(s=>({events:s.events.some(v=>v.id===event.id)?s.events.map(v=>v.id===event.id?event:v):[...s.events,event]}));await get().persist()},
  async softDeleteEvent(id){set(s=>({events:s.events.map(v=>v.id===id?{...v,deletedAt:now(),updatedAt:now(),syncStatus:v.googleSync?'pending':'local'}:v),selectedEventId:s.selectedEventId===id?undefined:s.selectedEventId}));await get().persist()},
  async moveEvent(id,dateKey){set(s=>({events:s.events.map(event=>{if(event.id!==id)return event;const start=new Date(event.startAt);const end=new Date(event.endAt);const duration=end.getTime()-start.getTime();const [y,m,d]=dateKey.split('-').map(Number);start.setFullYear(y,m-1,d);return{...event,startAt:start.toISOString(),endAt:new Date(start.getTime()+duration).toISOString(),updatedAt:now(),syncStatus:event.googleSync?'pending':'local'}})}));await get().persist()},
  async saveEntry(entry){set(s=>({entries:s.entries.some(v=>v.id===entry.id)?s.entries.map(v=>v.id===entry.id?entry:v):[...s.entries,entry]}));await get().persist()},
  async saveComment(comment){set(s=>({comments:s.comments.some(v=>v.id===comment.id)?s.comments.map(v=>v.id===comment.id?comment:v):[...s.comments,comment]}));await get().persist()},
  async deleteComment(id){set(s=>({comments:s.comments.filter(v=>v.id!==id)}));await get().persist()},
  async saveBoard(board){set(s=>({boards:s.boards.some(v=>v.id===board.id)?s.boards.map(v=>v.id===board.id?board:v):[...s.boards,board]}));await get().persist()},
  async deleteBoard(id){set(s=>({boards:s.boards.filter(v=>v.id!==id)}));await get().persist()},
  async addChecklistItem(date,text){const n=now();const item:ChecklistItem={id:crypto.randomUUID(),date,text,done:false,sortOrder:get().checklists.filter(v=>v.date===date&&!v.deletedAt).length,createdAt:n,updatedAt:n};set(s=>({checklists:[...s.checklists,item]}));await get().persist()},
  async updateChecklistItem(item){set(s=>({checklists:s.checklists.map(v=>v.id===item.id?item:v)}));await get().persist()},
  async deleteChecklistItem(id){set(s=>({checklists:s.checklists.map(v=>v.id===id?{...v,deletedAt:now(),updatedAt:now()}:v)}));await get().persist()},
  async updateProfile(profile){set({profile});await get().persist()},async updateCalendar(calendar){set({calendar});await get().persist()},
  async updatePreferences(preferences){set({preferences});await get().persist()},
  async saveStudyGoal(goal){set(s=>({studyGoals:s.studyGoals.some(v=>v.id===goal.id)?s.studyGoals.map(v=>v.id===goal.id?goal:v):[...s.studyGoals,goal]}));await get().persist()},
  async applyStudySchedule(goal,tasks){set(s=>({studyGoals:s.studyGoals.some(v=>v.id===goal.id)?s.studyGoals.map(v=>v.id===goal.id?goal:v):[...s.studyGoals,goal],studyTasks:[...s.studyTasks.filter(task=>task.goalId!==goal.id||task.status==='completed'||task.isLocked),...tasks.filter(task=>!s.studyTasks.some(old=>old.id===task.id&&(old.status==='completed'||old.isLocked)))]}));await get().persist()},
  async updateStudyTask(task){set(s=>{const before=s.studyTasks.find(v=>v.id===task.id);const delta=task.completedAmount-(before?.completedAmount??0);return{studyTasks:s.studyTasks.some(v=>v.id===task.id)?s.studyTasks.map(v=>v.id===task.id?task:v):[...s.studyTasks,task],studyGoals:s.studyGoals.map(goal=>goal.id===task.goalId?{...goal,completedAmount:Math.min(goal.totalAmount,Math.max(0,goal.completedAmount+delta)),updatedAt:now(),status:goal.completedAmount+delta>=goal.totalAmount?'completed':goal.status==='completed'?'active':goal.status}:goal)}});await get().persist()},
  async deleteStudyGoal(id){set(s=>({studyGoals:s.studyGoals.map(goal=>goal.id===id?{...goal,deletedAt:now(),updatedAt:now()}:goal),studyTasks:s.studyTasks.map(task=>task.goalId===id?{...task,deletedAt:now(),updatedAt:now()}:task)}));await get().persist()},
  async rolloverOverdueTasks(today=new Date().toISOString().slice(0,10)){const state=get(),policy=state.preferences.rolloverPolicy;if(policy==='none'||policy==='ask')return;if(policy==='next-day'){set(s=>({studyTasks:s.studyTasks.map(task=>task.scheduledDate<today&&task.status!=='completed'&&!task.isLocked?{...task,scheduledDate:today,updatedAt:now()}:task)}));await get().persist();return}for(const goal of state.studyGoals.filter(item=>item.status==='active'&&!item.deletedAt)){const overdue=state.studyTasks.some(task=>task.goalId===goal.id&&task.scheduledDate<today&&task.status!=='completed'&&!task.isLocked&&!task.deletedAt);if(!overdue)continue;const result=distributeStudyGoal({...goal,startDate:today},state.studyTasks.filter(task=>task.goalId===goal.id),state.events);if(result.ok)await get().applyStudySchedule(goal,result.tasks)}},
  async saveDailyMemo(date,content){set(s=>({dailyMemos:{...s.dailyMemos,[date]:content}}));clearTimeout(persistTimer);persistTimer=setTimeout(()=>void get().persist(),400)},
  async saveDateDiary(date,content){set(s=>({dateDiaries:{...s.dateDiaries,[date]:content}}));clearTimeout(persistTimer);persistTimer=setTimeout(()=>void get().persist(),400)},
  async loadSample(){const n=now();const start=new Date();start.setHours(10,0,0,0);const events:PlannerEvent[]=[{id:crypto.randomUUID(),title:'Morning pages',description:'Write three pages and plan the day.',startAt:start.toISOString(),endAt:new Date(start.getTime()+3600000).toISOString(),allDay:false,color:'#8f78b8',location:'Home',status:'planned',recurrenceRule:'',reminderMinutes:10,source:'local',googleSync:false,syncStatus:'local',createdAt:n,updatedAt:n},{id:crypto.randomUUID(),title:'Coffee with Mina',description:'Catch up and take a photo.',startAt:new Date(start.getTime()+86400000*2+14400000).toISOString(),endAt:new Date(start.getTime()+86400000*2+18000000).toISOString(),allDay:false,color:'#d8898f',location:'Yeonnam',status:'planned',recurrenceRule:'',reminderMinutes:30,source:'local',googleSync:false,syncStatus:'local',createdAt:n,updatedAt:n}];set({events});await get().persist()},
  async importData(value){const data=validateDiaryData(value);set(data);await get().persist()},async reset(){await diaryRepository.clear();set(structuredClone(DEFAULT_DIARY_DATA));await get().persist()}
}))

export const newEvent=(date=new Date()):PlannerEvent=>{const start=new Date(date);start.setHours(start.getHours()+1,0,0,0);const n=now();return{id:crypto.randomUUID(),title:'',description:'',startAt:start.toISOString(),endAt:new Date(start.getTime()+3600000).toISOString(),allDay:false,color:'#8f78b8',location:'',status:'planned',recurrenceRule:'',reminderMinutes:10,source:'local',googleSync:false,syncStatus:'local',createdAt:n,updatedAt:n}}
export const newEntry=(eventId:string):DiaryEntry=>{const n=now();return{id:crypto.randomUUID(),eventId,title:'',body:'',mood:'calm',tags:[],images:[],createdAt:n,updatedAt:n}}
export const newComment=(entryId:string,body:string):DiaryComment=>{const n=now();return{id:crypto.randomUUID(),entryId,body,createdAt:n,updatedAt:n}}
export const newBoard=(name='Untitled board'):BrainstormBoard=>{const n=now();return{id:crypto.randomUUID(),name,nodes:[],edges:[],blocks:[],freeText:'',createdAt:n,updatedAt:n}}
export const newNode=(boardId:string,x=100,y=100):BrainstormNode=>{const n=now();return{id:crypto.randomUUID(),boardId,title:'New thought',body:'',color:'#fff4a8',x,y,width:220,height:150,createdAt:n,updatedAt:n}}
export const newEdge=(boardId:string,sourceId:string,targetId:string):BrainstormEdge=>({id:crypto.randomUUID(),boardId,sourceId,targetId,createdAt:now()})
