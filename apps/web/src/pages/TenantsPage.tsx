import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type TenantRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";

export function TenantsPage() {
  const qc = useQueryClient();
  const { tenantId, setTenantId } = useWorkspace();
  const { data, isLoading } = useQuery({ queryKey: ["tenants"], queryFn: api.tenants });
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const create = useMutation({
    mutationFn: () => api.createTenant({ slug, name, legalName: legalName || undefined }),
    ...noticeHandlers({
      success: "Koperasi ditambahkan",
      onSuccess: () => {
        setSlug("");
        setName("");
        setLegalName("");
        void qc.invalidateQueries({ queryKey: ["tenants"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
      },
    }),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; body: Parameters<typeof api.updateTenant>[1] }) =>
      api.updateTenant(input.id, input.body),
    ...noticeHandlers({
      success: "Koperasi diperbarui",
      onSuccess: () => {
        setEditing(null);
        void qc.invalidateQueries({ queryKey: ["tenants"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Platform"
        title="Koperasi"
        description="Onboarding tenant, ubah profil, aktifkan, atau tangguhkan. Data tidak dihapus permanen."
      />
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
          <Field label="Slug">
            <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="sejahtera" required />
          </Field>
          <Field label="Nama">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Koperasi Sejahtera" required />
          </Field>
          <Field label="Nama legal">
            <TextInput value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="KSP …" />
          </Field>
          <Button type="submit">Daftarkan</Button>
        </form>
      </Card>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Nama</Th>
              <Th>Slug</Th>
              <Th>Paket</Th>
              <Th>Status</Th>
              <Th>Cabang</Th>
              <Th>Pengguna</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <Td className="text-mute" colSpan={7}>
                  Memuat…
                </Td>
              </tr>
            ) : (
              data?.map((t) => (
                <tr key={t.id} className={`border-t border-line/70 ${tenantId === t.id ? "bg-leaf-mist/50" : "hover:bg-canvas/50"}`}>
                  <Td>
                    {editing?.id === t.id ? (
                      <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    ) : (
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-mute">{t.legalName}</p>
                      </div>
                    )}
                  </Td>
                  <Td className="text-mute">{t.slug}</Td>
                  <Td>
                    {editing?.id === t.id ? (
                      <SelectInput value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}>
                        <option value="standard">standard</option>
                        <option value="pro">pro</option>
                      </SelectInput>
                    ) : (
                      t.plan
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td>{t._count?.branches ?? 0}</Td>
                  <Td>{t._count?.users ?? 0}</Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-1.5">
                      {editing?.id === t.id ? (
                        <>
                          <Button size="sm" onClick={() => update.mutate({ id: t.id, body: { name: editing.name, plan: editing.plan } })}>
                            Simpan
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Batal
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant={tenantId === t.id ? "soft" : "ghost"} onClick={() => setTenantId(tenantId === t.id ? null : t.id)}>
                            {tenantId === t.id ? "Lepas" : "Pakai"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                            Ubah
                          </Button>
                          {t.status !== "ACTIVE" ? (
                            <Button size="sm" variant="soft" onClick={() => update.mutate({ id: t.id, body: { status: "ACTIVE" } })}>
                              Aktifkan
                            </Button>
                          ) : null}
                          {t.status !== "SUSPENDED" ? (
                            <Button size="sm" variant="danger" onClick={() => update.mutate({ id: t.id, body: { status: "SUSPENDED" } })}>
                              Tangguhkan
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
