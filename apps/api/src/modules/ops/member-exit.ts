export const OPEN_LOAN_STATUSES = ["DRAFT", "APPROVED", "DISBURSED"] as const;

export function isOpenLoanStatus(status: string) {
  return OPEN_LOAN_STATUSES.includes(status as (typeof OPEN_LOAN_STATUSES)[number]);
}

export function memberExitError(input: {
  status: string;
  loans: Array<{ status: string }>;
  reason?: string;
  leftOn?: string;
}): string | null {
  if (input.status === "LEFT") return "Anggota ini sudah dicatat berhenti";
  const open = input.loans.filter((loan) => isOpenLoanStatus(loan.status));
  if (open.length) {
    return `Tidak bisa berhenti: masih ada ${open.length} pinjaman berjalan atau pengajuan. Selesaikan dulu.`;
  }
  const reason = input.reason?.trim() ?? "";
  if (reason.length < 8) return "Alasan berhenti minimal 8 karakter";
  if (reason.length > 2000) return "Alasan terlalu panjang";
  const leftOn = input.leftOn?.trim();
  if (leftOn && !/^\d{4}-\d{2}-\d{2}$/.test(leftOn)) return "Tanggal berhenti tidak valid";
  return null;
}

export function memberRestoreError(status: string): string | null {
  if (status !== "LEFT") return "Hanya anggota yang sudah berhenti yang bisa diaktifkan kembali";
  return null;
}
