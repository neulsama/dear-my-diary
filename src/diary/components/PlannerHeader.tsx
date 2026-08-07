import { format } from 'date-fns'

export function PlannerHeader({ sync, profile, onToday, onSignOut }: { sync:string; profile:string; onToday():void; onSignOut?():void }) {
  const refresh=()=>{if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(reg=>reg?.update()).catch(()=>{}).finally(()=>location.reload());else location.reload()}
  return <header className="top-header"><div className="wordmark">DEAR MY DIARY</div><div className="header-actions"><button onClick={onToday}>Today</button><button className="refresh-btn" title="새로고침 (최신 버전 불러오기)" onClick={refresh}>↻ 새로고침</button><time>{format(new Date(),'EEEE, MMMM d')}</time><span className="sync-state"><i/> {sync}</span><button className="profile-chip" title={onSignOut?'로그아웃':'프로필'} onClick={onSignOut}><span>{profile.slice(0,1).toUpperCase()}</span>{profile}</button></div></header>
}
