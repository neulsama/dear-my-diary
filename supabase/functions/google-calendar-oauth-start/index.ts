import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = request.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
    const state = crypto.randomUUID() + crypto.randomUUID()
    const body = await request.json().catch(() => ({})) as { returnTo?: string }
    const returnTo = body.returnTo ?? Deno.env.get('NEXT_PUBLIC_APP_URL')!
    const { data: existing } = await supabase.from('calendar_sync_states').select('id').is('connection_id', null).maybeSingle()
    const values = { user_id: user.id, oauth_state: state, oauth_state_expires_at: new Date(Date.now() + 600000).toISOString(), return_to: returnTo, status: 'authorizing', error: null }
    const result = existing
      ? await supabase.from('calendar_sync_states').update(values).eq('id', existing.id)
      : await supabase.from('calendar_sync_states').insert(values)
    if (result.error) throw result.error
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state
    })
    return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, { headers: cors })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'OAuth setup failed' }, { status: 500, headers: cors })
  }
})
