// Natural-language -> calendar events. Primary path calls an LLM (Anthropic by
// default; OpenAI/DeepSeek via an OpenAI-compatible endpoint). When no API key
// is configured it falls back to a lightweight offline heuristic parser so the
// feature still works in demo mode (clearly labelled as `local` in the UI).

export interface ParsedEvent {
  title: string
  date: string            // YYYY-MM-DD
  allDay: boolean
  startTime?: string      // HH:mm (24h)
  endTime?: string        // HH:mm (24h)
  location?: string
  description?: string
  recurrence?: '' | 'daily' | 'weekly' | 'monthly'
}
export interface ParseResult { events: ParsedEvent[]; source: 'ai' | 'local'; note?: string }

const env = import.meta.env as Record<string, string | undefined>
const provider = (env.VITE_LLM_PROVIDER || 'anthropic').toLowerCase()
const model = env.VITE_LLM_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')
const apiKey = env.VITE_LLM_API_KEY || env.VITE_ANTHROPIC_API_KEY || env.VITE_OPENAI_API_KEY || env.VITE_DEEPSEEK_API_KEY || env.NEXT_PUBLIC_ANTHROPIC_API_KEY
// In local dev, route OpenAI-compatible providers through the Vite proxy to dodge CORS.
const openaiBase = env.VITE_LLM_BASE_URL
  || (import.meta.env.DEV ? (provider === 'deepseek' ? '/llm-proxy/deepseek/v1' : '/llm-proxy/openai/v1')
    : (provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'))

export const aiConfigured = (): boolean => Boolean(apiKey)

const pad = (n: number) => String(n).padStart(2, '0')
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function systemPrompt(ref: Date): string {
  const weekday = ref.toLocaleDateString('en-US', { weekday: 'long' })
  return `You turn a user's natural-language notes (Korean or English) into structured calendar events.
Today is ${toISODate(ref)} (${weekday}). Assume timezone Asia/Seoul.
Resolve relative dates (오늘/내일/모레/글피, 이번주/다음주 + 요일, next Monday, in 3 days) against today.
Return ONLY minified JSON, no prose, no code fences, shaped exactly:
{"events":[{"title":str,"date":"YYYY-MM-DD","allDay":bool,"startTime":"HH:mm"|null,"endTime":"HH:mm"|null,"location":str|null,"recurrence":""|"daily"|"weekly"|"monthly"}]}
Rules: if a clock time is given set allDay=false and startTime (24h). If a time RANGE is stated (예: 2시부터 4시까지, 오후 2시~4시, 3-5pm, 14:00-16:00) set BOTH startTime and endTime. If only a start time plus a duration (예: 2시간, 90분) compute endTime. If a start time is given with no end and no duration, set endTime to one hour after startTime. If no time at all, allDay=true and omit both. Split multiple plans into separate events. Keep titles short.`
}

function normalize(raw: any): ParsedEvent[] {
  const list = Array.isArray(raw?.events) ? raw.events : Array.isArray(raw) ? raw : []
  return list.filter((e: any) => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map((e: any) => ({
    title: String(e.title).slice(0, 120),
    date: e.date,
    allDay: e.allDay !== false && !e.startTime,
    startTime: /^\d{1,2}:\d{2}$/.test(e.startTime || '') ? e.startTime : undefined,
    endTime: /^\d{1,2}:\d{2}$/.test(e.endTime || '') ? e.endTime : undefined,
    location: e.location ? String(e.location).slice(0, 120) : undefined,
    description: e.description ? String(e.description).slice(0, 500) : undefined,
    recurrence: ['daily', 'weekly', 'monthly'].includes(e.recurrence) ? e.recurrence : ''
  }))
}

function stripJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}')
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned)
}

async function callAnthropic(text: string, ref: Date): Promise<ParsedEvent[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt(ref), messages: [{ role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const out = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  return normalize(stripJson(out))
}

async function callOpenAICompatible(text: string, ref: Date): Promise<ParsedEvent[]> {
  const res = await fetch(`${openaiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt(ref) }, { role: 'user', content: text }] })
  })
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return normalize(stripJson(data.choices?.[0]?.message?.content || '{}'))
}

export async function parseSchedule(text: string, ref: Date = new Date()): Promise<ParseResult> {
  const trimmed = text.trim()
  if (!trimmed) return { events: [], source: 'local' }
  // Production (Vercel): go through the serverless proxy so the API key stays
  // server-side. The user sets DEEPSEEK_API_KEY in Vercel env vars.
  if (import.meta.env.PROD) {
    try {
      const res = await fetch('/api/parse-schedule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: trimmed, referenceDate: ref.toISOString() }) })
      if (res.ok) {
        const data = await res.json()
        const events = normalize(data)
        if (events.length) return { events, source: 'ai' }
        return { events: localParse(trimmed, ref), source: 'local', note: data.note || 'AI가 일정을 찾지 못해 기본 파서로 처리했습니다.' }
      }
    } catch { /* fall through to local */ }
    return { events: localParse(trimmed, ref), source: 'local', note: 'AI 서버 호출에 실패해 기본 파서로 처리했습니다.' }
  }
  // Development: call the provider directly through the Vite dev proxy (VITE_ key).
  if (apiKey) {
    try {
      const events = provider === 'anthropic' ? await callAnthropic(trimmed, ref) : await callOpenAICompatible(trimmed, ref)
      if (events.length) return { events, source: 'ai' }
      return { events: localParse(trimmed, ref), source: 'local', note: 'AI가 일정을 찾지 못해 기본 파서로 처리했습니다.' }
    } catch (error) {
      return { events: localParse(trimmed, ref), source: 'local', note: `AI 호출 실패로 기본 파서를 사용했습니다 (${error instanceof Error ? error.message.slice(0, 80) : 'error'}).` }
    }
  }
  return { events: localParse(trimmed, ref), source: 'local', note: 'AI 키가 없어 기본 파서로 처리했습니다. .env.local에 VITE_ANTHROPIC_API_KEY를 넣으면 AI 파싱이 켜집니다.' }
}

// ---- Offline heuristic fallback (Korean + light English) ----
const WEEKDAYS: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

function nextWeekday(from: Date, target: number, weeksAhead: number): Date {
  const d = new Date(from); const diff = (target - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff + weeksAhead * 7); return d
}

function localParseLine(line: string, ref: Date): ParsedEvent | null {
  let rest = line.trim(); if (!rest) return null
  let date: Date | undefined
  let recurrence: ParsedEvent['recurrence'] = ''
  if (/매일|every day|daily/i.test(rest)) recurrence = 'daily'
  else if (/매주|weekly|every week/i.test(rest)) recurrence = 'weekly'
  else if (/매달|매월|monthly/i.test(rest)) recurrence = 'monthly'

  const rel = rest.match(/오늘|내일|모레|글피|today|tomorrow/i)
  if (rel) { const map: Record<string, number> = { 오늘: 0, today: 0, 내일: 1, tomorrow: 1, 모레: 2, 글피: 3 }; date = new Date(ref); date.setDate(date.getDate() + (map[rel[0].toLowerCase()] ?? 0)) }
  const md = rest.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || rest.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (!date && md) { date = new Date(ref); date.setMonth(+md[1] - 1, +md[2]); if (date < ref && !recurrence) date.setFullYear(date.getFullYear() + 1) }
  const wd = rest.match(/(다음주|담주|이번주|next week|this week)?\s*(일|월|화|수|목|금|토)요일|\b(mon|tue|wed|thu|fri|sat|sun)\b/i)
  if (!date && wd) { const key = (wd[2] || wd[3] || '').toLowerCase(); const weeks = /다음주|담주|next/i.test(wd[0]) ? 1 : 0; if (key in WEEKDAYS) date = nextWeekday(ref, WEEKDAYS[key], weeks) }
  if (!date && recurrence) date = new Date(ref)
  if (!date) return null

  const times = extractTimes(rest)
  const startTime = times[0]
  const endTime = times[1] ?? (startTime ? addMinutes(startTime, 60) : undefined)
  const title = rest
    .replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일|\b\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/(다음주|담주|이번주|next week|this week)?\s*[일월화수목금토]요일|\b(mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
    .replace(/오늘|내일|모레|글피|today|tomorrow/gi, '')
    .replace(/(오전|오후|아침|저녁|밤|낮|am|pm)?\s*\d{1,2}\s*(시\s*(반|\d{1,2}\s*분?)?|:\s*\d{2}|am|pm)/gi, '')
    .replace(/부터|까지|~|—|\bto\b/gi, ' ')
    .replace(/매일|매주|매달|매월|daily|weekly|monthly|every day|every week/gi, '')
    .replace(/[,·]|에서|에|하기|할것|예정/g, ' ').replace(/\s+/g, ' ').trim()
  return { title: title || '새 일정', date: toISODate(date), allDay: !startTime, startTime, endTime, recurrence }
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number); const t = (h * 60 + m + mins) % (24 * 60)
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}
function extractTimes(str: string): string[] {
  const re = /(오전|오후|아침|저녁|밤|낮|am|pm)?\s*(\d{1,2})\s*(?:시\s*(반|\d{1,2}\s*분?)?|:\s*(\d{2})|\s*(am|pm))/gi
  const out: string[] = []; let m: RegExpExecArray | null
  while ((m = re.exec(str))) {
    const mer = (m[1] || m[5] || '').toLowerCase()
    let h = +m[2]; let min = 0
    if (m[3]) min = /반/.test(m[3]) ? 30 : parseInt(m[3]) || 0
    else if (m[4]) min = +m[4]
    if (/오후|저녁|밤|pm/.test(mer) && h < 12) h += 12
    if (/오전|아침|낮|am/.test(mer) && h === 12) h = 0
    out.push(`${pad(h)}:${pad(min)}`)
  }
  return out
}

export function localParse(text: string, ref: Date): ParsedEvent[] {
  return text.split(/[\n,;、]+/).map(line => localParseLine(line, ref)).filter((e): e is ParsedEvent => Boolean(e))
}
