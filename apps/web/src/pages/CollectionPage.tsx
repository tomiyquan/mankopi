import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops, type CollectCard } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Button, Card, MoneyInput, PageHeader, StatusBadge, TextInput, cx } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

const TABS = [
  { id: "due", label: "Jatuh tempo" },
  { id: "early", label: "Bayar lebih awal" },
] as const;

const KOL: Record<number, string> = {
  1: "Lancar",
  2: "DPK",
  3: "Kurang lancar",
  4: "Diragukan",
  5: "Macet",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

type LoanBill = {
  loanId: string;
  loanNo: string;
  memberName: string;
  phone?: string | null;
  collectability: number;
  items: CollectCard[];
  nextRemaining: number;
  totalDue: number;
  penalty: number;
  overdueCount: number;
  graceCount: number;
  dueTodayCount: number;
  upcomingCount: number;
};

function groupBills(cards: CollectCard[]): LoanBill[] {
  const today = todayIso();
  const map = new Map<string, LoanBill>();
  for (const card of cards) {
    const late = dateKey(card.dueDate) < today;
    const inGrace = Boolean(card.inGrace);
    const existing = map.get(card.loan.id);
    if (existing) {
      existing.items.push(card);
      existing.totalDue += card.remaining;
      existing.penalty += card.penalty ?? 0;
      existing.collectability = Math.max(existing.collectability, card.collectability);
      if (late && !inGrace) existing.overdueCount += 1;
      if (inGrace) existing.graceCount += 1;
      if (dateKey(card.dueDate) === today) existing.dueTodayCount += 1;
      if (card.upcoming || dateKey(card.dueDate) > today) existing.upcomingCount += 1;
      continue;
    }
    map.set(card.loan.id, {
      loanId: card.loan.id,
      loanNo: card.loan.loanNo,
      memberName: card.loan.member.name,
      phone: card.loan.member.phone,
      collectability: card.collectability,
      items: [card],
      nextRemaining: card.remaining,
      totalDue: card.remaining,
      penalty: card.penalty ?? 0,
      overdueCount: late && !inGrace ? 1 : 0,
      graceCount: inGrace ? 1 : 0,
      dueTodayCount: dateKey(card.dueDate) === today ? 1 : 0,
      upcomingCount: card.upcoming || dateKey(card.dueDate) > today ? 1 : 0,
    });
  }
  return [...map.values()].sort((a, b) => b.overdueCount - a.overdueCount || a.memberName.localeCompare(b.memberName, "id"));
}

function billStatus(bill: LoanBill) {
  const parts: string[] = [];
  if (bill.overdueCount) parts.push(`${bill.overdueCount} kena denda`);
  if (bill.graceCount) parts.push(`${bill.graceCount} dalam toleransi`);
  if (bill.dueTodayCount) parts.push(`${bill.dueTodayCount} jatuh tempo hari ini`);
  if (bill.upcomingCount && !bill.overdueCount && !bill.dueTodayCount) parts.push("belum jatuh tempo");
  if (!parts.length) parts.push(`${bill.items.length} angsuran`);
  return parts.join(" · ");
}

export function CollectionPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const [params, setParams] = useSearchParams();
  const scope = params.get("tab") === "early" ? "early" : "due";
  const cards = useQuery({
    queryKey: ["cards", tenantId, scope],
    queryFn: () => ops.todayCards(tenantId ?? undefined, scope),
    enabled,
  });
  const receipts = useQuery({ queryKey: ["receipts", tenantId], queryFn: () => ops.receipts(tenantId ?? undefined), enabled });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [openId, setOpenId] = useState("");
  const canCollect = Boolean(user?.permissions.includes("collection:create"));

  function setScope(next: "due" | "early") {
    const nextParams = new URLSearchParams(params);
    if (next === "early") nextParams.set("tab", "early");
    else nextParams.delete("tab");
    setParams(nextParams, { replace: true });
  }

  const bills = useMemo(() => groupBills(cards.data ?? []), [cards.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) => b.memberName.toLowerCase().includes(q) || b.loanNo.toLowerCase().includes(q));
  }, [bills, query]);
  const totals = useMemo(
    () => ({
      loans: bills.length,
      installments: bills.reduce((sum, b) => sum + b.items.length, 0),
      overdue: bills.reduce((sum, b) => sum + b.overdueCount, 0),
      amount: bills.reduce((sum, b) => sum + b.totalDue, 0),
    }),
    [bills],
  );

  function refreshOps() {
    void qc.invalidateQueries({ queryKey: ["cards"] });
    void qc.invalidateQueries({ queryKey: ["receipts"] });
    void qc.invalidateQueries({ queryKey: ["loans"] });
    void qc.invalidateQueries({ queryKey: ["journals"] });
    void qc.invalidateQueries({ queryKey: ["reports"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
  }
  const collect = useMutation({
    mutationFn: (loanId: string) =>
      ops.collect(
        { loanId, amount: Number(amounts[loanId] || bills.find((b) => b.loanId === loanId)?.nextRemaining), clientReceiptId: crypto.randomUUID() },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Setoran tercatat",
      onSuccess: (_data, loanId) => {
        setAmounts((s) => ({ ...s, [loanId]: "" }));
        refreshOps();
      },
    }),
  });
  const voidReceipt = useMutation({
    mutationFn: (id: string) => ops.voidReceipt(id, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Kwitansi dibatalkan",
      onSuccess: refreshOps,
    }),
  });

  function amountOf(bill: LoanBill) {
    return amounts[bill.loanId] ?? String(bill.nextRemaining);
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Penagihan"
        description="Jatuh tempo: tagihan hari ini dan yang menunggak. Bayar lebih awal: angsuran yang belum hari H. Setoran: denda → bunga → pokok, dari angsuran tertua. Bunga tetap mengikuti jadwal."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setScope(t.id)}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-semibold",
              scope === t.id ? "bg-leaf text-white" : "bg-white text-mute border border-line",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">{scope === "early" ? "Bisa dibayar lebih awal" : "Pinjaman ditagih"}</p>
          <p className="mt-1 text-2xl font-extrabold">{totals.loans}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">
            {scope === "early" ? "Angsuran belum jatuh tempo" : "Angsuran tertunggak / hari ini"}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{totals.installments}</p>
          {totals.overdue ? <p className="mt-1 text-xs text-clay">{totals.overdue} sudah lewat tempo</p> : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">{scope === "early" ? "Sisa angsuran" : "Total tagihan"}</p>
          <p className="mt-1 text-2xl font-extrabold">{idr(totals.amount)}</p>
        </Card>
      </div>
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama anggota atau nomor pinjaman"
        aria-label="Cari tagihan"
      />
      {cards.isLoading ? <p className="text-sm text-mute">Memuat tagihan…</p> : null}
      {!cards.isLoading && visible.length === 0 ? (
        <Card className="p-5 text-sm text-mute">
          {bills.length === 0
            ? scope === "early"
              ? "Tidak ada pinjaman yang bisa dibayar lebih awal. Yang sudah jatuh tempo ada di tab Jatuh tempo."
              : "Tidak ada tagihan jatuh tempo atau tertunggak hari ini. Untuk setor sebelum hari H, buka tab Bayar lebih awal."
            : "Tidak ada pinjaman yang cocok dengan pencarian."}
        </Card>
      ) : null}
      <div className="space-y-3">
        {visible.map((bill) => {
          const first = bill.items[0];
          const last = bill.items[bill.items.length - 1];
          const open = openId === bill.loanId;
          return (
            <Card key={bill.loanId} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={bill.memberName} />
                  <div className="min-w-0">
                    <p className="font-extrabold">{bill.memberName}</p>
                    <p className="text-sm text-mute">
                      <span className="font-mono text-leaf-dark">{bill.loanNo}</span>
                      {" · "}
                      {billStatus(bill)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={`Kol ${bill.collectability} · ${KOL[bill.collectability] ?? ""}`} />
                      {bill.upcomingCount && !bill.overdueCount && !bill.dueTodayCount ? (
                        <span className="rounded-full bg-leaf-mist px-2.5 py-1 text-xs font-semibold text-leaf-dark">Lebih awal</span>
                      ) : null}
                      {bill.overdueCount ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-clay">Kena denda</span> : null}
                      {bill.graceCount ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Dalam toleransi</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-mute">
                      {bill.items.length === 1
                        ? `Jatuh tempo ${formatDay(first.dueDate)}`
                        : `${formatDay(first.dueDate)} – ${formatDay(last.dueDate)} · ${bill.items.length} angsuran`}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-leaf-dark hover:underline"
                      onClick={() => setOpenId(open ? "" : bill.loanId)}
                    >
                      {open ? "Sembunyikan rincian" : "Lihat rincian angsuran"}
                    </button>
                  </div>
                </div>
                <div className="w-full shrink-0 lg:w-80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                    {scope === "early" ? "Sisa angsuran" : "Total tagihan"}
                  </p>
                  <p className="text-2xl font-extrabold">{idr(bill.totalDue)}</p>
                  <p className="mt-1 text-xs text-mute">
                    1 angsuran {idr(bill.nextRemaining)}
                    {bill.penalty > 0 ? ` · termasuk denda ${idr(bill.penalty)}` : ""}
                    {scope === "early" ? " · tanpa denda" : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <MoneyInput
                      aria-label={`Nominal setor ${bill.memberName}`}
                      value={amountOf(bill)}
                      onValueChange={(digits) => setAmounts({ ...amounts, [bill.loanId]: digits })}
                    />
                    {canCollect ? (
                      <Button
                        disabled={collect.isPending && collect.variables === bill.loanId}
                        onClick={() => collect.mutate(bill.loanId)}
                      >
                        Setor
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAmounts({ ...amounts, [bill.loanId]: String(bill.nextRemaining) })}>
                      Isi 1 angsuran
                    </Button>
                    {bill.items.length > 1 ? (
                      <Button size="sm" variant="soft" onClick={() => setAmounts({ ...amounts, [bill.loanId]: String(bill.totalDue) })}>
                        {scope === "early" ? "Lunasi sisa" : "Isi semua"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              {open ? (
                <ul className="mt-4 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/80">
                  {bill.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 bg-canvas/50 px-4 py-2.5 text-sm">
                      <span className="text-mute">
                        {formatDay(item.dueDate)}
                        {item.upcoming ? " · belum jatuh tempo" : item.inGrace ? " · toleransi" : item.daysOverdue > 0 ? ` · ${item.daysOverdue} hari` : ""}
                        {item.penalty ? ` · denda ${idr(item.penalty)}` : ""}
                      </span>
                      <span className="font-semibold">{idr(item.remaining)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <p className="font-semibold">Kwitansi terbaru</p>
        <ul className="mt-2 space-y-2 text-sm">
          {receipts.data?.length ? (
            receipts.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <div className={r.status === "VOIDED" ? "text-mute line-through" : undefined}>
                  <p>
                    {r.receiptNo} · {r.member.name}
                  </p>
                  <p className="text-xs text-mute">
                    {r.loan.loanNo} · {idr(Number(r.amount))}
                    {r.paidOn ? ` · ${formatDay(r.paidOn)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status === "VOIDED" ? "VOIDED" : r.status ?? "POSTED"} />
                  {canCollect && r.status !== "VOIDED" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={voidReceipt.isPending}
                      onClick={() => {
                      void confirmAction({
                        title: `Batalkan ${r.receiptNo}?`,
                        text: "Saldo pinjaman dan kas kembali seperti sebelum setor.",
                        confirmText: "Batalkan kwitansi",
                        danger: true,
                      }).then((ok) => {
                        if (ok) voidReceipt.mutate(r.id);
                      });
                      }}
                    >
                      Batalkan
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          ) : (
            <li className="text-mute">Belum ada kwitansi.</li>
          )}
        </ul>
      </Card>
    </TenantGate>
  );
}
