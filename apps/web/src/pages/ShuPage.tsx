import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BudgetOverview, type CkpnOverview, type ShuOverview } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, TableWrap, Td, TextInput, Th, cx } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

const TABS = [
  { id: "budget", label: "A. Porsi beban" },
  { id: "ckpn", label: "B. Cadangan risiko" },
  { id: "close", label: "C. Tutup buku / SHU" },
] as const;

const KOL: Record<number, string> = { 1: "Lancar", 2: "DPK", 3: "Kurang lancar", 4: "Diragukan", 5: "Macet" };

export function ShuPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const now = new Date();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("budget");
  const [year, setYear] = useState(now.getUTCFullYear());
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canEdit = Boolean(user?.permissions.includes("ledger:post_manual"));
  const canClose = Boolean(user?.permissions.includes("ledger:close"));

  const budget = useQuery({
    queryKey: ["budget", tenantId, year],
    queryFn: () => api.budget(tenantId ?? undefined, year),
    enabled,
  });
  const ckpn = useQuery({
    queryKey: ["ckpn", tenantId],
    queryFn: () => api.ckpn(tenantId ?? undefined),
    enabled,
  });
  const shu = useQuery({
    queryKey: ["shu", tenantId, year],
    queryFn: () => api.shu(tenantId ?? undefined, year),
    enabled,
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["budget"] });
    void qc.invalidateQueries({ queryKey: ["ckpn"] });
    void qc.invalidateQueries({ queryKey: ["shu"] });
    void qc.invalidateQueries({ queryKey: ["journals"] });
    void qc.invalidateQueries({ queryKey: ["reports"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
    void qc.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Keuangan"
        title="PHU, porsi, dan SHU"
        description="A: plafon beban dari pendapatan tahun berjalan. B: cadangan risiko dari kolektabilitas. C: tutup PHU ke SHU, lalu bagi sesuai AD/ART."
        action={
          <Field label="Tahun">
            <TextInput type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </Field>
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
      {tab === "budget" ? <BudgetPanel data={budget.data} year={year} canEdit={canEdit} onSaved={refresh} tenantId={tenantId} /> : null}
      {tab === "ckpn" ? <CkpnPanel data={ckpn.data} canEdit={canEdit} onSaved={refresh} tenantId={tenantId} /> : null}
      {tab === "close" ? <ClosePanel data={shu.data} year={year} canClose={canClose} onSaved={refresh} tenantId={tenantId} /> : null}
    </TenantGate>
  );
}

function BudgetPanel({
  data,
  year,
  canEdit,
  onSaved,
  tenantId,
}: {
  data?: BudgetOverview;
  year: number;
  canEdit: boolean;
  onSaved: () => void;
  tenantId?: string | null;
}) {
  const [rows, setRows] = useState(data?.rows ?? []);
  useEffect(() => setRows(data?.rows ?? []), [data]);
  const save = useMutation({
    mutationFn: () =>
      api.saveBudget(
        { rows: rows.map((r) => ({ accountCode: r.accountCode, name: r.name, percent: Number(r.percent), enabled: r.enabled })) },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({ success: "Porsi beban disimpan", onSuccess: onSaved }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Card className="p-4">
        <p className="text-sm text-mute">
          Plafon = persen × pendapatan kelas 4 tahun {year}. Jurnal beban (termasuk payroll dan CKPN) ditolak jika melewati sisa porsi.
        </p>
        <p className="mt-2 text-lg font-extrabold">Pendapatan tahun ini {idr(data?.income ?? 0)}</p>
      </Card>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Pos beban</Th>
              <Th>Porsi %</Th>
              <Th className="text-right">Plafon</Th>
              <Th className="text-right">Terpakai</Th>
              <Th className="text-right">Sisa</Th>
              <Th>Aktif</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.accountCode} className="border-t border-line/70">
                <Td>
                  <span className="font-mono text-xs text-mute">{row.accountCode}</span> {row.name}
                </Td>
                <Td>
                  {canEdit ? (
                    <TextInput
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={row.percent}
                      onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, percent: Number(e.target.value) } : r)))}
                    />
                  ) : (
                    `${row.percent}%`
                  )}
                </Td>
                <Td className="text-right">{idr(row.cap)}</Td>
                <Td className="text-right">{idr(row.spent)}</Td>
                <Td className={`text-right font-semibold ${row.remaining < 0 ? "text-clay" : ""}`}>{idr(row.remaining)}</Td>
                <Td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={!canEdit}
                    onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, enabled: e.target.checked } : r)))}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {canEdit ? <Button type="submit">Simpan porsi</Button> : null}
    </form>
  );
}

function CkpnPanel({
  data,
  canEdit,
  onSaved,
  tenantId,
}: {
  data?: CkpnOverview;
  canEdit: boolean;
  onSaved: () => void;
  tenantId?: string | null;
}) {
  const [rates, setRates] = useState(data?.rates ?? []);
  useEffect(() => setRates(data?.rates ?? []), [data]);
  const save = useMutation({
    mutationFn: () => api.saveCkpnRates({ rows: rates.map((r) => ({ grade: r.grade, percent: Number(r.percent) })) }, tenantId ?? undefined),
    ...noticeHandlers({ success: "Tarif CKPN disimpan", onSuccess: onSaved }),
  });
  const post = useMutation({
    mutationFn: () => api.postCkpn({ postedOn: new Date().toISOString().slice(0, 10) }, tenantId ?? undefined),
    ...noticeHandlers({ success: "Jurnal cadangan risiko tercatat", onSuccess: onSaved }),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-mute">
        Cadangan dihitung dari outstanding pinjaman cair × tarif Kol. Jurnal: Dr 5103, Cr 1202 (atau sebaliknya jika cadangan berlebih).
        Kena porsi beban 5103.
      </p>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Kol</Th>
              <Th>Tarif %</Th>
              <Th className="text-right">Outstanding</Th>
              <Th className="text-right">Wajib cadangan</Th>
            </tr>
          </thead>
          <tbody>
            {(data?.byGrade ?? []).map((row) => {
              const rate = rates.find((r) => r.grade === row.grade);
              return (
                <tr key={row.grade} className="border-t border-line/70">
                  <Td>
                    Kol {row.grade} · {KOL[row.grade]}
                  </Td>
                  <Td>
                    {canEdit ? (
                      <TextInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={rate?.percent ?? 0}
                        onChange={(e) =>
                          setRates(rates.map((r) => (r.grade === row.grade ? { ...r, percent: Number(e.target.value) } : r)))
                        }
                      />
                    ) : (
                      `${rate?.percent ?? 0}%`
                    )}
                  </Td>
                  <Td className="text-right">{idr(row.outstanding)}</Td>
                  <Td className="text-right">{idr(row.required)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-mute">Wajib cadangan</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.required ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-mute">Saldo 1202 sekarang</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.current ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-mute">Selisih jurnal</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.delta ?? 0)}</p>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button type="button" variant="ghost" onClick={() => save.mutate()}>
            Simpan tarif
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            disabled={Math.abs(data?.delta ?? 0) < 0.01}
            onClick={() => {
              void confirmAction({
                title: "Posting cadangan risiko?",
                text: `Jurnal ${idr(Math.abs(data?.delta ?? 0))} ke 5103 / 1202.`,
                confirmText: "Posting",
              }).then((ok) => {
                if (ok) post.mutate();
              });
            }}
          >
            Posting selisih
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ClosePanel({
  data,
  year,
  canClose,
  onSaved,
  tenantId,
}: {
  data?: ShuOverview;
  year: number;
  canClose: boolean;
  onSaved: () => void;
  tenantId?: string | null;
}) {
  const [shares, setShares] = useState(data?.shares ?? []);
  useEffect(() => setShares(data?.shares ?? []), [data]);
  const totalPct = shares.reduce((sum, s) => sum + Number(s.percent), 0);
  const save = useMutation({
    mutationFn: () =>
      api.saveShuShares(
        { rows: shares.map((s, i) => ({ accountCode: s.accountCode, name: s.name, percent: Number(s.percent), sortOrder: i + 1 })) },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({ success: "Porsi SHU disimpan", onSuccess: onSaved }),
  });
  const close = useMutation({
    mutationFn: () => api.closeYear(year, tenantId ?? undefined),
    ...noticeHandlers({ success: `PHU ${year} ditutup ke 3201`, onSuccess: onSaved }),
  });
  const allocate = useMutation({
    mutationFn: () => api.allocateYear(year, tenantId ?? undefined),
    ...noticeHandlers({ success: `SHU ${year} dialokasi`, onSuccess: onSaved }),
  });
  const reopen = useMutation({
    mutationFn: () => api.voidYearClose(year, tenantId ?? undefined),
    ...noticeHandlers({ success: `Tutup buku ${year} dibatalkan`, onSuccess: onSaved }),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-mute">
        Tutup buku memindahkan seluruh 4xxx/5xxx ke 3201 SHU. Setelah itu SHU dibagi ke cadangan dan dana sesuai porsi (jumlah 100%).
        Posting CKPN dulu jika perlu, karena setelah tutup PHU terkunci.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-mute">Pendapatan</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.income ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-mute">Beban</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.expense ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-mute">{data?.closed ? "SHU yang ditutup" : "SHU berjalan"}</p>
          <p className="mt-1 text-xl font-extrabold">{idr(data?.phuNet ?? 0)}</p>
        </Card>
      </div>
      <p className="text-sm font-semibold">{data?.closed ? (data.allocated ? "Sudah dialokasi" : "Sudah ditutup — siap alokasi") : "Belum ditutup"}</p>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Pos alokasi</Th>
              <Th>Porsi %</Th>
              <Th className="text-right">Nominal</Th>
            </tr>
          </thead>
          <tbody>
            {shares.map((row, i) => {
              const amount = data?.allocation.find((a) => a.accountCode === row.accountCode)?.amount ?? 0;
              return (
                <tr key={row.accountCode} className="border-t border-line/70">
                  <Td>
                    <span className="font-mono text-xs text-mute">{row.accountCode}</span> {row.name}
                  </Td>
                  <Td>
                    {canClose && !data?.allocated ? (
                      <TextInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={row.percent}
                        onChange={(e) => setShares(shares.map((s, idx) => (idx === i ? { ...s, percent: Number(e.target.value) } : s)))}
                      />
                    ) : (
                      `${row.percent}%`
                    )}
                  </Td>
                  <Td className="text-right">{idr(amount)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <p className={`text-sm ${Math.abs(totalPct - 100) < 0.05 ? "text-leaf-dark" : "text-clay"}`}>Jumlah porsi {totalPct}%</p>
      <div className="flex flex-wrap gap-2">
        {canClose && !data?.allocated ? (
          <Button type="button" variant="ghost" onClick={() => save.mutate()} disabled={Math.abs(totalPct - 100) > 0.05}>
            Simpan porsi SHU
          </Button>
        ) : null}
        {canClose && !data?.closed ? (
          <Button
            type="button"
            onClick={() => {
              void confirmAction({
                title: `Tutup buku ${year}?`,
                text: "Pendapatan dan beban tahun ini pindah ke 3201 SHU. PHU tahun ini kemudian terkunci.",
                confirmText: "Tutup buku",
              }).then((ok) => {
                if (ok) close.mutate();
              });
            }}
          >
            Tutup PHU
          </Button>
        ) : null}
        {canClose && data?.closed && !data.allocated ? (
          <Button
            type="button"
            disabled={(data.phuNet ?? 0) <= 0}
            onClick={() => {
              void confirmAction({
                title: `Alokasi SHU ${year}?`,
                text: "3201 dibagi ke cadangan dan dana sesuai porsi.",
                confirmText: "Alokasi",
              }).then((ok) => {
                if (ok) allocate.mutate();
              });
            }}
          >
            Alokasi SHU
          </Button>
        ) : null}
        {canClose && data?.closed ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              void confirmAction({
                title: `Batalkan tutup buku ${year}?`,
                text: "Jurnal alokasi dan tutup buku akan dibalik.",
                confirmText: "Batalkan",
                danger: true,
              }).then((ok) => {
                if (ok) reopen.mutate();
              });
            }}
          >
            Batalkan tutup buku
          </Button>
        ) : null}
      </div>
    </div>
  );
}
