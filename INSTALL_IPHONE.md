# 아이폰에 앱으로 설치하기 (PWA)

이 앱은 **PWA(Progressive Web App)**로 만들어져 있어, 아이폰 홈 화면에 추가하면
아이콘이 생기고 전체화면 앱처럼 실행됩니다. App Store·개발자 계정·Xcode가 필요 없습니다.

준비된 것: 앱 아이콘, 매니페스트(`manifest.webmanifest`), iOS 메타 태그, 오프라인 서비스워커(`sw.js`).

> ⚠️ 핵심: 아이폰은 **내 PC의 localhost에 접속할 수 없습니다.** 설치하려면 앱이
> 아이폰에서 열리는 주소에 있어야 합니다. 아래 A(권장) 또는 B 방법을 쓰세요.

---

## A. 배포해서 설치 (권장 · 어디서나 사용)

1. 이 폴더를 GitHub에 올린 뒤 https://vercel.com 에서 Import 합니다.
   - 저장소에 `vercel.json`이 있어 Vite 앱으로 자동 인식됩니다(빌드 `npm run build`, 출력 `dist`, SPA 리라이트 포함).
2. 배포가 끝나면 `https://내앱.vercel.app` 주소가 생깁니다.
3. **아이폰 Safari**로 그 주소를 엽니다.
4. 하단 **공유 버튼(⬆️)** → **홈 화면에 추가** → 추가.
5. 홈 화면에 "MY DIARY" 아이콘이 생기고, 탭하면 전체화면 앱처럼 실행됩니다(오프라인도 동작).

> 다른 사람과 공유하고 싶지 않다면 Vercel 프로젝트를 비공개로 두면 됩니다(주소만 알면 접속되니 링크만 관리).

## B. 같은 와이파이에서 바로 테스트 (배포 없이)

1. PC와 아이폰을 **같은 와이파이**에 연결합니다.
2. PC에서 네트워크 모드로 실행:
   ```bash
   npm run dev:network
   ```
3. PC의 로컬 IP를 확인합니다(예: `192.168.0.10`). Windows는 `ipconfig`의 IPv4 주소.
4. 아이폰 Safari에서 `http://<PC-IP>:5180` 접속 → 공유 → 홈 화면에 추가.
   - 이 방식은 PC를 켜둔 동안만 동작하고, http(비 HTTPS)라 오프라인 캐시(서비스워커)는 등록되지 않습니다. 설치·사용 자체는 됩니다.

---

## 알아두기

- **데이터 저장**: 현재 데모 모드에서는 데이터가 **그 기기의 브라우저(localStorage)**에 저장됩니다. 아이폰에 설치한 앱과 PC는 데이터가 따로입니다. 여러 기기에서 동기화하려면 [CALENDAR_SETUP.md](CALENDAR_SETUP.md)의 Supabase 설정이 필요합니다.
- **DeepSeek(AI 일정 파싱)와 배포**: 배포본에서는 **서버리스 함수 `api/parse-schedule.js`**를 통해 DeepSeek를 호출합니다(키가 브라우저에 노출되지 않음). Vercel에서 아래 환경변수만 설정하면 배포본에서도 AI 파싱이 동작합니다.
  - **Vercel → Project Settings → Environment Variables**:
    - `DEEPSEEK_API_KEY` = 본인 DeepSeek 키 (⚠️ `VITE_` 접두사 붙이지 마세요 — 붙이면 브라우저 번들에 노출됩니다)
    - (선택) `LLM_PROVIDER=deepseek`, `LLM_MODEL=deepseek-chat`
  - 환경변수를 추가/변경한 뒤에는 **Redeploy** 해야 반영됩니다.
  - 로컬 개발에서는 기존대로 `.env.local`의 `VITE_DEEPSEEK_API_KEY` + Vite 개발 프록시로 동작합니다(배포와 무관).
- **아이콘 다시 만들기**: `node scripts/gen-icons.mjs` (보라 배경 + 크림 플래너 카드). 디자인을 바꾸려면 그 스크립트를 수정하세요.
