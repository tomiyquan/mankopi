import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ops, type LoanDecisionKind, type LoanRow } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { idr } from "../lib/money";
import { EDUCATION_LABEL, EMPLOYMENT_LABEL, GENDER_LABEL, HOUSE_LABEL, labeled, MARITAL_LABEL, RELIGION_LABEL } from "../lib/member";
import { Button, Field, StatusBadge, TextArea } from "../ui/kit";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Pengajuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  DISBURSED: "Dicairkan",
  CLOSED: "Lunas",
};

const RATE_LABEL: Record<string, string> = {
  ANNUAL: "/tahun",
  DAILY: "/hari",
  PRINCIPAL_TOTAL: "dari pokok",
};

const METHOD_LABEL: Record<string, string> = {
  FLAT: "Flat",
  DECLINING: "Menurun",
  ANNUITY: "Anuitas",
  DAILY_EFFECTIVE: "Efektif harian",
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: "harian",
  WEEKLY: "mingguan",
  BIWEEKLY: "dua mingguan",
  MONTHLY: "bulanan",
};

export function loanBadge(loan: Pick<LoanRow, "status" | "decisionKind">) {
  if (loan.status === "APPROVED" && loan.decisionKind === "CONDITIONAL") return "Disetujui bersyarat";
  return STATUS_LABEL[loan.status] ?? loan.status;
}

export function LoanReviewPanel({
  loanId,
  tenantId,
  canDecide,
  onClose,
  onChanged,
}: {
  loanId: string;
  tenantId?: string;
  canDecide: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const review = useQuery({
    queryKey: ["loan-review", loanId, tenantId],
    queryFn: () => ops.loanReview(loanId, tenantId),
  });
  const [decision, setDecision] = useState<LoanDecisionKind>("APPROVED");
  const [note, setNote] = useState("");
  const [conditions, setConditions] = useState("");
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const decide = useMutation({
    mutationFn: () =>
      ops.decideLoan(
        loanId,
        { decision, note, conditions: decision === "CONDITIONAL" ? conditions : undefined },
        tenantId,
      ),
    ...noticeHandlers({
      success: (_d, _v) =>
        decision === "REJECTED" ? "Pengajuan ditolak" : decision === "CONDITIONAL" ? "Disetujui dengan syarat" : "Pinjaman disetujui",
      onSuccess: onChanged,
    }),
  });
  const disburse = useMutation({
    mutationFn: () => ops.disburse(loanId, tenantId, { conditionsCleared: cleared || undefined }),
    ...noticeHandlers({ success: "Pinjaman dicairkan", onSuccess: onChanged }),
  });

  const data = review.data;
  const draft = data?.loan.status === "DRAFT";
  const approved = data?.loan.status === "APPROVED";
  const conditional = data?.loan.decisionKind === "CONDITIONAL";

  function submit(e: FormEvent) {
    e.preventDefault();
    decide.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-leaf-deep/40 p-3 backdrop-blur-sm sm:p-6">
      <section className="relative my-auto w-full max-w-3xl rounded-2.5xl border border-line/80 bg-white shadow-pop">
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">Tinjauan analis kredit</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              {data?.loan.loanNo ?? "Memuat…"} · {data?.member.name ?? ""}
            </h2>
            <p className="mt-1 text-sm text-mute">Dasar putusan dari data anggota, simpanan, riwayat kredit, dan perkiraan angsuran.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </header>

        {review.isError ? (
          <p className="px-5 py-8 text-sm text-clay">{review.error instanceof Error ? review.error.message : "Gagal memuat tinjauan"}</p>
        ) : null}
        {!data && review.isLoading ? <p className="px-5 py-8 text-sm text-mute">Menyusun berkas analis…</p> : null}

        {data ? (
          <div className="space-y-5 px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={loanBadge(data.loan)} />
              <span className="text-sm font-semibold">{idr(Number(data.loan.principal))}</span>
              <span className="text-sm text-mute">
                {data.loan.product.name} · {(data.loan.annualRate * 100).toFixed(2)}% {RATE_LABEL[data.loan.rateBasis] ?? ""} ·{" "}
                {METHOD_LABEL[data.loan.method] ?? data.loan.method} · {data.loan.periods}x {FREQ_LABEL[data.loan.frequency] ?? ""}
              </span>
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <CardBlock title="Identitas anggota">
                <Row label="No. anggota" value={data.member.memberNo} />
                <Row label="NIK" value={data.member.nik} />
                <Row label="Jenis kelamin" value={labeled(GENDER_LABEL, data.member.gender)} />
                <Row
                  label="Lahir"
                  value={
                    data.member.dateOfBirth
                      ? `${data.member.placeOfBirth ?? "—"}, ${new Date(data.member.dateOfBirth).toLocaleDateString("id-ID")}${
                          data.member.ageYears != null ? ` · ${data.member.ageYears} th` : ""
                        }`
                      : (data.member.placeOfBirth ?? "—")
                  }
                />
                <Row label="Ibu kandung" value={data.member.motherName ?? "—"} />
                <Row label="Perkawinan" value={labeled(MARITAL_LABEL, data.member.maritalStatus)} />
                <Row label="Agama" value={labeled(RELIGION_LABEL, data.member.religion)} />
                <Row label="Pendidikan" value={labeled(EDUCATION_LABEL, data.member.education)} />
                <Row label="Telepon" value={[data.member.phone, data.member.phoneAlt].filter(Boolean).join(" · ") || "—"} />
                <Row label="Alamat" value={data.member.address ?? "—"} />
                <Row
                  label="Kantor"
                  value={[data.member.branch?.name, data.member.unit?.name].filter(Boolean).join(" · ") || "—"}
                />
              </CardBlock>
              <CardBlock title="Kapasitas & keluarga">
                <Row label="Pekerjaan" value={[data.member.occupation, labeled(EMPLOYMENT_LABEL, data.member.employmentType)].filter((v) => v && v !== "—").join(" · ") || "—"} />
                <Row label="Instansi" value={data.member.employerName ?? "—"} />
                <Row label="Penghasilan" value={data.member.monthlyIncome ? idr(data.member.monthlyIncome) : "—"} />
                <Row label="Penghasilan lain" value={data.member.otherIncome ? idr(data.member.otherIncome) : "—"} />
                <Row label="Rumah" value={labeled(HOUSE_LABEL, data.member.houseStatus)} />
                <Row label="Pasangan" value={data.member.spouseName ?? "—"} />
                <Row label="Tanggungan" value={data.member.dependents != null ? String(data.member.dependents) : "—"} />
                <Row label="Ahli waris" value={[data.member.heirName, data.member.heirRelation].filter(Boolean).join(" · ") || "—"} />
                <Row label="Darurat" value={[data.member.emergencyName, data.member.emergencyPhone].filter(Boolean).join(" · ") || "—"} />
              </CardBlock>
            </section>
            <CardBlock title="Simpanan">
              {data.savings.length === 0 ? <p className="text-sm text-mute">Belum ada rekening simpanan</p> : null}
              {data.savings.map((s) => (
                <Row key={s.id} label={s.name} value={idr(s.balance)} />
              ))}
              <Row label="Total simpanan" value={idr(data.savingsTotal)} />
            </CardBlock>

            <CardBlock title="Riwayat pinjaman anggota">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini label="Akumulasi tersalur" value={idr(data.history.disbursedTotal)} />
                <Mini label="Aktif" value={`${data.history.activeCount} · ${idr(data.history.activeOutstanding)}`} />
                <Mini label="Lancar" value={`${data.history.lancarCount} · ${idr(data.history.lancarOutstanding)}`} />
                <Mini
                  label="Macet"
                  value={`${data.history.macetCount} · ${idr(data.history.macetOutstanding)}`}
                  warn={data.history.macetCount > 0}
                />
              </div>
              {data.history.loans.length === 0 ? <p className="mt-3 text-sm text-mute">Belum ada pinjaman lain</p> : null}
              {data.history.loans.length > 0 ? (
                <ul className="mt-3 divide-y divide-line/70 text-sm">
                  {data.history.loans.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-mono text-leaf-dark">{row.loanNo}</span> · {row.productName}
                      </span>
                      <span className="text-mute">
                        {idr(row.principal)} · {STATUS_LABEL[row.status] ?? row.status}
                        {row.status === "DISBURSED" ? ` · Kol ${row.collectability}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBlock>

            <CardBlock title="Perkiraan angsuran jika dicairkan hari ini">
              <p className="text-sm">
                Angsuran {idr(data.preview.installment)} · bunga kira-kira {idr(data.preview.totalInterest)}
                {data.preview.firstDue && data.preview.lastDue
                  ? ` · ${new Date(data.preview.firstDue).toLocaleDateString("id-ID")} s.d. ${new Date(data.preview.lastDue).toLocaleDateString("id-ID")}`
                  : ""}
              </p>
              <ul className="mt-2 max-h-36 overflow-auto text-xs text-mute">
                {data.preview.schedule.map((s) => (
                  <li key={s.sequence}>
                    #{s.sequence} {new Date(s.dueDate).toLocaleDateString("id-ID")} · {idr(s.totalDue)}
                  </li>
                ))}
              </ul>
            </CardBlock>

            <CardBlock title="Catatan kelayakan">
              <ul className="space-y-1.5">
                {data.flags.map((flag) => (
                  <li key={flag.code} className={`text-sm ${flag.level === "warn" ? "text-clay" : "text-leaf-dark"}`}>
                    {flag.level === "warn" ? "Perlu perhatian — " : "Layak — "}
                    {flag.label}
                  </li>
                ))}
              </ul>
            </CardBlock>

            {!draft && data.loan.decisionNote ? (
              <CardBlock title="Putusan tercatat">
                <Row
                  label="Jenis"
                  value={
                    data.loan.decisionKind === "CONDITIONAL"
                      ? "Disetujui dengan syarat"
                      : data.loan.decisionKind === "REJECTED"
                        ? "Ditolak"
                        : "Disetujui"
                  }
                />
                <Row label="Analis" value={data.loan.decidedBy?.name ?? "—"} />
                <Row
                  label="Tanggal"
                  value={data.loan.decidedAt ? new Date(data.loan.decidedAt).toLocaleString("id-ID") : "—"}
                />
                <p className="mt-2 text-sm leading-6">{data.loan.decisionNote}</p>
                {data.loan.decisionConditions ? (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="font-semibold">Syarat: </span>
                    {data.loan.decisionConditions}
                  </p>
                ) : null}
              </CardBlock>
            ) : null}

            {draft && canDecide ? (
              <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line/80 bg-canvas/50 p-4">
                <p className="text-sm font-semibold">Putusan analis</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["APPROVED", "Setujui"],
                      ["CONDITIONAL", "Setujui dengan syarat"],
                      ["REJECTED", "Tolak"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                        decision === value ? "border-leaf bg-white text-leaf-dark" : "border-line bg-white text-mute"
                      }`}
                    >
                      <input type="radio" name="decision" checked={decision === value} onChange={() => setDecision(value)} />
                      {label}
                    </label>
                  ))}
                </div>
                <Field label="Keterangan / dasar putusan">
                  <TextArea
                    required
                    minLength={8}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Anggota lancar, simpanan cukup, tidak ada tunggakan. Pengajuan sesuai plafon produk."
                  />
                </Field>
                {decision === "CONDITIONAL" ? (
                  <Field label="Syarat yang harus dipenuhi">
                    <TextArea
                      required
                      minLength={8}
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="Contoh: Lunasi simpanan wajib tertunggak dan serahkan jaminan BPKB sebelum pencairan."
                    />
                  </Field>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={onClose}>
                    Batal
                  </Button>
                  <Button type="submit" variant={decision === "REJECTED" ? "danger" : "primary"} disabled={decide.isPending}>
                    {decision === "REJECTED" ? "Tolak pengajuan" : decision === "CONDITIONAL" ? "Simpan putusan bersyarat" : "Setujui"}
                  </Button>
                </div>
              </form>
            ) : null}

            {approved && canDecide ? (
              <div className="space-y-3 rounded-2xl border border-line/80 bg-canvas/50 p-4">
                {conditional && !data.loan.conditionsClearedAt ? (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
                    <span>Syarat operasional sudah dipenuhi. Pencairan boleh dilanjutkan.</span>
                  </label>
                ) : null}
                <Button
                  disabled={disburse.isPending || (conditional && !data.loan.conditionsClearedAt && !cleared)}
                  onClick={() => {
                    void confirmAction({
                      title: `Cairkan ${data.loan.loanNo}?`,
                      text: conditional
                        ? "Syarat dicatat terpenuhi. Kas berkurang, piutang bertambah, dan jadwal angsuran dibuat."
                        : "Kas berkurang, piutang bertambah, dan jadwal angsuran dibuat.",
                      confirmText: "Cairkan",
                    }).then((ok) => {
                      if (ok) disburse.mutate();
                    });
                  }}
                >
                  Cairkan
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CardBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-white p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-mute">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </p>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${warn ? "bg-red-50" : "bg-canvas"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className={`mt-0.5 text-sm font-extrabold ${warn ? "text-clay" : ""}`}>{value}</p>
    </div>
  );
}
