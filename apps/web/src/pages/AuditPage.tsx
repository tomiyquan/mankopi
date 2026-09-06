import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useWorkspace } from "../lib/workspace";
import { PageHeader, TableWrap, Td, Th } from "../ui/kit";

export function AuditPage() {
  const { tenantId, activeTenant } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["audit", tenantId],
    queryFn: () => api.audit(tenantId ?? undefined),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Jejak"
        title="Audit"
        description={activeTenant ? `Hanya jejak ${activeTenant.name}.` : "Seluruh platform. Pilih konteks koperasi untuk menyaring."}
      />
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="bg-canvas/70">
            <tr>
              <Th>Waktu</Th>
              <Th>Aksi</Th>
              <Th>Sumber</Th>
              <Th>Pelaku</Th>
            </tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((row) => (
                <tr key={row.id} className="border-t border-line/70 hover:bg-canvas/50">
                  <Td className="whitespace-nowrap text-mute">{new Date(row.createdAt).toLocaleString("id-ID")}</Td>
                  <Td className="font-medium">{row.action}</Td>
                  <Td>{row.resource}</Td>
                  <Td>{row.actor?.name ?? "sistem"}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="py-10 text-center text-mute" colSpan={4}>
                  Belum ada jejak
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
