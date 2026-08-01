// Authenticated two-way sync. The refresh token is AES-GCM encrypted at rest.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))
async function decrypt(value: string) {
  const [iv, cipher] = value.split('.')
  const key = await crypto.subtle.importKey('raw', decode(Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY')!), 'AES-GCM', false, ['decrypt'])
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(cipher)))
}
const eventDate = (value: { date?: string; dateTime?: string }) => value.dateTime ?? `${value.date}T00:00:00+09:00`

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = request.headers.get('Authorization') ?? ''
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await client.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
    const { data: connection } = await client.from('calendar_connections').select('*').eq('provider', 'google').single()
    if (!connection) return Response.json({ error: 'Not connected' }, { status: 409, headers: cors })
    const { data: preferenceRow } = await client.from('user_preferences').select('calendar_options').maybeSingle()
    const options = preferenceRow?.calendar_options ?? {}

    const refresh = await decrypt(connection.encrypted_refresh_token)
    const token = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: refresh, grant_type: 'refresh_token' })
    }).then(response => response.json())
    if (!token.access_token) throw new Error(token.error_description ?? 'Google token refresh failed')
    const googleHeaders = { Authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' }
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`

    const { data: pending } = options.googleContent === 'study' ? { data: [] } : await client.from('planner_events').select('*').in('sync_status', ['pending', 'error'])
    let pushed = 0
    for (const event of pending ?? []) {
      const body = {
        summary: event.title, description: event.description, location: event.location,
        start: event.all_day ? { date: event.start_at.slice(0, 10) } : { dateTime: event.start_at, timeZone: 'Asia/Seoul' },
        end: event.all_day ? { date: event.end_at.slice(0, 10) } : { dateTime: event.end_at, timeZone: 'Asia/Seoul' },
        recurrence: event.recurrence_rule ? [`RRULE:${event.recurrence_rule}`] : undefined,
        extendedProperties: { private: { dearMyDiaryId: event.id } }
      }
      const response = event.external_event_id
        ? await fetch(`${base}/${encodeURIComponent(event.external_event_id)}`, { method: event.deleted_at ? 'DELETE' : 'PUT', headers: googleHeaders, body: event.deleted_at ? undefined : JSON.stringify(body) })
        : await fetch(base, { method: 'POST', headers: googleHeaders, body: JSON.stringify(body) })
      if (response.ok) {
        const remote = response.status === 204 ? {} : await response.json()
        await client.from('planner_events').update({ external_provider: 'google', external_calendar_id: connection.calendar_id, external_event_id: remote.id ?? event.external_event_id, external_updated_at: remote.updated ?? new Date().toISOString(), last_synced_at: new Date().toISOString(), sync_status: 'synced', sync_error: null }).eq('id', event.id)
        pushed++
      } else {
        await client.from('planner_events').update({ sync_status: 'error', sync_error: `Google HTTP ${response.status}` }).eq('id', event.id)
      }
    }

    const { data: syncState } = await client.from('calendar_sync_states').select('*').eq('connection_id', connection.id).maybeSingle()
    const pull = async (syncToken?: string) => {
      const remoteEvents: Record<string, any>[] = []
      let pageToken: string | undefined
      let nextSyncToken: string | undefined
      do {
        const params = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: '2500' })
        if (syncToken) params.set('syncToken', syncToken)
        else params.set('timeMin', new Date(Date.now() - 366 * 86400000).toISOString())
        if (pageToken) params.set('pageToken', pageToken)
        const response = await fetch(`${base}?${params}`, { headers: googleHeaders })
        if (response.status === 410) return pull()
        if (!response.ok) throw new Error(`Google pull failed: ${response.status}`)
        const body = await response.json()
        remoteEvents.push(...(body.items ?? []))
        pageToken = body.nextPageToken
        nextSyncToken = body.nextSyncToken ?? nextSyncToken
      } while (pageToken)
      return { remoteEvents, nextSyncToken }
    }
    const pulledResult = options.googleContent === 'study' ? { remoteEvents: [], nextSyncToken: syncState?.sync_token } : await pull(syncState?.sync_token ?? undefined)
    const { remoteEvents, nextSyncToken } = pulledResult
    let pulled = 0
    for (const remote of remoteEvents) {
      const { data: existing } = await client.from('planner_events').select('id').eq('external_provider', 'google').eq('external_calendar_id', connection.calendar_id).eq('external_event_id', remote.id).maybeSingle()
      if (remote.status === 'cancelled') {
        if (existing) await client.from('planner_events').update({ deleted_at: new Date().toISOString(), sync_status: 'synced', external_updated_at: remote.updated }).eq('id', existing.id)
        continue
      }
      if (!remote.start || !remote.end) continue
      const localId = existing?.id ?? remote.extendedProperties?.private?.dearMyDiaryId ?? crypto.randomUUID()
      const values = {
        id: localId, user_id: user.id, title: remote.summary || '(제목 없음)', description: remote.description || '',
        start_at: eventDate(remote.start), end_at: eventDate(remote.end), all_day: Boolean(remote.start.date), color: '#8f78b8', location: remote.location || '',
        status: 'planned', recurrence_rule: (remote.recurrence?.[0] || '').replace(/^RRULE:/, ''), source: 'google', google_sync: true,
        external_provider: 'google', external_calendar_id: connection.calendar_id, external_event_id: remote.id, external_updated_at: remote.updated,
        last_synced_at: new Date().toISOString(), sync_status: 'synced', sync_error: null, deleted_at: null, updated_at: new Date().toISOString()
      }
      const { error } = await client.from('planner_events').upsert(values, { onConflict: 'id' })
      if (!error) pulled++
    }
    let studyPushed = 0
    if ((options.googleContent ?? 'both') !== 'events') {
      const { data: goals } = await client.from('study_goals').select('*').eq('google_sync_enabled', true).is('deleted_at', null)
      const goalIds = (goals ?? []).map(goal => goal.id)
      const { data: studyTasks } = goalIds.length ? await client.from('study_tasks').select('*').in('goal_id', goalIds) : { data: [] }
      for (const task of studyTasks ?? []) {
        const goal = (goals ?? []).find(item => item.id === task.goal_id)
        if (!goal) continue
        const include = !task.deleted_at && (options.googleIncludeCompleted || task.status !== 'completed')
        const targetCalendar = options.subjectCalendars?.[goal.id] || connection.calendar_id
        const taskBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events`
        if (!include && task.external_event_id) {
          const removed = await fetch(`${taskBase}/${encodeURIComponent(task.external_event_id)}`, { method: 'DELETE', headers: googleHeaders })
          if (removed.ok || removed.status === 404) await client.from('study_tasks').update({ external_event_id: null, external_provider: null, external_calendar_id: null, last_synced_at: new Date().toISOString() }).eq('id', task.id)
          continue
        }
        if (!include) continue
        const done = task.status === 'completed' && options.googleCompletedPrefix ? '[완료] ' : ''
        const startDate = task.scheduled_date
        const endDate = new Date(new Date(`${startDate}T00:00:00+09:00`).getTime() + 86400000).toISOString().slice(0, 10)
        const startTime = `${startDate}T09:00:00+09:00`
        const endTime = new Date(new Date(startTime).getTime() + Math.max(15, task.estimated_minutes || 30) * 60000).toISOString()
        const body = { summary: `${done}${task.title}`, description: task.notes || '', start: options.googleStudyTimeMode === 'timed' ? { dateTime: startTime, timeZone: 'Asia/Seoul' } : { date: startDate }, end: options.googleStudyTimeMode === 'timed' ? { dateTime: endTime, timeZone: 'Asia/Seoul' } : { date: endDate }, extendedProperties: { private: { dearMyDiaryStudyTaskId: task.id } } }
        const response = task.external_event_id ? await fetch(`${taskBase}/${encodeURIComponent(task.external_event_id)}`, { method: 'PUT', headers: googleHeaders, body: JSON.stringify(body) }) : await fetch(taskBase, { method: 'POST', headers: googleHeaders, body: JSON.stringify(body) })
        if (response.ok) { const remote = await response.json(); await client.from('study_tasks').update({ external_provider: 'google', external_calendar_id: targetCalendar, external_event_id: remote.id ?? task.external_event_id, last_synced_at: new Date().toISOString() }).eq('id', task.id); studyPushed++ }
      }
    }
    const stateValues = { user_id: user.id, connection_id: connection.id, sync_token: nextSyncToken, last_synced_at: new Date().toISOString(), status: 'idle', error: null, updated_at: new Date().toISOString() }
    if (syncState) await client.from('calendar_sync_states').update(stateValues).eq('id', syncState.id)
    else await client.from('calendar_sync_states').insert(stateValues)
    await client.from('calendar_connections').update({ updated_at: new Date().toISOString() }).eq('id', connection.id)
    return Response.json({ ok: true, pushed, pulled, studyPushed, synced: pushed + pulled + studyPushed }, { headers: cors })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500, headers: cors })
  }
})
