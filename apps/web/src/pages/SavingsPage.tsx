import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

export function SavingsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const members = useQuery({ queryKey: ["members", tenantId], queryFn: () => ops.members(tenantId ?? undefined), enabled });
  const products = useQuery({ queryKey: ["saving-products", tenantId], queryFn: () => ops.savingProducts(tenantId ?? undefined), enabled });
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"SETOR" | "TARIK">("SETOR");
  const [amount, setAmount] = useState("");
  const mutate = useMutation({
    mutationFn: () => ops.mutateSaving({ accountId, type, amount: Number(amount) }, tenantId ?? undefined),
    ...noticeHandlers({
      success: type === "SETOR" ? "Setoran simpanan tercatat" : "Penarikan simpanan tercatat",
      onSuccess: () => {
        setAmount("");
        void qc.invalidateQueries({ queryKey: ["members"] });
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      },
    }),
  });

  const accounts = (members.data ?? []).flatMap((m) =>
    m.savingAccounts.map((a) => ({
      id: a.id,
      label: `${m.memberNo} · ${m.name} · ${a.product.name}`,
      balance: Number(a.balance),
      withdrawable: a.product.withdrawable,
    })),
  );
  const visibleAccounts = type === "TARIK" ? accounts.filter((a) => a.withdrawable) : accounts;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutate.mutate();
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Operasional"
        title="Kas simpanan"
        description="Kasir hanya setor atau tarik. Simpanan mana yang boleh ditarik diatur di data induk, bukan di halaman ini."
        action={
          <Link to="/setup" className="text-sm font-semibold text-leaf-dark hover:underline">
            Data induk
          </Link>
        }
      />
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
          <Field label="Rekening" className="md:col-span-2">
            <SelectInput
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Pilih rekening</option>
              {visibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({idr(a.balance)})
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
                if (next === "TARIK" && !accounts.find((a) => a.id === accountId)?.withdrawable) {
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
          <Button type="submit" className="md:col-span-4">
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
      <div className="grid gap-3 md:grid-cols-2">
        {(members.data ?? []).map((m) => (
          <Card key={m.id} className="p-4">
            <p className="font-semibold">{m.name}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {m.savingAccounts.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    {a.product.name}
                    {a.product.withdrawable ? "" : <span className="ml-2 text-xs text-mute">tidak ditarik</span>}
                  </span>
                  <span className="font-semibold">{idr(Number(a.balance))}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </TenantGate>
  );
}
