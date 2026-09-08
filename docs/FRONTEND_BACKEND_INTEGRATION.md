# Frontend–backend integration contract

All endpoints return `{ success: boolean, data?: T, message?: string, errors?: unknown }`. Authenticated browser requests send credentials so the backend can use a secure HTTP-only session cookie.

| Feature | Frontend method | Method and suggested endpoint | Request | Response data | Access |
|---|---|---|---|---|---|
| Register | `authService.register()` | `POST /api/auth/register` | `{ firstName, lastName, email, password, accountType }` | `{ user }` | Public |
| Login | `authService.login()` | `POST /api/auth/login` | `{ email, password }` | `{ user }` | Public |
| Current session | `authService.me()` | `GET /api/auth/me` | — | `{ user }` | Authenticated |
| Logout | `authService.logout()` | `POST /api/auth/logout` | — | `{}` | Authenticated |
| Search tutors | `tutorService.list()` | `GET /api/tutors` | Query: skill, price, availability, rating, country, experience, language, lessonType, sort, page | `{ items: Tutor[], pagination }` | Public |
| Tutor profile | `tutorService.detail()` | `GET /api/tutors/:id` | — | `{ tutor }` | Public |
| Save tutor | `favouriteService.toggle()` | `PUT /api/students/me/favourites/:tutorId` | `{ saved }` | `{ favouriteTutorIds }` | Student |
| Create booking | `bookingService.create()` | `POST /api/bookings` | `{ tutorId, lessonType, durationMinutes, startTime, timezone, studentNote, paymentMethodId? }` | `{ booking }` | Student |
| Availability | `bookingService.availability()` | `GET /api/tutors/:id/availability` | Query: startDate, endDate, timezone, durationMinutes | `{ slots: AvailabilitySlot[] }` | Public |
| Student lessons | `lessonService.list()` | `GET /api/student/lessons` | Query: status, page | `{ items: Lesson[], pagination }` | Student |
| Cancel lesson | `lessonService.cancel()` | `POST /api/lessons/:id/cancel` | `{ reason? }` | `{ lesson, refund? }` | Student/Tutor participant |
| Reschedule lesson | `lessonService.reschedule()` | `PATCH /api/lessons/:id/reschedule` | `{ startTime, timezone }` | `{ lesson }` | Student/Tutor participant |
| Conversation list | `messageService.conversations()` | `GET /api/conversations` | Query: cursor | `{ items: Conversation[], nextCursor? }` | Authenticated |
| Message history | `messageService.messages()` | `GET /api/conversations/:id/messages` | Query: cursor | `{ items: Message[], nextCursor? }` | Conversation member |
| Send message | `messageService.send()` | `POST /api/conversations/:id/messages` | `{ type, text?, code?, language?, attachmentId? }` | `{ message }` | Conversation member |
| Notifications | `notificationService.list()` | `GET /api/notifications` | Query: filter, cursor | `{ items: Notification[], unreadCount }` | Authenticated |
| Mark notifications read | `notificationService.markAllRead()` | `PATCH /api/notifications/read` | `{ ids?: string[], all?: boolean }` | `{ unreadCount }` | Authenticated |
| Learning paths | `learningPathService.list()` | `GET /api/learning-paths` | Query: level, enrolled | `{ items: LearningPath[] }` | Public/Student |
| Path progress | `learningPathService.completeLesson()` | `PUT /api/student/learning-paths/:pathId/lessons/:lessonId` | `{ completed }` | `{ enrollment }` | Student |
| Assignments | `assignmentService.list()` | `GET /api/assignments` | Query: status | `{ items: Assignment[] }` | Student/Tutor |
| Submit assignment | `assignmentService.submit()` | `POST /api/assignments/:id/submission` | `{ repositoryUrl?, code?, attachmentIds? }` | `{ assignment, submission }` | Assigned student |
| Review assignment | `assignmentService.review()` | `PATCH /api/assignments/:id/review` | `{ feedback, score }` | `{ assignment }` | Owning tutor |
| Create review | `reviewService.create()` | `POST /api/lessons/:lessonId/review` | `{ rating, writtenReview, teachingQuality, communication, knowledge }` | `{ review }` | Student participant |
| Student settings | `studentService.updateSettings()` | `PATCH /api/students/me` | Profile and preference fields | `{ student }` | Student |
| Tutor settings | `tutorService.updateProfile()` | `PATCH /api/tutors/me` | Tutor profile fields | `{ tutor }` | Tutor |
| Tutor availability | `availabilityService.update()` | `PUT /api/tutors/me/availability` | `{ timezone, weeklyPeriods, blockedDates, exceptions }` | `{ availability }` | Tutor |
| Payment methods | `paymentService.methods()` | `GET /api/payments/methods` | — | `{ items: PaymentMethod[] }` | Student |
| Transactions | `paymentService.transactions()` | `GET /api/payments/transactions` | Query: page, status | `{ items: Transaction[], pagination }` | Authenticated owner |
| Tutor earnings | `earningsService.summary()` | `GET /api/tutors/me/earnings` | Query: range | `{ balances, totals, chart, transactions }` | Tutor |
| Withdrawal | `earningsService.withdraw()` | `POST /api/tutors/me/withdrawals` | `{ amount, payoutMethodId }` | `{ withdrawal }` | Tutor |
| Admin users | `adminService.users()` | `GET /api/admin/users` | Query: role, status, search, page | `{ items: User[], pagination }` | Admin |
| Admin tutor action | `adminService.setTutorStatus()` | `PATCH /api/admin/tutors/:id/status` | `{ status, reason? }` | `{ tutor }` | Admin |
| Admin bookings | `adminService.bookings()` | `GET /api/admin/bookings` | Query: status, date, page | `{ items: Booking[], pagination }` | Admin |
| Admin skills | `adminService.skills()` | `GET/POST/PATCH /api/admin/skills` | Skill fields | `{ skill }` or `{ items }` | Admin |
| Admin learning paths | `adminService.learningPaths()` | `GET/POST/PATCH /api/admin/learning-paths` | Path, module, and lesson fields | `{ learningPath }` | Admin |

## Realtime and external integration points

- Messages, presence, typing state, lesson connection state, and collaborative notes expose typed frontend boundaries but need a future WebSocket or realtime transport.
- Payment controls are presentation-only. A gateway should return tokenized payment method identifiers; raw card details must never pass through the application API.
- The lesson editor is ready for a Monaco adapter. Code execution must use an isolated backend sandbox rather than the browser service layer.
- Calendar buttons need an `.ics` endpoint or provider integration. File controls need an authenticated upload-signing endpoint and attachment record.
