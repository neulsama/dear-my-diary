# Supabase 연동 — 10분 설정 (기기 간 데이터 동기화)

이걸 설정하면 **아이폰 앱과 PC가 같은 데이터**를 쓰게 됩니다(이메일 로그인 기반).
계정 생성과 키 복사는 보안상 직접 하셔야 하고, 나머지는 전부 준비돼 있습니다.

> ⚠️ **0단계 — 기존 기록 백업(중요!)**
> 지금(데모 모드)의 데이터는 기기 브라우저에만 있습니다. 연동을 켜기 **전에**,
> 기록이 있는 각 기기에서 **설정 → 데이터 내보내기(JSON)** 로 백업해 두세요.
> 연동 후 **설정 → 가져오기**로 클라우드에 올릴 수 있습니다.

## 1. Supabase 프로젝트 만들기 (약 2분)
1. https://supabase.com → 가입/로그인 → **New project**
2. 이름 아무거나(예: dear-my-diary), Database 비밀번호 설정(보관), Region은 **Northeast Asia (Seoul)** 권장 → Create

## 2. 데이터베이스 설정 — 붙여넣기 한 번 (약 1분)
1. 왼쪽 메뉴 **SQL Editor** → New query
2. 저장소의 [`supabase/setup.sql`](supabase/setup.sql) 내용을 **전부 복사해 붙여넣고 Run**
   (테이블·보안 정책(RLS)·이미지 버킷까지 한 번에 생성됩니다. "Success" 뜨면 끝)

## 3. 로그인 리디렉션 설정 (약 1분)
1. **Authentication → URL Configuration**
2. **Site URL**: `https://dear-my-diary.vercel.app`
3. **Redirect URLs**에 추가: `https://dear-my-diary.vercel.app/monthly`

## 4. 키 복사 → Vercel에 입력 (약 3분)
1. Supabase **Project Settings → API**에서 두 값 복사:
   - **Project URL** (https://xxxx.supabase.co)
   - **anon public** key (eyJ…)
2. Vercel → 프로젝트 → **Settings → Environment Variables**에서:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 복사한 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 복사한 anon key |
| `NEXT_PUBLIC_DEMO_MODE` | **false** ← 기존 true를 수정 |

3. **Deployments → 최신 배포 → ⋯ → Redeploy** (환경변수는 재배포해야 반영)

## 5. 로그인하고 데이터 옮기기 (약 2분)
1. 재배포 후 앱을 열면 **이메일 로그인 화면**이 나옵니다 → 이메일 입력 → 받은 메일의 링크 클릭
2. 로그인되면 **설정 → 가져오기**로 0단계에서 백업한 JSON을 올리기
3. 다른 기기(폰/PC)에서도 **같은 이메일로 로그인**하면 같은 데이터가 보입니다 ✅

## 참고
- 이메일 로그인 링크는 Supabase 기본 메일러 사용(무료·개인용 충분, 시간당 발송 제한 있음).
- 로컬 개발(`npm run dev`)은 `.env.local`이 데모 모드라 그대로 브라우저 저장으로 동작합니다.
  로컬에서도 클라우드를 쓰려면 `.env.local`에 같은 두 키를 넣고 `NEXT_PUBLIC_DEMO_MODE=false`로 바꾸세요.
- 구글 캘린더 실시간 동기화·애플 구독은 별도 단계입니다 → [CALENDAR_SETUP.md](CALENDAR_SETUP.md)
- 문제가 생기면: 로그인 메일이 안 오면 스팸함 확인, 링크 클릭 후 이상하면 3단계 URL 설정 재확인.
