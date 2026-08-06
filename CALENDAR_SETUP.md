# 구글 · 애플 캘린더 실시간 연동 설정 가이드

로컬 데모 모드에서는 일정이 브라우저에만 저장되고, 캘린더 연동 버튼은 "설정이 필요하다"는 안내만 표시합니다.
**실시간 양방향 연동**을 켜려면 아래 순서대로 본인 계정에서 Supabase와 Google Cloud를 설정해야 합니다.
(코드·Edge Function은 이미 저장소에 포함되어 있어, 계정 설정과 배포만 하면 됩니다.)

> 계정 생성과 API 키 발급은 보안상 **직접** 하셔야 합니다. 아래 값들을 발급받아 `.env.local`과 Supabase 시크릿에 넣으세요.

---

## 1. Supabase 프로젝트 (데이터 저장 + 서버 함수)

1. https://supabase.com 에서 프로젝트를 만듭니다.
2. **SQL Editor**에서 마이그레이션을 순서대로 실행합니다.
   - `supabase/migrations/202608020100_dear_my_diary.sql`
   - `supabase/migrations/202608020200_study_preferences.sql`
   - `supabase/migrations/202608060100_checklist_and_doc_blocks.sql` ← 이번에 추가된 체크리스트·문서 블록용
3. **Storage**에 비공개 버킷 `diary-images`가 생성됐는지 확인합니다.
4. **Project Settings → API**에서 아래 값을 복사해 `.env.local`에 넣습니다.

```env
NEXT_PUBLIC_DEMO_MODE=false            # ← 데모 모드 끄기 (중요)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # anon public key
```

> `NEXT_PUBLIC_DEMO_MODE=false`로 바꾸면 이메일 로그인 화면이 뜨고, 데이터가 Supabase(사용자별)로 저장됩니다.

---

## 2. Google Calendar OAuth (양방향 동기화)

1. https://console.cloud.google.com 에서 프로젝트를 만들고 **Google Calendar API**를 사용 설정합니다.
2. **OAuth 동의 화면**을 구성합니다(외부, 테스트 사용자에 본인 이메일 추가).
3. **사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션**을 만듭니다.
4. **승인된 리디렉션 URI**에 배포된 콜백 함수 주소를 넣습니다:
   `https://<프로젝트>.supabase.co/functions/v1/google-calendar-callback`
5. 발급된 **클라이언트 ID / 시크릿**을 Supabase Edge Function 시크릿에 넣습니다(아래 4단계).
6. 32바이트 AES 키를 만들어 Base64로 인코딩합니다(토큰 암호화용):

```bash
openssl rand -base64 32
```

---

## 3. 애플 캘린더 구독 (단방향 ICS)

애플 캘린더는 표준상 **단방향 구독**입니다(내 앱 → 애플). 아래 5단계에서 `calendar-token` / `calendar-feed`
함수를 배포하면, 앱의 **캘린더 연동 → 애플 캘린더 구독**에서 비공개 URL을 발급받아 macOS/iPhone에 구독으로 추가할 수 있습니다.
(로컬에서 지금 바로 쓰려면 같은 화면의 **ICS 다운로드**로 `.ics` 파일을 받아 구글/애플 캘린더에 가져오기 하면 됩니다.)

---

## 4. Edge Function 시크릿 설정

Supabase CLI 로그인 후, 프로젝트 루트에서:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  GOOGLE_REDIRECT_URI=https://<프로젝트>.supabase.co/functions/v1/google-calendar-callback \
  CALENDAR_TOKEN_ENCRYPTION_KEY=<openssl로 만든 Base64 키> \
  CRON_SECRET=<임의의 긴 문자열>
```

> 이 값들은 절대 `NEXT_PUBLIC_`으로 노출하면 안 됩니다(서버 전용).

---

## 5. Edge Function 배포

```bash
supabase functions deploy google-calendar-oauth-start
supabase functions deploy google-calendar-callback
supabase functions deploy google-calendar-sync
supabase functions deploy calendar-token
supabase functions deploy calendar-feed
```

---

## 6. 사용하기

1. 앱을 다시 실행하고 이메일로 로그인합니다.
2. **캘린더 연동** 탭 → **Google Calendar 연결** → 구글 로그인/동의.
3. **지금 동기화**를 누르거나 **자동 동기화**를 켭니다.
   - 앱의 로컬 변경은 구글로 push되고, 구글 변경은 증분 sync 토큰으로 pull됩니다.
4. **애플 캘린더 구독** → **비공개 주소 발급** → 그 URL을 macOS Calendar(파일 → 새 구독) / iPhone(설정 → 캘린더 → 계정 → 구독 캘린더 추가)에 붙여넣습니다.

---

## 자동 백그라운드 동기화(선택)

포함된 UI는 **on-demand**(버튼/자동토글) 동기화입니다. 사람이 접속하지 않아도 주기적으로 동기화하려면,
Supabase의 Scheduled Functions(cron)로 `google-calendar-sync`를 `CRON_SECRET`과 함께 호출하도록 예약하세요.

---

## 요약: 지금 당장 vs 완전 연동

| 원하는 것 | 필요한 것 |
|---|---|
| 지금 로컬에서 캘린더로 내보내기 | **캘린더 연동 → ICS 다운로드** (설정 불필요) |
| 구글 실시간 양방향 + 애플 구독 | 위 1~6단계 (본인 Supabase·Google 계정 필요) |
