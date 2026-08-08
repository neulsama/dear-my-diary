import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { PlannerHeader } from './diary/components/PlannerHeader'
import { InstallPrompt } from './diary/components/InstallPrompt'
import { MonthlyPage } from './diary/pages/MonthlyPage'
import { WeeklyPage } from './diary/pages/WeeklyPage'
import { DiaryEntryPage } from './diary/pages/DiaryEntryPage'
import { BrainstormPage } from './diary/pages/BrainstormPage'
import { CalendarSyncPage } from './diary/pages/CalendarSyncPage'
import { DiarySettingsPage } from './diary/pages/DiarySettingsPage'
import { StudyLoadPage } from './diary/pages/StudyLoadPage'
import { useDiaryStore } from './diary/store'
import { DEMO_MODE } from './diary/repository'
import { isOpenDiaryShortcut } from './diary/utils/shortcuts'
import { supabase } from './lib/supabase'
import { applyPreferences } from './diary/utils/theme'

type Route = 'monthly' | 'weekly' | 'study-load' | 'brainstorm' | 'calendar-sync' | 'settings' | 'entry'

const parseRoute = (): { route: Route; eventId?: string } => {
  const path = location.pathname
  const entry = path.match(/^\/entry\/([^/]+)/)
  if (entry) return { route: 'entry', eventId: decodeURIComponent(entry[1]) }
  if (path.startsWith('/weekly')) return { route: 'weekly' }
  if (path.startsWith('/brainstorm')) return { route: 'brainstorm' }
  if (path.startsWith('/study-load')) return { route: 'study-load' }
  if (path.startsWith('/calendar-sync') || path.startsWith('/settings/calendar')) return { route: 'calendar-sync' }
  if (path.startsWith('/settings')) return { route: 'settings' }
  return { route: 'monthly' }
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !email.trim()) return
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/monthly` }
    })
    setSending(false)
    setMessage(error ? error.message : '로그인 링크를 이메일로 보냈습니다. 받은 편지함을 확인해 주세요.')
  }

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <span className="auth-kicker">YOUR PRIVATE PLANNER</span>
      <h1 id="auth-title">DEAR MY DIARY</h1>
      <p>월간·주간 계획과 하루의 기록을 한곳에서 관리하세요.</p>
      <form onSubmit={submit}>
        <label>이메일<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <button className="purple-button" disabled={sending}>{sending ? '보내는 중…' : '이메일로 로그인'}</button>
      </form>
      {message && <div className="notice" role="status">{message}</div>}
      <small>비밀번호 없이 이메일 링크로 로그인합니다. 데이터는 사용자별로 분리되어 저장됩니다.</small>
    </section>
  </main>
}

export default function App() {
  const store = useDiaryStore()
  const [current, setCurrent] = useState(parseRoute)
  const [anchor, setAnchor] = useState(new Date())
  const [authReady, setAuthReady] = useState(DEMO_MODE)
  const [userEmail, setUserEmail] = useState<string | null>(DEMO_MODE ? 'demo' : null)

  useEffect(() => {
    if (DEMO_MODE) {
      void store.init()
      return
    }
    if (!supabase) return
    const client = supabase
    void client.auth.getSession().then(({ data }) => {
      const session = data.session
      setUserEmail(session?.user.email ?? null)
      setAuthReady(true)
      if (session) void store.init()
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      setAuthReady(true)
      if (session && !useDiaryStore.getState().ready) void useDiaryStore.getState().init()
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { applyPreferences(store.preferences) }, [store.preferences])

  useEffect(() => {
    const pop = () => setCurrent(parseRoute())
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])

  const navigate = (path: string) => {
    history.pushState({}, '', path)
    setCurrent(parseRoute())
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openDiary = (id: string) => navigate(`/entry/${encodeURIComponent(id)}`)

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!isOpenDiaryShortcut(event)) return
      event.preventDefault()
      if (store.selectedEventId) openDiary(store.selectedEventId)
      else store.setToast('먼저 일정을 선택해 주세요.')
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [store.selectedEventId])

  useEffect(() => {
    if (!store.toast) return
    const timer = setTimeout(() => store.setToast(undefined), 3200)
    return () => clearTimeout(timer)
  }, [store.toast])

  const saveLabel = store.saveState==='Saved'?'저장됨':store.saveState==='Saving…'?'저장 중…':'저장 실패'
  const syncLabel = store.calendar.googleConnected
    ? (store.saveState === 'Saved' ? '동기화됨' : saveLabel)
    : `${DEMO_MODE ? 'DEMO_MODE' : '비공개'} · ${saveLabel}`
  const nav = useMemo(() => [
    { id: 'monthly', label: 'Monthly', path: '/monthly' },
    { id: 'weekly', label: 'Weekly', path: '/weekly' },
    { id: 'study-load', label: '전체 공부 분량', path: '/study-load' },
    { id: 'brainstorm', label: 'Brainstorm', path: '/brainstorm' },
    { id: 'calendar-sync', label: '캘린더 연동', path: '/calendar-sync' },
    { id: 'settings', label: '설정', path: '/settings' }
  ] as const, [])

  if (!authReady) return <div className="app-loading"><div>DEAR MY DIARY</div><span>로그인 상태를 확인하고 있습니다…</span></div>
  if (!DEMO_MODE && !userEmail) return <AuthScreen />
  if (!store.ready) return <div className="app-loading"><div>DEAR MY DIARY</div><span>플래너를 여는 중입니다…</span></div>

  return <div className="diary-app">
    <PlannerHeader sync={syncLabel} profile={store.profile.displayName || userEmail || 'Diary'} onToday={() => { setAnchor(new Date()); if (!['monthly', 'weekly'].includes(current.route)) navigate('/monthly') }} onSignOut={!DEMO_MODE ? () => void supabase?.auth.signOut() : undefined} />
    <nav className="main-nav" aria-label="Main navigation">{nav.map(item => <button key={item.id} className={current.route === item.id ? 'active' : ''} onClick={() => navigate(item.path)}>{item.label}</button>)}</nav>
    <InstallPrompt />
    <main>
      {current.route === 'monthly' && <MonthlyPage anchor={anchor} setAnchor={setAnchor} openDiary={openDiary} />}
      {current.route === 'weekly' && <WeeklyPage anchor={anchor} setAnchor={setAnchor} openDiary={openDiary} />}
      {current.route === 'study-load' && <StudyLoadPage />}
      {current.route === 'brainstorm' && <BrainstormPage />}
      {current.route === 'calendar-sync' && <CalendarSyncPage />}
      {current.route === 'settings' && <DiarySettingsPage />}
      {current.route === 'entry' && current.eventId && <DiaryEntryPage eventId={current.eventId} goBack={() => navigate('/monthly')} />}
    </main>
    {store.toast && <div className="toast" role="status">{store.toast}<button aria-label="알림 닫기" onClick={() => store.setToast(undefined)}>×</button></div>}
  </div>
}
