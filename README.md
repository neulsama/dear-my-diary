# DEAR MY DIARY

A warm, private web planner that connects monthly and weekly plans to photo diary entries, comments, a freeform brainstorm canvas, and calendar integrations. The interface follows a minimal paper-calendar layout with a small purple accent and uses `GodoRounded` globally.

## Features

- Monday-first Monthly planner with a dynamic 6-week grid, current-day state, CRUD, drag-to-move, recurrence/reminders, and responsive event overflow
- Weekly planner using the same `planner_events`, including all-day plans, 06:00–24:00 timeline, drag-to-move, duration extension, and current-time line
- `전체 공부 분량`에서 과목별 목표를 만들고, 요일·제외일·가용 시간·최소 묶음·최대 분량·버퍼일을 고려해 정확한 합계로 자동 배분
- Monthly와 Weekly가 동일한 `study_tasks`를 사용하며 완료, 부분 완료, 고정, 날짜 이동, 수동 작업 및 미완료 이월을 즉시 공유
- 사용자별 글씨 크기(80~140%), 테마 색상, 일정별 색상과 플래너 표시 밀도 설정
- `Alt + 7` / `Option + 7` opens the selected plan’s Diary Entry; editors are excluded from the shortcut
- Event-linked diary with multi-image carousel, ordering/removal, keyboard arrows, mood, tags, autosave, and editable Comments
- Brainstorm boards with movable/resizable colored notes, edges, multi-select, zoom, undo/redo, keyboard shortcuts, and autosave
- Google Calendar OAuth 2.0 and manual two-way incremental synchronization with encrypted refresh tokens
- Private Apple Calendar ICS subscription function plus local `.ics` download
- Demo Mode browser repository, sample data only when explicitly loaded, JSON export/import, reduced motion, and mobile layouts
- Supabase PostgreSQL schema, RLS policies, private Storage bucket policy, and external-event deduplication

## Recently added

- **텍스트로 일정 추가** — Monthly/Weekly 상단의 "✎ 텍스트로 일정 추가"에 자유롭게 적으면(예: "내일 오후 2시부터 4시까지 팀 회의, 8월 20일 치과 예약, 매주 월요일 아침 7시 운동") 월간·주간에 자동 정리됩니다. **시작·종료 시간 범위**(2시부터 4시까지, 3-5pm)도 인식하며, 시작 시간만 있으면 종료를 +1시간으로 채워 편집할 수 있게 합니다. 기본은 LLM(Anthropic/OpenAI/DeepSeek) 파싱이며, 키가 없으면 내장 오프라인 파서가 한국어/영어 날짜·시간 표현을 처리합니다. 설정: `.env.example`의 `VITE_LLM_*` 참고.
- **주간 즉석 체크리스트** — Weekly의 각 날짜에서 공부 분량 입력 없이 바로 할 일을 추가/체크할 수 있습니다(학습 계획과 별도).
- **브레인스토밍 문서 모드** — Brainstorm의 "문서" 탭에서 노트 카드 대신 제목/부제목/소제목/글머리/본문 블록으로 글씨 크기를 달리해 자유롭게 작성할 수 있습니다.
- **날짜별 브레인스토밍 (Monthly + Alt+7)** — Monthly에서 날짜(날짜 숫자 클릭)를 선택한 뒤 `Alt + 7`을 누르면 그 날짜 전용 브레인스토밍 패널이 열립니다(위 문서 모드와 동일한 서식 블록). 내용이 있는 날짜에는 ✦ 표시가 뜹니다. (Weekly의 `Alt + 7`은 기존대로 선택 일정의 Diary를 엽니다.)
- **구글·애플 캘린더 실시간 연동** — 설정 방법은 [CALENDAR_SETUP.md](CALENDAR_SETUP.md) 참고(본인 Supabase·Google 계정 필요). 지금 바로는 캘린더 연동 → ICS 다운로드로 내보낼 수 있습니다.
- **아이폰 앱으로 설치 (PWA)** — 홈 화면에 추가하면 아이콘·전체화면·오프라인으로 앱처럼 실행됩니다. 매니페스트·아이콘·서비스워커 포함. 설치·배포 방법은 [INSTALL_IPHONE.md](INSTALL_IPHONE.md) 참고.

## Local development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5180`. To start a detached Windows preview server:

```bash
npm run dev:background
```

Quality commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env.local` and fill only the services you use.

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:5180
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
CALENDAR_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
```

Never expose the service-role key, Google secret, token encryption key, or cron secret through a `NEXT_PUBLIC_` variable.

## Demo Mode

Without external environment variables, plans, entries, comments, photos, and brainstorm boards are stored in the current browser. Sample data is created only by **Settings → Load sample data**. Google Connect explains the missing configuration instead of breaking the app. The server-backed private Apple feed requires Supabase; local `.ics` download remains available.

## Supabase setup

1. Create a Supabase project and configure your application URL in Authentication URL settings.
2. Apply migrations in order: `202608020100_dear_my_diary.sql`, then `202608020200_study_preferences.sql`.
3. Verify that the private `diary-images` Storage bucket was created.
4. Confirm RLS is enabled on all user-data tables and Storage objects are restricted to the authenticated user’s first path segment.
5. Deploy the Edge Functions under `supabase/functions` and add their server-only secrets.

Diary image object names must follow `{user_id}/{entry_id}/{random-file-name}`. Production clients should request signed URLs rather than making the bucket public.

## Google Calendar OAuth

1. In Google Cloud Console, enable Google Calendar API and configure the OAuth consent screen.
2. Create a Web OAuth client.
3. Add the deployed `google-calendar-callback` function URL as an authorized redirect URI.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Supabase Edge Function secrets.
5. Generate a 32-byte AES key, Base64-encode it, and set it as `CALENDAR_TOKEN_ENCRYPTION_KEY`.
6. Deploy `google-calendar-oauth-start`, `google-calendar-callback`, and `google-calendar-sync`.
7. Use **Calendar Sync → Connect Google Calendar**, then enable Auto-sync if desired.

OAuth state expires after ten minutes. Refresh tokens are encrypted server-side and are never written to localStorage or logs. The sync endpoint pushes pending local changes, pulls Google changes with an incremental sync token, preserves external identifiers, and records explicit sync errors. Add a scheduled server invocation or Google push notifications if unattended background sync is required.

## Apple Calendar subscription

1. Open **Calendar Sync → Apple Calendar Subscription**.
2. Deploy both `calendar-token` and `calendar-feed`, then issue or regenerate a private URL.
3. Copy the URL into Calendar on macOS via **File → New Calendar Subscription**, or on iPhone via **Settings → Calendar → Accounts → Add Subscribed Calendar**.
4. Choose a refresh interval.

The subscription is one-way: changes from DEAR MY DIARY appear after Apple refreshes, while changes made in Apple Calendar are not imported. Treat the URL like a password. The database stores only its SHA-256 hash; regenerating it revokes the previous token.

## Vercel deployment

Build with `npm run build` and deploy `dist` as a Vite static site. Configure SPA rewrites to `/index.html`. Add only public Supabase variables to Vercel’s client environment. Supabase Edge Functions remain the server runtime for OAuth, sync, private Storage operations, and ICS feeds. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin and update Supabase/Google redirect allowlists.

## Security notes

- Never log OAuth tokens or full private ICS URLs.
- Keep diary images in the private bucket and use short-lived signed URLs.
- Do not request Apple ID credentials; the Apple integration is an ICS subscription, not CalDAV.
- Soft-delete planner events so remote deletions can be synchronized safely.
- RLS and Storage policies are mandatory even when the UI checks ownership.

## Project map

```text
src/diary/
  components/              shared planner header and event editor
  pages/                   Monthly, Weekly, Diary, Brainstorm, Sync, Settings
  utils/                   date grid, shortcuts, RFC 5545 ICS
  repository.ts            Demo and authenticated Supabase repository boundary
  store.ts                 shared events and application state
  study/scheduler.ts       deterministic exact-sum study distribution engine
supabase/
  migrations/              diary plus preferences/study schema, constraints, RLS, Storage policy
  functions/               Google OAuth/sync and private ICS feed
tests/                     calendar, shortcut, canvas restore, ICS, RLS tests
references/                supplied visual references
```

## Current integration boundary

The planner, study-load scheduling, shared study checklists, diary, comments, brainstorm, authenticated Supabase persistence, private image upload, manual Google two-way sync, and Apple feed are implemented. Production use still requires real Supabase/Google credentials and deployed migrations/functions. Automatic background Google updates require a scheduler or Google push-notification worker; the included UI performs on-demand sync. Study-task Google updates are pushed on sync; remote Google edits are imported as regular planner events rather than rewriting deterministic study ranges.
