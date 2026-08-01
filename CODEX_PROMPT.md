# DEAR MY DIARY — Codex Implementation Specification

현재 저장소를 직접 분석하고, 아래 요구사항을 만족하는 완성도 높은 웹 기반 다이어리·플래너 애플리케이션을 실제로 구현한다.

## 실행 원칙

- 설명이나 계획만 작성하지 말고 실제 파일을 생성·수정한다.
- 기존 프로젝트가 있다면 현재 구조, 패키지 매니저, 스타일 체계를 최대한 유지한다.
- 저장소가 비어 있거나 정상적인 웹 프로젝트가 아니면 Next.js App Router + React + TypeScript로 초기화한다.
- 질문하지 말고 합리적인 기본값을 정해 구현을 끝까지 진행한다.
- 버튼만 만들어 놓거나 가짜 성공 메시지를 표시하는 식의 미완성 구현은 금지한다.
- 구현 후 install, lint, typecheck, test, production build를 실행하고 오류를 수정한다.
- 외부 서비스 환경 변수가 없어도 핵심 기능을 확인할 수 있도록 DEMO_MODE를 제공한다.

## 참고 이미지

- `references/monthly-calendar.png`
  - 월간 플래너의 미니멀한 레이아웃 참고
  - 흰색 또는 따뜻한 아이보리 배경
  - 얇은 회색 선
  - 넓은 달력 칸
  - 둥근 캡슐 형태의 월 표시
  - 이미지 자체를 배경으로 쓰지 말고 HTML/CSS Grid로 구현

- `references/diary-entry-reference.png`
  - 일정별 다이어리 상세 화면 참고
  - 2000년대 개인 홈페이지 또는 미니홈피 감성
  - 상단 프로필, 큰 사진 캐러셀, 짧은 본문, Comments 영역
  - 보라색 포인트
  - 참고 이미지의 인물, 이름, 로고, 사진은 복제하지 않는다.

## 서비스 이름

화면의 서비스명과 제목은 모두 다음으로 통일한다.

`DEAR MY DIARY`

기존의 “바름이 플래너” 같은 이름이 있다면 전부 교체한다.

## 핵심 기능

1. Monthly Planner
2. Weekly Planner
3. 일정별 Diary Entry
4. 자유로운 Brainstorm Canvas
5. Google Calendar 양방향 동기화
6. Apple Calendar용 비공개 ICS 구독
7. 일정 선택 후 `Alt + 7` 또는 macOS `Option + 7`로 기록 화면 열기

## 권장 기술 스택

기존 프로젝트에 적절한 스택이 있으면 유지한다. 새로 구성할 때는 다음을 사용한다.

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage
- date-fns
- Zod
- React Hook Form
- @dnd-kit
- @xyflow/react
- Google Calendar API
- 검증된 ICS 생성 라이브러리
- Vitest
- 가능하면 Playwright

## 폰트

전역 CSS에 다음 폰트를 적용한다.

```css
@font-face {
    font-family: 'GodoRounded';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2409-1@1.0/godoRoundedL.woff2') format('woff2');
    font-weight: 300;
    font-display: swap;
}

@font-face {
    font-family: 'GodoRounded';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2409-1@1.0/godoRoundedR.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
}

html,
body,
button,
input,
textarea,
select {
    font-family: 'GodoRounded', ui-rounded, system-ui, sans-serif;
}
```

- 월, 요일, 메뉴, 버튼 등 UI 문구는 영어로 작성한다.
- 한국어 입력 및 표시도 깨지지 않아야 한다.

## 전체 레이아웃

상단:

- `DEAR MY DIARY` 워드마크
- Today 버튼
- 현재 날짜
- 동기화 상태
- 사용자 프로필 메뉴

내비게이션:

- Monthly
- Weekly
- Brainstorm
- Calendar Sync
- Settings

디자인:

- 흰색 또는 아주 옅은 아이보리 배경
- 얇은 회색 테두리
- 과한 그림자, 유리 효과, 강한 그라데이션 금지
- 보라색은 선택 상태와 Diary 화면의 포인트로만 사용
- 넓은 여백과 아날로그 플래너 인상
- 데스크톱과 모바일 반응형
- 접근 가능한 포커스 표시와 대비

## Monthly Planner

라우트 예시: `/monthly`

- 앱을 열면 현재 연도와 현재 월을 자동 계산해 표시한다.
- 날짜를 하드코딩하지 않는다.
- 기본 시간대는 `Asia/Seoul`.
- 주 시작은 Monday.
- 요일 순서:
  - Monday
  - Tuesday
  - Wednesday
  - Thursday
  - Friday
  - Saturday
  - Sunday
- 월 제목은 캡슐 형태로 표시한다.
- 월 이름은 글자 간격을 넓혀 `A U G U S T`처럼 표시한다.
- 연도도 자동 표시한다.
- 이전 달, 다음 달, Today 버튼을 제공한다.
- 7열 × 최대 6주 달력으로 구현한다.
- 이전·다음 달 날짜는 흐리게 표시한다.
- 오늘 날짜와 선택 날짜를 구분한다.
- 일정은 셀 안에 제목, 시간, 색상으로 표시한다.
- 모바일에서는 최대 2개만 표시하고 나머지는 `+3 more`로 축약한다.

일정 CRUD:

- 날짜 셀 클릭 또는 더블 클릭으로 일정 생성
- 일정 클릭으로 선택
- 일정 더블 클릭으로 편집
- 드래그 앤 드롭으로 날짜 이동
- 삭제 전 확인
- 저장 상태 표시
- 실패 시 입력값 보존

일정 필드:

- title
- description
- start date/time
- end date/time
- all-day
- color
- location
- status
- recurrence rule
- reminder
- source
- Google Calendar synchronization 여부

## Weekly Planner

라우트 예시: `/weekly`

Monthly와 Weekly는 별도의 복사본 데이터를 만들지 않는다. 동일한 `planner_events` 데이터를 서로 다른 방식으로 렌더링한다.

- Monthly에서 생성하면 Weekly에 즉시 표시
- Weekly에서 수정하면 Monthly에 즉시 반영
- 한쪽에서 삭제하면 다른 쪽에서도 삭제
- 캐시 무효화, 공통 상태 또는 실시간 구독으로 즉시 갱신

UI:

- Monday부터 Sunday까지 7일
- 이전 주, 다음 주, This Week
- All-day 영역
- 시간표는 기본 06:00~24:00
- 겹치는 일정은 나란히 배치
- 일정 드래그로 날짜와 시간 이동
- 리사이즈로 종료 시간 변경
- 모바일은 1일 또는 3일 보기
- 현재 시간 표시선

## Alt + 7 단축키

Monthly 또는 Weekly에서 일정 하나를 선택하면 `selectedEvent`가 된다.

다음 조건으로 단축키를 구현한다.

```ts
event.altKey === true && event.code === 'Digit7'
```

- Windows/Linux: Alt + 7
- macOS: Option + 7
- 선택된 일정이 있으면 `/entry/[eventId]`를 연다.
- 선택된 일정이 없으면 `Select a plan first` 토스트를 표시한다.
- input, textarea, contenteditable 작성 중에는 작동하지 않는다.
- 일정 메뉴에 `Open Diary` 버튼을 추가한다.
- 컨텍스트 메뉴에 `Write about this plan`을 추가한다.
- Settings에 단축키 안내를 추가한다.

## Diary Entry

라우트: `/entry/[eventId]`

특정 일정 하나와 연결된 다이어리 화면이다.

상단:

- 사용자 아바타
- display name
- handle
- 연결된 일정 제목
- 일정 날짜와 시간
- Monthly/Weekly로 돌아가기

본문:

- 큰 사진 영역
- 여러 장 업로드
- 좌우 화살표 캐러셀
- 키보드 좌우 방향키
- 이미지 삭제와 순서 변경
- 파일 형식 및 크기 검증
- Supabase Storage 비공개 버킷
- signed URL 또는 인증된 접근 방식
- 업로드 진행 상태

다이어리 필드:

- title
- body
- mood
- tags
- created_at
- updated_at
- 자동 저장
- 저장 상태 표시

Comments:

- 하단에 `Comments` 영역
- 같은 기록에 짧은 후속 메모 여러 개 추가
- 시간순 표시
- 수정 및 삭제
- 작성 시각 표시

일정 하나당 기본 Diary Entry 하나, Comments는 여러 개가 연결되게 한다.

## Brainstorm Canvas

라우트: `/brainstorm`

단순 textarea가 아니라 자유로운 보드형 브레인스토밍 공간을 구현한다.

- 무한 캔버스
- 확대/축소
- 화면 이동
- 메모 카드 생성
- 카드 이동 및 크기 조절
- 카드 제목과 본문
- 카드 색상
- 카드 연결선
- 카드 삭제
- 다중 선택
- 전체 맞춤 보기
- undo/redo
- 자동 저장
- 마지막 저장 시간
- 새 보드 생성
- 보드 이름 변경
- 보드 삭제
- 보드 전환

단축키:

- N: 새 메모
- Delete/Backspace: 선택 메모 삭제
- Ctrl/Cmd + Z: undo
- Ctrl/Cmd + Shift + Z: redo
- Ctrl/Cmd + S: 즉시 저장

텍스트 입력 중에는 단축키가 방해하지 않게 한다.

## Google Calendar

Google Calendar는 실제 OAuth 2.0 기반 양방향 동기화를 구현한다.

설정 화면: `/settings/calendar`

기능:

- Connect Google Calendar
- 연결 계정 이메일
- 대상 Calendar 선택
- Sync now
- Last synced
- Auto-sync on/off
- Disconnect

보안:

- state 검증
- 가능하면 PKCE
- offline access
- refresh token 처리
- access/refresh token을 localStorage에 저장하지 않는다.
- 서버에서만 처리한다.
- refresh token은 암호화해 DB에 저장한다.
- service role key를 클라이언트에 노출하지 않는다.
- 토큰을 로그에 출력하지 않는다.

동기화:

- 로컬 생성 → Google 생성
- 로컬 수정 → Google 수정
- 로컬 삭제 → Google 삭제
- Google 생성/수정/삭제 → 로컬 반영
- 종일 일정
- 시간대
- 반복 일정
- incremental sync
- sync token 오류 시 full sync
- 무한 동기화 방지
- 충돌 상태 표시
- 연결하지 않아도 로컬 일정은 정상 작동

일정에 다음 필드를 둔다.

- external_provider
- external_calendar_id
- external_event_id
- external_updated_at
- last_synced_at
- sync_status
- sync_error

## Apple Calendar / iCloud

Google과 같은 완전한 양방향 연동으로 표시하지 않는다.

기능명:

`Apple Calendar Subscription`

설명 문구:

`Add your private subscription URL to Apple Calendar. Changes made in DEAR MY DIARY will appear in Apple Calendar after it refreshes. Changes made directly in Apple Calendar are not imported back.`

구현:

- 사용자별 긴 랜덤 토큰
- `/api/calendar/ics/[privateToken]`
- RFC 5545 ICS
- 올바른 content-type과 UTF-8
- 종일/시간 일정 구분
- timezone
- 반복 일정
- 안정적인 UID
- 제목, 내용, 장소
- 토큰 재발급
- 이전 토큰 즉시 무효화
- URL 복사
- `.ics` 다운로드
- Apple Calendar 추가 안내

보안:

- 전체 URL을 로그에 남기지 않는다.
- 사용자 본인만 Settings에서 확인
- 가능하면 DB에는 token hash 저장
- Apple ID 비밀번호를 요구하거나 저장하지 않는다.
- 검증되지 않은 iCloud CalDAV 서버를 하드코딩하지 않는다.

## 인증과 설정

Supabase Auth:

- 이메일 또는 magic link 로그인
- 로그아웃
- 세션 유지
- 보호된 라우트
- Google Calendar OAuth와 앱 로그인 세션 분리

프로필:

- display name
- handle
- avatar
- timezone
- default event duration
- default reminder

설정:

- light theme 기본
- reduced motion
- keyboard shortcuts
- Google 연결 상태
- Apple subscription 상태

## 데이터베이스

Supabase migration SQL을 작성한다.

필수 테이블:

- profiles
- planner_events
- diary_entries
- diary_images
- diary_comments
- brainstorm_boards
- brainstorm_nodes
- brainstorm_edges
- calendar_connections
- calendar_sync_states
- calendar_feed_tokens

필수 원칙:

- 각 사용자 데이터에 user_id
- foreign key
- 필요한 unique constraint
- `planner_events(user_id, start_at)` 인덱스
- provider + external_event_id 중복 방지
- diary_entries.event_id unique
- handle unique
- 일정 soft delete
- 모든 사용자 데이터 테이블에 RLS
- 사용자는 자신의 데이터만 접근
- Storage도 사용자 디렉터리 기준 제한

## DEMO_MODE

`.env`가 없는 상태에서도 핵심 기능을 확인할 수 있게 한다.

`NEXT_PUBLIC_DEMO_MODE=true`일 때:

- localStorage 또는 브라우저 adapter
- Monthly CRUD
- Weekly 자동 반영
- Diary Entry
- Comments
- Brainstorm 저장
- Alt + 7
- 샘플 데이터는 `Load sample data` 버튼을 눌렀을 때만 생성
- Google 연결은 필요한 환경 변수 안내
- Apple ICS 서버 기능은 서버 환경이 필요함을 정확히 표시

프로덕션에서는 Supabase adapter를 사용한다. UI가 저장 방식에 직접 종속되지 않도록 repository/service 계층을 둔다.

## 환경 변수

`.env.example`을 만든다.

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_DEMO_MODE=false

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

CALENDAR_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
```

비밀 값에는 `NEXT_PUBLIC_`을 붙이지 않는다. 누락된 환경 변수 때문에 앱 전체가 흰 화면이 되지 않게 한다.

## 접근성과 UX

- 키보드만으로 일정 선택과 편집
- aria-label
- 모달 focus trap
- ESC 닫기
- toast
- 색상만으로 상태 구분 금지
- 드래그 앤 드롭 대체 조작
- reduced motion
- skeleton
- empty state
- error boundary
- 재시도
- 저장 실패 시 입력 보존

## 테스트

최소 테스트:

1. 현재 월 날짜 계산
2. Monday-first 월간 그리드
3. 윤년과 월말
4. 일정 CRUD
5. Monthly 생성 일정이 Weekly에 표시
6. Alt + 7이 선택 일정의 Diary Entry를 여는지
7. 선택 일정이 없을 때 안내
8. Brainstorm 저장 및 복원
9. ICS 기본 유효성
10. RLS
11. 외부 이벤트 중복 방지
12. 시간대 변환
13. 종일 일정 종료 날짜 처리

가능하면 Playwright E2E:

- 일정 작성
- Weekly에서 확인
- 일정 선택
- Alt + 7
- 다이어리 작성
- 새로고침 후 유지

## README

다음을 포함한다.

- 프로젝트 소개
- 주요 기능
- 로컬 실행
- Supabase 설정
- migration 적용
- Storage 설정
- Google Calendar API와 OAuth 설정
- 환경 변수
- Apple Calendar에 ICS URL 추가
- DEMO_MODE
- Vercel 배포
- 보안 주의사항
- Google 양방향과 Apple 단방향 구독의 차이
- 테스트와 build 명령어

## 완료 조건

- `DEAR MY DIARY` 표시
- 월과 요일이 영어
- GodoRounded 실제 적용
- 현재 월/연도/날짜 자동 계산
- 월 이동과 Today 작동
- Monthly CRUD 작동
- Weekly 자동 반영
- Alt + 7로 Diary Entry 열기
- Diary 사진, 본문, Comments 작동
- Brainstorm Canvas 작동 및 저장
- Google 환경 변수 설정 시 실제 OAuth 연결 가능
- Apple 비공개 ICS 발급 가능
- 모바일/데스크톱 지원
- TypeScript 오류 없음
- lint 오류 없음
- production build 성공
- 주요 테스트 통과
- README, `.env.example`, migration SQL 존재

마지막에 직접 실행한다.

1. 의존성 설치
2. lint
3. typecheck
4. test
5. production build

오류가 발생하면 수정하고 다시 실행한다.

최종 응답에는 다음만 정리한다.

- 구현한 기능
- 주요 변경 파일
- migration 위치
- 필요한 환경 변수
- 실행 및 테스트 결과
- Google Calendar 설정 시 사용자가 해야 하는 단계
- Apple Calendar 구독 방법
- 실제 남은 제한사항

지금부터 저장소를 분석하고 실제 구현을 시작한다.
