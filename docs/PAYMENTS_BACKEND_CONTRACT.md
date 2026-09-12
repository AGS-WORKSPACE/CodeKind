# Payments, wallets and appeals — backend contract

The frontend for hourly pricing, the session-payment ledger, appeals and multi-currency wallets is
complete and runs against offline repositories. This is what the backend has to provide to replace
them. Responses use the same envelope as the rest of the API: `{ success, data?, message?, errors? }`,
with credentials sent so the session cookie applies.

Design notes and the reasoning behind the model are in [PAYMENTS_LEDGER_PLAN.md](./PAYMENTS_LEDGER_PLAN.md).

## Money representation

- **Every amount is an integer in minor units** (cents, kobo, yen). No floats, no decimal strings.
- Each amount travels with an ISO 4217 `currency`. The supported set and their minor-unit exponents
  are in `src/lib/money.ts`; `JPY` has exponent 0, everything else 2.
- Commission is stored in **basis points** (`platformFeeBps`), so 15% is `1500`.
- A session payment never mixes currencies. Cross-currency is a future swap feature.

## Billing rules the server must own

```
billedMinutes = min(ceil(attendedSeconds / 60), scheduledMinutes)
gross         = ceil(hourlyRate × billedMinutes / 60)
platformFee   = round(gross × platformFeeBps / 10000)
net           = gross − platformFee
heldAtBooking = ceil(hourlyRate × scheduledMinutes / 60)
maturesAt     = endedAt + 24 hours
```

The rate comes from the tutor for a direct booking and from the **learner's ad** for an ad-sourced
session. Because the bill is capped at the scheduled duration, a capture can never exceed its hold.

## Wallets

| Action | Frontend method | Endpoint | Request | Response | Access |
|---|---|---|---|---|---|
| List wallets | `walletService.list()` | `GET /api/wallets?ownerId=` | — | `{ wallets: Wallet[] }` | Owner or admin |
| Wallet entries | `walletService.entries()` | `GET /api/wallets/entries?ownerId=&currency=` | — | `{ entries: WalletEntry[] }` | Owner or admin |
| Add a currency | `walletService.addCurrency()` | `POST /api/wallets` | `{ ownerId, ownerType, currency }` | `{ wallet }` | Owner |
| Top up | `walletService.topUp()` | `POST /api/wallets/top-ups` | `{ ownerId, currency, amount, method }` | `{ topUp }` | Owner |
| List withdrawals | `walletService.withdrawals()` | `GET /api/wallets/withdrawals?ownerId=` | — | `{ withdrawals: Withdrawal[] }` | Owner or admin |
| Withdraw | `walletService.withdraw()` | `POST /api/wallets/withdrawals` | `{ ownerId, currency, amount, destination }` | `{ withdrawal }` | Owner |

A wallet has `available` and `reserved`. Escrow moves money from `available` into `reserved`; it is
still the owner's, but it cannot be spent or withdrawn. **Withdrawals may only ever draw on
`available`.** Wallet owners are `USER`, `ORG` or `PLATFORM`; platform wallets (clearing and revenue)
are internal and must never be returned from these endpoints.

Every movement writes a `WalletEntry` on both sides carrying `direction`, `kind`, `amount`,
`balanceAfter`, the counterparty wallet, and a reference to what caused it. A wallet's balance must
be reconstructible by replaying its entries.

## Session payments

| Action | Frontend method | Endpoint | Request | Response | Access |
|---|---|---|---|---|---|
| List | `ledgerService.payments()` | `GET /api/session-payments?payerId=&payeeId=&status=` | — | `{ items: SessionPayment[] }` | Party or admin |
| One payment | `ledgerService.payment()` | `GET /api/session-payments/:id` | — | `{ payment }` | Party or admin |
| By session | `ledgerService.bySession()` | `GET /api/session-payments/by-session/:sessionId` | — | `{ payment \| null }` | Party or admin |
| Book (escrow) | `ledgerService.create()` | `POST /api/session-payments` | `{ sessionId, source, adId?, payerId, payerType, payerName, payeeId, payeeName, payeeOrgId?, topic, currency, hourlyRate, scheduledMinutes }` | `{ payment }` | Payer |
| Settle | `ledgerService.settle()` | `POST /api/session-payments/:id/settle` | `{ attendedSeconds }` | `{ payment }` | System or tutor |
| Cancel | `ledgerService.cancel()` | `POST /api/session-payments/:id/cancel` | `{ reason }` | `{ payment }` | Party or admin |
| Tutor earnings | `ledgerService.earnings()` | `GET /api/session-payments/earnings?payeeId=` | — | `{ summaries: EarningsSummary[] }` | Payee or admin |

**Status lifecycle**

```
HELD ──settle──▶ PENDING ──24h, no appeal──▶ PAID
  │                 │
  │                 └──appeal──▶ FLAGGED ──admin resolves──▶ APPEAL_SETTLEMENT
  └──cancel──▶ CANCELLED
```

**Money movement per transition**

| Transition | Movement |
|---|---|
| Booking | payer `available` → payer `reserved` (`heldAmount`) |
| Settle | `reserved` → platform clearing (`gross`); `heldAmount − gross` released to payer `available` |
| Mature | clearing → payee `available` (`net`); clearing → platform revenue (`platformFee`) |
| Cancel | `reserved` → payer `available` (whole hold) |
| Appeal settlement | clearing → appellant and/or respondent; remainder → platform revenue |

Maturity is a **scheduled server job**, not a client call: everything `PENDING` whose `maturesAt` has
passed and that carries no open appeal is paid out. `FLAGGED` rows are never swept. The frontend has
a preview-only "skip grace" control with no backend counterpart (`ledgerService.fastForwardGrace`) —
do not implement it.

Keeping the captured gross in a clearing wallet until maturity is deliberate: a tutor's pending
balance is a ledger figure, not spendable money, so a settlement never has to claw back funds that
have already been withdrawn.

## Appeals

| Action | Frontend method | Endpoint | Request | Response | Access |
|---|---|---|---|---|---|
| List | `ledgerService.appeals()` | `GET /api/appeals?appellantId=&respondentId=&status=` | — | `{ items: Appeal[] }` | Party or admin |
| One appeal | `ledgerService.appeal()` | `GET /api/appeals/:id` | — | `{ appeal }` | Party or admin |
| Open | `ledgerService.openAppeal()` | `POST /api/appeals` | `{ sessionPaymentId, appellantId, reason, details }` | `{ appeal }` | Payer of that session |
| Withdraw | `ledgerService.withdrawAppeal()` | `POST /api/appeals/:id/withdraw` | — | `{ appeal }` | Appellant |
| Resolve | `ledgerService.resolveAppeal()` | `POST /api/admin/appeals/:id/resolve` | `{ appellantAmount, respondentAmount, note, resolvedBy }` | `{ appeal }` | Admin (`appeals.resolve`) |

Rules the server must enforce, not the client:

- Only the **payer** of a session may appeal it.
- An appeal may be opened only while the payment is `PENDING` **and** `now < maturesAt`.
- Opening an appeal sets the payment to `FLAGGED`; withdrawing one returns it to `PENDING` with its
  original `maturesAt` (so a withdrawn appeal past the deadline matures on the next sweep).
- `appellantAmount + respondentAmount` may not exceed the session's `grossAmount`; neither may be
  negative. Whatever is not awarded is retained as platform revenue and recorded in
  `settlement.platformRetained`.
- Resolution sets the payment to `APPEAL_SETTLEMENT` and stores the settlement with the amounts, the
  note, who decided, and when. The status never returns to `PENDING` or `PAID`.
- Resolution is manual. There is no automatic or timed resolution path.

Suggested permission keys, matching the existing admin set: `session_payments.read`,
`appeals.read`, `appeals.resolve`, `wallets.read`, `wallets.adjust`.

## Learning ads

| Action | Frontend method | Endpoint | Request | Response | Access |
|---|---|---|---|---|---|
| Open ad board | `learningAdsService.board()` | `GET /api/learning-ads?skill=` | — | `{ items: LearningAd[] }` | Tutor |
| Learner's ads | `learningAdsService.byLearner()` | `GET /api/learning-ads?learnerId=` | — | `{ items: LearningAd[] }` | Owner |
| One ad | `learningAdsService.ad()` | `GET /api/learning-ads/:id` | — | `{ ad }` | Authenticated |
| Post an ad | `learningAdsService.create()` | `POST /api/learning-ads` | `{ learnerId, learnerName, title, description, skill, level, currency, hourlyRate, sessionMinutes, preferredTimes, openForDays? }` | `{ ad }` | Learner |
| Close an ad | `learningAdsService.close()` | `POST /api/learning-ads/:id/close` | — | `{ ad }` | Owner |
| Applications on an ad | `learningAdsService.applications()` | `GET /api/learning-ads/:id/applications` | — | `{ items: TutorApplication[] }` | Ad owner |
| A tutor's applications | `learningAdsService.byTutor()` | `GET /api/learning-ads/applications?tutorId=` | — | `{ items: TutorApplication[] }` | That tutor |
| Apply | `learningAdsService.apply()` | `POST /api/learning-ads/:id/applications` | `{ tutorId, tutorName, headline, rating, message }` | `{ application }` | Tutor |
| Shortlist / decline | `learningAdsService.shortlist()` / `.decline()` | `PATCH /api/learning-ads/applications/:id` | `{ status }` | `{ application }` | Ad owner |
| Accept and book | `learningAdsService.accept()` | `POST /api/learning-ads/applications/:id/accept` | — | `{ ad, application, payment }` | Ad owner |

Accepting **must be atomic**: it books the session at the **ad's** rate and currency, escrows it from
the learner's wallet, marks the application `ACCEPTED`, declines the others, and sets the ad to
`FILLED`. An accepted application with no funded session must not be possible. A tutor may not apply
twice to the same ad, and a closed or filled ad takes no further applications.

## Errors

The frontend surfaces `message` from the envelope directly, so these should be human-readable and
safe to show:

- insufficient balance for an escrow or withdrawal
- no wallet in the session's currency
- appeal window closed, or appellant is not the payer
- settlement exceeds what the session collected
- ad closed, already applied, or already filled

An `ApiError` (a real 4xx/5xx response) is shown to the user; only an unreachable API falls back to
the offline repositories, so validation failures must come back as proper error responses rather
than as empty successes.
