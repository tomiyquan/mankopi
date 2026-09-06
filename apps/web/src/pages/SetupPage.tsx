import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, TextInput } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

export function SetupPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canEdit = Boolean(user?.permissions.includes("savings:post"));
  const canCapital = Boolean(user?.permissions.includes("ledger:post_manual"));
  const setup = useQuery({ queryKey: ["setup", tenantId], queryFn: () => ops.setup(tenantId ?? undefined), enabled });
  const save = useMutation({
    mutationFn: (body: { requirePokokForLoan?: boolean; requireWajibForLoan?: boolean }) =>
      ops.savePolicy(body, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Kebijakan disimpan",
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["setup"] }),
    }),
  });
  const provision = useMutation({
    mutationFn: () => ops.provisionProducts(tenantId ?? undefined),
    ...noticeHandlers({
      success: "Data induk terpasang",
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["setup"] });
        void qc.invalidateQueries({ queryKey: ["saving-products"] });
        void qc.invalidateQueries({ queryKey: ["loan-products"] });
        void qc.invalidateQueries({ queryKey: ["accounts"] });
        void qc.invalidateQueries({ queryKey: ["periods"] });
      },
    }),
  });

  const ready = setup.data?.ready;
  const policy = setup.data?.policy;
  const items = [
    { ok: (ready?.accounts ?? 0) > 0, label: "Bagan perkiraan", to: "/accounts", hint: `${ready?.accounts ?? 0} akun` },
    { ok: Boolean(ready?.openPeriod), label: "Periode akuntansi terbuka", to: "/periods", hint: ready?.openPeriod ? "bulan ini terbuka" : "belum ada periode terbuka" },
    {
      ok: (ready?.openingCapital ?? 0) > 0,
      label: "Modal awal",
      to: "/journals",
      hint: (ready?.openingCapital ?? 0) > 0 ? idr(ready?.openingCapital ?? 0) : "belum dicatat",
    },
    { ok: (ready?.savingProducts ?? 0) > 0, label: "Produk simpanan", to: "/products", hint: `${ready?.savingProducts ?? 0} produk` },
    { ok: (ready?.withdrawableProducts ?? 0) > 0, label: "Simpanan yang boleh ditarik", to: "/products", hint: `${ready?.withdrawableProducts ?? 0} produk boleh tarik` },
    { ok: (ready?.loanProducts ?? 0) > 0, label: "Produk pinjaman", to: "/products", hint: `${ready?.loanProducts ?? 0} produk` },
    { ok: (ready?.holidays ?? 0) > 0, label: "Kalender libur", to: "/calendar", hint: `${ready?.holidays ?? 0} hari libur` },
    { ok: true, label: "Porsi beban, CKPN, dan SHU", to: "/shu", hint: "kebijakan PHU" },
  ];

  return (
    <TenantGate>
      <PageHeader
        kicker="Data induk"
        title="Setup awal koperasi"
        description="Atur data awal keuangan dan aturan AD/ART sebelum operasional. Modal awal dicatat di sini — tidak perlu mengisi debit-kredit di halaman Jurnal."
        action={
          canEdit ? (
            <Button onClick={() => provision.mutate()} disabled={provision.isPending}>
              Pasang data bawaan
            </Button>
          ) : undefined
        }
      />
      <OpeningCapital
        amount={ready?.openingCapital ?? 0}
        cashAccounts={setup.data?.cashAccounts ?? []}
        canPost={canCapital}
        tenantId={tenantId}
        onPosted={() => {
          void qc.invalidateQueries({ queryKey: ["setup"] });
          void qc.invalidateQueries({ queryKey: ["journals"] });
          void qc.invalidateQueries({ queryKey: ["reports"] });
        }}
      />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Card className="p-5">
          <p className="text-sm font-semibold">Kesiapan data induk</p>
          <p className="mt-1 text-sm text-mute">Centang ini sebelum menerima setoran atau pengajuan pinjaman.</p>
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${item.ok ? "border-leaf/30 bg-leaf-mist" : "border-line/80 bg-white"}`}
                >
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-0.5 text-xs text-mute">{item.hint}</p>
                  </div>
                  <span className={`text-xs font-semibold ${item.ok ? "text-leaf-dark" : "text-mute"}`}>{item.ok ? "Siap" : "Belum"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold">Aturan keanggotaan & kredit</p>
          <p className="mt-1 text-sm text-mute">
            Ketentuan umum koperasi: simpanan pokok (dan opsional wajib) sebagai syarat kredit. Penarikan diatur per produk, bukan di kasir.
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-line/80 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={policy?.requirePokokForLoan ?? true}
                disabled={!canEdit || !policy}
                onChange={(e) => save.mutate({ requirePokokForLoan: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold">Pokok lunas sebelum pinjaman</span>
                <span className="mt-0.5 block text-xs text-mute">Standar UU perkoperasian: simpanan pokok adalah modal keanggotaan.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-line/80 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={policy?.requireWajibForLoan ?? false}
                disabled={!canEdit || !policy}
                onChange={(e) => save.mutate({ requireWajibForLoan: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold">Wajib terpenuhi sebelum pinjaman</span>
                <span className="mt-0.5 block text-xs text-mute">Aktifkan jika AD/ART mensyaratkan simpanan wajib lancar sebelum kredit.</span>
              </span>
            </label>
          </div>
          <p className="mt-4 text-sm text-mute">
            Produk mana yang boleh ditarik diatur di{" "}
            <Link to="/products" className="font-semibold text-leaf-dark hover:underline">
              produk simpanan
            </Link>
            . Default: pokok dan wajib tidak bisa ditarik, sukarela bisa.
          </p>
        </Card>
      </div>
    </TenantGate>
  );
}

function OpeningCapital({
  amount,
  cashAccounts,
  canPost,
  tenantId,
  onPosted,
}: {
  amount: number;
  cashAccounts: Array<{ code: string; name: string }>;
  canPost: boolean;
  tenantId: string | null;
  onPosted: () => void;
}) {
  const [value, setValue] = useState("5000000");
  const [cashCode, setCashCode] = useState("1101");
  const [postedOn, setPostedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const post = useMutation({
    mutationFn: () =>
      ops.postOpeningCapital({ amount: Number(value), cashCode, postedOn, memo: "Modal awal koperasi" }, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Modal awal tercatat",
      onSuccess: () => {
        setValue("");
        onPosted();
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    post.mutate();
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">Modal awal</p>
      <p className="mt-1 text-sm text-mute">
        Uang tunai atau di bank yang sudah dimiliki koperasi sebelum operasional. Sistem mencatat Kas/Bank bertambah dan Modal sendiri bertambah — Anda hanya isi nominal.
      </p>
      {amount > 0 ? (
        <p className="mt-3 text-sm font-semibold text-leaf-dark">
          Sudah tercatat {idr(amount)}.{" "}
          <Link to="/journals" className="font-semibold underline">
            Lihat di jurnal
          </Link>
        </p>
      ) : null}
      {canPost ? (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Nominal">
            <MoneyInput value={value} onValueChange={setValue} placeholder="5.000.000" required />
          </Field>
          <Field label="Masuk ke">
            <SelectInput value={cashCode} onChange={(e) => setCashCode(e.target.value)}>
              {(cashAccounts.length ? cashAccounts : [{ code: "1101", name: "Kas" }, { code: "1102", name: "Bank" }]).map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Tanggal">
            <TextInput type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={post.isPending}>
            Catat modal
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-mute">Pencatatan modal membutuhkan hak jurnal manual (pengurus/bendahara).</p>
      )}
      {post.isSuccess ? <p className="mt-3 text-sm text-leaf-dark">Modal tercatat. Cek jejaknya di halaman Jurnal.</p> : null}
    </Card>
  );
}
