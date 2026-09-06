import { useQuery } from "@tanstack/react-query";
import { ops } from "../lib/api";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Card, PageHeader, TableWrap, Td, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

export function AnalyticsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const data = useQuery({
    queryKey: ["analytics", tenantId],
    queryFn: () => ops.analytics(tenantId ?? undefined),
    enabled: Boolean(tenantId || !user?.isPlatformAdmin),
  });
  const a = data.data;

  return (
    <TenantGate>
      <PageHeader kicker="Analitik" title="Kesehatan koperasi" description="NPL, aging, SHU, dan paket pos OJK dihitung dari ledger + kolektabilitas pinjaman." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Anggota" value={String(a?.members ?? "…")} />
        <Kpi label="Simpanan" value={a ? idr(a.savings) : "…"} />
        <Kpi label="Outstanding" value={a ? idr(a.outstanding) : "…"} />
        <Kpi label="Kas riil" value={a ? idr(a.cash ?? 0) : "…"} />
        <Kpi label="SHU (PHU)" value={a ? idr(a.shu) : "…"} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold">NPL / SIPEDAI</p>
          <p className="mt-2 text-3xl font-extrabold">{a ? `${(a.nplRatio * 100).toFixed(1)}%` : "…"}</p>
          <p className="text-sm text-mute">{a ? `${a.nplCount} akun · ${idr(a.nplAmount)}` : ""}</p>
        </Card>
        <Card className="p-5">
          <p className="font-semibold">Aging kolektabilitas</p>
          <ul className="mt-3 space-y-1 text-sm">
            {a
              ? Object.entries(a.aging).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="capitalize">{k}</span>
                    <span>{idr(v)}</span>
                  </li>
                ))
              : null}
          </ul>
        </Card>
      </div>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Paket OJK</Th>
              <Th className="text-right">Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {a?.ojk.map((row) => (
              <tr key={row.key} className="border-t border-line/70">
                <Td>{row.label}</Td>
                <Td className="text-right">{idr(row.net)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </TenantGate>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
    </Card>
  );
}
