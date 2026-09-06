import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, StatusBadge, TextInput } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

type DraftLine = { accountId: string; debit: string; credit: string };

const emptyLine = (): DraftLine => ({ accountId: "", debit: "", credit: "" });

const SOURCE_LABEL: Record<string, string> = {
  manual: "Jurnal manual",
  reverse: "Jurnal balik",
  "opening.capital": "Modal awal",
  "savings.deposit": "Setor simpanan",
  "savings.withdraw": "Tarik simpanan",
  "credit.disburse": "Pencairan pinjaman",
  "collection.receipt": "Setoran tagihan",
  "payroll.salary": "Payroll gaji",
  "credit.ckpn": "Cadangan risiko",
  "year.close": "Tutup buku PHU",
  "shu.allocate": "Alokasi SHU",
};

function sourceLabel(sourceType: string) {
  return SOURCE_LABEL[sourceType] ?? sourceType;
}

export function JournalsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const canPost = Boolean(user?.permissions.includes("ledger:post_manual"));
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const accounts = useQuery({ queryKey: ["accounts", tenantId], queryFn: () => api.accounts(tenantId ?? undefined), enabled });
  const journals = useQuery({ queryKey: ["journals", tenantId], queryFn: () => api.journals(tenantId ?? undefined), enabled });
  const [postedOn, setPostedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);

  const post = useMutation({
    mutationFn: () =>
      api.postJournal(
        {
          postedOn,
          memo: memo || undefined,
          lines: lines
            .filter((l) => l.accountId)
            .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Jurnal tercatat",
      onSuccess: () => {
        setMemo("");
        setLines([emptyLine(), emptyLine()]);
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      },
    }),
  });
  const reverse = useMutation({
    mutationFn: (id: string) => api.reverseJournal(id, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Jurnal balik dibuat",
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["journals"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    post.mutate();
  }

  const activeAccounts = (accounts.data ?? []).filter((a) => a.status === "ACTIVE");
  const byCode = (code: string) => activeAccounts.find((a) => a.code === code)?.id ?? "";

  function fillModalExample() {
    setMemo("Modal awal koperasi Rp5.000.000");
    setLines([
      { accountId: byCode("1101"), debit: "5000000", credit: "" },
      { accountId: byCode("3103"), debit: "", credit: "5000000" },
    ]);
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Keuangan"
        title="Jurnal"
        description="Buku akuntansi. Jurnal balik hanya mengoreksi ayat buku, bukan membatalkan pinjaman atau simpanan. Modal awal lebih mudah dari Setup awal."
      />
      <Card className="p-4">
        <p className="text-sm font-semibold">Contoh pengisian: modal awal Rp5.000.000</p>
        <p className="mt-1 text-sm text-mute">
          Satu sisi uang masuk, satu sisi sumbernya. Total debit harus sama dengan total kredit. Jangan pakai form ini untuk membatalkan pencairan pinjaman.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-left text-mute">
                <th className="px-3 py-2 font-medium">Baris</th>
                <th className="px-3 py-2 font-medium">Akun</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line/70">
                <td className="px-3 py-2">1</td>
                <td className="px-3 py-2">1101 · Kas</td>
                <td className="px-3 py-2 text-right font-semibold">5.000.000</td>
                <td className="px-3 py-2 text-right text-mute">kosong</td>
              </tr>
              <tr className="border-t border-line/70">
                <td className="px-3 py-2">2</td>
                <td className="px-3 py-2">3103 · Modal Sendiri</td>
                <td className="px-3 py-2 text-right text-mute">kosong</td>
                <td className="px-3 py-2 text-right font-semibold">5.000.000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-mute">Keterangan: Modal awal koperasi. Kalau uangnya di bank, ganti baris 1 menjadi 1102 · Bank.</p>
      </Card>
      {canPost ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm font-semibold">Ayat luar biasa</p>
              <Button type="button" variant="soft" size="sm" onClick={fillModalExample} disabled={!byCode("1101") || !byCode("3103")}>
                Isi contoh modal 5 juta
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tanggal">
                <TextInput type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} required />
              </Field>
              <Field label="Keterangan">
                <TextInput value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Modal awal koperasi" />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="hidden grid-cols-[2fr_1fr_1fr] gap-2 text-xs font-medium text-mute md:grid">
                <span>Akun</span>
                <span>Debit (uang masuk / aset bertambah)</span>
                <span>Kredit (sumber / modal bertambah)</span>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                  <SelectInput value={line.accountId} onChange={(e) => setLines(lines.map((l, idx) => (idx === i ? { ...l, accountId: e.target.value } : l)))}>
                    <option value="">Pilih akun</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </SelectInput>
                  <MoneyInput placeholder="Debit" value={line.debit} onValueChange={(debit) => setLines(lines.map((l, idx) => (idx === i ? { ...l, debit, credit: "" } : l)))} />
                  <MoneyInput placeholder="Kredit" value={line.credit} onValueChange={(credit) => setLines(lines.map((l, idx) => (idx === i ? { ...l, credit, debit: "" } : l)))} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setLines([...lines, emptyLine()])}>
                Tambah baris
              </Button>
              <Button type="submit">Posting jurnal</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="space-y-3">
        {journals.data?.map((j) => (
          <Card key={j.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-leaf-dark">{j.number}</p>
                <p className="mt-1 text-sm text-mute">
                  {new Date(j.postedOn).toLocaleDateString("id-ID")} · {sourceLabel(j.sourceType)}
                  {j.memo ? ` · ${j.memo}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={j.status} />
                {canPost && j.status === "POSTED" && (j.sourceType === "manual" || j.sourceType === "opening.capital") ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      void confirmAction({
                        title: `Jurnal balik ${j.number}?`,
                        text: "Ayat asli tetap tersimpan, lalu dicatat ayat kebalikannya.",
                        confirmText: "Buat jurnal balik",
                        danger: true,
                      }).then((ok) => {
                        if (ok) reverse.mutate(j.id);
                      });
                    }}
                  >
                    Jurnal balik
                  </Button>
                ) : null}
              </div>
            </div>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {j.lines.map((line) => (
                  <tr key={line.id} className="border-t border-line/60">
                    <td className="py-2">
                      {line.account.code} · {line.account.name}
                    </td>
                    <td className="py-2 text-right">{Number(line.debit) ? idr(Number(line.debit)) : ""}</td>
                    <td className="py-2 text-right">{Number(line.credit) ? idr(Number(line.credit)) : ""}</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-semibold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{idr(Number(j.debitTotal))}</td>
                  <td className="pt-2 text-right">{idr(Number(j.creditTotal))}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </TenantGate>
  );
}
