import { useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { Modal } from '../../components/Modal'
import { useDiaryStore } from '../store'
import type { StudyGoal, StudyTask, StudyUnitType } from '../types'
import { createStudyGoal, distributeStudyGoal, parseDateKey, taskRangeLabel, unitLabel, type DistributionResult } from '../study/scheduler'
import { parseStudyGoals, type ParsedStudyGoal } from '../ai/parseSchedule'

const units:Array<[StudyUnitType,string]>=[['page','페이지'],['problem','문제'],['lecture','강의'],['chapter','챕터'],['word','단어'],['minute','분'],['hour','시간'],['custom','사용자 지정 단위']]
const weekdays=[['일',0],['월',1],['화',2],['수',3],['목',4],['금',5],['토',6]] as const
const now=()=>new Date().toISOString()
const todayKey=()=>format(new Date(),'yyyy-MM-dd')
const countAvailableDays=(start:string,end:string,available:number[])=>{let count=0;let cursor=parseDateKey(start);const last=parseDateKey(end);while(cursor<=last){if(available.includes(cursor.getDay()))count++;cursor=addDays(cursor,1)}return count}

// AI가 파싱한 자연어 목표 -> StudyGoal. 분량이 없으면 '하루 N분 x 가능한 날 수'의 시간(분) 목표로 만든다.
function parsedToGoal(p:ParsedStudyGoal,defaults:{weekdays:number[];bufferDays:number}):StudyGoal{
 const start=p.startDate&&p.startDate>=todayKey()?p.startDate:todayKey()
 const excluded=new Set(p.excludedWeekdays??[])
 const availableWeekdays=(excluded.size?[0,1,2,3,4,5,6]:defaults.weekdays).filter(d=>!excluded.has(d))
 const deadline=p.deadline&&p.deadline>=start?p.deadline:format(addDays(parseDateKey(start),6),'yyyy-MM-dd')
 const base:Partial<StudyGoal>={subject:p.subject,title:p.title??`${p.subject} 끝내기`,startDate:start,deadline,availableWeekdays,dailyStartTime:p.dailyStartTime??'',dailyEndTime:p.dailyEndTime??'',bufferDays:0}
 if(p.totalAmount){return createStudyGoal({...base,unitType:p.unitType??'page',totalAmount:p.totalAmount,estimatedMinutesPerUnit:p.dailyMinutes&&p.totalAmount?Math.max(1,Math.round(p.dailyMinutes*countAvailableDays(start,deadline,availableWeekdays)/p.totalAmount*10)/10):undefined})}
 const daily=p.dailyMinutes??60
 const days=Math.max(1,countAvailableDays(start,deadline,availableWeekdays))
 return createStudyGoal({...base,unitType:'minute',totalAmount:days*daily,minDailyAmount:daily,maxDailyAmount:daily,chunkSize:Math.min(daily,10),estimatedMinutesPerUnit:1})
}

function StudyCapture({onClose,onPreview}:{onClose():void;onPreview(goal:StudyGoal,result:DistributionResult):void}){
 const store=useDiaryStore()
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[drafts,setDrafts]=useState<ParsedStudyGoal[]>([])
 const run=async()=>{if(!text.trim())return;setBusy(true);setNote('');setDrafts([])
  const result=await parseStudyGoals(text,new Date())
  setDrafts(result.goals);setNote(result.note??(result.goals.length?'':'목표를 찾지 못했습니다. 과목명·분량·기간을 함께 적어 보세요.'));setBusy(false)}
 const update=(i:number,patch:Partial<ParsedStudyGoal>)=>setDrafts(d=>d.map((g,idx)=>idx===i?{...g,...patch}:g))
 const remove=(i:number)=>setDrafts(d=>d.filter((_,idx)=>idx!==i))
 const toggleDay=(i:number,day:number)=>setDrafts(d=>d.map((g,idx)=>{if(idx!==i)return g;const ex=new Set(g.excludedWeekdays??[]);ex.has(day)?ex.delete(day):ex.add(day);return{...g,excludedWeekdays:[...ex].sort()}}))
 const apply=async()=>{
  let applied=0
  for(const parsed of drafts){
   const goal=parsedToGoal(parsed,{weekdays:store.preferences.defaultStudyWeekdays,bufferDays:store.preferences.defaultBufferDays})
   const result=distributeStudyGoal(goal,store.studyTasks.filter(t=>!t.deletedAt),store.events)
   if(result.ok&&result.tasks.length){await store.applyStudySchedule(goal,result.tasks);applied++}
   else{onPreview(goal,result);store.setToast(applied?`${applied}개 목표를 먼저 배분했습니다. 남은 목표는 조건을 확인해 주세요.`:'자동 배분 조건을 확인해 주세요.');return}
  }
  store.setToast(`${applied}개 목표를 위클리·먼슬리에 자동 배분했습니다.`);onClose()
 }
 return <Modal title="텍스트로 공부 목표 추가" onClose={onClose} wide>
  <div className="quick-capture">
   <p className="quick-capture-hint">예: “광고학입문론 308페이지를 일주일 안에 끝내야 해. 하루에 5시간 쓸 수 있고 화요일·수요일은 공부 못 해” / “8월 11일까지 아키비 잡지, 매일 오후 6시부터 7시까지 한 시간씩”</p>
   <textarea rows={4} value={text} placeholder="공부 계획을 자유롭게 적어 주세요" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')void run()}}/>
   <div className="quick-capture-actions"><small>AI가 목표·기간·제외 요일을 해석해 자동 배분합니다</small><button className="purple-button" disabled={busy||!text.trim()} onClick={run}>{busy?'해석 중…':'해석하기'} <kbd>Ctrl+↵</kbd></button></div>
   {note&&<div className="notice" role="status">{note}</div>}
   {drafts.length>0&&<div className="study-capture-list">{drafts.map((g,i)=><div className="study-capture-item" key={i}>
    <div className="sc-row"><input className="qc-title" value={g.subject} onChange=
{e=>update(i,{subject:e.target.value})}/><button className="qc-remove" title="제외" onClick={()=>remove(i)}>×</button></div>
    <div className="sc-row"><label>분량<input type="number" min="1" placeholder="시간 기반" value={g.totalAmount??''} onChange={e=>update(i,{totalAmount:e.target.value?+e.target.value:undefined})}/><select value={g.unitType??'page'} onChange={e=>update(i,{unitType:e.target.value as ParsedStudyGoal['unitType']})}>{units.filter(([k])=>k!=='custom').map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label>마감<input type="date" value={g.deadline??''} onChange={e=>update(i,{deadline:e.target.value||undefined})}/></label>
    <label>하루(분)<input type="number" min="0" value={g.dailyMinutes??''} onChange={e=>update(i,{dailyMinutes:e.target.value?+e.target.value:undefined})}/></label>
    <label>시간<span className="qc-timerange"><input type="time" value={g.dailyStartTime??''} onChange={e=>update(i,{dailyStartTime:e.target.value||undefined})}/><i>~</i><input type="time" value={g.dailyEndTime??''} onChange={e=>update(i,{dailyEndTime:e.target.value||undefined})}/></span></label></div>
    <div className="sc-row sc-days"><span>쉬는 요일</span>{weekdays.map(([l,d])=><label key={d} className={g.excludedWeekdays?.includes(d)?'off':''}><input type="checkbox" checked={g.excludedWeekdays?.includes(d)??false} onChange={()=>toggleDay(i,d)}/>{l}</label>)}</div>
   </div>)}</div>}
  </div>
  <footer className="modal-actions"><span className="action-spacer"/><button onClick={onClose}>취소</button><button className="purple-button" disabled={!drafts.length} onClick={apply}>{drafts.length?`${drafts.length}개 목표 추가·자동 배분`:'목표 추가'}</button></footer>
 </Modal>
}

function GoalForm({goal,onClose,onPreview}:{goal:StudyGoal;onClose():void;onPreview(goal:StudyGoal):void}){
 const [value,setValue]=useState(goal),[error,setError]=useState('');const patch=<K extends keyof StudyGoal>(key:K,next:StudyGoal[K])=>setValue(current=>({...current,[key]:next,updatedAt:now()}))
 // 쉼표 구분 입력은 타이핑 중 파싱하면 쉼표가 지워진다. 원문을 그대로 두고 저장할 때만 파싱한다.
 const [excludedRaw,setExcludedRaw]=useState(goal.excludedDates.join(', ')),[restRaw,setRestRaw]=useState(goal.restDates.join(', '))
 const parseDates=(raw:string)=>raw.split(',').map(v=>v.trim()).filter(Boolean)
 const submit=()=>{if(!value.subject.trim()||!value.title.trim())return setError('과목명과 목표명을 입력해 주세요.');if(value.totalAmount<=0)return setError('전체 분량은 0보다 커야 합니다.');onPreview({...value,excludedDates:parseDates(excludedRaw),restDates:parseDates(restRaw)})}
 return <Modal title={goal.subject?'학습 목표 수정':'새 학습 목표'} onClose={onClose} wide><div className="study-form">
  <label>과목명<input value={value.subject} onChange={event=>patch('subject',event.target.value)} placeholder="예: 영어"/></label><label>목표명<input value={value.title} onChange={event=>patch('title',event.target.value)} placeholder="예: 문법책 완독"/></label>
  <label>단위 종류<select value={value.unitType} onChange={event=>patch('unitType',event.target.value as StudyUnitType)}>{units.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{value.unitType==='custom'&&<label>사용자 지정 단위명<input value={value.customUnitLabel} onChange={event=>patch('customUnitLabel',event.target.value)}/></label>}
  <label>전체 분량<input type="number" min="1" value={value.totalAmount||''} onChange={event=>patch('totalAmount',+event.target.value)}/></label><label>이미 완료한 분량<input type="number" min="0" max={value.totalAmount} value={value.completedAmount} onChange={event=>patch('completedAmount',+event.target.value)}/><small>남은 분량 {Math.max(0,value.totalAmount-value.completedAmount)}{unitLabel(value)}</small></label>
  <label>시작일<input type="date" value={value.startDate} onChange={event=>patch('startDate',event.target.value)}/></label><label>마감일<input type="date" value={value.deadline} onChange={event=>patch('deadline',event.target.value)}/></label>
  <label>공부 시작 시간<input type="time" value={value.dailyStartTime??''} onChange={event=>patch('dailyStartTime',event.target.value)}/><small>비워두면 위클리 시간표에 자동(오후 6시~)으로 배치됩니다</small></label><label>공부 종료 시간<input type="time" value={value.dailyEndTime??''} onChange={event=>patch('dailyEndTime',event.target.value)}/></label>
  <label>우선순위 (1~5)<input type="number" min="1" max="5" value={value.priority} onChange={event=>patch('priority',+event.target.value)}/></label><label>난이도 (1~5)<input type="number" min="1" max="5" value={value.difficulty} onChange={event=>patch('difficulty',+event.target.value)}/></label>
  <label>하루 최소 분량<input type="number" min="0" value={value.minDailyAmount??''} onChange={event=>patch('minDailyAmount',event.target.value?+event.target.value:undefined)}/></label><label>하루 최대 분량<input type="number" min="1" value={value.maxDailyAmount??''} onChange={event=>patch('maxDailyAmount',event.target.value?+event.target.value:undefined)}/></label>
  <label>최소 묶음 단위<input type="number" min="1" value={value.chunkSize} onChange={event=>patch('chunkSize',Math.max(1,+event.target.value))}/></label><label>마감 전 버퍼일<input type="number" min="0" value={value.bufferDays} onChange={event=>patch('bufferDays',Math.max(0,+event.target.value))}/></label>
  <label>단위당 예상 소요 시간(분)<input type="number" min="0" step="0.1" value={value.estimatedMinutesPerUnit??''} onChange={event=>patch('estimatedMinutesPerUnit',event.target.value?+event.target.value:undefined)}/></label><label>제외 날짜 (쉼표 구분)<input value={excludedRaw} onChange={event=>setExcludedRaw(event.target.value)} placeholder="2026-08-05, 2026-08-12"/></label>
  <label>쉬는 날 (쉼표 구분)<input value={restRaw} onChange={event=>setRestRaw(event.target.value)}/></label><label>목표 색상<div className="inline-colors"><input type="color" value={value.textColor} title="글씨 색" onChange={event=>patch('textColor',event.target.value)}/><input type="color" value={value.backgroundColor} title="배경 색" onChange={event=>patch('backgroundColor',event.target.value)}/><input type="color" value={value.borderColor} title="테두리 색" onChange={event=>patch('borderColor',event.target.value)}/></div></label>
  <fieldset className="full"><legend>공부 가능한 요일</legend><div className="weekday-picker">{weekdays.map(([label,day])=><label key={day}><input type="checkbox" checked={value.availableWeekdays.includes(day)} onChange={event=>patch('availableWeekdays',event.target.checked?[...value.availableWeekdays,day]:value.availableWeekdays.filter(v=>v!==day))}/>{label}</label>)}</div></fieldset>
  <fieldset className="full"><legend>요일별 공부 가능 시간(분)</legend><div className="weekday-capacity">{weekdays.map(([label,day])=><label key={day}>{label}<input type="number" min="0" value={value.dailyCapacity[String(day)]??''} onChange={event=>patch('dailyCapacity',{...value.dailyCapacity,[day]:+event.target.value})}/></label>)}</div></fieldset>
  <label className="full">메모<textarea rows={3} value={value.notes} onChange={event=>patch('notes',event.target.value)}/></label>
  <label className="inline"><input type="checkbox" checked={value.autoScheduleEnabled} onChange={event=>patch('autoScheduleEnabled',event.target.checked)}/>자동 배분</label><label className="inline"><input type="checkbox" checked={value.googleSyncEnabled} onChange={event=>patch('googleSyncEnabled',event.target.checked)}/>Google Calendar 동기화</label><label className="inline"><input type="checkbox" checked={value.appleFeedEnabled} onChange={event=>patch('appleFeedEnabled',event.target.checked)}/>Apple Calendar 구독 포함</label>
 </div>{error&&<div className="form-error">{error}</div>}<footer className="modal-actions"><span className="action-spacer"/><button onClick={onClose}>취소</button><button className="purple-button" onClick={submit}>자동 배분 미리보기</button></footer></Modal>
}

function Preview({goal,result,onClose,onEdit,onApply}:{goal:StudyGoal;result:DistributionResult;onClose():void;onEdit():void;onApply(tasks:StudyTask[]):void}){
 const [tasks,setTasks]=useState(result.tasks);const remaining=goal.totalAmount-goal.completedAmount;const total=tasks.reduce((sum,task)=>sum+Math.max(0,task.plannedAmount-task.completedAmount),0)
 const amount=(id:string,next:number)=>setTasks(current=>{let cursor=goal.completedAmount+1;return current.map(task=>{const planned=task.id===id?Math.max(task.completedAmount,+next):task.plannedAmount;if(task.isLocked){cursor=Math.max(cursor,task.endAmount+1);return task}const start=cursor,end=start+planned-1;cursor=end+1;return{...task,plannedAmount:planned,startAmount:start,endAmount:end,title:`${goal.subject} ${taskRangeLabel(goal,start,end)}`,estimatedMinutes:Math.round(planned*(goal.estimatedMinutesPerUnit??0)),updatedAt:now()}})})
 return <Modal title="자동 배분 미리보기" onClose={onClose} wide>{result.errors.map(error=><div className="preview-error" key={error}>{error}</div>)}{result.warnings.map(warning=><div className="preview-warning" key={warning}>{warning}</div>)}<div className={total===remaining?'notice':'preview-error'}>배분 합계 {total} / 남은 분량 {remaining}{unitLabel(goal)} {total===remaining?'· 정확히 일치합니다.':'· 합계를 맞춰 주세요.'}</div><div className="preview-table-wrap"><table className="distribution-preview"><thead><tr><th>날짜</th><th>요일</th><th>과목</th><th>학습 범위</th><th>분량</th><th>예상 시간</th><th>기존 일정</th><th>고정</th></tr></thead><tbody>{tasks.map(task=>{const day=result.days.find(value=>value.taskId===task.id||value.date===task.scheduledDate);return <tr key={task.id}><td><input type="date" value={task.scheduledDate} onChange={event=>setTasks(current=>current.map(value=>value.id===task.id?{...value,scheduledDate:event.target.value,isLocked:true}:value))}/></td><td>{format(parseDateKey(task.scheduledDate),'EEE')}</td><td>{goal.subject}</td><td>{taskRangeLabel(goal,task.startAmount,task.endAmount)}</td><td><input type="number" min="1" value={task.plannedAmount} disabled={task.isLocked} onChange={event=>amount(task.id,+event.target.value)}/></td><td>{task.estimatedMinutes}분</td><td>{day?.conflictCount?`${day.conflictCount}개 충돌`:'없음'}</td><td><input type="checkbox" checked={task.isLocked} onChange={event=>setTasks(current=>current.map(value=>value.id===task.id?{...value,isLocked:event.target.checked}:value))}/></td></tr>})}</tbody></table></div><footer className="modal-actions"><button onClick={onEdit}>조건 수정</button><button onClick={()=>onEdit()}>다시 계산</button><span className="action-spacer"/><button onClick={onClose}>취소</button><button className="purple-button" disabled={!result.ok||total!==remaining} onClick={()=>onApply(tasks)}>이대로 적용</button></footer></Modal>
}

export function StudyLoadPage(){
 const store=useDiaryStore();const goals=store.studyGoals.filter(goal=>!goal.deletedAt);const tasks=store.studyTasks.filter(task=>!task.deletedAt);const [editing,setEditing]=useState<StudyGoal>();const [preview,setPreview]=useState<{goal:StudyGoal;result:DistributionResult}>();const [capture,setCapture]=useState(false)
 const today=new Date().toISOString().slice(0,10),weekEnd=new Date(Date.now()+6*86400000).toISOString().slice(0,10)
 const summary=useMemo(()=>{const active=goals.filter(goal=>goal.status==='active'),total=active.reduce((sum,goal)=>sum+goal.totalAmount,0),done=active.reduce((sum,goal)=>sum+goal.completedAmount,0);return{active:active.length,total,done,remaining:Math.max(0,total-done),progress:total?Math.round(done/total*100):0,today:tasks.filter(task=>task.scheduledDate===today&&task.status!=='completed').reduce((sum,task)=>sum+task.plannedAmount-task.completedAmount,0),week:tasks.filter(task=>task.scheduledDate>=today&&task.scheduledDate<=weekEnd&&task.status!=='completed').reduce((sum,task)=>sum+task.plannedAmount-task.completedAmount,0),deadline:active.map(goal=>goal.deadline).sort()[0]??'-',overdue:active.filter(goal=>goal.deadline<today).length}},[goals,tasks,today,weekEnd])
 const calculate=(goal:StudyGoal)=>{const result=distributeStudyGoal(goal,tasks,store.events);setPreview({goal,result});setEditing(undefined)}
 // 깔끔하게 배분되면 미리보기 없이 바로 적용, 경고·충돌이 있으면 미리보기를 연다.
 const distribute=(goal:StudyGoal)=>{const result=distributeStudyGoal(goal,tasks,store.events);if(result.ok&&!result.errors.length&&!result.warnings.length&&result.tasks.length){void store.applyStudySchedule(goal,result.tasks);store.setToast(`${goal.subject}: ${result.tasks.length}일로 자동 배분했습니다.`)}else setPreview({goal,result})}
 return <section className="planner-page study-load-page"><div className="planner-heading"><div><span className="month-capsule">전체 공부 분량</span><strong>과목별 목표와 자동 배분</strong></div><div><button className="purple-button" onClick={()=>setCapture(true)}>✎ 텍스트로 목표 추가</button><button onClick={()=>setEditing(createStudyGoal({availableWeekdays:store.preferences.defaultStudyWeekdays,bufferDays:store.preferences.defaultBufferDays}))}>+ 직접 입력</button></div></div>
  <div className="study-summary">{[['진행 중 목표',summary.active],['전체 분량',summary.total],['완료 분량',summary.done],['남은 분량',summary.remaining],['평균 진행률',`${summary.progress}%`],['오늘 할 분량',summary.today],['이번 주 분량',summary.week],['가까운 마감일',summary.deadline],['지연 목표',summary.overdue]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  {!goals.length?<div className="empty-copy">아직 공부 목표가 없습니다. 전체 분량과 기간을 입력하면 날짜별 체크리스트를 정확한 합계로 자동 생성합니다.</div>:<div className="study-goal-grid">{goals.map(goal=>{const progress=goal.totalAmount?Math.round(goal.completedAmount/goal.totalAmount*100):0;const todayTask=tasks.filter(task=>task.goalId===goal.id&&task.scheduledDate===today&&task.status!=='completed').reduce((sum,task)=>sum+task.plannedAmount-task.completedAmount,0);const days=Math.max(0,Math.ceil((parseDateKey(goal.deadline).getTime()-parseDateKey(today).getTime())/86400000)+1);return <article className="study-goal-card" key={goal.id} style={{'--goal-text':goal.textColor,'--goal-bg':goal.backgroundColor,'--goal-border':goal.borderColor} as React.CSSProperties}><header><div><span>{goal.subject}</span><h2 title={goal.title}>{goal.title}</h2></div><b>{progress}%</b></header><div className="study-progress"><i style={{width:`${progress}%`}}/></div><div className="study-metrics"><div><span>완료 / 전체</span><b>{goal.completedAmount} / {goal.totalAmount}{unitLabel(goal)}</b></div><div><span>남은 분량</span><b>{goal.totalAmount-goal.completedAmount}{unitLabel(goal)}</b></div><div><span>남은 일수</span><b>{days}일</b></div><div><span>오늘</span><b>{todayTask}{unitLabel(goal)}</b></div><div><span>상태</span><b>{goal.status==='active'?'진행 중':goal.status==='paused'?'일시 중지':'완료'}</b></div></div><div className="study-card-actions"><button onClick={()=>distribute(goal)}>자동 배분</button><button onClick={()=>calculate(goal)}>미리보기</button><button onClick={()=>setEditing(goal)}>직접 수정</button><button onClick={()=>void store.saveStudyGoal({...goal,status:goal.status==='paused'?'active':'paused',updatedAt:now()})}>{goal.status==='paused'?'재개':'일시 중지'}</button><button onClick={()=>void store.saveStudyGoal({...goal,status:'completed',completedAmount:goal.totalAmount,updatedAt:now()})}>완료 처리</button><button className="danger-button" onClick={()=>confirm('이 목표와 연결된 미완료 학습 작업을 삭제할까요?')&&void store.deleteStudyGoal(goal.id)}>삭제</button></div></article>})}</div>}
  {capture&&<StudyCapture onClose={()=>setCapture(false)} onPreview={(goal,result)=>{setCapture(false);setPreview({goal,result})}}/>}
  {editing&&<GoalForm goal={editing} onClose={()=>setEditing(undefined)} onPreview={calculate}/>} {preview&&<Preview goal={preview.goal} result={preview.result} onClose={()=>setPreview(undefined)} onEdit={()=>{setEditing(preview.goal);setPreview(undefined)}} onApply={async schedule=>{await store.applyStudySchedule(preview.goal,schedule);store.setToast('학습 계획을 Monthly와 Weekly에 반영했습니다.');setPreview(undefined)}}/>}
 </section>
}
