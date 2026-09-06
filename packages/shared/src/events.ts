export const DOMAIN_EVENTS = {
  TENANT_CREATED: "platform.tenant.created",
  USER_SIGNED_IN: "identity.user.signed_in",
  USER_CREATED: "identity.user.created",
  ROLE_CHANGED: "identity.role.changed",
  BRANCH_CREATED: "org.branch.created",
  MEMBER_REGISTERED: "membership.member.registered",
  SAVING_POSTED: "savings.transaction.posted",
  LOAN_POSTED: "credit.loan.posted",
  LOAN_PAYMENT_ALLOCATED: "credit.payment.allocated",
  COLLECTION_RECEIVED: "collection.receipt.received",
  JOURNAL_POSTED: "ledger.journal.posted",
  CASH_CLOSED: "org.cash.closed",
  LOAN_OVERDUE: "credit.loan.overdue",
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export type DomainEvent<TPayload = Record<string, unknown>> = {
  name: DomainEventName;
  tenantId?: string;
  branchId?: string;
  actorId?: string;
  occurredAt: string;
  payload: TPayload;
};
