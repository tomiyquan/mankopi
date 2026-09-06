export const SAVING_KINDS = ["POKOK", "WAJIB", "SUKARELA"] as const;
export type SavingKind = (typeof SAVING_KINDS)[number];

const MEMBERSHIP_KINDS = new Set<SavingKind>(["POKOK", "WAJIB"]);

export function normalizeProductCode(code: string) {
  return code.trim().toUpperCase();
}

export function productCodeError(code: string): string | null {
  const normalized = normalizeProductCode(code);
  if (!/^[A-Z0-9][A-Z0-9_-]{1,15}$/.test(normalized)) {
    return "Kode produk 2–16 karakter: huruf, angka, minus, atau garis bawah";
  }
  return null;
}

export function productNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 80) {
    return "Nama produk harus 3–80 karakter";
  }
  return null;
}

export function parseSavingKind(kind: string): SavingKind | null {
  const value = kind.trim().toUpperCase();
  return SAVING_KINDS.includes(value as SavingKind) ? (value as SavingKind) : null;
}

export function requiredAccountClass(kind: SavingKind): "2" | "3" {
  return kind === "SUKARELA" ? "2" : "3";
}

export function savingAccountMapError(kind: SavingKind, classCode: string): string | null {
  const expected = requiredAccountClass(kind);
  if (classCode !== expected) {
    return kind === "SUKARELA"
      ? "Simpanan sukarela harus dipetakan ke akun kewajiban (kelas 2)"
      : "Simpanan pokok/wajib harus dipetakan ke akun ekuitas (kelas 3)";
  }
  return null;
}

export function savingMinAmountError(kind: SavingKind, minAmount: number): string | null {
  if (!Number.isFinite(minAmount) || minAmount < 0) return "Setoran minimum tidak valid";
  if (MEMBERSHIP_KINDS.has(kind) && minAmount < 1) {
    return "Simpanan pokok dan wajib wajib punya setoran minimum";
  }
  return null;
}

export function uniqueMembershipError(kind: SavingKind, activeSameKind: number): string | null {
  if (MEMBERSHIP_KINDS.has(kind) && activeSameKind > 0) {
    return `Sudah ada produk ${kind.toLowerCase()} aktif. Nonaktifkan yang lama sebelum menambah yang baru.`;
  }
  return null;
}

export function deactivateMembershipError(kind: string, otherActiveSameKind: number): string | null {
  if (MEMBERSHIP_KINDS.has(kind as SavingKind) && otherActiveSameKind === 0) {
    return `Tidak bisa menonaktifkan satu-satunya produk ${kind.toLowerCase()} — ini syarat keanggotaan`;
  }
  return null;
}

export function changeSavingAccountError(hasMovements: boolean): string | null {
  if (hasMovements) return "Akun lawan terkunci karena sudah ada mutasi";
  return null;
}

export function savingDepositError(kind: SavingKind, minAmount: number, balance: number, amount: number): string | null {
  if (!(amount > 0)) return "Nominal harus lebih dari 0";
  if (kind === "POKOK") {
    const remaining = roundMoney(minAmount - balance);
    if (remaining <= 0) return "Simpanan pokok sudah dilunasi";
    if (amount !== remaining) return `Setor pokok harus tepat ${formatIdr(remaining)} (sisa kewajiban)`;
    return null;
  }
  if (amount < minAmount) return `Setoran minimal ${formatIdr(minAmount)}`;
  return null;
}

export function savingWithdrawError(withdrawable: boolean, balance: number, amount: number): string | null {
  if (!withdrawable) return "Produk ini tidak boleh ditarik. Ubah aturan di data induk jika AD/ART mengizinkan.";
  if (!(amount > 0)) return "Nominal harus lebih dari 0";
  if (amount > balance) return "Saldo tidak mencukupi";
  return null;
}

export type TenantPolicy = {
  requirePokokForLoan: boolean;
  requireWajibForLoan: boolean;
};

export const DEFAULT_TENANT_POLICY: TenantPolicy = {
  requirePokokForLoan: true,
  requireWajibForLoan: false,
};

export function parseTenantPolicy(raw: unknown): TenantPolicy {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    requirePokokForLoan: value.requirePokokForLoan !== false,
    requireWajibForLoan: value.requireWajibForLoan === true,
  };
}

export function membershipPaidError(label: string, required: boolean, paid: boolean): string | null {
  if (required && !paid) return `Lunasi simpanan ${label} sebelum mengajukan pinjaman`;
  return null;
}

export function loanLimitError(principal: number, minPrincipal: number, maxPrincipal: number | null): string | null {
  if (!(principal > 0)) return "Pokok pinjaman harus lebih dari 0";
  if (principal < minPrincipal) return `Pokok minimal produk ini ${formatIdr(minPrincipal)}`;
  if (maxPrincipal != null && principal > maxPrincipal) return `Pokok maksimal produk ini ${formatIdr(maxPrincipal)}`;
  return null;
}

export function loanBoundError(minPrincipal: number, maxPrincipal: number | null): string | null {
  if (!(minPrincipal >= 0)) return "Pokok minimum tidak valid";
  if (maxPrincipal != null && maxPrincipal < minPrincipal) return "Pokok maksimum harus sama atau lebih besar dari minimum";
  return null;
}

export function changeLoanTermsError(hasLiveLoans: boolean): string | null {
  if (hasLiveLoans) return "Metode, jenis bunga, dan tenor terkunci karena sudah ada pinjaman cair";
  return null;
}

export function loanEligibilityError(hasPokokProduct: boolean, pokokPaid: boolean): string | null {
  if (hasPokokProduct && !pokokPaid) return "Lunasi simpanan pokok sebelum mengajukan pinjaman";
  return null;
}

export function loanStatusChangeError(next: string | undefined): string | null {
  if (next && !["ACTIVE", "INACTIVE"].includes(next)) return "Status produk tidak valid";
  return null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatIdr(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
