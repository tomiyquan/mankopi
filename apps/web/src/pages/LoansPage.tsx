import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops, type LoanRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, StatusBadge } from "../ui/kit";
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
  const members = useQuery({ queryKey: ["members", tenantId], queryFn: () => ops.members(tenantId ?? undefined), enabled });
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

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Pinjaman"
        description="Analis membuka berkas pengajuan dulu: riwayat anggota, simpanan, dan kelayakan. Putusan wajib disertai keterangan, termasuk jika disetujui dengan syarat."
        action={
          <Link to="/setup" className="text-sm font-semibold text-leaf-dark hover:underline">
            Data induk
          </Link>
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
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
            <Field label="Anggota">
              <SelectInput value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">Pilih</option>
                {members.data?.map((m) => (
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
            onOpen={() => setReviewId(l.id)}
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
  onOpen,
}: {
  loan: LoanRow;
  canCollect: boolean;
  onOpen: () => void;
}) {
  return (
    <Card className="p-5">
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-leaf-dark">{l.loanNo}</p>
            <p className="font-semibold">{l.member.name}</p>
            <p className="text-sm text-mute">
              {l.product.name} · Pokok {idr(Number(l.principal))}
              {l.status === "DISBURSED" ? ` · outstanding ${idr(Number(l.outstandingPrincipal))}` : ""}
            </p>
            {l.decisionNote ? <p className="mt-2 line-clamp-2 text-sm text-mute">{l.decisionNote}</p> : null}
            {l.decisionConditions ? (
              <p className="mt-1 text-xs font-medium text-amber-800">Syarat: {l.decisionConditions}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={loanBadge(l)} />
            {l.status === "DISBURSED" ? <span className="text-xs text-mute">Kol {l.collectability}</span> : null}
          </div>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={onOpen}>
          {l.status === "DRAFT" ? "Tinjau pengajuan" : "Lihat berkas"}
        </Button>
        {l.status === "DISBURSED" && canCollect && Number(l.outstandingPrincipal) > 0 ? (
          <Link to={collectionHref(l.loanNo, l.schedule)}>
            <Button size="sm" variant="ghost">
              Setor
            </Button>
          </Link>
        ) : null}
      </div>
      {l.schedule.length ? (
        <ul className="mt-3 max-h-40 overflow-auto text-xs text-mute">
          {l.schedule.slice(0, 6).map((s) => (
            <li key={s.id}>
              #{s.sequence} {new Date(s.dueDate).toLocaleDateString("id-ID")} · {idr(Number(s.principalDue) + Number(s.interestDue))} · {s.status}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
