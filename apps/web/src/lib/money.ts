export function idr(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

/**
 * Digit rupiah utuh dari ketikan atau nilai API.
 * Titik ribuan id-ID (`1.000`, `1.0000` setelah digit berikutnya) bukan desimal.
 * Desimal Inggris/`JSON` hanya jika pecahan 1–2 digit (`1500000.00`).
 */
export function rupiahDigits(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(Math.round(Math.abs(value)));
  }
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return "";
  if (/^-?\d+\.\d{1,2}$/.test(trimmed)) {
    return String(Math.round(Math.abs(Number(trimmed))));
  }
  return trimmed.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatRupiahInput(value: string | number): string {
  const digits = rupiahDigits(value);
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(digits));
}
