import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops, type SavingAccountRow, type SavingTxnVoucher } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Dialog, DialogBody, DialogHeader, Field, MoneyInput, PageHeader, SelectInput, TableWrap, Td, TextArea, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";
import { SavingTxnPreview } from "./SavingTxnPrint";

const KIND_LABEL: Record<string, string> = {
  POKOK: "Pokok",
  WAJIB: "Wajib",
  SUKARELA: "Sukarela",
};

type SavingMethod = "CASH" | "BANK" | "TRANSFER";

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function matchesQuery(row: SavingAccountRow, q: string) {
  if (!q) return true;
  const hay = [row.accountNo, row.member.memberNo, row.member.name, row.product.name, row.product.code].join(" ").toLowerCase();
  return hay.includes(q);
}

function accountLabel(row: SavingAccountRow) {
  const left = row.member.status === "LEFT" ? " · berhenti" : "";
  return `${row.accountNo} · ${row.member.memberNo} · ${row.member.name} · ${row.product.name} (${idr(Number(row.balance))})${left}`;
}

export function SavingsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canPost = Boolean(user?.permissions.includes("savings:post"));
  const products = useQuery({ queryKey: ["saving-products", tenantId], queryFn: () => ops.savingProducts(tenantId ?? undefined), enabled });
  const accounts = useQuery({ queryKey: ["saving-accounts", tenantId], queryFn: () => ops.savingAccounts(tenantId ?? undefined), enabled });
  const [accountId, setAccountId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<"SETOR" | "TARIK">("SETOR");
  const [method, setMethod] = useState<SavingMethod>("CASH");
  const [counterAccountId, setCounterAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const mutate = useMutation({
    mutationFn: () =>
      ops.mutateSaving(
        {
          accountId,
          type,
          amount: Number(amount),
          method,
          note: note.trim() || undefined,
          counterAccountId: method === "TRANSFER" ? counterAccountId : undefined,
        },
        tenantId ?? undefined,
      ),
    ...noticeHandlers<SavingTxnVoucher, void>({
      success: type === "SETOR" ? "Setoran simpanan tercatat" : "Penarikan simpanan tercatat",
      onSuccess: (data) => {
        setFormOpen(false);
        setAmount("");
        setNote("");
        setCounterAccountId("");
        setMethod("CASH");
        setPrintId(data.id);
        void qc.invalidateQueries({ queryKey: ["members"] });
        void qc.invalidateQueries({ queryKey: ["saving-accounts"] });
        void qc.invalidateQueries({ queryKey: ["saving-account"] });
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      },
    }),
  });

  const rows = accounts.data ?? [];
  const visibleAccounts =
    type === "TARIK"
      ? rows.filter((a) => a.product.withdrawable)
      : rows.filter((a) => a.member.status !== "LEFT");
  const destId = type === "SETOR" ? accountId : counterAccountId;
  const sourceId = type === "TARIK" ? accountId : counterAccountId;
  const sourceAccounts = rows.filter((a) => a.product.withdrawable && a.id !== destId);
  const destAccounts = rows.filter((a) => a.member.status !== "LEFT" && a.id !== sourceId);
  const filtered = useMemo(() => rows.filter((row) => matchesQuery(row, q.trim().toLowerCase())), [rows, q]);
  const setupIncomplete =
    products.isSuccess && (products.data?.filter((p) => p.status !== "INACTIVE").length ?? 0) === 0;
  const selected = rows.find((a) => a.id === accountId);
  const transfer = method === "TRANSFER";
  const sourceLabel = "Rekening sumber";
  const destLabel = "Rekening tujuan";
  const methodHint =
    method === "BANK"
      ? "Dana masuk atau keluar lewat rekening Bank (1102)."
      : transfer
        ? "Dana ditarik dari rekening sumber, lalu masuk ke rekening tujuan."
        : "Dana tunai lewat Kas (1101).";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutate.mutate();
  }

  function openForm(nextType: "SETOR" | "TARIK", nextAccountId?: string) {
    setType(nextType);
    if (nextAccountId) {
      setAccountId(nextAccountId);
    } else if (nextType === "TARIK" && !rows.find((a) => a.id === accountId)?.product.withdrawable) {
      setAccountId("");
    } else if (nextType === "SETOR" && rows.find((a) => a.id === accountId)?.member.status === "LEFT") {
      setAccountId("");
    }
    setMethod("CASH");
    setCounterAccountId("");
    setAmount("");
    setNote("");
    setFormOpen(true);
    setOpenId(null);
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Kas simpanan"
        description="Setor atau tarik per rekening. Pilih tunai, pindah buku bank, atau pindah buku antar rekening, lalu cetak buktinya."
        action={
          setupIncomplete ? (
            <Link to="/setup" className="text-sm font-semibold text-leaf-dark hover:underline">
              Data induk
            </Link>
          ) : undefined
        }
      />
      {canPost ? (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Transaksi kas</p>
              <p className="mt-1 text-sm text-mute">Jurnal otomatis ke Kas, Bank, atau antar rekening simpanan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openForm("SETOR")}>Penyetoran</Button>
              <Button variant="ghost" onClick={() => openForm("TARIK")}>
                Penarikan
              </Button>
            </div>
          </div>
          {(products.data?.filter((p) => p.status !== "INACTIVE").length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-mute">
              Belum ada produk simpanan.{" "}
              <Link to="/setup" className="font-semibold text-leaf-dark hover:underline">
                Buka setup awal
              </Link>
              .
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Buku rekening</p>
            <p className="mt-1 text-sm text-mute">Cari nomor akun, anggota, atau produk, lalu buka mutasi lengkapnya.</p>
          </div>
          <Field label="Cari" className="sm:w-72">
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="SMP-0001 atau nama anggota" />
          </Field>
        </div>
      </Card>

      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>No. akun</Th>
              <Th>Anggota</Th>
              <Th>Produk</Th>
              <Th>Mutasi</Th>
              <Th className="text-right">Saldo</Th>
              <Th className="sticky right-0 z-[1] bg-canvas/95 text-right shadow-[-8px_0_12px_-10px_rgba(18,36,28,0.18)]">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((a) => (
                <tr key={a.id} className="group border-t border-line/70">
                  <Td className="font-mono font-semibold text-leaf-dark">{a.accountNo}</Td>
                  <Td>
                    <p className="font-semibold">{a.member.name}</p>
                    <p className="text-xs text-mute">{a.member.memberNo}</p>
                  </Td>
                  <Td>
                    {a.product.name}
                    <span className="text-mute"> · {KIND_LABEL[a.product.kind] ?? a.product.kind}</span>
                    {a.product.withdrawable ? null : <span className="ml-2 text-xs text-mute">tidak ditarik</span>}
                  </Td>
                  <Td>{a._count.txns} kali</Td>
                  <Td className="text-right font-semibold">{idr(Number(a.balance))}</Td>
                  <Td className="sticky right-0 z-[1] bg-white text-right shadow-[-8px_0_12px_-10px_rgba(18,36,28,0.12)] group-hover:bg-[#f3faf6]">
                    <Button size="sm" variant="soft" className="whitespace-nowrap" onClick={() => setOpenId(a.id)}>
                      Lihat rekening
                    </Button>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="py-10 text-center text-mute" colSpan={6}>
                  {accounts.isLoading ? "Memuat rekening…" : q.trim() ? "Tidak ada rekening yang cocok." : "Belum ada rekening simpanan."}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      {formOpen ? (
        <Dialog onClose={() => setFormOpen(false)} className="max-w-lg">
          <DialogHeader>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">Kas simpanan</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">{type === "SETOR" ? "Penyetoran" : "Penarikan"}</h2>
              <p className="mt-1 text-sm text-mute">
                {type === "SETOR" ? "Catat setoran tunai, bank, atau pindah buku." : "Catat penarikan tunai, bank, atau pindah buku."}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setFormOpen(false)}>
              Tutup
            </Button>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={onSubmit} className="grid gap-3">
              {transfer ? null : (
                <Field label="Rekening">
                  <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                    <option value="">Pilih rekening</option>
                    {visibleAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabel(a)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}
              {selected && type === "TARIK" && !selected.product.withdrawable ? (
                <p className="text-sm text-clay">Produk ini tidak boleh ditarik.</p>
              ) : null}
              <Field label="Metode">
                <SelectInput
                  value={method}
                  onChange={(e) => {
                    const next = e.target.value as SavingMethod;
                    setMethod(next);
                    if (next !== "TRANSFER") setCounterAccountId("");
                  }}
                >
                  <option value="CASH">Tunai</option>
                  <option value="BANK">Pindah buku · Bank</option>
                  <option value="TRANSFER">Pindah buku · Rekening</option>
                </SelectInput>
                <p className="mt-1.5 text-xs text-mute">{methodHint}</p>
              </Field>
              {transfer ? (
                <>
                  <Field label={sourceLabel}>
                    <SelectInput
                      value={type === "TARIK" ? accountId : counterAccountId}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (type === "TARIK") {
                          setAccountId(id);
                          if (id && id === counterAccountId) setCounterAccountId("");
                        } else {
                          setCounterAccountId(id);
                          if (id && id === accountId) setAccountId("");
                        }
                      }}
                      required
                    >
                      <option value="">Pilih rekening sumber</option>
                      {sourceAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {accountLabel(a)}
                        </option>
                      ))}
                    </SelectInput>
                    {sourceAccounts.length === 0 ? (
                      <p className="mt-1.5 text-xs text-mute">Tidak ada rekening sumber yang boleh ditarik untuk pindah buku.</p>
                    ) : null}
                  </Field>
                  <Field label={destLabel}>
                    <SelectInput
                      value={type === "SETOR" ? accountId : counterAccountId}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (type === "SETOR") {
                          setAccountId(id);
                          if (id && id === counterAccountId) setCounterAccountId("");
                        } else {
                          setCounterAccountId(id);
                          if (id && id === accountId) setAccountId("");
                        }
                      }}
                      required
                    >
                      <option value="">Pilih rekening tujuan</option>
                      {destAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {accountLabel(a)}
                        </option>
                      ))}
                    </SelectInput>
                    {destAccounts.length === 0 ? (
                      <p className="mt-1.5 text-xs text-mute">Tidak ada rekening tujuan yang bisa menerima pindah buku.</p>
                    ) : null}
                  </Field>
                </>
              ) : null}
              <Field label="Nominal">
                <MoneyInput value={amount} onValueChange={setAmount} required />
              </Field>
              <Field label="Catatan transaksi">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Opsional, tampil di bukti dan jurnal" />
              </Field>
              {type === "TARIK" && visibleAccounts.length === 0 && (products.data?.length ?? 0) > 0 ? (
                <p className="text-sm text-mute">
                  Belum ada produk yang boleh ditarik. Tandai di{" "}
                  <Link to="/products" className="font-semibold text-leaf-dark hover:underline">
                    data induk produk
                  </Link>
                  .
                </p>
              ) : null}
              <Button type="submit" disabled={mutate.isPending}>
                {mutate.isPending ? "Memproses…" : "Proses dan cetak bukti"}
              </Button>
            </form>
          </DialogBody>
        </Dialog>
      ) : null}

      {openId ? (
        <SavingAccountDossier
          accountId={openId}
          tenantId={tenantId ?? undefined}
          canPost={canPost}
          onClose={() => setOpenId(null)}
          onUseAccount={(id, nextType) => openForm(nextType ?? "SETOR", id)}
          onPrint={(id) => setPrintId(id)}
        />
      ) : null}

      {printId ? <SavingTxnPreview txnId={printId} tenantId={tenantId ?? undefined} onClose={() => setPrintId(null)} /> : null}
    </TenantGate>
  );
}

function SavingAccountDossier({
  accountId,
  tenantId,
  canPost,
  onClose,
  onUseAccount,
  onPrint,
}: {
  accountId: string;
  tenantId?: string;
  canPost: boolean;
  onClose: () => void;
  onUseAccount: (id: string, type?: "SETOR" | "TARIK") => void;
  onPrint: (id: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["saving-account", accountId, tenantId],
    queryFn: () => ops.savingAccount(accountId, tenantId),
  });
  const data = detail.data;
  const left = data?.member.status === "LEFT";

  return (
    <Dialog onClose={onClose} className="max-w-4xl">
      <DialogHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">{data?.accountNo ?? "Memuat…"}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">
            {data ? `${data.member.name} · ${data.product.name}` : "Buku rekening"}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {data
              ? `${data.member.memberNo} · ${KIND_LABEL[data.product.kind] ?? data.product.kind} · dibuka ${formatDay(data.openedOn)}`
              : "Menyusun mutasi rekening…"}
          </p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onClose}>
          Tutup
        </Button>
      </DialogHeader>
      <DialogBody>
        {detail.isError ? (
          <p className="text-sm text-clay">{detail.error instanceof Error ? detail.error.message : "Gagal memuat rekening"}</p>
        ) : null}
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label="Saldo saat ini" value={idr(data.balance)} />
              <Mini label="Total setor" value={idr(data.summary.totalSetor)} />
              <Mini label="Total tarik" value={idr(data.summary.totalTarik)} />
            </div>
            {canPost ? (
              <div className="flex flex-wrap gap-2">
                {left ? null : (
                  <Button size="sm" onClick={() => onUseAccount(data.id, "SETOR")}>
                    Setor ke rekening ini
                  </Button>
                )}
                {data.product.withdrawable ? (
                  <Button size="sm" variant="ghost" onClick={() => onUseAccount(data.id, "TARIK")}>
                    Tarik dari rekening ini
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-line/70">
              <table className="w-full text-sm">
                <thead className="bg-canvas/70">
                  <tr>
                    <Th>Tanggal</Th>
                    <Th>No</Th>
                    <Th>Mutasi</Th>
                    <Th>Metode</Th>
                    <Th>Keterangan</Th>
                    <Th>Jurnal</Th>
                    <Th className="text-right">Masuk</Th>
                    <Th className="text-right">Keluar</Th>
                    <Th className="text-right">Saldo</Th>
                    <Th className="text-right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.length ? (
                    data.ledger.map((row) => {
                      const setor = row.type !== "TARIK";
                      return (
                        <tr key={row.id} className="border-t border-line/70">
                          <Td className="whitespace-nowrap">{formatDay(row.occurredOn)}</Td>
                          <Td className="font-mono text-xs">{row.txnNo ?? "—"}</Td>
                          <Td className={setor ? "font-semibold text-leaf-dark" : "font-semibold text-clay"}>{setor ? "Setor" : "Tarik"}</Td>
                          <Td className="text-mute">{row.methodLabel ?? "—"}</Td>
                          <Td className="text-mute">{row.note || row.memo || "—"}</Td>
                          <Td className="font-mono text-xs">{row.journalNo ?? "—"}</Td>
                          <Td className="text-right">{setor ? idr(row.amount) : "—"}</Td>
                          <Td className="text-right">{setor ? "—" : idr(row.amount)}</Td>
                          <Td className="text-right font-semibold">{idr(row.balanceAfter)}</Td>
                          <Td className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => onPrint(row.id)}>
                              Cetak
                            </Button>
                          </Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <Td className="py-8 text-center text-mute" colSpan={10}>
                        Belum ada mutasi pada rekening ini.
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </DialogBody>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
