export const SAVING_METHODS = ["CASH", "BANK", "TRANSFER"] as const;
export type SavingMethod = (typeof SAVING_METHODS)[number];

export function parseSavingMethod(value?: string): SavingMethod | null {
  const method = (value ?? "CASH").trim().toUpperCase();
  return SAVING_METHODS.includes(method as SavingMethod) ? (method as SavingMethod) : null;
}

export function formatSavingTxnNo(seq: number) {
  return `SM-${String(seq).padStart(4, "0")}`;
}

export function savingMethodLabel(method?: string | null) {
  if (method === "BANK") return "Pindah buku · Bank";
  if (method === "TRANSFER") return "Pindah buku · Rekening";
  return "Tunai";
}

export function savingMethodError(value?: string): string | null {
  if (!parseSavingMethod(value)) return "Metode harus tunai, bank, atau pindah buku rekening";
  return null;
}

export function savingNoteError(note?: string | null): string | null {
  if (note && note.trim().length > 500) return "Catatan transaksi maksimal 500 karakter";
  return null;
}

export function savingTransferError(method: string, accountId: string, counterAccountId?: string | null): string | null {
  if (method !== "TRANSFER") return null;
  if (!counterAccountId) return "Pilih rekening sumber dan rekening tujuan untuk pindah buku";
  if (counterAccountId === accountId) return "Rekening sumber dan rekening tujuan tidak boleh sama";
  return null;
}
