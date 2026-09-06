import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type UserRow } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { operationalRoles, roleLabel } from "../lib/roles";
import { useWorkspace } from "../lib/workspace";
import { Avatar, Button, Card, Field, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";

export function UsersPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users", tenantId], queryFn: () => api.users(tenantId ?? undefined) });
  const roles = useQuery({ queryKey: ["roles", tenantId], queryFn: () => api.roles(tenantId ?? undefined) });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const tenantRoles = operationalRoles(roles.data ?? [], tenantId, Boolean(user?.isPlatformAdmin));

  const create = useMutation({
    mutationFn: () =>
      api.createUser({
        email,
        name,
        password,
        roleId,
        scope: user?.isPlatformAdmin && !tenantId ? "PLATFORM" : "TENANT",
        tenantId: tenantId ?? undefined,
      }),
    ...noticeHandlers({
      success: "Pengguna ditambahkan",
      onSuccess: () => {
        setEmail("");
        setName("");
        setPassword("");
        void qc.invalidateQueries({ queryKey: ["users"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
      },
    }),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Tidak ada pengguna");
      const role = editing.memberships[0]?.role.id ?? roleId;
      return Promise.all([
        api.updateUser(editing.id, { name: editing.name, phone: editing.phone }),
        role ? api.setMembership(editing.id, { roleId: role, scope: "TENANT" }) : Promise.resolve(),
      ]);
    },
    ...noticeHandlers({
      success: "Pengguna diperbarui",
      onSuccess: () => {
        setEditing(null);
        void qc.invalidateQueries({ queryKey: ["users"] });
      },
    }),
  });
  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "ACTIVE" | "DISABLED" }) => api.setUserStatus(id, next),
    ...noticeHandlers({
      success: (_d, vars) => (vars.next === "ACTIVE" ? "Pengguna diaktifkan" : "Pengguna dinonaktifkan"),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["users"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
      },
    }),
  });
  const reset = useMutation({
    mutationFn: () => api.resetPassword(resetId!, newPassword),
    ...noticeHandlers({
      success: "Kata sandi direset",
      onSuccess: () => {
        setResetId(null);
        setNewPassword("");
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
        kicker="Identitas"
        title="Pengguna"
        description="Admin koperasi adalah Ketua / Pengurus. Manajer cabang bisa menambah pengguna, tetapi tidak mengubah hak akses."
      />
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5 md:items-end">
          <Field label="Nama">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </Field>
          <Field label="Kata sandi">
            <TextInput value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </Field>
          <Field label="Peran">
            <SelectInput value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
              <option value="">Pilih</option>
              {tenantRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleLabel(r)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Koperasi</Th>
              <Th>Peran</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-line/70 hover:bg-canvas/50">
                <Td>
                  {editing?.id === u.id ? (
                    <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  ) : (
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <span className="font-semibold">{u.name}</span>
                    </div>
                  )}
                </Td>
                <Td className="text-mute">{u.email}</Td>
                <Td>{u.tenant?.name ?? "Platform"}</Td>
                <Td>
                  {editing?.id === u.id ? (
                    <SelectInput
                      value={editing.memberships[0]?.role.id ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          memberships: [{ role: { id: e.target.value, name: "" }, branch: null }],
                        })
                      }
                    >
                      {tenantRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </SelectInput>
                  ) : (
                    u.memberships
                      .map((m) => {
                        const found = tenantRoles.find((r) => r.id === m.role.id);
                        return found ? roleLabel(found) : m.role.name;
                      })
                      .join(", ")
                  )}
                </Td>
                <Td>
                  <StatusBadge status={u.status} />
                </Td>
                <Td className="whitespace-nowrap">
                  <div className="flex flex-wrap gap-1.5">
                    {editing?.id === u.id ? (
                      <>
                        <Button size="sm" onClick={() => save.mutate()}>
                          Simpan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Batal
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                          Ubah
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetId(u.id)}>
                          Reset
                        </Button>
                        {u.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              void confirmAction({
                                title: `Nonaktifkan ${u.name}?`,
                                text: "Pengguna ini tidak bisa masuk sampai diaktifkan lagi.",
                                confirmText: "Nonaktifkan",
                                danger: true,
                              }).then((ok) => {
                                if (ok) status.mutate({ id: u.id, next: "DISABLED" });
                              });
                            }}
                          >
                            Nonaktifkan
                          </Button>
                        ) : (
                          <Button size="sm" variant="soft" onClick={() => status.mutate({ id: u.id, next: "ACTIVE" })}>
                            Aktifkan
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {resetId ? (
        <Card className="p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              reset.mutate();
            }}
          >
            <Field label="Sandi baru" className="min-w-56">
              <TextInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </Field>
            <Button type="submit">Simpan sandi</Button>
            <Button type="button" variant="ghost" onClick={() => setResetId(null)}>
              Tutup
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
