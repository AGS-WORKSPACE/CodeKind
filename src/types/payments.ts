/** Money is always integer minor units (cents, kobo, …). Never a float, never a decimal string. */
export type CurrencyCode='USD'|'NGN'|'GBP'|'EUR'|'KES'|'GHS'|'ZAR'|'INR'|'CAD'|'JPY';

export type WalletOwnerType='USER'|'ORG'|'PLATFORM';

/**
 * One wallet per owner per currency. `available` is spendable; `reserved` is escrow held against
 * booked sessions — it still belongs to the owner but cannot be spent or withdrawn.
 */
export type Wallet={
 id:string;
 ownerId:string;
 ownerType:WalletOwnerType;
 currency:CurrencyCode;
 available:number;
 reserved:number;
 /** The owner's native token: the currency they are paid in and see first. */
 isDefault:boolean;
 createdAt:string;
};

export type WalletEntryKind='TOPUP'|'WITHDRAWAL'|'HOLD'|'RELEASE'|'CAPTURE'|'SESSION_EARNING'|'PLATFORM_FEE'|'APPEAL_SETTLEMENT'|'REFUND'|'ADJUSTMENT';
export type EntryReference={type:'SESSION_PAYMENT'|'APPEAL'|'TOPUP'|'WITHDRAWAL'|'ADJUSTMENT';id:string};

/** An immutable line on a wallet. Balances are reconstructible by replaying these in order. */
export type WalletEntry={
 id:string;
 walletId:string;
 ownerId:string;
 currency:CurrencyCode;
 direction:'CREDIT'|'DEBIT';
 kind:WalletEntryKind;
 amount:number;
 /** Available balance after this entry, so a statement never has to re-add the column. */
 balanceAfter:number;
 counterpartyWalletId?:string;
 reference?:EntryReference;
 description:string;
 createdAt:string;
};

export type SessionPaymentStatus='HELD'|'PENDING'|'PAID'|'FLAGGED'|'APPEAL_SETTLEMENT'|'CANCELLED';
export type SessionPaymentSource='DIRECT_BOOKING'|'LEARNING_AD';

/**
 * The ledger row for one session. Created at booking with the escrow hold, settled when the
 * session ends, and matured 24 hours later unless an appeal flags it.
 */
export type SessionPayment={
 id:string;
 sessionId:string;
 source:SessionPaymentSource;
 payerId:string;
 payerType:'USER'|'ORG';
 payerName:string;
 payeeId:string;
 payeeName:string;
 /** Set when the tutor teaches under an organisation, which is then the earning party. */
 payeeOrgId?:string;
 topic:string;
 /** Subject badge for the session card; the topic alone reads poorly in a list. */
 skill?:string;
 /** When the session is scheduled to start. Absent on seeded history that predates scheduling. */
 startsAt?:string;
 currency:CurrencyCode;
 hourlyRate:number;
 scheduledMinutes:number;
 /** Null until the session ends. Attended minutes, rounded up, capped at scheduledMinutes. */
 billedMinutes:number|null;
 /** The escrow taken at booking: the full scheduled duration at the hourly rate. */
 heldAmount:number;
 grossAmount:number;
 platformFeeBps:number;
 platformFee:number;
 netAmount:number;
 status:SessionPaymentStatus;
 createdAt:string;
 startedAt?:string;
 endedAt?:string;
 /** When the grace period started — the moment the session was settled. */
 pendingSince?:string;
 /** pendingSince + 24h. A FLAGGED row ignores this until the appeal is resolved. */
 maturesAt?:string;
 paidAt?:string;
};

export type AppealReason='TUTOR_NO_SHOW'|'LEFT_EARLY'|'WRONG_DURATION'|'QUALITY'|'OTHER';
export type AppealStatus='OPEN'|'UNDER_REVIEW'|'RESOLVED'|'REJECTED'|'WITHDRAWN';

export type Appeal={
 id:string;
 sessionPaymentId:string;
 appellantId:string;
 appellantName:string;
 respondentId:string;
 respondentName:string;
 reason:AppealReason;
 details:string;
 status:AppealStatus;
 createdAt:string;
 /** Set once an admin has decided how the money is split. */
 appellantAmount?:number;
 respondentAmount?:number;
 platformRetained?:number;
 resolutionNote?:string;
 resolvedAt?:string;
};

export type TransferStatus='PENDING'|'COMPLETED'|'REJECTED';

export type TopUp={id:string;walletId:string;ownerId:string;currency:CurrencyCode;amount:number;method:string;status:TransferStatus;createdAt:string;settledAt?:string};
export type Withdrawal={id:string;walletId:string;ownerId:string;currency:CurrencyCode;amount:number;destination:string;status:TransferStatus;createdAt:string;settledAt?:string};
/** Where a withdrawal is paid out. Bank codes come from the provider. */
export type WithdrawalDestination={bankCode:string;accountNumber:string;accountName:string};
export type Bank={code:string;name:string};
/** Which currencies money can move in, and the providers that move it. */
export type PaymentMethods={currencies:CurrencyCode[];methods:string[]};

/** Reserved for the swap feature. Defined now so the ledger's reference types don't shift later. */
export type SwapQuote={from:CurrencyCode;to:CurrencyCode;amount:number;rate:number;receives:number;expiresAt:string};

/** What a tutor is owed: money on the way, versus money already in the wallet. */
export type EarningsSummary={
 currency:CurrencyCode;
 pending:number;
 flagged:number;
 paid:number;
 available:number;
};
