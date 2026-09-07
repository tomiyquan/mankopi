import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useWorkspace } from "../lib/workspace";
import { Button, PageHeader, SelectInput, TableWrap, Td, TextInput, Th } from "../ui/kit";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AuditPage() {
  const { tenantId, activeTenant } = useWorkspace();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [tenantId, pageSize]);

  const { data, isFetching } = useQuery({
    queryKey: ["audit", tenantId, debouncedQ, page, pageSize],
    queryFn: () =>
      api.audit({
        tenantId: tenantId ?? undefined,
        q: debouncedQ || undefined,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Jejak"
        title="Audit"
        description={
          activeTenant
            ? `Hanya jejak ${activeTenant.name}.`
            : "Seluruh platform. Pilih konteks koperasi untuk menyaring."
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari aksi, sumber, pelaku, atau email"
            aria-label="Cari jejak audit"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <span className="whitespace-nowrap">Baris per halaman</span>
          <div className="w-24">
            <SelectInput
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Jumlah baris per halaman"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </SelectInput>
          </div>
        </label>
      </div>
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
            {items.length ? (
              items.map((row) => (
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
                  {isFetching
                    ? "Memuat jejak…"
                    : debouncedQ
                      ? "Tidak ada jejak yang cocok dengan pencarian."
                      : "Belum ada jejak"}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-mute">
            {total ? `Menampilkan ${from}–${to} dari ${total} jejak` : "Tidak ada data"}
            {isFetching ? " · memperbarui…" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Sebelumnya
            </Button>
            <span className="min-w-24 text-center text-xs font-medium text-mute">
              Halaman {Math.min(page, pageCount)} / {pageCount}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      </TableWrap>
    </div>
  );
}
