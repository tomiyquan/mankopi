import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api, type OverviewRow } from "../lib/api";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Icons } from "../ui/icons";
import { Card, PageHeader, StatusBadge } from "../ui/kit";

const AUDIT_LABELS: Record<string, string> = {
  "identity.signed_in": "Masuk konsol",
  "identity.user.created": "Pengguna baru",
  "identity.user.updated": "Pengguna diubah",
  "identity.user.disabled": "Pengguna dinonaktifkan",
  "identity.user.enabled": "Pengguna diaktifkan",
  "identity.user.role_changed": "Peran pengguna diubah",
  "identity.role.changed": "Hak akses diubah",
  "membership.member.registered": "Anggota baru",
  "membership.member.updated": "Data anggota diubah",
  "credit.loan.applied": "Pengajuan pinjaman",
  "credit.loan.approved": "Pinjaman disetujui",
  "credit.loan.approved_conditional": "Disetujui dengan syarat",
  "credit.loan.rejected": "Pinjaman ditolak",
  "collection.receipt.posted": "Setoran tercatat",
  "collection.receipt.voided": "Kwitansi dibatalkan",
  "hr.employee.created": "Pegawai baru",
  "hr.payroll.posted": "Payroll diposting",
  "hr.payroll.voided": "Payroll dibatalkan",
  "platform.tenant.created": "Koperasi baru",
  "platform.tenant.updated": "Koperasi diubah",
};

function pct(value: number) {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { tenantId, activeTenant } = useWorkspace();
  const summary = useQuery({
    queryKey: ["summary", tenantId],
    queryFn: () => api.summary(tenantId ?? undefined),
  });
  const scoped = Boolean(tenantId);
  const tenant = summary.data?.tenant ?? activeTenant;
  const ops = summary.data?.ops;
  const firstName = user?.name?.split(" ")[0] ?? "Pengurus";

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={scoped ? "Ringkasan koperasi" : "Konsol platform"}
        title={scoped ? tenant?.name ?? user?.tenantSlug ?? "Koperasi" : `Halo, ${firstName}`}
        description={
          scoped
            ? "Angka yang perlu dipantau pengurus hari ini: anggota, simpanan, kredit, penagihan, dan kas."
            : "Pilih koperasi di bilah atas untuk melihat ringkasan operasional. Tanpa pilihan, ini daftar armada platform."
        }
      />

      {scoped ? <TenantKpis ops={ops} branches={summary.data?.branches} users={summary.data?.users} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Koperasi" value={String(summary.data?.tenants ?? "…")} note="seluruh platform" />
          <Kpi label="Pengguna" value={String(summary.data?.users ?? "…")} note="seluruh platform" />
          <Kpi label="Cabang" value={String(summary.data?.branches ?? "…")} note="seluruh tenant" />
          <Kpi
            label="Ditangguhkan"
            value={String(summary.data?.suspended ?? "…")}
            note="koperasi tidak aktif"
            warn={(summary.data?.suspended ?? 0) > 0}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm font-semibold">Akses cepat</p>
          <p className="mt-1 text-sm text-mute">
            {scoped ? "Langsung ke pekerjaan harian pengurus." : "Kelola armada koperasi dari sini."}
          </p>
          <div className="mt-4 grid gap-2">
            {user?.permissions.includes("savings:view") || user?.permissions.includes("ledger:view") ? (
              <Quick to="/setup" label="Setup awal" icon={Icons.sliders} />
            ) : null}
            {user?.permissions.includes("member:view") ? <Quick to="/members" label="Anggota" icon={Icons.users} /> : null}
            {user?.permissions.includes("savings:view") || user?.permissions.includes("loan:view") ? (
              <Quick to="/products" label="Produk" icon={Icons.tag} />
            ) : null}
            {user?.permissions.includes("savings:view") ? <Quick to="/savings" label="Setor / tarik" icon={Icons.book} /> : null}
            {user?.permissions.includes("loan:view") ? <Quick to="/loans" label="Pinjaman" icon={Icons.journal} /> : null}
            {user?.permissions.includes("collection:view") ? <Quick to="/collection" label="Penagihan" icon={Icons.pin} /> : null}
            {user?.permissions.includes("hr:employee:manage") ? <Quick to="/personnel" label="Personalia" icon={Icons.users} /> : null}
            {user?.permissions.includes("hr:payroll:view") ? <Quick to="/payroll" label="Payroll" icon={Icons.journal} /> : null}
            {user?.permissions.includes("ledger:view") ? <Quick to="/journals" label="Jurnal" icon={Icons.journal} /> : null}
            {user?.permissions.includes("report:phu:view") ? <Quick to="/analytics" label="Analitik" icon={Icons.chart} /> : null}
            {user?.permissions.includes("platform:tenant:manage") ? <Quick to="/tenants" label="Kelola koperasi" icon={Icons.building} /> : null}
            {user?.permissions.includes("identity:user:manage") ? <Quick to="/users" label="Kelola pengguna" icon={Icons.users} /> : null}
            {user?.permissions.includes("org:branch:view") ? <Quick to="/branches" label="Kelola cabang" icon={Icons.pin} /> : null}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Aktivitas terakhir</p>
            {tenant ? <StatusBadge status={tenant.status} /> : null}
          </div>
          <ul className="mt-4 divide-y divide-line/70">
            {(summary.data?.recentAudit ?? []).length === 0 ? (
              <li className="py-8 text-center text-sm text-mute">Belum ada jejak</li>
            ) : null}
            {summary.data?.recentAudit.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{AUDIT_LABELS[row.action] ?? row.action}</p>
                  <p className="text-xs text-mute">{new Date(row.createdAt).toLocaleString("id-ID")}</p>
                </div>
                <span className="text-mute">{row.actor?.name ?? "sistem"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function TenantKpis({
  ops,
  branches,
  users,
}: {
  ops?: OverviewRow | null;
  branches?: number;
  users?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Anggota aktif"
        value={ops ? String(ops.members) : "…"}
        note={`${users ?? "…"} pengguna · ${branches ?? "…"} cabang${ops ? ` · ${ops.units} unit` : ""}`}
        to="/members"
      />
      <Kpi
        label="Saldo simpanan"
        value={ops ? idr(ops.savings) : "…"}
        note="pokok, wajib, dan sukarela"
        to="/savings"
      />
      <Kpi
        label="Pinjaman berjalan"
        value={ops ? idr(ops.outstanding) : "…"}
        note={
          ops
            ? `${ops.pendingApproval} menunggu putusan · ${ops.pendingDisburse} siap cair`
            : "outstanding pokok"
        }
        warn={Boolean(ops && ops.pendingApproval > 0)}
        to="/loans"
      />
      <Kpi
        label="NPL"
        value={ops ? pct(ops.nplRatio) : "…"}
        note={ops ? `${ops.nplCount} rekening · ${idr(ops.nplAmount)}` : "kolektabilitas 3–5"}
        warn={Boolean(ops && ops.nplCount > 0)}
        to="/analytics"
      />
      <Kpi
        label="Penagihan hari ini"
        value={ops ? String(ops.collectionDue + ops.collectionOverdue) : "…"}
        note={
          ops
            ? `${ops.collectionOverdue} menunggak · ${idr(ops.collectionDueAmount)}`
            : "jatuh tempo dan menunggak"
        }
        warn={Boolean(ops && ops.collectionOverdue > 0)}
        to="/collection"
      />
      <Kpi
        label="Setoran hari ini"
        value={ops ? idr(ops.collectedToday) : "…"}
        note={ops ? `${ops.collectedTodayCount} kwitansi` : "yang sudah diinput"}
        to="/collection"
      />
      <Kpi
        label="Kas"
        value={ops ? idr(ops.cashKas) : "…"}
        note={ops ? `bank ${idr(ops.cashBank)}` : "dari buku besar"}
        to="/journals"
      />
      <Kpi
        label="Posisi kas + bank"
        value={ops ? idr(ops.cash) : "…"}
        note="saldo riil buku besar"
        to="/reports"
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  warn,
  to,
}: {
  label: string;
  value: string;
  note: string;
  warn?: boolean;
  to?: string;
}) {
  const body = (
    <Card className="relative overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-leaf to-leaf-glow" />
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-mute">
        {warn ? <span className="text-clay">{note}</span> : note}
      </p>
    </Card>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block rounded-[inherit] hover:opacity-95">
      {body}
    </Link>
  );
}

function Quick({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Icons.home }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-sm font-semibold hover:border-leaf/40 hover:bg-leaf-mist"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-canvas text-leaf-dark">
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}
