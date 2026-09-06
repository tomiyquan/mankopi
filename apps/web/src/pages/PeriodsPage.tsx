import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { confirmAction, noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

export function PeriodsPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const canPost = Boolean(user?.permissions.includes("ledger:post_manual"));
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const periods = useQuery({
    queryKey: ["periods", tenantId],
    queryFn: () => api.periods(tenantId ?? undefined),
    enabled: Boolean(tenantId || !user?.isPlatformAdmin),
  });
  const open = useMutation({
    mutationFn: () => api.openPeriod({ year: Number(year), month: Number(month) }, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Periode dibuka",
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["periods"] }),
    }),
  });
  const close = useMutation({
    mutationFn: (id: string) => api.closePeriod(id, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Periode ditutup",
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["periods"] }),
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    open.mutate();
  }

  return (
    <TenantGate>
      <PageHeader kicker="Data induk" title="Periode akuntansi" description="Periode tertutup mengunci posting. Koreksi untuk bulan tertutup diposting sebagai jurnal balik di periode yang masih terbuka." />
      {canPost ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <Field label="Tahun">
              <TextInput type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
            </Field>
            <Field label="Bulan">
              <TextInput type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} required />
            </Field>
            <Button type="submit">Buka periode</Button>
          </form>
        </Card>
      ) : null}
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Periode</Th>
              <Th>Rentang</Th>
              <Th>Jurnal</Th>
              <Th>Status</Th>
              {canPost ? <Th>Aksi</Th> : null}
            </tr>
          </thead>
          <tbody>
            {periods.data?.map((p) => (
              <tr key={p.id} className="border-t border-line/70">
                <Td className="font-semibold">
                  {p.year}-{String(p.month).padStart(2, "0")}
                </Td>
                <Td className="text-mute">
                  {new Date(p.startsOn).toLocaleDateString("id-ID")} — {new Date(p.endsOn).toLocaleDateString("id-ID")}
                </Td>
                <Td>{p._count?.journals ?? 0}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                {canPost ? (
                  <Td>
                    {p.status === "OPEN" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          void confirmAction({
                            title: `Tutup periode ${p.year}-${String(p.month).padStart(2, "0")}?`,
                            text: "Periode tertutup tidak bisa menerima jurnal baru.",
                            confirmText: "Tutup periode",
                            danger: true,
                          }).then((ok) => {
                            if (ok) close.mutate(p.id);
                          });
                        }}
                      >
                        Tutup
                      </Button>
                    ) : (
                      <span className="text-xs text-mute">Terkunci</span>
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
