import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BranchRow, type BranchStats } from "../lib/api";
import { idr } from "../lib/money";
import { noticeHandlers } from "../lib/notify";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, StatusBadge, TextInput } from "../ui/kit";

const EMPTY_STATS: BranchStats = {
  members: 0,
  disbursedTotal: 0,
  activeCount: 0,
  activeOutstanding: 0,
  lancarCount: 0,
  lancarOutstanding: 0,
  macetCount: 0,
  macetOutstanding: 0,
};

export function BranchesPage() {
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["branches", tenantId], queryFn: () => api.branches(tenantId ?? undefined) });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [unitFor, setUnitFor] = useState<string | null>(null);
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");

  const create = useMutation({
    mutationFn: () => api.createBranch({ code, name, tenantId: tenantId ?? undefined }),
    ...noticeHandlers({
      success: "Cabang ditambahkan",
      onSuccess: () => {
        setCode("");
        setName("");
        void qc.invalidateQueries({ queryKey: ["branches"] });
        void qc.invalidateQueries({ queryKey: ["summary"] });
      },
    }),
  });
  const save = useMutation({
    mutationFn: () => api.updateBranch(editing!.id, { name: editing!.name, address: editing!.address ?? undefined }),
    ...noticeHandlers({
      success: "Cabang diperbarui",
      onSuccess: () => {
        setEditing(null);
        void qc.invalidateQueries({ queryKey: ["branches"] });
      },
    }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateBranch(id, { status }),
    ...noticeHandlers({
      success: (_d, vars) => (vars.status === "ACTIVE" ? "Cabang diaktifkan" : "Cabang dinonaktifkan"),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["branches"] }),
    }),
  });
  const addUnit = useMutation({
    mutationFn: () => api.createUnit({ branchId: unitFor!, code: unitCode, name: unitName }),
    ...noticeHandlers({
      success: "Unit ditambahkan",
      onSuccess: () => {
        setUnitFor(null);
        setUnitCode("");
        setUnitName("");
        void qc.invalidateQueries({ queryKey: ["branches"] });
      },
    }),
  });
  const unitStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateUnit(id, { status }),
    ...noticeHandlers({
      success: (_d, vars) => (vars.status === "ACTIVE" ? "Unit diaktifkan" : "Unit dinonaktifkan"),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["branches"] }),
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Organisasi"
        title="Cabang & unit"
        description="Ubah profil cabang, nonaktifkan, dan kelola unit. Setiap kartu menampilkan anggota serta mutu pinjaman cabang itu. Operator platform perlu memilih konteks koperasi dulu."
      />
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="Kode">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Nama">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Button type="submit">Tambah cabang</Button>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((b) => (
          <Card key={b.id} className="p-5">
            {editing?.id === b.id ? (
              <div className="space-y-3">
                <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <TextInput placeholder="Alamat" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => save.mutate()}>
                    Simpan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-mute">{b.code}</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight">{b.name}</p>
                  <p className="mt-1 text-sm text-mute">{b.tenant?.name}</p>
                  {b.address ? <p className="mt-1 text-sm">{b.address}</p> : null}
                </div>
                <StatusBadge status={b.status} />
              </div>
            )}
            <BranchStatsGrid stats={b.stats ?? EMPTY_STATS} />
            <ul className="mt-4 space-y-2">
              {b.units.length === 0 ? <li className="text-sm text-mute">Belum ada unit</li> : null}
              {b.units.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{u.code}</span> — {u.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unitStatus.mutate({ id: u.id, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                  >
                    {u.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                Ubah
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setUnitFor(b.id)}>
                Tambah unit
              </Button>
              <Button
                size="sm"
                variant={b.status === "ACTIVE" ? "danger" : "soft"}
                onClick={() => toggle.mutate({ id: b.id, status: b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
              >
                {b.status === "ACTIVE" ? "Nonaktifkan cabang" : "Aktifkan cabang"}
              </Button>
            </div>
            {unitFor === b.id ? (
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  addUnit.mutate();
                }}
              >
                <TextInput placeholder="Kode unit" value={unitCode} onChange={(e) => setUnitCode(e.target.value)} required />
                <TextInput placeholder="Nama unit" value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
                <Button type="submit" size="sm">
                  Simpan
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function BranchStatsGrid({ stats }: { stats: BranchStats }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2">
      <StatTile label="Anggota" value={String(stats.members)} hint="anggota aktif" />
      <StatTile label="Akumulasi tersalur" value={idr(stats.disbursedTotal)} hint="pokok yang pernah dicairkan" />
      <StatTile
        label="Pinjaman aktif"
        value={String(stats.activeCount)}
        hint={`${idr(stats.activeOutstanding)} outstanding`}
      />
      <StatTile
        label="Pinjaman lancar"
        value={String(stats.lancarCount)}
        hint={`${idr(stats.lancarOutstanding)} · Kol 1`}
      />
      <StatTile
        label="Pinjaman macet"
        value={String(stats.macetCount)}
        hint={`${idr(stats.macetOutstanding)} · Kol 5`}
        warn={stats.macetCount > 0}
        wide
      />
    </dl>
  );
}

function StatTile({
  label,
  value,
  hint,
  warn,
  wide,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-canvas px-3 py-2.5 ${wide ? "col-span-2" : ""} ${warn ? "bg-red-50" : ""}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</dt>
      <dd className={`mt-0.5 text-base font-extrabold tracking-tight ${warn ? "text-clay" : ""}`}>{value}</dd>
      <p className={`mt-0.5 text-xs ${warn ? "text-clay" : "text-mute"}`}>{hint}</p>
    </div>
  );
}
