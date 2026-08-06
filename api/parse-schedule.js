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

async function callAnthropic(text, ref) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: systemPrompt(ref), messages: [{ role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  return normalize(stripJson(out))
}

async function callOpenAICompatible(text, ref) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt(ref) }, { role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`${PROVIDER} ${res.status}`)
  const data = await res.json()
  return normalize(stripJson((data.choices && data.choices[0] && data.choices[0].message.content) || '{}'))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const text = (body.text || '').trim()
  if (!text) { res.status(200).json({ events: [] }); return }
  if (!KEY) { res.status(200).json({ events: [], note: '서버에 AI 키가 없습니다. Vercel 환경변수 DEEPSEEK_API_KEY를 설정하세요.' }); return }
  const ref = body.referenceDate ? new Date(body.referenceDate) : new Date()
  try {
    const events = PROVIDER === 'anthropic' ? await callAnthropic(text, ref) : await callOpenAICompatible(text, ref)
    res.status(200).json({ events, source: 'ai' })
  } catch (e) {
    res.status(200).json({ events: [], note: 'AI 호출 실패: ' + String(e && e.message || e).slice(0, 120) })
  }
}
