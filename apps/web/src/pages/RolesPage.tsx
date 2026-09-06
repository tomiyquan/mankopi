import { PERMISSIONS, ROLE_META, isPlatformPermission, mappedPermissionKeys } from "@mankopi/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { operationalRoles, roleLabel } from "../lib/roles";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, PageHeader } from "../ui/kit";

const GROUPS: Record<string, string> = {
  platform: "Platform",
  identity: "Identitas",
  org: "Organisasi",
  audit: "Audit",
  member: "Anggota",
  savings: "Simpanan",
  loan: "Kredit",
  collection: "Penagihan",
  ledger: "Ledger",
  report: "Laporan",
  compliance: "Kepatuhan",
  hr: "SDM",
};

function visiblePermissions(layer: string) {
  return PERMISSIONS.filter((perm) => layer === "PLATFORM" || !isPlatformPermission(perm.key));
}

export function RolesPage() {
  const { user, reload } = useAuth();
  const { tenantId, activeTenant } = useWorkspace();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["roles", tenantId],
    queryFn: () => api.roles(tenantId ?? undefined),
  });

  async function afterChange() {
    void qc.invalidateQueries({ queryKey: ["roles"] });
    await reload().catch(() => undefined);
  }

  const save = useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: string[] }) => api.setRolePermissions(id, keys),
    ...noticeHandlers({
      success: "Hak akses disimpan. Menu sesi ini ikut diperbarui.",
      onSuccess: () => void afterChange(),
    }),
  });
  const reset = useMutation({
    mutationFn: (id: string) => api.resetRolePermissions(id),
    ...noticeHandlers({
      success: "Peran dikembalikan ke pemetaan bawaan",
      onSuccess: () => void afterChange(),
    }),
  });

  const roles = operationalRoles(data ?? [], tenantId, Boolean(user?.isPlatformAdmin));
  const tenantName = activeTenant?.name ?? user?.tenantSlug ?? (user?.isPlatformAdmin ? null : "koperasi ini");

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Keamanan"
        title="Hak akses"
        description={
          tenantId
            ? `Peran pengurus ${tenantName ?? "koperasi terpilih"}. Admin koperasi adalah Ketua / Pengurus, bukan Manajer Cabang.`
            : "Peran operator platform. Pilih koperasi di bilah atas untuk mengatur peran pengurus."
        }
      />
      <Card className="space-y-2 px-5 py-4 text-sm leading-6 text-mute">
        <p>
          Tidak ada peran bernama “admin” di dalam koperasi.{" "}
          <strong className="font-semibold text-ink">Ketua / Pengurus</strong> adalah admin tenant — mengatur
          pengguna, hak akses, dan seluruh operasional.
        </p>
        <p>
          <strong className="font-semibold text-ink">Manajer Cabang</strong> hanya operasional cabang: bisa
          kelola pengguna, tetapi tidak mengubah hak akses dan tidak memutus kredit.{" "}
          <strong className="font-semibold text-ink">Platform Admin</strong> adalah operator SaaS Mankopi, bukan
          pengurus koperasi.
        </p>
      </Card>
      {user?.isPlatformAdmin && !tenantId ? (
        <Card className="px-5 py-4 text-sm text-mute">
          Pilih konteks koperasi untuk melihat ketua, manajer cabang, dan peran operasional lainnya.
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map((role) => {
          const selected = new Set(role.permissions.map((p) => p.permission.key));
          const defaults = new Set(mappedPermissionKeys(role.slug));
          const visible = visiblePermissions(role.layer);
          const drifted =
            visible.some((perm) => selected.has(perm.key) !== defaults.has(perm.key));
          const meta = ROLE_META[role.slug];
          const groups = Object.entries(
            visible.reduce<Record<string, Array<(typeof PERMISSIONS)[number]>>>((acc, perm) => {
              const key = perm.key.split(":")[0];
              (acc[key] ??= []).push(perm);
              return acc;
            }, {}),
          );
          return (
            <Card key={role.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold tracking-tight">{roleLabel(role)}</p>
                  <p className="text-sm text-mute">{role.slug}</p>
                  {meta ? <p className="mt-2 text-sm leading-6 text-mute">{meta.summary}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-leaf-mist px-2.5 py-1 text-xs font-semibold text-leaf-dark">
                    {meta?.isTenantAdmin
                      ? "Admin koperasi"
                      : role.layer === "PLATFORM"
                        ? "Platform"
                        : activeTenant?.name ?? "Koperasi"}
                  </span>
                  {drifted ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Beda dari bawaan
                    </span>
                  ) : (
                    <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-mute">
                      Sesuai pemetaan
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reset.isPending || !drifted}
                  onClick={() => {
                    void confirmAction({
                      title: `Pulihkan ${role.name}?`,
                      text: "Kotak centang dikembalikan ke pemetaan bawaan peran ini.",
                      confirmText: "Pulihkan",
                    }).then((ok) => {
                      if (ok) reset.mutate(role.id);
                    });
                  }}
                >
                  Pulihkan bawaan
                </Button>
              </div>
              <div className="mt-4 max-h-[28rem] space-y-4 overflow-auto pr-1">
                {groups.map(([group, perms]) => (
                  <div key={group}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                      {GROUPS[group] ?? group}
                    </p>
                    <ul className="space-y-1.5">
                      {perms.map((perm) => (
                        <li key={perm.key}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-canvas">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-leaf"
                              checked={selected.has(perm.key)}
                              onChange={(e) => {
                                const next = new Set(selected);
                                if (e.target.checked) next.add(perm.key);
                                else next.delete(perm.key);
                                save.mutate({ id: role.id, keys: [...next] });
                              }}
                            />
                            <span>
                              <span className="text-sm font-medium">{perm.description}</span>
                              <span className="block text-xs text-mute">{perm.key}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
