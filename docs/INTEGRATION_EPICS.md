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
| Wallets and payments (epic 7) | 🟡 | Backend done, including Flutterwave top-ups and withdrawals. The UI still runs on demo money. |
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
- Tutor profile page shows real fields; hide rating, reviews and lesson counts until epic 9.
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

## 7. Wallets and payments 🟡

The ledger UI already exists and runs on demo data behind `ledgerService` and `walletService`.

**UI**
- Switch both services to the real endpoints in `docs/PAYMENTS_BACKEND_CONTRACT.md`.
- Booking holds the escrow in the same request that creates the booking, not in two calls.

**Backend**
- Done: wallets and ledger, escrow at booking (trial rate on a first session, free lessons at zero),
  settlement from the session evidence, the grace sweep, appeals, admin credits, and the settings
  and permissions behind them.
- Done: top-ups and withdrawals through Flutterwave, behind a provider interface chosen by currency,
  with webhooks that are verified with the provider before any money moves.
- Left: the UI, in `docs/PAYMENTS_BACKEND_CONTRACT.md` order.

**Done when** booking holds real money, settling pays the tutor after the grace period, and demo
wallets are deleted.

## 8. Live sessions

**UI**
- Ending the session marks the booking completed and settles payment, using the evidence summary
  (joins, leaves and media samples are already recorded).
- Summary page reads the settled booking and payment.

**Backend**
- A `completed` transition on bookings, and a durable evidence row written with the settlement.
- Signaling and STUN/TURN are done: the room connects through PairloreSignal when the API has
  `SIGNAL_URL`, and demo tabs (`?as=`) still use the browser-only channel.

## 9. Reviews and ratings

**UI**
- "Leave a review" on the lesson summary; ratings and review counts on tutor cards and profile.

**Backend**
- `POST /bookings/:id/review`, rating aggregates on the tutor profile.

## 10. Messages

**UI**
- Conversation list, history and sending on `/student/messages` and `/tutor/messages`.
- A new message raises a notification.

**Backend:** conversations and messages; realtime delivery later.

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
