import { useEffect, useState } from 'react'

// iOS에는 PWA 설치 프롬프트가 없어서 사용자가 방법을 모르면 설치할 수 없다.
// 설치 전 상태에서만: iOS는 안내 배너, Chrome/Android는 실제 설치 버튼을 보여준다.
const DISMISS_KEY = 'dmd-install-dismissed'

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<{ prompt(): Promise<void> } | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [installed, setInstalled] = useState(isStandalone)
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setDeferred(event as unknown as { prompt(): Promise<void> }) }
    const onInstalled = () => setInstalled(true)
    addEventListener('beforeinstallprompt', onPrompt)
    addEventListener('appinstalled', onInstalled)
    return () => { removeEventListener('beforeinstallprompt', onPrompt); removeEventListener('appinstalled', onInstalled) }
  }, [])

  if (installed || dismissed) return null
  if (!isIOS && !deferred) return null

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }

  return <div className="install-banner" role="note">
    {isIOS
      ? <span>📱 앱으로 설치: Safari 하단 <b>공유(⬆️)</b> 버튼 → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있어요.</span>
      : <span>📱 이 플래너를 앱으로 설치할 수 있어요. <button className="purple-button install-now" onClick={() => { void deferred?.prompt(); setDeferred(null) }}>앱 설치</button></span>}
    <button className="install-dismiss" aria-label="설치 안내 닫기" onClick={dismiss}>×</button>
  </div>
}
