import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AccountRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

const CLASSES: Record<string, string> = { "1": "Aktiva", "2": "Kewajiban", "3": "Ekuitas", "4": "Pendapatan", "5": "Beban" };

export function AccountsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const canPost = Boolean(user?.permissions.includes("ledger:post_manual"));
  const accounts = useQuery({ queryKey: ["accounts", tenantId], queryFn: () => api.accounts(tenantId ?? undefined), enabled: Boolean(tenantId || !user?.isPlatformAdmin) });
  const maps = useQuery({ queryKey: ["ojk-maps"], queryFn: api.ojkMaps });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ojkMap, setOjkMap] = useState("");
  const [normal, setNormal] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [editing, setEditing] = useState<AccountRow | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createAccount(
        { code, name, classCode: code[0], normalBalance: normal, report: ["4", "5"].includes(code[0]) ? "PHU" : "NERACA", ojkMap: ojkMap || undefined },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Perkiraan ditambahkan",
      onSuccess: () => {
        setCode("");
        setName("");
        void qc.invalidateQueries({ queryKey: ["accounts"] });
      },
    }),
  });
  const update = useMutation({
    mutationFn: () => api.updateAccount(editing!.id, { name: editing!.name, ojkMap: editing!.ojkMap, status: editing!.status }, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Perkiraan diperbarui",
      onSuccess: () => {
        setEditing(null);
        void qc.invalidateQueries({ queryKey: ["accounts"] });
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <TenantGate>
      <PageHeader kicker="Data induk" title="No perkiraan" description="Bagan akun koperasi, termasuk peta pos OJK. Akun sistem tidak dihapus — nonaktifkan jika tidak dipakai." />
      {canPost ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5 md:items-end">
            <Field label="Kode">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="1103" required />
            </Field>
            <Field label="Nama">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Saldo normal">
              <SelectInput value={normal} onChange={(e) => setNormal(e.target.value as "DEBIT" | "CREDIT")}>
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Kredit</option>
              </SelectInput>
            </Field>
            <Field label="Peta OJK">
              <SelectInput value={ojkMap} onChange={(e) => setOjkMap(e.target.value)}>
                <option value="">Belum dipetakan</option>
                {maps.data?.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button type="submit">Tambah akun</Button>
          </form>
        </Card>
      ) : null}
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Kode</Th>
              <Th>Nama</Th>
              <Th>Kelas</Th>
              <Th>Peta OJK</Th>
              <Th>Status</Th>
              {canPost ? <Th>Aksi</Th> : null}
            </tr>
          </thead>
          <tbody>
            {accounts.data?.map((a) => (
              <tr key={a.id} className="border-t border-line/70">
                <Td className="font-mono font-semibold">{a.code}</Td>
                <Td>
                  {editing?.id === a.id ? (
                    <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  ) : (
                    a.name
                  )}
                </Td>
                <Td className="text-mute">{CLASSES[a.classCode] ?? a.classCode}</Td>
                <Td>
                  {editing?.id === a.id ? (
                    <SelectInput value={editing.ojkMap ?? ""} onChange={(e) => setEditing({ ...editing, ojkMap: e.target.value })}>
                      <option value="">Belum dipetakan</option>
                      {maps.data?.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </SelectInput>
                  ) : (
                    maps.data?.find((m) => m.key === a.ojkMap)?.label ?? a.ojkMap ?? "—"
                  )}
                </Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
                {canPost ? (
                  <Td className="whitespace-nowrap">
                    {editing?.id === a.id ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => update.mutate()}>
                          Simpan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Batal
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          variant={a.status === "ACTIVE" ? "danger" : "soft"}
                          onClick={() =>
                            api.updateAccount(a.id, { status: a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, tenantId ?? undefined).then(() => qc.invalidateQueries({ queryKey: ["accounts"] }))
                          }
                        >
                          {a.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    )}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </TenantGate>
  );
}
