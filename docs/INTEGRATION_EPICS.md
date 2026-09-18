# Integration epics

The order in which the frontend moves from demo data to the Go backend. Each epic is ordered so the
ones before it unblock it. Endpoints are relative to `/api/v1`.

**Status:** ✅ done · 🟡 partly done · ⬜ not started

## Ground rules

- Every service keeps its offline fallback: an `ApiError` means the backend answered and is shown to
  the user; a failed connection falls back to demo data.
- When an epic lands, delete the mock data and mock-only code it replaces.
- Every live panel has a loading, an empty and an error state. No invented numbers on a live page.
- Leave `VITE_API_URL` unset locally and in deploys; the proxy or host rewrite keeps `/api` same-origin.

## Done so far

| Epic | Status | Notes |
| --- | --- | --- |
| Sign-up, login and workspaces | ✅ | Cookie session, workspace picker. |
| Reference lists | ✅ | Countries, timezones and skills come from `/reference`. |
| Account and tutor profile settings | ✅ | `/account/*`, `/tutor/profile`. |
| Notifications | ✅ | Inbox, read state, unread dot. |
| Tutor calendar | ✅ | Week view from `/bookings`. |
| One account, several workspaces | ✅ | Add learning or teaching; switch from the avatar menu. |
| Admin error log | ✅ | `/admin/error-log`, for admins signed in to the admin workspace. |
| Account safety (epic 1) | ✅ | Verify email, forgot and reset password, route guards. |
| Tutor discovery (epic 2) | ✅ | Search, filters, sort and pages on `/tutors`; real profile page. |
| Tutor approval (epic 3) | ✅ | Admin applications page with approve and ask-for-changes. |
| Booking and lessons (epic 4) | ✅ | Free times only, lessons tabs, reschedule, cancel; lobby and room read the booking. |
| Tutor search | ✅ | Keywords plus meaning (pgvector + Ollama), merged by rank fusion. |
| Session telemetry | ✅ | Join/leave seen by the server, browser samples every 10s, evidence summary and admin page. |
| Reference lists admin | ✅ | Show or hide skills, countries, timezones and currencies at `/admin/reference-lists`. |
| Tutor dashboard (epic 5) | ✅ | Today, next session, active students, hours taught and profile status. |
| My students (epic 6) | ✅ | Active and previous learners from `/tutor/students`. |
| Live call connections | ✅ | Signaling service (PairloreSignal), tickets and STUN/TURN from `/sessions/:id/connect`. |
| Wallets and payments (epic 7) | ✅ | Wallets, escrow, settlement, appeals, Flutterwave top-ups and withdrawals, and the admin money pages. |
| Live sessions (epic 8) | ✅ | Ending completes the booking and settles it; the evidence is kept; the summary reads the booking. |
| Reviews and ratings (epic 9) | ✅ | Learners review a finished session; ratings on cards, profiles, search and the tutor dashboard. |
| Messages (epic 10) | ✅ | Conversations between two people who share a session, with unread counts and notifications. |
| Demo pages retired | ✅ | Home, the admin centre and the workspace pages either read the API or say plainly what is not built. |
| Student dashboard | 🟡 | Name, stats, next session and suggested tutors are live. Path and assignments wait on epics 11–12. |

---

## 1. Account safety ✅

Booking needs a verified email, so this comes before anything else.

**UI**
- `/verify-email?token=` calls `POST /auth/verify-email` and shows success, expired or invalid.
- Forgot and reset password pages call `POST /auth/forgot-password` and `POST /auth/reset-password`.
- `ProtectedRoute` actually guards routes: redirect to login when signed out, and to the workspace
  picker when the role does not match.
- Refresh `user.emailVerified` after verifying, so the dashboard banner disappears.

**Backend:** ready.

**Done when** a new account can verify, reset its password, and cannot open another role's pages.

## 2. Tutor discovery ✅

**UI**
- Tutors page sends `skill`, `q` and `page` to `GET /tutors` and uses its pagination. Remove filters
  the backend does not support yet (rating, availability) rather than faking them.
- Tutor profile page shows real fields; ratings and reviews arrived with epic 9, lesson counts later.
- Tutor onboarding drops step 6 (weekly availability).

**Backend:** `GET /tutors` takes `skill`, `q`, `language`, `maxPrice`, `experience`, `sort` and `page`.

**Done when** an approved tutor can be found by skill and name and their page shows only real data.

## 3. Tutor approval ✅

No tutor is bookable until an admin approves them.

**UI**
- Admin applications page lists submitted profiles, with approve and reject actions.

**Backend**
- `GET /admin/tutors?status=submitted`.
- `PATCH /admin/tutors/:id`, with an optional `reason` sent to the tutor.

**Done when** an admin signed in with the admin workspace approves a tutor and they appear in search.

## 4. Booking and lessons ✅

**UI**
- Booking flow offers times that are actually free: no fixed time list, no past dates.
- My Lessons reads `GET /bookings` for all three tabs: upcoming, completed, cancelled.
- Cancel and reschedule use `POST /bookings/:id/cancel` and `/reschedule`, with the clash and
  "only before it starts" errors shown in the modal.
- Lesson lobby and room read the booking instead of the payment record.

**Backend**
- `GET /tutors/:id/busy?from=&to=` so booking only offers free times.
- `GET /bookings?view=upcoming|past|cancelled&page=` for the lessons page.

**Done when** a learner books, reschedules and cancels, and both sides see the same thing.

## 5. Tutor dashboard ✅

**UI**
- `TutorDashboard` replaces the demo `Dashboard`; `ScheduledSessions` and `NextSessionPanel` are deleted.
- Today's sessions, upcoming count and hours taught come from `GET /bookings`; active students from
  `GET /tutor/students`.
- Profile status card links to settings until the profile is approved.
- Earnings and rating cards return with epics 7 and 9, rather than showing invented numbers.

**Backend:** ready.

## 6. My students ✅

**UI**
- `/tutor/students` lists learners in active and previous tabs: learning goal, skills, sessions held
  and booked, and the next or last session.

**Backend**
- `GET /tutor/students?view=active|previous&page=`, grouped server-side with counts for both tabs.

## 7. Wallets and payments ✅

**UI**
- `ledgerService` and `walletService` call the real endpoints; the demo ledger and wallet
  repositories are deleted. Money has no offline fallback: a balance the backend did not send is
  not shown at all.
- Booking holds the escrow inside the booking request, so there is no second call to undo.
- Ending a session settles it; the summary reads what the server billed.
- Admin gains Money Settings (commission, grace period, limits), Wallet Credits and live Appeals.
  The mock finance and disputes sections they replace are gone.
- Organisation wallets say plainly that they wait for epic 14.

**Backend**
- Done: wallets and ledger, escrow at booking (trial rate on a first session, free lessons at zero),
  settlement from the session evidence, the grace sweep, appeals, admin credits, and the settings
  and permissions behind them.
- Done: top-ups and withdrawals through Flutterwave, behind a provider interface chosen by currency,
  with webhooks that are verified with the provider before any money moves.
**Left for later epics:** learning-ad bookings still run on the demo store (epic 13), and
organisation wallets wait for epic 14.

**Done when** booking holds real money, settling pays the tutor after the grace period, and demo
wallets are deleted.

## 8. Live sessions ✅

**UI**
- The summary reads the booking and the settled payment: the real topic, skill, date, the other
  person and the minutes billed. The demo lesson content, the invented tutor form and the
  "preview the other view" toggle are gone.
- Which side you see comes from the booking, not from a button.

**Backend**
- Ending a session completes the booking and settles it, and the evidence it was billed from is
  kept in `session_evidence`. Session events are dropped after their retention; an appeal weeks
  later still reads what the bill was made from, and a later join cannot rewrite it.
- A sweep closes sessions neither side ended, an hour after they were due to finish, so escrow is
  never held for ever.
- Signaling and STUN/TURN are done: the room connects through PairloreSignal when the API has
  `SIGNAL_URL`, and demo tabs (`?as=`) still use the browser-only channel.

**Left for later epics:** homework joins the summary with epic 11. The review is there already.

## 9. Reviews and ratings ✅

**UI**
- The lesson summary asks the learner for stars and a comment, and shows what they wrote when they
  come back. Sending it again replaces it.
- Ratings and review counts on tutor cards, the tutor profile (with the reviews themselves), the
  "Best reviewed" sort, and the tutor dashboard.
- `/tutor/reviews` is a real page instead of the notifications page.

**Backend**
- `POST /bookings/:id/review` — the learner of a completed session only, one to five stars.
  `GET /bookings/:id/review`, `GET /tutors/:id/reviews`, `GET /reviews/latest`.
- The average and count live on the tutor profile, so lists and sorting need no join. A first
  review notifies the tutor; edits do not.

## Demo pages retired ✅

The pages that showed invented content now either read the API or say what is missing.

- **Home** reads real tutors (best reviewed first), real subjects from the skill list, and real
  reviews. The invented testimonials, the fake customer logo strip and the "4.9 from 12,000+
  sessions" claim are gone; `GET /stats` supplies the numbers, and each one is hidden until there
  is something to count.
- **Assignments and learning paths** keep their routes and say plainly that they are not
  built yet, with the fake conversation, demo assignments and invented curriculum deleted. They
  come back with epics 11 and 12. Messages arrived with epic 10.
- **The admin control centre** shows real counts, applications waiting and open appeals. Every
  section still without a backend says so rather than showing a demo table, and the mock admin
  repository is deleted. Epic 15 fills them in.
- Dead demo components (`AdminDashboard`, the old `Booking` flow, the old `LessonRoom`,
  `AdminManagement`) are deleted with the mock data they read.

## 10. Messages ✅

**UI**
- `/student/messages` and `/tutor/messages` list everyone you teach or learn from, with the last
  thing said and what is unread. `/…/messages/:id` opens one thread.
- "Message" buttons on a lesson and on My Students open the thread with that person.
- The open page polls every ten seconds, so a reply arrives without a reload. Live delivery is a
  later change; nothing about the UI has to move for it.

**Backend**
- `GET /conversations`, `POST /conversations` (open or find one), `GET /conversations/:id/messages`
  (oldest first, and reading marks it read), `POST /conversations/:id/messages`.
- A conversation only exists between two people who share a booking, so strangers cannot write to
  each other. Read state is one timestamp per side.
- The first message after the other person is up to date raises a notification; a burst raises one.

## 11. Assignments

**UI**
- Tutor creates and reviews work; learner submits it. Dashboard assignments panel goes live.

**Backend:** assignments and submissions, linked to a booking.

## 12. Learning paths

**UI**
- Enrol, track module progress, and show the current path on the student dashboard.

**Backend:** paths, enrolments and progress.

## 13. Learning ads

**UI**
- The ad board, tutor applications and turning an accepted application into a booking run on the
  backend.

**Backend:** ads and applications; conversion writes a booking and its escrow (epics 4 and 7).

## 14. Organisations

**UI**
- Organisation dashboard, trainers and invitations use real members.

**Backend:** invitations, trainer membership, and organisation wallets.

## 15. Admin control centre

**UI**
- Users, bookings, disputes and platform settings on real data.

**Backend:** admin list endpoints.
