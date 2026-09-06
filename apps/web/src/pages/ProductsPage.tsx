import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ops, type LoanProductRow, type SavingProductRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, StatusBadge, TextInput } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

const SAVING_KINDS = [
  { value: "POKOK", label: "Pokok", accountCode: "3101" },
  { value: "WAJIB", label: "Wajib", accountCode: "3102" },
  { value: "SUKARELA", label: "Sukarela", accountCode: "2101" },
] as const;

const METHODS = [
  { value: "DECLINING", label: "Menurun" },
  { value: "FLAT", label: "Flat" },
  { value: "ANNUITY", label: "Anuitas" },
  { value: "DAILY_EFFECTIVE", label: "Harian efektif" },
] as const;

const FREQUENCIES = [
  { value: "MONTHLY", label: "Bulanan" },
  { value: "BIWEEKLY", label: "Dua mingguan" },
  { value: "WEEKLY", label: "Mingguan" },
  { value: "DAILY", label: "Harian" },
] as const;

const RATE_BASES = [
  { value: "ANNUAL", label: "Per tahun", suffix: "/ tahun" },
  { value: "DAILY", label: "Per hari", suffix: "/ hari" },
  { value: "PRINCIPAL_TOTAL", label: "Total dari pokok", suffix: "dari pokok" },
] as const;

function rateBasisMeta(value?: string) {
  return RATE_BASES.find((b) => b.value === value) ?? RATE_BASES[0];
}

const PENALTY_KINDS = [
  { value: "NONE", label: "Tidak ada denda", unit: "none" },
  { value: "FIXED_ONCE", label: "Nominal sekali", unit: "rp" },
  { value: "FIXED_PER_DAY", label: "Nominal per hari", unit: "rp" },
  { value: "PERCENT_INSTALLMENT", label: "% dari angsuran sekali", unit: "pct" },
  { value: "PERCENT_INSTALLMENT_PER_DAY", label: "% dari angsuran per hari", unit: "pct" },
] as const;

function penaltyMeta(value?: string) {
  return PENALTY_KINDS.find((k) => k.value === value) ?? PENALTY_KINDS[0];
}

function penaltyFromApi(kind: string | undefined, value: string | number | undefined) {
  const n = Number(value ?? 0);
  return penaltyMeta(kind).unit === "pct" ? String(n * 100) : String(n);
}

function penaltyToApi(kind: string, raw: string) {
  const n = Number(raw || 0);
  return penaltyMeta(kind).unit === "pct" ? n / 100 : n;
}

function penaltySummary(kind?: string, value?: string | number, graceDays?: number) {
  const grace = `toleransi ${graceDays ?? 0} hari`;
  const meta = penaltyMeta(kind);
  if (meta.value === "NONE") return grace;
  const amount = Number(value ?? 0);
  if (meta.unit === "pct") return `${grace} · denda ${(amount * 100).toFixed(2)}% ${meta.label.replace("% dari angsuran ", "")}`;
  return `${grace} · denda ${idr(amount)}${meta.value === "FIXED_PER_DAY" ? "/hari" : ""}`;
}

export function ProductsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canViewSaving = Boolean(user?.permissions.includes("savings:view"));
  const canViewLoan = Boolean(user?.permissions.includes("loan:view"));
  const canSaving = Boolean(user?.permissions.includes("savings:post"));
  const canLoan = Boolean(user?.permissions.includes("loan:approve"));
  const savings = useQuery({ queryKey: ["saving-products", tenantId], queryFn: () => ops.savingProducts(tenantId ?? undefined), enabled: enabled && canViewSaving });
  const loans = useQuery({ queryKey: ["loan-products", tenantId], queryFn: () => ops.loanProducts(tenantId ?? undefined), enabled: enabled && canViewLoan });
  const accounts = useQuery({ queryKey: ["accounts", tenantId], queryFn: () => api.accounts(tenantId ?? undefined), enabled: enabled && canSaving });
  const contra = useMemo(
    () => (accounts.data ?? []).filter((a) => a.status === "ACTIVE" && ["2", "3"].includes(a.classCode)),
    [accounts.data],
  );
  const empty = (savings.data?.length ?? 0) === 0 && (loans.data?.length ?? 0) === 0;
  const provision = useMutation({
    mutationFn: () => ops.provisionProducts(tenantId ?? undefined),
    ...noticeHandlers({
      success: "Data bawaan produk terpasang",
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["saving-products"] });
        void qc.invalidateQueries({ queryKey: ["loan-products"] });
      },
    }),
  });

  return (
    <TenantGate>
      <PageHeader
        kicker="Data induk"
        title="Produk koperasi"
        description="Aturan produk: pokok/wajib satu aktif, akun mengikuti jenis, setor pokok sekali lunas. Opsi tarik dan buka rekening saat daftar anggota diatur di sini — bukan di kasir."
        action={
          empty && canSaving ? (
            <Button onClick={() => provision.mutate()} disabled={provision.isPending}>
              Pasang data bawaan
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {canViewSaving ? (
          <SavingProducts
            canEdit={canSaving}
            products={savings.data ?? []}
            accounts={contra}
            tenantId={tenantId}
            onChanged={() => {
              void qc.invalidateQueries({ queryKey: ["saving-products"] });
              void qc.invalidateQueries({ queryKey: ["members"] });
            }}
          />
        ) : null}
        {canViewLoan ? (
          <LoanProducts
            canEdit={canLoan}
            products={loans.data ?? []}
            tenantId={tenantId}
            onChanged={() => void qc.invalidateQueries({ queryKey: ["loan-products"] })}
          />
        ) : null}
      </div>
    </TenantGate>
  );
}

function SavingProducts({
  canEdit,
  products,
  accounts,
  tenantId,
  onChanged,
}: {
  canEdit: boolean;
  products: SavingProductRow[];
  accounts: Array<{ code: string; name: string; classCode?: string }>;
  tenantId: string | null;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof SAVING_KINDS)[number]["value"]>("POKOK");
  const [accountCode, setAccountCode] = useState("3101");
  const [minAmount, setMinAmount] = useState("100000");
  const [withdrawable, setWithdrawable] = useState(false);
  const [openOnJoin, setOpenOnJoin] = useState(true);
  const [editName, setEditName] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editAccount, setEditAccount] = useState("");
  const [editWithdrawable, setEditWithdrawable] = useState(false);
  const [editOpenOnJoin, setEditOpenOnJoin] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      ops.createSavingProduct(
        { code, name, kind, accountCode, minAmount: Number(minAmount), withdrawable, openOnJoin },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Produk simpanan ditambahkan",
      onSuccess: () => {
        setCode("");
        setName("");
        onChanged();
      },
    }),
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => ops.updateSavingProduct(selected!.id, body, tenantId ?? undefined),
    ...noticeHandlers({ success: "Produk simpanan disimpan", onSuccess: onChanged }),
  });

  function onKind(next: (typeof SAVING_KINDS)[number]["value"]) {
    setKind(next);
    const preset = SAVING_KINDS.find((k) => k.value === next);
    if (preset) {
      setAccountCode(preset.accountCode);
      setMinAmount(next === "POKOK" ? "100000" : next === "WAJIB" ? "25000" : "0");
      setWithdrawable(next === "SUKARELA");
    }
  }

  function pick(p: SavingProductRow) {
    setSelectedId(p.id);
    setEditName(p.name);
    setEditMin(String(Number(p.minAmount)));
    setEditAccount(p.accountCode);
    setEditWithdrawable(p.withdrawable);
    setEditOpenOnJoin(p.openOnJoin);
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    update.mutate({
      name: editName,
      minAmount: Number(editMin),
      accountCode: editAccount,
      withdrawable: editWithdrawable,
      openOnJoin: editOpenOnJoin,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold">Simpanan</h2>
        <p className="text-sm text-mute">Pokok/wajib = ekuitas, default tidak bisa ditarik. Sukarela = kewajiban, default boleh ditarik. Bisa diubah sesuai AD/ART.</p>
      </div>
      {canEdit ? (
        <Card className="p-4">
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <Field label="Kode">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="POKOK" required />
            </Field>
            <Field label="Jenis">
              <SelectInput value={kind} onChange={(e) => onKind(e.target.value as typeof kind)}>
                {SAVING_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Nama" className="sm:col-span-2">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Simpanan Pokok" required />
            </Field>
            <Field label="Akun lawan">
              <SelectInput value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Setoran minimum">
              <MoneyInput value={minAmount} onValueChange={setMinAmount} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={withdrawable} onChange={(e) => setWithdrawable(e.target.checked)} />
              Boleh ditarik di kas simpanan
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={openOnJoin} onChange={(e) => setOpenOnJoin(e.target.checked)} />
              Buka rekening otomatis saat daftar anggota
            </label>
            <Button type="submit" className="sm:col-span-2">
              Tambah produk simpanan
            </Button>
          </form>
        </Card>
      ) : null}
      <div className="space-y-2">
        {products.length === 0 ? <Card className="p-4 text-sm text-mute">Belum ada produk simpanan.</Card> : null}
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 ${selectedId === p.id ? "border-leaf/40 bg-leaf-mist" : "border-line/80 bg-white hover:border-leaf/30 hover:bg-leaf-mist/40"}`}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                <span className="font-mono text-leaf-dark">{p.code}</span> · {p.name}
              </p>
              <p className="mt-1 text-xs text-mute">
                {p.kind.toLowerCase()} · akun {p.accountCode} · min {idr(Number(p.minAmount))} · {p._count?.accounts ?? 0} rekening
                {p.withdrawable ? " · boleh tarik" : " · tidak ditarik"}
                {p.openOnJoin ? " · buka saat daftar" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {p.withdrawable ? <span className="rounded-full bg-leaf-mist px-2 py-0.5 text-[11px] font-semibold text-leaf-dark">boleh tarik</span> : null}
              <StatusBadge status={p.status} />
            </div>
          </button>
        ))}
      </div>
      {selected && canEdit ? (
        <Card className="p-4">
          <p className="text-sm font-semibold">Kelola {selected.code}</p>
          {selected.hasMovements ? <p className="mt-1 text-xs text-mute">Akun lawan terkunci — sudah ada mutasi.</p> : null}
          <form onSubmit={onSave} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama" className="sm:col-span-2">
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </Field>
            <Field label="Minimum">
              <MoneyInput value={editMin} onValueChange={setEditMin} />
            </Field>
            <Field label="Akun lawan">
              <SelectInput value={editAccount} onChange={(e) => setEditAccount(e.target.value)} disabled={selected.hasMovements}>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editWithdrawable} onChange={(e) => setEditWithdrawable(e.target.checked)} />
              Boleh ditarik di kas simpanan
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editOpenOnJoin} onChange={(e) => setEditOpenOnJoin(e.target.checked)} />
              Buka rekening otomatis saat daftar anggota
            </label>
            <Button type="submit">Simpan perubahan</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => update.mutate({ status: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
            >
              {selected.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function LoanProducts({
  canEdit,
  products,
  tenantId,
  onChanged,
}: {
  canEdit: boolean;
  products: LoanProductRow[];
  tenantId: string | null;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("DECLINING");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [rateBasis, setRateBasis] = useState("ANNUAL");
  const [ratePct, setRatePct] = useState("18");
  const [periods, setPeriods] = useState("12");
  const [graceDays, setGraceDays] = useState("3");
  const [penaltyKind, setPenaltyKind] = useState("NONE");
  const [penaltyValue, setPenaltyValue] = useState("0");
  const [minPrincipal, setMinPrincipal] = useState("500000");
  const [maxPrincipal, setMaxPrincipal] = useState("25000000");
  const [edit, setEdit] = useState({
    name: "",
    method: "",
    frequency: "",
    rateBasis: "ANNUAL",
    ratePct: "",
    periods: "",
    graceDays: "0",
    penaltyKind: "NONE",
    penaltyValue: "0",
    minPrincipal: "",
    maxPrincipal: "",
  });

  const create = useMutation({
    mutationFn: () =>
      ops.createLoanProduct(
        {
          code,
          name,
          method,
          frequency,
          rateBasis,
          annualRate: Number(ratePct) / 100,
          periods: Number(periods),
          graceDays: Number(graceDays),
          penaltyKind,
          penaltyValue: penaltyToApi(penaltyKind, penaltyValue),
          minPrincipal: Number(minPrincipal),
          maxPrincipal: maxPrincipal ? Number(maxPrincipal) : null,
        },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Produk pinjaman ditambahkan",
      onSuccess: () => {
        setCode("");
        setName("");
        onChanged();
      },
    }),
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => ops.updateLoanProduct(selected!.id, body, tenantId ?? undefined),
    ...noticeHandlers({ success: "Produk pinjaman disimpan", onSuccess: onChanged }),
  });

  function pick(p: LoanProductRow) {
    setSelectedId(p.id);
    setEdit({
      name: p.name,
      method: p.method,
      frequency: p.frequency,
      rateBasis: p.rateBasis ?? "ANNUAL",
      ratePct: String(Number(p.annualRate) * 100),
      periods: String(p.periods),
      graceDays: String(p.graceDays ?? 0),
      penaltyKind: p.penaltyKind ?? "NONE",
      penaltyValue: penaltyFromApi(p.penaltyKind, p.penaltyValue),
      minPrincipal: String(Number(p.minPrincipal ?? 0)),
      maxPrincipal: p.maxPrincipal == null ? "" : String(Number(p.maxPrincipal)),
    });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    update.mutate({
      name: edit.name,
      method: edit.method,
      frequency: edit.frequency,
      rateBasis: edit.rateBasis,
      annualRate: Number(edit.ratePct) / 100,
      periods: Number(edit.periods),
      graceDays: Number(edit.graceDays),
      penaltyKind: edit.penaltyKind,
      penaltyValue: penaltyToApi(edit.penaltyKind, edit.penaltyValue),
      minPrincipal: Number(edit.minPrincipal),
      maxPrincipal: edit.maxPrincipal ? Number(edit.maxPrincipal) : null,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold">Pinjaman</h2>
        <p className="text-sm text-mute">Batas pokok, bunga, tenor, toleransi, dan denda mengikuti produk. Syarat kredit diatur di Setup awal.</p>
      </div>
      {canEdit ? (
        <Card className="p-4">
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <Field label="Kode">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="REGULER" required />
            </Field>
            <Field label="Nama">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Pinjaman Reguler" required />
            </Field>
            <Field label="Metode">
              <SelectInput value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Frekuensi">
              <SelectInput value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Jenis bunga">
              <SelectInput value={rateBasis} onChange={(e) => setRateBasis(e.target.value)}>
                {RATE_BASES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={`Bunga % ${rateBasisMeta(rateBasis).suffix}`}>
              <TextInput type="number" min="0" step="0.01" value={ratePct} onChange={(e) => setRatePct(e.target.value)} required />
            </Field>
            <p className="sm:col-span-2 text-xs text-mute">
              Per tahun: persen tahunan seperti biasa. Per hari: persen dikali hari tiap angsuran. Total dari pokok: persen × pokok, lalu dibagi merata ke tenor.
            </p>
            <Field label="Tenor (kali)">
              <TextInput type="number" min="1" max="360" value={periods} onChange={(e) => setPeriods(e.target.value)} required />
            </Field>
            <Field label="Pokok minimum">
              <MoneyInput value={minPrincipal} onValueChange={setMinPrincipal} />
            </Field>
            <Field label="Pokok maksimum">
              <MoneyInput value={maxPrincipal} onValueChange={setMaxPrincipal} />
            </Field>
            <Field label="Toleransi terlambat (hari)">
              <TextInput type="number" min="0" max="90" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </Field>
            <Field label="Jenis denda">
              <SelectInput value={penaltyKind} onChange={(e) => setPenaltyKind(e.target.value)}>
                {PENALTY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {penaltyMeta(penaltyKind).unit !== "none" ? (
              <Field label={penaltyMeta(penaltyKind).unit === "pct" ? "Denda %" : "Denda (Rp)"} className="sm:col-span-2">
                {penaltyMeta(penaltyKind).unit === "pct" ? (
                  <TextInput type="number" min="0" step="0.01" value={penaltyValue} onChange={(e) => setPenaltyValue(e.target.value)} />
                ) : (
                  <MoneyInput value={penaltyValue} onValueChange={setPenaltyValue} />
                )}
              </Field>
            ) : null}
            <p className="sm:col-span-2 text-xs text-mute">
              Dalam masa toleransi, angsuran sudah jatuh tempo tapi belum kena denda. Kolektabilitas tetap dihitung dari tanggal jatuh tempo.
            </p>
            <Button type="submit" className="sm:col-span-2">
              Tambah produk pinjaman
            </Button>
          </form>
        </Card>
      ) : null}
      <div className="space-y-2">
        {products.length === 0 ? <Card className="p-4 text-sm text-mute">Belum ada produk pinjaman.</Card> : null}
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 ${selectedId === p.id ? "border-leaf/40 bg-leaf-mist" : "border-line/80 bg-white hover:border-leaf/30 hover:bg-leaf-mist/40"}`}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                <span className="font-mono text-leaf-dark">{p.code}</span> · {p.name}
              </p>
              <p className="mt-1 text-xs text-mute">
                {(Number(p.annualRate) * 100).toFixed(2)}% {rateBasisMeta(p.rateBasis).suffix} · {p.periods}x · {penaltySummary(p.penaltyKind, p.penaltyValue, p.graceDays)} · {p._count?.loans ?? 0} akad
              </p>
            </div>
            <StatusBadge status={p.status} />
          </button>
        ))}
      </div>
      {selected && canEdit ? (
        <Card className="p-4">
          <p className="text-sm font-semibold">Kelola {selected.code}</p>
          {selected.hasLiveLoans ? <p className="mt-1 text-xs text-mute">Metode, jenis bunga, dan tenor terkunci — ada pinjaman cair.</p> : null}
          <form onSubmit={onSave} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama" className="sm:col-span-2">
              <TextInput value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} required />
            </Field>
            <Field label="Metode">
              <SelectInput value={edit.method} disabled={selected.hasLiveLoans} onChange={(e) => setEdit((s) => ({ ...s, method: e.target.value }))}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Frekuensi">
              <SelectInput value={edit.frequency} disabled={selected.hasLiveLoans} onChange={(e) => setEdit((s) => ({ ...s, frequency: e.target.value }))}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Jenis bunga">
              <SelectInput value={edit.rateBasis} disabled={selected.hasLiveLoans} onChange={(e) => setEdit((s) => ({ ...s, rateBasis: e.target.value }))}>
                {RATE_BASES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={`Bunga % ${rateBasisMeta(edit.rateBasis).suffix}`}>
              <TextInput type="number" min="0" step="0.01" value={edit.ratePct} disabled={selected.hasLiveLoans} onChange={(e) => setEdit((s) => ({ ...s, ratePct: e.target.value }))} />
            </Field>
            <Field label="Tenor">
              <TextInput type="number" min="1" value={edit.periods} disabled={selected.hasLiveLoans} onChange={(e) => setEdit((s) => ({ ...s, periods: e.target.value }))} />
            </Field>
            <Field label="Pokok min">
              <MoneyInput value={edit.minPrincipal} onValueChange={(minPrincipal) => setEdit((s) => ({ ...s, minPrincipal }))} />
            </Field>
            <Field label="Pokok max">
              <MoneyInput value={edit.maxPrincipal} onValueChange={(maxPrincipal) => setEdit((s) => ({ ...s, maxPrincipal }))} />
            </Field>
            <Field label="Toleransi (hari)">
              <TextInput type="number" min="0" max="90" value={edit.graceDays} onChange={(e) => setEdit((s) => ({ ...s, graceDays: e.target.value }))} />
            </Field>
            <Field label="Jenis denda">
              <SelectInput value={edit.penaltyKind} onChange={(e) => setEdit((s) => ({ ...s, penaltyKind: e.target.value }))}>
                {PENALTY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {penaltyMeta(edit.penaltyKind).unit !== "none" ? (
              <Field label={penaltyMeta(edit.penaltyKind).unit === "pct" ? "Denda %" : "Denda (Rp)"} className="sm:col-span-2">
                {penaltyMeta(edit.penaltyKind).unit === "pct" ? (
                  <TextInput type="number" min="0" step="0.01" value={edit.penaltyValue} onChange={(e) => setEdit((s) => ({ ...s, penaltyValue: e.target.value }))} />
                ) : (
                  <MoneyInput value={edit.penaltyValue} onValueChange={(penaltyValue) => setEdit((s) => ({ ...s, penaltyValue }))} />
                )}
              </Field>
            ) : null}
            <Button type="submit">Simpan perubahan</Button>
            <Button type="button" variant="ghost" onClick={() => update.mutate({ status: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>
              {selected.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
