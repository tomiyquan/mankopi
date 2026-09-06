import { ACCOUNT_CLASSES } from "@mankopi/shared";

export type AccountClass = keyof typeof ACCOUNT_CLASSES;

export type AccountTemplate = {
  code: string;
  name: string;
  classCode: string;
  normalBalance: "DEBIT" | "CREDIT";
  isCash: boolean;
  report: "NERACA" | "PHU" | "ARUS_KAS";
  cashFlow?: "OPERATING" | "INVESTING" | "FINANCING";
  ojkMap?: string;
};

export const OJK_MAPS = [
  { key: "ASET_LANCAR_KAS", label: "Aset lancar — Kas" },
  { key: "ASET_LANCAR_BANK", label: "Aset lancar — Bank" },
  { key: "ASET_PIUTANG_PINJAMAN", label: "Aset — Piutang pinjaman" },
  { key: "ASET_CADANGAN_RISIKO", label: "Aset — Cadangan risiko (pengurang piutang)" },
  { key: "KEWAJIBAN_SIMPANAN", label: "Kewajiban — Simpanan" },
  { key: "KEWAJIBAN_POTONGAN_GAJI", label: "Kewajiban — Potongan gaji" },
  { key: "EKUITAS_SIMP_POKOK", label: "Ekuitas — Simpanan pokok" },
  { key: "EKUITAS_SIMP_WAJIB", label: "Ekuitas — Simpanan wajib" },
  { key: "EKUITAS_MODAL", label: "Ekuitas — Modal sendiri" },
  { key: "EKUITAS_CADANGAN", label: "Ekuitas — Cadangan (dari SHU)" },
  { key: "EKUITAS_SHU", label: "Ekuitas — SHU tahun berjalan" },
  { key: "KEWAJIBAN_DANA_SHU", label: "Kewajiban — Dana / utang pembagian SHU" },
  { key: "PENDAPATAN_BUNGA", label: "Pendapatan — Bunga pinjaman" },
  { key: "PENDAPATAN_DENDA", label: "Pendapatan — Denda" },
  { key: "PENDAPATAN_LAIN", label: "Pendapatan — Lainnya" },
  { key: "BEBAN_OPERASIONAL", label: "Beban — Operasional" },
  { key: "BEBAN_GAJI", label: "Beban — Personalia" },
  { key: "BEBAN_CADANGAN_RISIKO", label: "Beban — Cadangan risiko / CKPN" },
] as const;

export const DEFAULT_COA_TEMPLATE: AccountTemplate[] = [
  { code: "1101", name: "Kas", classCode: ACCOUNT_CLASSES.ASSET, normalBalance: "DEBIT", isCash: true, report: "ARUS_KAS", cashFlow: "OPERATING", ojkMap: "ASET_LANCAR_KAS" },
  { code: "1102", name: "Bank", classCode: ACCOUNT_CLASSES.ASSET, normalBalance: "DEBIT", isCash: true, report: "ARUS_KAS", cashFlow: "OPERATING", ojkMap: "ASET_LANCAR_BANK" },
  { code: "1201", name: "Piutang Pinjaman Anggota", classCode: ACCOUNT_CLASSES.ASSET, normalBalance: "DEBIT", isCash: false, report: "NERACA", cashFlow: "OPERATING", ojkMap: "ASET_PIUTANG_PINJAMAN" },
  { code: "1202", name: "Cadangan Risiko Pinjaman", classCode: ACCOUNT_CLASSES.ASSET, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "OPERATING", ojkMap: "ASET_CADANGAN_RISIKO" },
  { code: "2101", name: "Simpanan Sukarela", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "OPERATING", ojkMap: "KEWAJIBAN_SIMPANAN" },
  { code: "2102", name: "Utang Potongan Gaji", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "OPERATING", ojkMap: "KEWAJIBAN_POTONGAN_GAJI" },
  { code: "2103", name: "Utang Jasa Anggota", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "KEWAJIBAN_DANA_SHU" },
  { code: "2104", name: "Dana Pengurus", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "KEWAJIBAN_DANA_SHU" },
  { code: "2105", name: "Dana Karyawan", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "KEWAJIBAN_DANA_SHU" },
  { code: "2106", name: "Dana Pendidikan", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "KEWAJIBAN_DANA_SHU" },
  { code: "2107", name: "Dana Sosial", classCode: ACCOUNT_CLASSES.LIABILITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "KEWAJIBAN_DANA_SHU" },
  { code: "3101", name: "Simpanan Pokok", classCode: ACCOUNT_CLASSES.EQUITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "EKUITAS_SIMP_POKOK" },
  { code: "3102", name: "Simpanan Wajib", classCode: ACCOUNT_CLASSES.EQUITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "EKUITAS_SIMP_WAJIB" },
  { code: "3103", name: "Modal Sendiri", classCode: ACCOUNT_CLASSES.EQUITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "EKUITAS_MODAL" },
  { code: "3201", name: "SHU Tahun Berjalan", classCode: ACCOUNT_CLASSES.EQUITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "EKUITAS_SHU" },
  { code: "3202", name: "Cadangan dari SHU", classCode: ACCOUNT_CLASSES.EQUITY, normalBalance: "CREDIT", isCash: false, report: "NERACA", cashFlow: "FINANCING", ojkMap: "EKUITAS_CADANGAN" },
  { code: "4101", name: "Pendapatan Bunga Pinjaman", classCode: ACCOUNT_CLASSES.INCOME, normalBalance: "CREDIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "PENDAPATAN_BUNGA" },
  { code: "4102", name: "Pendapatan Denda", classCode: ACCOUNT_CLASSES.INCOME, normalBalance: "CREDIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "PENDAPATAN_DENDA" },
  { code: "4103", name: "Pendapatan Lainnya", classCode: ACCOUNT_CLASSES.INCOME, normalBalance: "CREDIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "PENDAPATAN_LAIN" },
  { code: "5101", name: "Beban Operasional", classCode: ACCOUNT_CLASSES.EXPENSE, normalBalance: "DEBIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "BEBAN_OPERASIONAL" },
  { code: "5102", name: "Beban Personalia", classCode: ACCOUNT_CLASSES.EXPENSE, normalBalance: "DEBIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "BEBAN_GAJI" },
  { code: "5103", name: "Beban Cadangan Risiko", classCode: ACCOUNT_CLASSES.EXPENSE, normalBalance: "DEBIT", isCash: false, report: "PHU", cashFlow: "OPERATING", ojkMap: "BEBAN_CADANGAN_RISIKO" },
];

export function classOfAccount(code: string): string {
  return code.slice(0, 1);
}
