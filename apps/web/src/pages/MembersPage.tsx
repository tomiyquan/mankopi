import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ops, type MemberRow } from "../lib/api";
import {
  emptyMemberForm,
  formToPayload,
  formatMemberAddress,
  labeled,
  memberCompleteness,
  MEMBER_TYPE_LABEL,
  memberToForm,
  type MemberFormState,
} from "../lib/member";
import { idr } from "../lib/money";
import { noticeHandlers, confirmAction } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Dialog, DialogBody, DialogHeader, Field, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextArea, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";
import { MemberFormFields } from "./MemberFormFields";

const MEMBER_STATUS_LABEL: Record<string, string> = { ACTIVE: "Aktif", LEFT: "Berhenti" };
const OPEN_LOAN = new Set(["DRAFT", "APPROVED", "DISBURSED"]);
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTERS = [
  { id: "ACTIVE", label: "Aktif" },
  { id: "LEFT", label: "Berhenti" },
  { id: "ALL", label: "Semua" },
] as const;

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function MembersPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canWrite = Boolean(user?.permissions.includes("member:create"));
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm());
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]["id"]>("ACTIVE");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [tenantId, pageSize, statusFilter]);

  const members = useQuery({
    queryKey: ["members", tenantId, debouncedQ, statusFilter, page, pageSize],
    queryFn: () =>
      ops.members({
        tenantId: tenantId ?? undefined,
        q: debouncedQ || undefined,
        status: statusFilter,
        page,
        pageSize,
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
  const branches = useQuery({ queryKey: ["branches", tenantId], queryFn: () => api.branches(tenantId ?? undefined), enabled });

  const items = members.data?.items ?? [];
  const total = members.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const activeBranches = (branches.data ?? []).filter((b) => b.status === "ACTIVE");
  useEffect(() => {
    if (!form.branchId && activeBranches.length) {
      const hq = activeBranches.find((b) => b.code === "HQ") ?? activeBranches[0];
      setForm((prev) => ({ ...prev, branchId: hq.id }));
    }
  }, [activeBranches, form.branchId]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["members"] });
    void qc.invalidateQueries({ queryKey: ["summary"] });
    void qc.invalidateQueries({ queryKey: ["loan-review"] });
  }

  const create = useMutation({
    mutationFn: () => ops.createMember(formToPayload(form), tenantId ?? undefined),
    ...noticeHandlers({
      success: "Anggota terdaftar",
      onSuccess: () => {
        setForm(emptyMemberForm(form.branchId));
        setShowForm(false);
        refresh();
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Anggota"
        description="Pendaftaran, kelengkapan berkas, dan pencatatan anggota yang berhenti. Anggota berhenti tidak bisa mengajukan pinjaman atau setor simpanan baru."
        action={
          canWrite ? (
            <Button variant={showForm ? "ghost" : "primary"} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Tutup formulir" : "Daftar anggota"}
            </Button>
          ) : null
        }
      />
      {canWrite && showForm ? (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-5">
            <MemberFormFields form={form} setForm={setForm} branches={branches.data ?? []} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Simpan pendaftaran
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <label className="flex items-center gap-2 text-sm text-mute">
          <span className="whitespace-nowrap">Status</span>
          <div className="w-36">
            <SelectInput
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as (typeof FILTERS)[number]["id"])}
              aria-label="Filter status anggota"
            >
              {FILTERS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </SelectInput>
          </div>
        </label>
        <div className="w-full max-w-md flex-1">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor, nama, NIK, HP, atau pekerjaan"
            aria-label="Cari anggota"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <span className="whitespace-nowrap">Baris per halaman</span>
          <div className="w-24">
            <SelectInput value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Jumlah baris per halaman">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </SelectInput>
          </div>
        </label>
      </div>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>No</Th>
              <Th>Nama</Th>
              <Th>Kontak</Th>
              <Th>Pekerjaan</Th>
              <Th>Kantor</Th>
              <Th>Berkas</Th>
              <Th>Status</Th>
              <Th className="sticky right-0 z-[1] bg-canvas/95 text-right shadow-[-8px_0_12px_-10px_rgba(18,36,28,0.18)]">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((m) => {
              const complete = memberCompleteness(m);
              return (
                <tr key={m.id} className="group border-t border-line/70">
                  <Td className="font-mono">{m.memberNo}</Td>
                  <Td>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-mute">{m.nik}</p>
                  </Td>
                  <Td>
                    <p>{m.phone ?? "—"}</p>
                    <p className="text-xs text-mute">{formatMemberAddress(m) || "Alamat belum diisi"}</p>
                  </Td>
                  <Td>{m.occupation ?? "—"}</Td>
                  <Td>
                    {m.branch?.name ?? "—"}
                    {m.unit?.name ? ` · ${m.unit.name}` : ""}
                  </Td>
                  <Td>
                    <span className={complete.percent < 60 ? "text-clay" : "text-leaf-dark"}>{complete.percent}%</span>
                    <span className="text-mute"> · {MEMBER_TYPE_LABEL[m.memberType ?? "REGULAR"] ?? m.memberType}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={MEMBER_STATUS_LABEL[m.status] ?? m.status} />
                  </Td>
                  <Td className="sticky right-0 z-[1] bg-white text-right shadow-[-8px_0_12px_-10px_rgba(18,36,28,0.12)] group-hover:bg-[#f3faf6]">
                    <Button size="sm" variant="soft" className="whitespace-nowrap" onClick={() => setSelected(m)}>
                      Buka berkas
                    </Button>
                  </Td>
                </tr>
              );
            })
            ) : (
              <tr>
                <Td className="py-10 text-center text-mute" colSpan={8}>
                  {members.isFetching
                    ? "Memuat anggota…"
                    : debouncedQ
                      ? "Tidak ada anggota yang cocok dengan pencarian."
                      : statusFilter === "LEFT"
                        ? "Belum ada anggota yang berhenti."
                        : "Belum ada anggota"}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-mute">
            {total ? `Menampilkan ${from}–${to} dari ${total} anggota` : "Tidak ada data"}
            {members.isFetching ? " · memperbarui…" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Sebelumnya
            </Button>
            <span className="min-w-24 text-center text-xs font-medium text-mute">
              Halaman {Math.min(page, pageCount)} / {pageCount}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      </TableWrap>
      {selected ? (
        <MemberDossier
          member={selected}
          branches={branches.data ?? []}
          canWrite={canWrite}
          tenantId={tenantId ?? undefined}
          onClose={() => setSelected(null)}
          onSaved={() => {
            refresh();
            setSelected(null);
          }}
        />
      ) : null}
    </TenantGate>
  );
}

function MemberDossier({
  member,
  branches,
  canWrite,
  tenantId,
  onClose,
  onSaved,
}: {
  member: MemberRow;
  branches: Awaited<ReturnType<typeof api.branches>>;
  canWrite: boolean;
  tenantId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reason, setReason] = useState("");
  const [leftOn, setLeftOn] = useState(todayIso);
  const [form, setForm] = useState<MemberFormState>(() => memberToForm(member));
  const left = member.status === "LEFT";
  const openLoans = member.loans.filter((loan) => OPEN_LOAN.has(loan.status));
  const save = useMutation({
    mutationFn: () => ops.updateMember(member.id, formToPayload(form), tenantId),
    ...noticeHandlers({ success: "Berkas anggota diperbarui", onSuccess: onSaved }),
  });
  const leave = useMutation({
    mutationFn: () => ops.leaveMember(member.id, { reason, leftOn }, tenantId),
    ...noticeHandlers({ success: "Anggota dicatat berhenti", onSuccess: onSaved }),
  });
  const restore = useMutation({
    mutationFn: () => ops.restoreMember(member.id, tenantId),
    ...noticeHandlers({ success: "Keanggotaan diaktifkan kembali", onSuccess: onSaved }),
  });

  return (
    <Dialog onClose={onClose} className="max-w-4xl">
      <DialogHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">{member.memberNo}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{member.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-mute">
            <StatusBadge status={MEMBER_STATUS_LABEL[member.status] ?? member.status} />
            <span>
              {labeled(MEMBER_TYPE_LABEL, member.memberType)} · kelengkapan {memberCompleteness(member).percent}%
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {canWrite && !editing && !leaving && !left ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Lengkapi berkas
            </Button>
          ) : null}
          {canWrite && !editing && !leaving && !left ? (
            <Button size="sm" variant="danger" onClick={() => setLeaving(true)}>
              Catat berhenti
            </Button>
          ) : null}
          {canWrite && left && !editing ? (
            <Button
              size="sm"
              onClick={() => {
                void confirmAction({
                  title: "Aktifkan kembali keanggotaan?",
                  text: "Anggota bisa kembali mengajukan pinjaman dan setor simpanan.",
                  confirmText: "Aktifkan",
                }).then((ok) => {
                  if (ok) restore.mutate();
                });
              }}
              disabled={restore.isPending}
            >
              Aktifkan kembali
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogHeader>
      <DialogBody>
        {leaving ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              leave.mutate();
            }}
          >
            <p className="text-sm leading-6 text-mute">
              Setelah berhenti, anggota tidak bisa mengajukan pinjaman atau setor simpanan baru. Penarikan simpanan mengikuti aturan produk.
            </p>
            {openLoans.length ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-clay">
                Masih ada {openLoans.length} pinjaman berjalan atau pengajuan (
                {openLoans.map((loan) => loan.loanNo).join(", ")}). Selesaikan dulu sebelum mencatat berhenti.
              </p>
            ) : null}
            <Field label="Tanggal berhenti">
              <TextInput type="date" value={leftOn} onChange={(e) => setLeftOn(e.target.value)} required />
            </Field>
            <Field label="Alasan">
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Misalnya mengundurkan diri karena pindah domisili"
                required
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setLeaving(false)}>
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={leave.isPending || openLoans.length > 0}>
                Simpan berhenti
              </Button>
            </div>
          </form>
        ) : editing ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <MemberFormFields form={form} setForm={setForm} branches={branches} lockNik />
            <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line/70 bg-white/95 px-5 py-3 backdrop-blur-sm">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Simpan berkas
              </Button>
            </div>
          </form>
        ) : (
          <MemberReadout member={member} />
        )}
      </DialogBody>
    </Dialog>
  );
}

function MemberReadout({ member: m }: { member: MemberRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReadBlock title="Identitas">
        <Line label="NIK" value={m.nik} />
        <Line label="Lahir" value={[m.placeOfBirth, m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString("id-ID") : null].filter(Boolean).join(", ") || "—"} />
        <Line label="Ibu kandung" value={m.motherName ?? "—"} />
        <Line label="Jenis kelamin" value={labeled({ MALE: "Laki-laki", FEMALE: "Perempuan" }, m.gender)} />
        <Line label="Agama" value={labeled({ ISLAM: "Islam", CHRISTIAN: "Kristen", CATHOLIC: "Katolik", HINDU: "Hindu", BUDDHIST: "Buddha", CONFUCIAN: "Konghucu", OTHER: "Lainnya" }, m.religion)} />
        <Line label="Perkawinan" value={labeled({ SINGLE: "Belum kawin", MARRIED: "Kawin", WIDOWED: "Duda / janda", DIVORCED: "Cerai" }, m.maritalStatus)} />
        <Line label="Pendidikan" value={m.education ?? "—"} />
        <Line label="No. KK" value={m.familyCardNo ?? "—"} />
        <Line label="NPWP" value={m.npwp ?? "—"} />
      </ReadBlock>
      <ReadBlock title="Kontak & alamat">
        <Line label="HP" value={m.phone ?? "—"} />
        <Line label="HP alternatif" value={m.phoneAlt ?? "—"} />
        <Line label="Email" value={m.email ?? "—"} />
        <Line label="Alamat" value={formatMemberAddress(m) || "—"} />
        <Line label="Rumah" value={labeled({ OWNED: "Milik sendiri", FAMILY: "Milik keluarga", RENT: "Sewa / kontrak", OFFICIAL: "Dinas", OTHER: "Lainnya" }, m.houseStatus)} />
        <Line label="Lama tinggal" value={m.yearsAtAddress != null ? `${m.yearsAtAddress} tahun` : "—"} />
      </ReadBlock>
      <ReadBlock title="Keluarga">
        <Line label="Pasangan" value={m.spouseName ?? "—"} />
        <Line label="Tanggungan" value={m.dependents != null ? String(m.dependents) : "—"} />
        <Line label="Ahli waris" value={[m.heirName, m.heirRelation, m.heirPhone].filter(Boolean).join(" · ") || "—"} />
        <Line label="Darurat" value={[m.emergencyName, m.emergencyRelation, m.emergencyPhone].filter(Boolean).join(" · ") || "—"} />
      </ReadBlock>
      <ReadBlock title="Pekerjaan">
        <Line label="Pekerjaan" value={m.occupation ?? "—"} />
        <Line label="Jenis" value={labeled({ EMPLOYEE: "Karyawan", SELF_EMPLOYED: "Wiraswasta", FARMER: "Petani / nelayan", CIVIL_SERVANT: "ASN / TNI / Polri", INFORMAL: "Pekerja informal", RETIRED: "Pensiunan", OTHER: "Lainnya" }, m.employmentType)} />
        <Line label="Instansi" value={m.employerName ?? "—"} />
        <Line label="Alamat kerja" value={m.workAddress ?? "—"} />
        <Line label="Penghasilan" value={m.monthlyIncome != null ? idr(Number(m.monthlyIncome)) : "—"} />
        <Line label="Penghasilan lain" value={m.otherIncome != null ? idr(Number(m.otherIncome)) : "—"} />
      </ReadBlock>
      <ReadBlock title="Keanggotaan">
        <Line label="Kantor" value={[m.branch?.name, m.unit?.name].filter(Boolean).join(" · ") || "—"} />
        <Line label="Status" value={MEMBER_STATUS_LABEL[m.status] ?? m.status} />
        <Line label="Bergabung" value={m.joinedOn ? new Date(m.joinedOn).toLocaleDateString("id-ID") : "—"} />
        {m.status === "LEFT" ? (
          <>
            <Line label="Berhenti" value={m.leftOn ? new Date(m.leftOn).toLocaleDateString("id-ID") : "—"} />
            <Line label="Alasan" value={m.exitReason ?? "—"} />
          </>
        ) : null}
        <Line label="SLIK" value={m.slikConsentAt ? "Ada izin" : "Belum ada izin"} />
        <Line label="Rekening simpanan" value={m.savingAccounts.length ? `${m.savingAccounts.length} rekening` : "Belum ada"} />
        {m.savingAccounts.map((a) => (
          <Line key={a.id} label={a.accountNo} value={`${a.product.name} · ${idr(Number(a.balance))}`} />
        ))}
        <Line label="Pinjaman" value={`${m.loans.length} rekening`} />
        {m.notes ? <p className="mt-2 text-sm leading-6">{m.notes}</p> : null}
      </ReadBlock>
    </div>
  );
}

function ReadBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line/70 p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-mute">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </p>
  );
}
