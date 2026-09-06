import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ops, type EmployeeRow } from "../lib/api";
import { noticeHandlers } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { idr } from "../lib/money";
import { useWorkspace } from "../lib/workspace";
import { Button, Card, Field, MoneyInput, PageHeader, SelectInput, StatusBadge, TableWrap, Td, TextInput, Th } from "../ui/kit";
import { TenantGate } from "../ui/TenantGate";

function num(v: string | number | null | undefined) {
  return Number(v ?? 0);
}

export function PersonnelPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const qc = useQueryClient();
  const enabled = Boolean(tenantId || !user?.isPlatformAdmin);
  const employees = useQuery({ queryKey: ["employees", tenantId], queryFn: () => ops.employees(tenantId ?? undefined), enabled });
  const branches = useQuery({ queryKey: ["branches", tenantId], queryFn: () => api.branches(tenantId ?? undefined), enabled });
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [allowance, setAllowance] = useState("0");
  const [branchId, setBranchId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const activeBranches = (branches.data ?? []).filter((b) => b.status === "ACTIVE");
  const selectedBranch = activeBranches.find((b) => b.id === (editing?.branchId ?? branchId));
  const units = (selectedBranch?.units ?? []).filter((u) => u.status === "ACTIVE");

  useEffect(() => {
    if (!branchId && activeBranches.length) {
      const hq = activeBranches.find((b) => b.code === "HQ") ?? activeBranches[0];
      setBranchId(hq.id);
    }
  }, [activeBranches, branchId]);

  const create = useMutation({
    mutationFn: () =>
      ops.createEmployee(
        {
          name,
          position,
          baseSalary: Number(baseSalary),
          allowance: Number(allowance) || 0,
          branchId,
          unitId: unitId || null,
        },
        tenantId ?? undefined,
      ),
    ...noticeHandlers({
      success: "Pegawai ditambahkan",
      onSuccess: () => {
        setName("");
        setPosition("");
        setBaseSalary("");
        setAllowance("0");
        setUnitId("");
        void qc.invalidateQueries({ queryKey: ["employees"] });
      },
    }),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Tidak ada pegawai");
      return ops.updateEmployee(
        editing.id,
        {
          name: editing.name,
          position: editing.position,
          baseSalary: num(editing.baseSalary),
          allowance: num(editing.allowance),
          branchId: editing.branchId ?? undefined,
          unitId: editing.unitId ?? null,
          status: editing.status as "ACTIVE" | "DISABLED",
        },
        tenantId ?? undefined,
      );
    },
    ...noticeHandlers({
      success: "Pegawai diperbarui",
      onSuccess: () => {
        setEditing(null);
        void qc.invalidateQueries({ queryKey: ["employees"] });
      },
    }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <TenantGate>
      <PageHeader
        kicker="SDM"
        title="Personalia"
        description="Pegawai koperasi, bukan anggota. Gaji pokok dan tunjangan di sini menjadi dasar draft payroll. Plafon porsi anggaran 5102 dihitung di Payroll saat draft disimpan atau diposting."
      />
      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3 xl:grid-cols-7 md:items-end">
          <Field label="Nama">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Jabatan">
            <TextInput value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Kasir" />
          </Field>
          <Field label="Gaji pokok">
            <MoneyInput value={baseSalary} onValueChange={setBaseSalary} required />
          </Field>
          <Field label="Tunjangan">
            <MoneyInput value={allowance} onValueChange={setAllowance} />
          </Field>
          <Field label="Cabang">
            <SelectInput
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setUnitId("");
              }}
            >
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Unit">
            <SelectInput value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!units.length}>
              <option value="">{units.length ? "Tanpa unit" : "Tidak ada unit"}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
              <Th>No</Th>
              <Th>Nama</Th>
              <Th>Jabatan</Th>
              <Th>Cabang</Th>
              <Th>Gaji pokok</Th>
              <Th>Tunjangan</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {employees.data?.map((row) => {
              const e = editing?.id === row.id ? editing : row;
              return (
                <tr key={row.id} className="border-t border-line/70">
                  <Td className="font-mono">{row.employeeNo}</Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <TextInput value={e.name} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} />
                    ) : (
                      <span className="font-semibold">{row.name}</span>
                    )}
                  </Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <TextInput value={e.position ?? ""} onChange={(ev) => setEditing({ ...editing, position: ev.target.value })} />
                    ) : (
                      row.position ?? "—"
                    )}
                  </Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <SelectInput
                        value={e.branchId ?? ""}
                        onChange={(ev) => setEditing({ ...editing, branchId: ev.target.value, unitId: null })}
                      >
                        {activeBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      row.branch?.name ?? "—"
                    )}
                  </Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <MoneyInput
                        value={e.baseSalary}
                        onValueChange={(baseSalary) => setEditing({ ...editing, baseSalary })}
                      />
                    ) : (
                      idr(num(row.baseSalary))
                    )}
                  </Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <MoneyInput
                        value={e.allowance}
                        onValueChange={(allowance) => setEditing({ ...editing, allowance })}
                      />
                    ) : (
                      idr(num(row.allowance))
                    )}
                  </Td>
                  <Td>
                    {editing?.id === row.id ? (
                      <SelectInput
                        value={e.status}
                        onChange={(ev) => setEditing({ ...editing, status: ev.target.value })}
                      >
                        <option value="ACTIVE">Aktif</option>
                        <option value="DISABLED">Nonaktif</option>
                      </SelectInput>
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {editing?.id === row.id ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => save.mutate()}>
                          Simpan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Batal
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Ubah
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </TenantGate>
  );
}
