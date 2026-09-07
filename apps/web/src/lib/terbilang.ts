const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

function belowThousand(n: number): string {
  if (n <= 0) return "";
  const ratus = Math.floor(n / 100);
  const rest = n % 100;
  const puluh = Math.floor(rest / 10);
  const satu = rest % 10;
  const parts: string[] = [];
  if (ratus === 1) parts.push("seratus");
  else if (ratus > 1) parts.push(`${SATUAN[ratus]} ratus`);
  if (rest === 10) parts.push("sepuluh");
  else if (rest === 11) parts.push("sebelas");
  else if (rest > 11 && rest < 20) parts.push(`${SATUAN[satu]} belas`);
  else {
    if (puluh > 1) parts.push(`${SATUAN[puluh]} puluh`);
    if (satu) parts.push(SATUAN[satu]);
  }
  return parts.join(" ");
}

export function terbilang(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n === 0) return "nol";
  const groups: Array<[number, string]> = [
    [1_000_000_000_000, "triliun"],
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
  ];
  let rest = n;
  const parts: string[] = [];
  for (const [div, label] of groups) {
    const qty = Math.floor(rest / div);
    rest %= div;
    if (!qty) continue;
    if (label === "ribu" && qty === 1) parts.push("seribu");
    else parts.push(`${belowThousand(qty)} ${label}`);
  }
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function terbilangRupiah(value: number): string {
  return `${terbilang(value)} rupiah`;
}
