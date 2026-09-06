import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ops, type PayrollItemRow, type PayrollRunRow } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

function num(v: string | number | null | undefined) {
  return Number(v ?? 0);
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function periodLabel(run: Pick<PayrollRunRow, "year" | "month">) {
  return `${MONTHS[run.month - 1] ?? run.month} ${run.year}`;
}

export function PayrollPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canPost = Boolean(user?.permissions.includes("hr:payroll:post"));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [paidOn, setPaidOn] = useState(() => now.toISOString().slice(0, 10));
  const [cashCode, setCashCode] = useState("1101");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftItem, setDraftItem] = useState<PayrollItemRow | null>(null);

  const runs = useQuery({ queryKey: ["payrolls", tenantId], queryFn: () => ops.payrolls(tenantId ?? undefined), enabled });
  const detail = useQuery({
    queryKey: ["payroll", tenantId, selectedId],
    queryFn: () => ops.payroll(selectedId!, tenantId ?? undefined),
    enabled: Boolean(selectedId),
  });
  const run = detail.data;
  const budgetYear = Number(String(run?.paidOn ?? paidOn).slice(0, 4)) || year;
  const budget = useQuery({
    queryKey: ["budget", tenantId, budgetYear],
    queryFn: () => api.budget(tenantId ?? undefined, budgetYear),
    enabled,
  });

  function refreshBudget() {
    void qc.invalidateQueries({ queryKey: ["budget"] });
  }

  const create = useMutation({
    mutationFn: () => ops.createPayroll({ year, month, paidOn, cashAccountCode: cashCode }, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Draft payroll dibuat dari pegawai aktif",
      onSuccess: (run) => {
        setSelectedId((run as PayrollRunRow).id);
        void qc.invalidateQueries({ queryKey: ["payrolls"] });
        refreshBudget();
      },
    }),
  });
  const saveItem = useMutation({
    mutationFn: () => {
      if (!selectedId || !draftItem) throw new Error("Tidak ada baris");
      return ops.updatePayrollItem(
        selectedId,
        draftItem.id,
        { baseSalary: num(draftItem.baseSalary), allowance: num(draftItem.allowance), deduction: num(draftItem.deduction) },
        tenantId ?? undefined,
      );
    },
    ...noticeHandlers({
      success: "Baris diperbarui",
      onSuccess: () => {
        setDraftItem(null);
        void qc.invalidateQueries({ queryKey: ["payroll"] });
        void qc.invalidateQueries({ queryKey: ["payrolls"] });
        refreshBudget();
      },
    }),
  });
  const submit = useMutation({
    mutationFn: () => ops.submitPayroll(selectedId!, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Payroll diposting. Jurnal gaji sudah tercatat.",
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["payroll"] });
        void qc.invalidateQueries({ queryKey: ["payrolls"] });
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
        refreshBudget();
      },
    }),
  });
  const voidRun = useMutation({
    mutationFn: () => ops.voidPayroll(selectedId!, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Payroll dibatalkan. Jurnal balik sudah dibuat.",
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["payroll"] });
        void qc.invalidateQueries({ queryKey: ["payrolls"] });
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
        refreshBudget();
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const items = run?.items ?? [];
  const totals = items.reduce(
    (acc, i) => ({
      base: acc.base + num(i.baseSalary),
      allowance: acc.allowance + num(i.allowance),
      deduction: acc.deduction + num(i.deduction),
      net: acc.net + num(i.net),
    }),
    { base: 0, allowance: 0, deduction: 0, net: 0 },
  );
  let liveBase = totals.base;
  let liveAllowance = totals.allowance;
  if (run?.status === "DRAFT" && draftItem) {
    const orig = items.find((i) => i.id === draftItem.id);
    if (orig) {
      liveBase = liveBase - num(orig.baseSalary) + num(draftItem.baseSalary);
      liveAllowance = liveAllowance - num(orig.allowance) + num(draftItem.allowance);
    }
  }
  const draftExpense = liveBase + liveAllowance;
  const porsi = budget.data?.rows.find((r) => r.accountCode === "5102");
  const afterPost = porsi && run?.status === "DRAFT" ? porsi.remaining - draftExpense : porsi?.remaining;
  const overBudget = Boolean(porsi?.enabled && run?.status === "DRAFT" && (afterPost ?? 0) < -0.009);

  return (
    <TenantGate>
      <PageHeader
        kicker="SDM"
        title="Payroll"
        description="Draft diisi dari Personalia. Posting menulis jurnal 5102. Porsi anggaran personalia dihitung otomatis tiap draft dibuat, baris disimpan, atau diposting."
      />
      <PayrollBudget
        year={budgetYear}
        loading={budget.isLoading}
        porsi={porsi}
        income={budget.data?.income ?? 0}
        draftExpense={run?.status === "DRAFT" ? draftExpense : 0}
        afterPost={afterPost}
        overBudget={overBudget}
      />
      {canPost ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5 md:items-end">
            <Field label="Tahun">
              <TextInput type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
            </Field>
            <Field label="Bulan">
              <SelectInput value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((label, idx) => (
                  <option key={label} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Tanggal bayar">
              <TextInput type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
            </Field>
            <Field label="Sumber dana">
              <SelectInput value={cashCode} onChange={(e) => setCashCode(e.target.value)}>
                <option value="1101">1101 Kas</option>
                <option value="1102">1102 Bank</option>
              </SelectInput>
            </Field>
            <Button type="submit">Buat draft</Button>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-2">
          <p className="text-sm font-semibold">Riwayat periode</p>
          <ul className="mt-3 divide-y divide-line/70">
            {(runs.data ?? []).length === 0 ? <li className="py-6 text-center text-sm text-mute">Belum ada payroll</li> : null}
            {(runs.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(row.id);
                    setDraftItem(null);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-2 py-3 text-left text-sm ${selectedId === row.id ? "rounded-xl bg-leaf-mist" : ""}`}
                >
                  <span>
                    <span className="font-semibold">{periodLabel(row)}</span>
                    <span className="mt-0.5 block text-xs text-mute">{row.items.length} pegawai</span>
                  </span>
                  <StatusBadge status={row.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 lg:col-span-3">
          {!run ? (
            <p className="py-10 text-center text-sm text-mute">Pilih periode, atau buat draft dari pegawai aktif.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold tracking-tight">{periodLabel(run)}</p>
                  <p className="text-sm text-mute">
                    {run.memo} · dibayar {new Date(run.paidOn).toLocaleDateString("id-ID")} · {run.cashAccountCode === "1102" ? "Bank" : "Kas"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={run.status} />
                  {canPost && run.status === "DRAFT" ? (
                    <Button
                      size="sm"
                      disabled={overBudget}
                      onClick={() => {
                        void confirmAction({
                          title: `Posting gaji ${periodLabel(run)}?`,
                          text: `Jurnal otomatis: Dr 5102 ${idr(draftExpense)}, Cr ${run.cashAccountCode} ${idr(totals.net)}${totals.deduction ? `, Cr 2102 ${idr(totals.deduction)}` : ""}. Sisa porsi setelah posting ${idr(afterPost ?? 0)}.`,
                          confirmText: "Posting jurnal",
                        }).then((ok) => {
                          if (ok) submit.mutate();
                        });
                      }}
                    >
                      Posting
                    </Button>
                  ) : null}
                  {canPost && run.status === "POSTED" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void confirmAction({
                          title: "Batalkan payroll?",
                          text: "Jurnal gaji akan dibalik. Periode ini bisa dibuat draft baru setelah itu.",
                          confirmText: "Batalkan",
                          danger: true,
                        }).then((ok) => {
                          if (ok) voidRun.mutate();
                        });
                      }}
                    >
                      Batalkan
                    </Button>
                  ) : null}
                </div>
              </div>

              <TableWrap>
                <table className="w-full text-sm">
                  <thead className="bg-canvas/70">
                    <tr>
                      <Th>Pegawai</Th>
                      <Th>Pokok</Th>
                      <Th>Tunjangan</Th>
                      <Th>Potongan</Th>
                      <Th>Diterima</Th>
                      {canPost && run.status === "DRAFT" ? <Th>Aksi</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const row = draftItem?.id === item.id ? draftItem : item;
                      return (
                        <tr key={item.id} className="border-t border-line/70">
                          <Td>
                            <p className="font-semibold">{item.employeeName}</p>
                            <p className="text-xs text-mute">{item.position ?? "—"}</p>
                          </Td>
                          <Td>
                            {draftItem?.id === item.id ? (
                              <MoneyInput
                                value={row.baseSalary}
                                onValueChange={(baseSalary) => setDraftItem({ ...draftItem, baseSalary })}
                              />
                            ) : (
                              idr(num(item.baseSalary))
                            )}
                          </Td>
                          <Td>
                            {draftItem?.id === item.id ? (
                              <MoneyInput
                                value={row.allowance}
                                onValueChange={(allowance) => setDraftItem({ ...draftItem, allowance })}
                              />
                            ) : (
                              idr(num(item.allowance))
                            )}
                          </Td>
                          <Td>
                            {draftItem?.id === item.id ? (
                              <MoneyInput
                                value={row.deduction}
                                onValueChange={(deduction) => setDraftItem({ ...draftItem, deduction })}
                              />
                            ) : (
                              idr(num(item.deduction))
                            )}
                          </Td>
                          <Td className="font-semibold">{idr(num(item.net))}</Td>
                          {canPost && run.status === "DRAFT" ? (
                            <Td className="whitespace-nowrap">
                              {draftItem?.id === item.id ? (
                                <div className="flex gap-1.5">
                                  <Button size="sm" onClick={() => saveItem.mutate()}>
                                    Simpan
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDraftItem(null)}>
                                    Batal
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setDraftItem(item)}>
                                  Ubah
                                </Button>
                              )}
                            </Td>
                          ) : null}
                        </tr>
                      );
                    })}
                    <tr className="border-t border-line bg-canvas/50 font-semibold">
                      <Td>Total</Td>
                      <Td>{idr(totals.base)}</Td>
                      <Td>{idr(totals.allowance)}</Td>
                      <Td>{idr(totals.deduction)}</Td>
                      <Td>{idr(totals.net)}</Td>
                      {canPost && run.status === "DRAFT" ? <Td /> : null}
                    </tr>
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}
        </Card>
      </div>
    </TenantGate>
  );
}

function PayrollBudget({
  year,
  loading,
  porsi,
  income,
  draftExpense,
  afterPost,
  overBudget,
}: {
  year: number;
  loading?: boolean;
  porsi?: { percent: number; enabled: boolean; spent: number; cap: number; remaining: number };
  income: number;
  draftExpense: number;
  afterPost?: number;
  overBudget: boolean;
}) {
  if (loading) {
    return <Card className="p-4 text-sm text-mute">Menghitung porsi anggaran payroll…</Card>;
  }
  if (!porsi) {
    return (
      <Card className="p-4 text-sm text-mute">
        Porsi beban personalia (5102) belum diatur.{" "}
        <Link to="/shu" className="font-semibold text-leaf-dark hover:underline">
          Atur di PHU & SHU
        </Link>
      </Card>
    );
  }
  return (
    <Card className={`p-4 ${overBudget ? "border-clay/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Porsi anggaran payroll · 5102</p>
          <p className="mt-1 text-xs text-mute">
            {porsi.enabled ? `${porsi.percent}% pendapatan tahun ${year}` : "Porsi nonaktif — tidak membatasi posting"}
            {" · "}
            <Link to="/shu" className="font-semibold text-leaf-dark hover:underline">
              Ubah porsi
            </Link>
          </p>
        </div>
        {overBudget ? <p className="text-sm font-semibold text-clay">Draft melebihi sisa porsi</p> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BudgetStat label="Pendapatan tahun" value={idr(income)} />
        <BudgetStat label="Plafon gaji" value={idr(porsi.cap)} />
        <BudgetStat label="Sudah terpakai" value={idr(porsi.spent)} />
        <BudgetStat label="Draft ini (pokok+tunjangan)" value={idr(draftExpense)} />
        <BudgetStat label="Sisa setelah posting" value={idr(afterPost ?? porsi.remaining)} warn={overBudget} />
      </div>
    </Card>
  );
}

function BudgetStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-mute">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${warn ? "text-clay" : ""}`}>{value}</p>
    </div>
  );
}
