# Pairlore admin frontend/backend contract

The admin control centre is frontend-only. The backend developer can connect it through these suggested contracts. Responses should use a consistent envelope containing success, data, optional message, and optional errors.

| Frontend action | Suggested endpoint | Method | Request | Permission |
|---|---|---|---|---|
| Dashboard metrics | /api/admin/dashboard | GET | range query | dashboard.read |
| Global search | /api/admin/search | GET | q query | platform.search |
| List or view students | /api/admin/students, /api/admin/students/:id | GET | filters and pagination | students.read |
| Suspend or restore student | /api/admin/students/:id/status | PATCH | status, reason | students.suspend |
| List or view tutors | /api/admin/tutors, /api/admin/tutors/:id | GET | filters and pagination | tutors.read |
| Approve tutor | /api/admin/tutors/:id/approve | PATCH | optional note | tutors.approve |
| Reject tutor | /api/admin/tutors/:id/reject | PATCH | reason | tutors.approve |
| Edit or suspend tutor | /api/admin/tutors/:id | PATCH | changed fields, reason | tutors.edit or tutors.suspend |
| Review application | /api/admin/tutor-applications/:id | GET | none | tutors.read |
| Decide application | /api/admin/tutor-applications/:id/decision | PATCH | decision, reason, note | tutors.approve |
| Review verification | /api/admin/tutor-verification/:id | PATCH | type, status, reason | tutors.verify |
| List or view bookings | /api/admin/bookings, /api/admin/bookings/:id | GET | filters and pagination | bookings.read |
| Cancel booking | /api/admin/bookings/:id/cancel | PATCH | reason | bookings.cancel |
| Transactions | /api/admin/transactions, /api/admin/transactions/:id | GET | filters and pagination | transactions.read |
| Decide refund | /api/admin/refunds/:id/decision | PATCH | decision, reason, amount | refunds.approve |
| Decide withdrawal | /api/admin/withdrawals/:id/decision | PATCH | decision, reason | withdrawals.approve |
| Resolve dispute | /api/admin/disputes/:id/resolve | PATCH | resolution, note, refundAmount | disputes.resolve |
| Create or edit skill | /api/admin/skills, /api/admin/skills/:id | POST or PATCH | skill fields | skills.manage |
| Create or edit path | /api/admin/learning-paths, /api/admin/learning-paths/:id | POST or PATCH | path and curriculum | learning_paths.create or learning_paths.edit |
| Publish path | /api/admin/learning-paths/:id/publish | PATCH | published | learning_paths.publish |
| Create notification | /api/admin/notifications | POST | title, message, audience, CTA, schedule | notifications.manage |
| Update settings | /api/admin/settings | PATCH | PlatformSettings | settings.manage |
| Update feature flags | /api/admin/settings/features | PATCH | FeatureFlag array | settings.manage |
| Manage admin users | /api/admin/admin-users/:id | POST or PATCH | user, role, permissions | admin_users.manage |
| Read audit log | /api/admin/audit-logs | GET | filters and pagination | audit_logs.read |

Suggested permission keys include dashboard.read, platform.search, students.read, students.suspend, tutors.read, tutors.approve, tutors.verify, tutors.edit, tutors.suspend, bookings.read, bookings.cancel, transactions.read, refunds.read, refunds.approve, withdrawals.read, withdrawals.approve, disputes.read, disputes.resolve, learning_paths.read, learning_paths.create, learning_paths.edit, learning_paths.publish, skills.manage, reports.read, reports.resolve, notifications.manage, settings.manage, admin_users.manage, and audit_logs.read.
