import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ops } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, PageHeader, TextInput } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

export function CalendarPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const canEdit = Boolean(user?.permissions.includes("loan:approve"));
  const holidays = useQuery({ queryKey: ["calendar", tenantId], queryFn: () => ops.holidays(tenantId ?? undefined), enabled });
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => ops.addHoliday({ date, name }, tenantId ?? undefined),
    ...noticeHandlers({
      success: "Hari libur ditambahkan",
      onSuccess: () => {
        setDate("");
        setName("");
        void qc.invalidateQueries({ queryKey: ["calendar"] });
        void qc.invalidateQueries({ queryKey: ["setup"] });
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="Data induk"
        title="Kalender libur"
        description="Libur tenant menggeser jatuh tempo angsuran. Default libur nasional dipasang saat setup awal."
      />
      {canEdit ? (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <Field label="Tanggal">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Nama">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Libur koperasi" required />
            </Field>
            <Button type="submit">Tambah libur</Button>
          </form>
        </Card>
      ) : null}
      <Card className="p-4">
        <ul className="divide-y divide-line/70">
          {(holidays.data ?? []).length === 0 ? <li className="py-8 text-center text-sm text-mute">Belum ada hari libur.</li> : null}
          {(holidays.data ?? []).map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-mute">{new Date(h.date).toLocaleDateString("id-ID")}</p>
              </div>
              <span className="text-xs text-mute">{h.source === "NATIONAL" ? "Nasional" : "Koperasi"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </TenantGate>
  );
}
