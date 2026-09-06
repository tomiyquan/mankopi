import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Card, PageHeader, TableWrap, Td, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";
import { cx } from "../ui/kit";

const TABS = [
  { id: "neraca", label: "Neraca" },
  { id: "phu", label: "PHU" },
  { id: "cash", label: "Arus kas" },
  { id: "ojk", label: "Peta OJK" },
] as const;

export function ReportsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const now = new Date();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("neraca");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const reports = useQuery({
    queryKey: ["reports", tenantId, year, month],
    queryFn: () => api.reports(tenantId ?? undefined, Number(year), Number(month)),
    enabled: Boolean(tenantId || !user?.isPlatformAdmin),
  });
  const data = reports.data;

  return (
    <TenantGate>
      <PageHeader
        kicker="Laporan"
        title="Dari buku besar"
        description="Kas riil = saldo Kas + Bank dari seluruh jurnal. Neraca/PHU/arus kas di bawah mengikuti bulan yang dipilih."
        action={
          <div className="flex gap-2">
            <input className="w-24 rounded-xl border border-line px-3 py-2 text-sm" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            <input className="w-20 rounded-xl border border-line px-3 py-2 text-sm" type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-semibold",
              tab === t.id ? "bg-leaf text-white" : "bg-white text-mute border border-line",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Kas riil (1101)" value={idr(data.cashPosition?.kas ?? 0)} note="saldo seluruh waktu" />
          <Kpi label="Bank (1102)" value={idr(data.cashPosition?.bank ?? 0)} note="saldo seluruh waktu" />
          <Kpi label="Uang tunai + bank" value={idr(data.cashPosition?.total ?? 0)} note="kas + bank" />
        </div>
      ) : null}
      {data ? (
        <p className={`text-sm font-medium ${data.trial.balanced ? "text-leaf-dark" : "text-clay"}`}>
          Posisi kas dihitung dari seluruh jurnal, bukan hanya bulan terpilih. Tab Arus kas = pergerakan periode. Neraca saldo {data.trial.balanced ? "seimbang" : "tidak seimbang"} · Debit {idr(data.trial.debit)} · Kredit {idr(data.trial.credit)}
        </p>
      ) : null}
      {tab === "neraca" ? <Statement rows={data?.neraca ?? []} /> : null}
      {tab === "phu" ? <Statement rows={data?.phu ?? []} /> : null}
      {tab === "cash" ? (
        <div className="space-y-3">
          <p className="text-sm text-mute">
            Kartu di bawah adalah neto periode (masuk minus keluar). Dua pencairan bisa terlihat kecil jika ada
            setoran sukarela di bulan yang sama — rincian jurnal ada di tabel. Minus = uang keluar. Operasi:
            pinjaman, simpanan sukarela, bunga, denda, gaji, beban. Investasi: aset tetap. Pendanaan: modal,
            simpanan pokok/wajib, SHU.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi label="Operasi" value={idr(data?.cashFlow.OPERATING ?? 0)} note="neto: pinjaman + sukarela + bunga + beban" />
            <Kpi label="Investasi" value={idr(data?.cashFlow.INVESTING ?? 0)} note="aset tetap / investasi jangka panjang" />
            <Kpi label="Pendanaan" value={idr(data?.cashFlow.FINANCING ?? 0)} note="modal dan simpanan pokok/wajib" />
          </div>
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="bg-canvas/70">
                <tr>
                  <Th>Jurnal</Th>
                  <Th>Kelompok</Th>
                  <Th className="text-right">Arus kas</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.cashMoves ?? []).length === 0 ? (
                  <tr>
                    <Td className="py-8 text-center text-mute" colSpan={3}>
                      Belum ada mutasi kas di periode ini
                    </Td>
                  </tr>
                ) : (
                  (data?.cashMoves ?? []).map((row) => (
                    <tr key={`${row.journalId}-${row.kind}`} className="border-t border-line/70">
                      <Td>
                        <p className="font-medium">{row.memo || sourceLabel(row.sourceType)}</p>
                        <p className="text-xs text-mute">
                          {row.number} · {sourceLabel(row.sourceType)}
                        </p>
                      </Td>
                      <Td>{kindLabel(row.kind)}</Td>
                      <Td className={`text-right font-semibold ${row.amount < 0 ? "text-clay" : ""}`}>{idr(row.amount)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </div>
      ) : null}
      {tab === "ojk" ? (
        <TableWrap>
          <table className="w-full text-sm">
            <thead className="bg-canvas/70">
              <tr>
                <Th>Pos OJK</Th>
                <Th className="text-right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {data?.ojk.map((row) => (
                <tr key={row.key} className="border-t border-line/70">
                  <Td>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-mute">{row.key}</p>
                  </Td>
                  <Td className="text-right font-semibold">{idr(row.net)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
    </TenantGate>
  );
}

function Statement({ rows }: { rows: Array<{ accountCode: string; name: string; net: number; debit: number; credit: number }> }) {
  return (
    <TableWrap>
      <table className="w-full text-sm">
        <thead className="bg-canvas/70">
          <tr>
            <Th>Akun</Th>
            <Th className="text-right">Debit</Th>
            <Th className="text-right">Kredit</Th>
            <Th className="text-right">Neto</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <Td className="py-8 text-center text-mute" colSpan={4}>
                Belum ada mutasi di periode ini
              </Td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountCode} className="border-t border-line/70">
                <Td>
                  <span className="font-mono text-xs text-mute">{row.accountCode}</span> {row.name}
                </Td>
                <Td className="text-right">{idr(row.debit)}</Td>
                <Td className="text-right">{idr(row.credit)}</Td>
                <Td className="text-right font-semibold">{idr(row.net)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableWrap>
  );
}

function kindLabel(kind: "OPERATING" | "INVESTING" | "FINANCING") {
  if (kind === "OPERATING") return "Operasi";
  if (kind === "INVESTING") return "Investasi";
  return "Pendanaan";
}

function sourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    "credit.disburse": "Pencairan pinjaman",
    "collection.receipt": "Setoran angsuran",
    "savings.deposit": "Setoran simpanan",
    "savings.withdraw": "Penarikan simpanan",
    "opening.capital": "Modal awal",
    reverse: "Pembalikan jurnal",
    manual: "Jurnal manual",
    "credit.ckpn": "Cadangan risiko",
    "year.close": "Tutup buku PHU",
    "shu.allocate": "Alokasi SHU",
    "payroll.salary": "Payroll gaji",
  };
  return labels[sourceType] ?? sourceType;
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-sm text-mute">{note}</p> : null}
    </Card>
  );
}
