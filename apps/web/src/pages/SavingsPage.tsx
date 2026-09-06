import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops, type SavingAccountRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Dialog, DialogBody, DialogHeader, Field, MoneyInput, PageHeader, SelectInput, TableWrap, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

const KIND_LABEL: Record<string, string> = {
  POKOK: "Pokok",
  WAJIB: "Wajib",
  SUKARELA: "Sukarela",
};

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function matchesQuery(row: SavingAccountRow, q: string) {
  if (!q) return true;
  const hay = [row.accountNo, row.member.memberNo, row.member.name, row.product.name, row.product.code].join(" ").toLowerCase();
  return hay.includes(q);
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
  const [type, setType] = useState<"SETOR" | "TARIK">("SETOR");
  const [amount, setAmount] = useState("");
  const [q, setQ] = useState("");
  const mutate = useMutation({
    mutationFn: () => ops.mutateSaving({ accountId, type, amount: Number(amount) }, tenantId ?? undefined),
    ...noticeHandlers({
      success: type === "SETOR" ? "Setoran simpanan tercatat" : "Penarikan simpanan tercatat",
      onSuccess: () => {
        setAmount("");
        void qc.invalidateQueries({ queryKey: ["members"] });
        void qc.invalidateQueries({ queryKey: ["saving-accounts"] });
        void qc.invalidateQueries({ queryKey: ["saving-account"] });
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      },
    }),
  });

  const rows = accounts.data ?? [];
  const visibleAccounts = type === "TARIK" ? rows.filter((a) => a.product.withdrawable) : rows;
  const filtered = useMemo(() => rows.filter((row) => matchesQuery(row, q.trim().toLowerCase())), [rows, q]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutate.mutate();
  }

  function useAccount(id: string, nextType?: "SETOR" | "TARIK") {
    setAccountId(id);
    if (nextType) setType(nextType);
    setOpenId(null);
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Kas simpanan"
        description="Setiap rekening punya nomor akun. Buka buku rekening untuk melihat setor, tarik, saldo berjalan, dan jurnal terkait."
        action={
          <Link to="/setup" className="text-sm font-semibold text-leaf-dark hover:underline">
            Data induk
          </Link>
        }
      />
      {canPost ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
            <Field label="Rekening" className="md:col-span-2">
              <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                <option value="">Pilih rekening</option>
                {visibleAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountNo} · {a.member.memberNo} · {a.member.name} · {a.product.name} ({idr(Number(a.balance))})
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Aksi">
              <SelectInput
                value={type}
                onChange={(e) => {
                  const next = e.target.value as "SETOR" | "TARIK";
                  setType(next);
                  if (next === "TARIK" && !rows.find((a) => a.id === accountId)?.product.withdrawable) {
                    setAccountId("");
                  }
                }}
              >
                <option value="SETOR">Setor</option>
                <option value="TARIK">Tarik</option>
              </SelectInput>
            </Field>
            <Field label="Nominal">
              <MoneyInput value={amount} onValueChange={setAmount} required />
            </Field>
            <Button type="submit" className="md:col-span-4" disabled={mutate.isPending}>
              Proses — jurnal otomatis
            </Button>
          </form>
          {mutate.data ? <p className="mt-3 text-sm text-leaf-dark">Berhasil. Jurnal tercatat, saldo {idr((mutate.data as { balance: number }).balance)}.</p> : null}
          {(products.data?.filter((p) => p.status !== "INACTIVE").length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-mute">
              Belum ada produk simpanan.{" "}
              <Link to="/setup" className="font-semibold text-leaf-dark hover:underline">
                Buka setup awal
              </Link>
              .
            </p>
          ) : null}
          {type === "TARIK" && visibleAccounts.length === 0 && (products.data?.length ?? 0) > 0 ? (
            <p className="mt-3 text-sm text-mute">
              Belum ada produk yang boleh ditarik. Tandai di{" "}
              <Link to="/products" className="font-semibold text-leaf-dark hover:underline">
                data induk produk
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

      {openId ? (
        <SavingAccountDossier
          accountId={openId}
          tenantId={tenantId ?? undefined}
          canPost={canPost}
          onClose={() => setOpenId(null)}
          onUseAccount={useAccount}
        />
      ) : null}
    </TenantGate>
  );
}

function SavingAccountDossier({
  accountId,
  tenantId,
  canPost,
  onClose,
  onUseAccount,
}: {
  accountId: string;
  tenantId?: string;
  canPost: boolean;
  onClose: () => void;
  onUseAccount: (id: string, type?: "SETOR" | "TARIK") => void;
}) {
  const detail = useQuery({
    queryKey: ["saving-account", accountId, tenantId],
    queryFn: () => ops.savingAccount(accountId, tenantId),
  });
  const data = detail.data;

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
                <Button size="sm" onClick={() => onUseAccount(data.id, "SETOR")}>
                  Setor ke rekening ini
                </Button>
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
                    <Th>Mutasi</Th>
                    <Th>Keterangan</Th>
                    <Th>Jurnal</Th>
                    <Th className="text-right">Masuk</Th>
                    <Th className="text-right">Keluar</Th>
                    <Th className="text-right">Saldo</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.length ? (
                    data.ledger.map((row) => {
                      const setor = row.type !== "TARIK";
                      return (
                        <tr key={row.id} className="border-t border-line/70">
                          <Td className="whitespace-nowrap">{formatDay(row.occurredOn)}</Td>
                          <Td className={setor ? "font-semibold text-leaf-dark" : "font-semibold text-clay"}>{setor ? "Setor" : "Tarik"}</Td>
                          <Td className="text-mute">{row.memo ?? "—"}</Td>
                          <Td className="font-mono text-xs">{row.journalNo ?? "—"}</Td>
                          <Td className="text-right">{setor ? idr(row.amount) : "—"}</Td>
                          <Td className="text-right">{setor ? "—" : idr(row.amount)}</Td>
                          <Td className="text-right font-semibold">{idr(row.balanceAfter)}</Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <Td className="py-8 text-center text-mute" colSpan={7}>
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
