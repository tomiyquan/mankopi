export const LOAN_DECISIONS = ["APPROVED", "CONDITIONAL", "REJECTED"] as const;
export type LoanDecisionKind = (typeof LOAN_DECISIONS)[number];

export function isLoanDecision(value: string | undefined): value is LoanDecisionKind {
  return LOAN_DECISIONS.includes(value as LoanDecisionKind);
}

export function loanDecisionError(input: { decision?: string; note?: string; conditions?: string }): string | null {
  if (!isLoanDecision(input.decision)) {
    return "Pilih putusan: setujui, setujui dengan syarat, atau tolak";
  }
  const note = (input.note ?? "").trim();
  if (note.length < 8) return "Keterangan putusan minimal 8 karakter";
  if (note.length > 2000) return "Keterangan terlalu panjang";
  if (input.decision === "CONDITIONAL") {
    const conditions = (input.conditions ?? "").trim();
    if (conditions.length < 8) return "Syarat persetujuan wajib diisi";
    if (conditions.length > 2000) return "Syarat terlalu panjang";
  }
  return null;
}

export function loanStatusFromDecision(decision: LoanDecisionKind): "APPROVED" | "REJECTED" {
  return decision === "REJECTED" ? "REJECTED" : "APPROVED";
}

export function loanDecisionAuditAction(decision: LoanDecisionKind) {
  if (decision === "REJECTED") return "credit.loan.rejected";
  if (decision === "CONDITIONAL") return "credit.loan.approved_conditional";
  return "credit.loan.approved";
}
