import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops, type LoanRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Dialog, DialogBody, DialogHeader, Field, MoneyInput, PageHeader, SelectInput, StatusBadge, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";
import { LoanReviewPanel, loanBadge } from "./LoanReviewPanel";

const STEPS = [
  { key: "DRAFT", label: "1. Pengajuan" },
  { key: "APPROVED", label: "2. Putusan" },
  { key: "DISBURSED", label: "3. Pencairan" },
] as const;

function collectionHref(loanNo: string, schedule: Array<{ dueDate: string; status: string }>) {
  const today = new Date().toISOString().slice(0, 10);
  const hasDue = schedule.some((s) => s.status !== "PAID" && s.dueDate.slice(0, 10) <= today);
  const qs = new URLSearchParams({ q: loanNo });
  if (!hasDue) qs.set("tab", "early");
  return `/collection?${qs}`;
}

export function LoansPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canCreate = Boolean(user?.permissions.includes("loan:create"));
  const canDecide = Boolean(user?.permissions.includes("loan:approve"));
  const canCollect = Boolean(user?.permissions.includes("collection:create"));
  const [memberQ, setMemberQ] = useState("");
  const [debouncedMemberQ, setDebouncedMemberQ] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMemberQ(memberQ.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [memberQ]);
  const members = useQuery({
    queryKey: ["members", "picker", tenantId, debouncedMemberQ],
    queryFn: () =>
      ops.members({
        tenantId: tenantId ?? undefined,
        q: debouncedMemberQ || undefined,
        status: "ACTIVE",
        page: 1,
        pageSize: 50,
      }),
    enabled,
  });
  const products = useQuery({ queryKey: ["loan-products", tenantId], queryFn: () => ops.loanProducts(tenantId ?? undefined), enabled });
  const loans = useQuery({ queryKey: ["loans", tenantId], queryFn: () => ops.loans(tenantId ?? undefined), enabled });
  const [memberId, setMemberId] = useState("");
  const [productId, setProductId] = useState("");
  const [principal, setPrincipal] = useState("2000000");
  const [reviewId, setReviewId] = useState<string | null>(null);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["loans"] });
    void qc.invalidateQueries({ queryKey: ["loan-review"] });
    void qc.invalidateQueries({ queryKey: ["journals"] });
    void qc.invalidateQueries({ queryKey: ["collection"] });
  }

  const create = useMutation({
    mutationFn: () => ops.createLoan({ memberId, productId, principal: Number(principal) }, tenantId ?? undefined),
    ...noticeHandlers({ success: "Pengajuan tercatat", onSuccess: refresh }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const setupIncomplete =
    products.isSuccess && (products.data?.filter((p) => p.status !== "INACTIVE").length ?? 0) === 0;

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Pinjaman"
        description="Analis membuka berkas pengajuan dulu: riwayat anggota, simpanan, dan kelayakan. Putusan wajib disertai keterangan, termasuk jika disetujui dengan syarat."
        action={
          setupIncomplete ? (
            <Link to="/setup" className="text-sm font-semibold text-leaf-dark hover:underline">
              Data induk
            </Link>
          ) : undefined
        }
      />
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.key} className="rounded-2xl border border-line/80 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-leaf-dark">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-mute">
              {step.key === "DRAFT"
                ? "Analis mengajukan. Sistem menolak jika syarat data induk belum terpenuhi atau nominal di luar batas produk."
                : step.key === "APPROVED"
                  ? "Putusan dari tinjauan berkas: setujui, setujui dengan syarat, atau tolak — masing-masing dengan keterangan."
                  : "Kasir mencairkan setelah putusan. Pinjaman bersyarat baru boleh cair jika syarat sudah dipenuhi."}
            </p>
          </li>
        ))}
      </ol>
      {canCreate ? (
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Pengajuan baru</p>
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Field label="Cari anggota">
              <TextInput
                value={memberQ}
                onChange={(e) => setMemberQ(e.target.value)}
                placeholder="Nama, nomor, atau NIK"
                aria-label="Cari anggota untuk pengajuan"
              />
            </Field>
            <Field label="Anggota">
              <SelectInput value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">Pilih</option>
                {(members.data?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} · {m.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Produk">
              <SelectInput value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Pilih</option>
                {products.data
                  ?.filter((p) => p.status !== "INACTIVE")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {(Number(p.annualRate) * 100).toFixed(2)}%{" "}
                      {p.rateBasis === "DAILY" ? "/hari" : p.rateBasis === "PRINCIPAL_TOTAL" ? "dari pokok" : "/tahun"} · {p.periods}x
                    </option>
                  ))}
              </SelectInput>
            </Field>
            <Field label="Pokok">
              <MoneyInput value={principal} onValueChange={setPrincipal} required />
            </Field>
            <Button type="submit">Ajukan</Button>
          </form>
          {(products.data?.filter((p) => p.status !== "INACTIVE").length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-mute">
              Belum ada produk pinjaman aktif.{" "}
              <Link to="/products" className="font-semibold text-leaf-dark hover:underline">
                Tambah di data induk
              </Link>
              .
            </p>
          ) : null}
        </Card>
      ) : null}
      <div className="space-y-3">
        {loans.data?.map((l) => (
          <LoanCard
            key={l.id}
            loan={l}
            canCollect={canCollect}
            onOpenBerkas={() => setReviewId(l.id)}
          />
        ))}
      </div>
      {reviewId ? (
        <LoanReviewPanel
          loanId={reviewId}
          tenantId={tenantId ?? undefined}
          canDecide={canDecide}
          onClose={() => setReviewId(null)}
          onChanged={() => {
            refresh();
            setReviewId(null);
          }}
        />
      ) : null}
    </TenantGate>
  );
}

function LoanCard({
  loan: l,
  canCollect,
  onOpenBerkas,
}: {
  loan: LoanRow;
  canCollect: boolean;
  onOpenBerkas: () => void;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const paidCount = l.schedule.filter((s) => s.status === "PAID").length;
  const nextDue = l.schedule.find((s) => s.status !== "PAID");
  const nextAmount = nextDue ? Number(nextDue.principalDue) + Number(nextDue.interestDue) + Number(nextDue.penaltyDue ?? 0) : 0;
  const canSetor = l.status === "DISBURSED" && canCollect && Number(l.outstandingPrincipal) > 0;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-leaf-dark">{l.loanNo}</p>
          <p className="mt-0.5 truncate text-base font-extrabold tracking-tight">{l.member.name}</p>
          <p className="mt-1 text-sm text-mute">
            {l.product.name} · pokok {idr(Number(l.principal))}
            {l.status === "DISBURSED" || l.status === "CLOSED" ? ` · sisa ${idr(Number(l.outstandingPrincipal))}` : ""}
          </p>
          {l.schedule.length ? (
            <p className="mt-1 text-xs text-mute">
              {paidCount}/{l.schedule.length} angsuran lunas
              {nextDue
                ? ` · berikutnya ${new Date(nextDue.dueDate).toLocaleDateString("id-ID")} · ${idr(nextAmount)}`
                : ""}
            </p>
          ) : l.decisionConditions && l.status === "APPROVED" ? (
            <p className="mt-1 text-xs font-medium text-amber-800">Bersyarat — lihat berkas</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusBadge status={loanBadge(l)} />
          {l.status === "DISBURSED" ? <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-mute">Kol {l.collectability}</span> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {l.schedule.length ? (
          <Button size="sm" variant="ghost" onClick={() => setShowSchedule(true)}>
            Jadwal angsuran
          </Button>
        ) : null}
        <Button size="sm" variant="soft" onClick={onOpenBerkas}>
          {l.status === "DRAFT" ? "Tinjau pengajuan" : "Lihat berkas"}
        </Button>
        {canSetor ? (
          <Link to={collectionHref(l.loanNo, l.schedule)}>
            <Button size="sm">Setor</Button>
          </Link>
        ) : null}
      </div>
      {showSchedule ? <LoanScheduleDialog loan={l} onClose={() => setShowSchedule(false)} canSetor={canSetor} /> : null}
    </Card>
  );
}

const SCHEDULE_STATUS: Record<string, string> = {
  PAID: "Lunas",
  PARTIAL: "Sebagian",
  DUE: "Belum",
};

function LoanScheduleDialog({
  loan,
  onClose,
  canSetor,
}: {
  loan: LoanRow;
  onClose: () => void;
  canSetor: boolean;
}) {
  const paidCount = loan.schedule.filter((s) => s.status === "PAID").length;
  const paidAmount = loan.schedule.reduce((sum, s) => sum + Number(s.principalPaid ?? 0) + Number(s.interestPaid ?? 0) + Number(s.penaltyPaid ?? 0), 0);
  const dueAmount = loan.schedule.reduce((sum, s) => sum + Number(s.principalDue) + Number(s.interestDue) + Number(s.penaltyDue ?? 0), 0);

  return (
    <Dialog onClose={onClose} className="max-w-4xl">
      <DialogHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">{loan.loanNo}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">Jadwal angsuran · {loan.member.name}</h2>
          <p className="mt-1 text-sm text-mute">
            {loan.product.name} · {paidCount}/{loan.schedule.length} lunas · terbayar {idr(paidAmount)} dari {idr(dueAmount)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {canSetor ? (
            <Link to={collectionHref(loan.loanNo, loan.schedule)}>
              <Button size="sm">Setor</Button>
            </Link>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogHeader>
      <DialogBody>
        <div className="overflow-x-auto rounded-2xl border border-line/70">
          <table className="w-full text-sm">
            <thead className="bg-canvas/70">
              <tr>
                <Th>#</Th>
                <Th>Jatuh tempo</Th>
                <Th className="text-right">Pokok</Th>
                <Th className="text-right">Bunga</Th>
                <Th className="text-right">Jumlah</Th>
                <Th className="text-right">Terbayar</Th>
                <Th className="text-right">Sisa</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {loan.schedule.map((s) => {
                const due = Number(s.principalDue) + Number(s.interestDue) + Number(s.penaltyDue ?? 0);
                const paid = Number(s.principalPaid ?? 0) + Number(s.interestPaid ?? 0) + Number(s.penaltyPaid ?? 0);
                const remaining = Math.max(0, due - paid);
                return (
                  <tr key={s.id} className="border-t border-line/70">
                    <Td className="font-mono text-mute">{s.sequence}</Td>
                    <Td className="whitespace-nowrap">{new Date(s.dueDate).toLocaleDateString("id-ID")}</Td>
                    <Td className="text-right">{idr(Number(s.principalDue))}</Td>
                    <Td className="text-right">{idr(Number(s.interestDue))}</Td>
                    <Td className="text-right font-medium">{idr(due)}</Td>
                    <Td className="text-right">{paid ? idr(paid) : "—"}</Td>
                    <Td className="text-right">{remaining ? idr(remaining) : "—"}</Td>
                    <Td>
                      <StatusBadge status={SCHEDULE_STATUS[s.status] ?? s.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogBody>
    </Dialog>
  );
}
