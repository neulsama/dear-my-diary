// Vercel serverless function: natural-language text -> calendar events.
// Keeps the LLM API key SERVER-SIDE (never shipped to the browser).
// Set the key in Vercel → Project Settings → Environment Variables:
//   DEEPSEEK_API_KEY   (recommended; provider defaults to deepseek)
//   optionally LLM_PROVIDER=deepseek|anthropic|openai, LLM_MODEL, LLM_BASE_URL
// Do NOT prefix these with VITE_ (that would inline them into the client bundle).

const PROVIDER = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase()
const KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
const MODEL = process.env.LLM_MODEL || (PROVIDER === 'anthropic' ? 'claude-haiku-4-5' : PROVIDER === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')
const OPENAI_BASE = process.env.LLM_BASE_URL || (PROVIDER === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1')

const pad = n => String(n).padStart(2, '0')
const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function systemPrompt(ref) {
  const weekday = ref.toLocaleDateString('en-US', { weekday: 'long' })
  return `You turn a user's natural-language notes (Korean or English) into structured calendar events.
Today is ${toISODate(ref)} (${weekday}). Assume timezone Asia/Seoul.
Resolve relative dates (오늘/내일/모레/글피, 이번주/다음주 + 요일, next Monday, in 3 days) against today.
Return ONLY minified JSON, no prose, no code fences, shaped exactly:
{"events":[{"title":str,"date":"YYYY-MM-DD","allDay":bool,"startTime":"HH:mm"|null,"endTime":"HH:mm"|null,"location":str|null,"recurrence":""|"daily"|"weekly"|"monthly"}]}
Rules: if a clock time is given set allDay=false and startTime (24h). If a time RANGE is stated (예: 2시부터 4시까지, 오후 2시~4시, 3-5pm, 14:00-16:00) set BOTH startTime and endTime. If only a start time plus a duration (예: 2시간, 90분) compute endTime. If a start time is given with no end and no duration, set endTime to one hour after startTime. If no time at all, allDay=true and omit both. Split multiple plans into separate events. Keep titles short.`
}

function studySystemPrompt(ref) {
  const weekday = ref.toLocaleDateString('en-US', { weekday: 'long' })
  return `You turn a user's natural-language study plan (Korean or English) into structured study goals.
Today is ${toISODate(ref)} (${weekday}). Timezone Asia/Seoul. Resolve relative dates (내일, 다음주, 일주일 안에 = today + 7 days, 8월 11일까지) against today.
Return ONLY minified JSON, no prose, no code fences, shaped exactly:
{"goals":[{"subject":str,"title":str|null,"unitType":"page"|"problem"|"lecture"|"chapter"|"word"|"minute"|"hour"|null,"totalAmount":num|null,"startDate":"YYYY-MM-DD"|null,"deadline":"YYYY-MM-DD"|null,"dailyStartTime":"HH:mm"|null,"dailyEndTime":"HH:mm"|null,"dailyMinutes":num|null,"excludedWeekdays":[int]|null}]}
Rules:
- subject: the material's name (책/과목/잡지 이름). Keep it short.
- totalAmount+unitType: 308페이지 -> 308+"page"; 60문제 -> 60+"problem". If no amount is stated, leave both null.
- deadline: "8월 11일까지"->that date. "일주일 안에"->today+7. If none, null.
- dailyStartTime/dailyEndTime: a preferred daily study window like "오후 6시부터 7시까지" -> 18:00/19:00.
- dailyMinutes: available minutes per day ("하루 5시간"->300, "매일 한시간씩"->60).
- excludedWeekdays: days the user CANNOT study, 0=일요일,1=월,2=화,3=수,4=목,5=금,6=토.
- Split independent materials into separate goals. Do not invent numbers the user didn't say.`
}

function normalizeStudy(raw) {
  const list = Array.isArray(raw && raw.goals) ? raw.goals : []
  const units = ['page', 'problem', 'lecture', 'chapter', 'word', 'minute', 'hour']
  return list.filter(g => g && g.subject).map(g => ({
    subject: String(g.subject).slice(0, 60),
    title: g.title ? String(g.title).slice(0, 100) : undefined,
    unitType: units.includes(g.unitType) ? g.unitType : undefined,
    totalAmount: Number.isFinite(+g.totalAmount) && +g.totalAmount > 0 ? Math.round(+g.totalAmount) : undefined,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(g.startDate || '') ? g.startDate : undefined,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(g.deadline || '') ? g.deadline : undefined,
    dailyStartTime: /^\d{1,2}:\d{2}$/.test(g.dailyStartTime || '') ? g.dailyStartTime : undefined,
    dailyEndTime: /^\d{1,2}:\d{2}$/.test(g.dailyEndTime || '') ? g.dailyEndTime : undefined,
    dailyMinutes: Number.isFinite(+g.dailyMinutes) && +g.dailyMinutes > 0 ? Math.round(+g.dailyMinutes) : undefined,
    excludedWeekdays: Array.isArray(g.excludedWeekdays) ? g.excludedWeekdays.map(n => +n).filter(n => n >= 0 && n <= 6) : undefined
  }))
}

function normalize(raw) {
  const list = Array.isArray(raw && raw.events) ? raw.events : Array.isArray(raw) ? raw : []
  return list.filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map(e => ({
    title: String(e.title).slice(0, 120),
    date: e.date,
    allDay: e.allDay !== false && !e.startTime,
    startTime: /^\d{1,2}:\d{2}$/.test(e.startTime || '') ? e.startTime : undefined,
    endTime: /^\d{1,2}:\d{2}$/.test(e.endTime || '') ? e.endTime : undefined,
    location: e.location ? String(e.location).slice(0, 120) : undefined,
    recurrence: ['daily', 'weekly', 'monthly'].includes(e.recurrence) ? e.recurrence : ''
  }))
}

function stripJson(text) {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}')
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned)
}

async function callAnthropic(system, text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages: [{ role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  return stripJson(out)
}

async function callOpenAICompatible(system, text) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`${PROVIDER} ${res.status}`)
  const data = await res.json()
  return stripJson((data.choices && data.choices[0] && data.choices[0].message.content) || '{}')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const text = (body.text || '').trim()
  const isStudy = body.kind === 'study'
  const empty = isStudy ? { goals: [] } : { events: [] }
  if (!text) { res.status(200).json(empty); return }
  if (!KEY) { res.status(200).json({ ...empty, note: '서버에 AI 키가 없습니다. Vercel 환경변수 DEEPSEEK_API_KEY를 설정하세요.' }); return }
  const ref = body.referenceDate ? new Date(body.referenceDate) : new Date()
  const system = isStudy ? studySystemPrompt(ref) : systemPrompt(ref)
  try {
    const raw = PROVIDER === 'anthropic' ? await callAnthropic(system, text) : await callOpenAICompatible(system, text)
    if (isStudy) res.status(200).json({ goals: normalizeStudy(raw), source: 'ai' })
    else res.status(200).json({ events: normalize(raw), source: 'ai' })
  } catch (e) {
    res.status(200).json({ ...empty, note: 'AI 호출 실패: ' + String(e && e.message || e).slice(0, 120) })
  }
}
