# Session payments, wallets and appeals — implementation plan

Branch: `feat/session-payments-wallets`

This plan covers hourly pricing, per-minute settlement, the session-payment ledger, the 24-hour
grace period, appeals, and multi-currency wallets. It follows the existing frontend architecture:
types → mock repository (persisted, offline) → service (API first, mock fallback) → screens, with a
backend contract written alongside so the API can be built against it.

## 1. Decisions this plan is built on

| Decision | Choice |
|---|---|
| Funds flow | Escrow at booking. The payer's wallet is debited into a platform clearing wallet when the session is booked. Settlement happens at session end; the unused remainder is returned. |
| Platform fee | Taken per session. The ledger records gross, fee, and net-to-tutor separately; only net reaches the tutor. The rate comes from `PlatformSettings.commission`. |
| Billing basis | Actual attended minutes, rounded **up** to the whole minute, capped at the scheduled duration so the escrow always covers the bill. |
| Rate source | A direct booking uses the **tutor's** hourly rate. A session created from a learning ad uses the **learner's** advertised hourly rate. |
| Currency | Every session-payment carries one currency. The payer pays from their wallet in that currency and the tutor is paid in the same currency — no FX. Swap is a later update. |

## 2. Money rules

All amounts are integers in **minor units** (cents, kobo…) — never floats. A currency table carries
the minor-unit exponent, so zero-decimal currencies (JPY) work without special cases.

```
billedMinutes = min(ceil(attendedSeconds / 60), scheduledMinutes)
gross         = ceil(hourlyRateMinor × billedMinutes / 60)
platformFee   = round(gross × commissionBps / 10000)
net           = gross − platformFee
```

Worked example from the brief: $10/h for 10 minutes → `ceil(1000 × 10 / 60)` = 167 minor = **$1.67**,
which is the 0.167/min figure.

The escrow taken at booking is the full scheduled duration: `ceil(hourlyRateMinor × scheduledMinutes / 60)`.
Because the bill is capped at the scheduled duration, a capture can never exceed its hold.

## 3. Money movement

Four wallet owners take part: the payer (learner or organisation), the tutor, a **platform clearing**
wallet that holds escrowed money in flight, and a **platform revenue** wallet that keeps fees.

| Event | Movement | Session-payment status |
|---|---|---|
| Booking created / ad application accepted | payer `available` → payer `reserved` (hold) | `HELD` |
| Session ends | hold → platform clearing (gross); remainder released to payer `available` | `PENDING` |
| No appeal, 24h elapsed | clearing → tutor `available` (net), clearing → platform revenue (fee) | `PAID` |
| Appeal opened inside the window | nothing moves; maturity is blocked | `FLAGGED` |
| Admin resolves the appeal | clearing → appellant and/or respondent by the amounts the admin specifies; anything left → platform revenue | `APPEAL_SETTLEMENT` |
| Booking cancelled before the session | hold released to payer `available` | `CANCELLED` |

Holding the captured gross in the clearing wallet until maturity is what makes appeals clean: the
tutor's pending balance is a ledger figure, not spendable money, so a settlement never has to claw
back funds that have already been withdrawn.

Every movement writes a `WalletEntry` on both sides with a running `balanceAfter` and a reference
back to the session-payment, so a wallet's balance is always reconstructible from its entries.

## 4. Status lifecycle

```
HELD ──session ends──▶ PENDING ──24h, no appeal──▶ PAID
  │                      │
  │                      └──appeal opened──▶ FLAGGED ──admin resolves──▶ APPEAL_SETTLEMENT
  └──cancelled──▶ CANCELLED
```

Rules enforced in the repository, not in the UI:
- An appeal may only be opened while the payment is `PENDING` and `now < maturesAt`.
- A `FLAGGED` payment never matures, however long it sits past the 24 hours.
- A settlement's `appellantAmount + respondentAmount` may not exceed the captured gross.
- Only the payer of a session may appeal it; only an admin may resolve.

## 5. Learning ads

A learner posts an ad carrying the subject, session length, and **their own** hourly rate and
currency. Tutors apply; the learner accepts one application, which books the session at the ad's
rate and escrows from the learner's wallet exactly like a direct booking. The ad then closes.

## 6. Files

**Types**
- `src/types/payments.ts` — currency, money, wallets, wallet entries, session payments, appeals, top-ups, withdrawals.
- `src/types/learning-ads.ts` — learning ads and tutor applications.

**Domain (pure, no React, no storage)**
- `src/lib/money.ts` — currency table, minor-unit arithmetic, formatting, proration, fee split.

**Persistence (offline stand-in, same pattern as `src/mocks/org.repository.ts`)**
- `src/mocks/payments.store.ts` — the persisted store, seed data, and the transfer/hold/capture primitives that keep wallets and the ledger consistent.
- `src/mocks/wallet.repository.ts`, `src/mocks/ledger.repository.ts`, `src/mocks/learning-ads.repository.ts`.

**Services (API first, mock fallback)**
- `src/services/wallet.service.ts`, `src/services/ledger.service.ts`, `src/services/learning-ads.service.ts`.

**Screens**
- `src/wallet-pages.tsx` — balances per currency, entry history, top up, withdraw, swap (disabled, labelled as coming).
- `src/ledger-pages.tsx` — the learner's session payments with an appeal action, the tutor's pending/paid earnings, and the appeal detail.
- `src/learning-ads-pages.tsx` — the learner's ads and applicants, and the tutor's ad board.
- `src/admin-control.tsx` — new Finance sections for the session-payment ledger and for appeal resolution.
- `src/styles15.css` — styles for the above, imported from `src/main.tsx` alongside the existing sheets.

**Wiring**
- Routes in `src/App.tsx`, sidebar entries in `src/components.tsx`.
- Escrow shown at the payment step of `src/booking-frontend.tsx`.
- Settlement triggered from the end of a session in `src/classroom/LessonSummary.tsx`.

**Docs**
- `docs/PAYMENTS_BACKEND_CONTRACT.md` — endpoints, requests, responses, permissions.

## 7. Order of work

1. Types and the money library.
2. The store with its transfer primitives, then the three repositories over it.
3. Services with the API-first fallback.
4. Wallet screens, then ledger and appeal screens, then learning ads.
5. Admin ledger and appeal-resolution sections.
6. Routes, navigation, booking and lesson-end wiring.
7. `npm run typecheck` and `npm run build`, then the backend contract doc.

## 8. Notes for the backend

- Maturity is a scheduled job server-side. The frontend store sweeps matured rows on read so the
  offline preview behaves the same way; the preview also exposes a "fast-forward grace" control so
  the transition can be demonstrated without waiting a day.
- Balances must never be computed from floats or stored as decimals in the client.
- The clearing and revenue wallets belong to the platform, not to any user, and must not be exposed
  through user-facing wallet endpoints.
