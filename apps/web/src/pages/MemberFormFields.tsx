import type { ReactNode } from "react";
import type { BranchRow } from "../lib/api";
import { MEMBER_OPTIONS, type MemberFormState } from "../lib/member";
import { Field, MoneyInput, SelectInput, TextArea, TextInput } from "../ui/kit";

export function MemberFormFields({
  form,
  setForm,
  branches,
  lockNik,
}: {
  form: MemberFormState;
  setForm: (next: MemberFormState) => void;
  branches: BranchRow[];
  lockNik?: boolean;
}) {
  const active = branches.filter((b) => b.status === "ACTIVE");
  const selected = active.find((b) => b.id === form.branchId);
  const units = (selected?.units ?? []).filter((u) => u.status === "ACTIVE");
  const set = (patch: Partial<MemberFormState>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-5">
      <Section title="Identitas">
        <Field label="NIK">
          <TextInput value={form.nik} onChange={(e) => set({ nik: e.target.value.replace(/\D/g, "").slice(0, 16) })} required maxLength={16} disabled={lockNik} />
        </Field>
        <Field label="Nama lengkap">
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label="Jenis kelamin">
          <SelectInput value={form.gender} onChange={(e) => set({ gender: e.target.value })} required>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.gender.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Tempat lahir">
          <TextInput value={form.placeOfBirth} onChange={(e) => set({ placeOfBirth: e.target.value })} required />
        </Field>
        <Field label="Tanggal lahir">
          <TextInput type="date" value={form.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} required />
        </Field>
        <Field label="Nama ibu kandung">
          <TextInput value={form.motherName} onChange={(e) => set({ motherName: e.target.value })} required />
        </Field>
        <Field label="Agama">
          <SelectInput value={form.religion} onChange={(e) => set({ religion: e.target.value })}>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.religion.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Status perkawinan">
          <SelectInput value={form.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value })}>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.maritalStatus.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Pendidikan">
          <SelectInput value={form.education} onChange={(e) => set({ education: e.target.value })}>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.education.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="No. KK">
          <TextInput value={form.familyCardNo} onChange={(e) => set({ familyCardNo: e.target.value.replace(/\D/g, "").slice(0, 16) })} maxLength={16} />
        </Field>
        <Field label="NPWP">
          <TextInput value={form.npwp} onChange={(e) => set({ npwp: e.target.value.replace(/\D/g, "").slice(0, 16) })} maxLength={16} />
        </Field>
      </Section>

      <Section title="Kontak & alamat">
        <Field label="Nomor HP">
          <TextInput value={form.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 15) })} required />
        </Field>
        <Field label="HP alternatif">
          <TextInput value={form.phoneAlt} onChange={(e) => set({ phoneAlt: e.target.value.replace(/\D/g, "").slice(0, 15) })} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Alamat lengkap" className="sm:col-span-2 xl:col-span-3">
          <TextInput value={form.address} onChange={(e) => set({ address: e.target.value })} required />
        </Field>
        <Field label="RT/RW">
          <TextInput value={form.rtRw} onChange={(e) => set({ rtRw: e.target.value })} placeholder="001/002" />
        </Field>
        <Field label="Kelurahan / desa">
          <TextInput value={form.village} onChange={(e) => set({ village: e.target.value })} />
        </Field>
        <Field label="Kecamatan">
          <TextInput value={form.district} onChange={(e) => set({ district: e.target.value })} />
        </Field>
        <Field label="Kota / kabupaten">
          <TextInput value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Provinsi">
          <TextInput value={form.province} onChange={(e) => set({ province: e.target.value })} />
        </Field>
        <Field label="Kode pos">
          <TextInput value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })} maxLength={5} />
        </Field>
        <Field label="Status rumah">
          <SelectInput value={form.houseStatus} onChange={(e) => set({ houseStatus: e.target.value })}>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.houseStatus.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Lama tinggal (tahun)">
          <TextInput type="number" min={0} max={90} value={form.yearsAtAddress} onChange={(e) => set({ yearsAtAddress: e.target.value })} />
        </Field>
      </Section>

      <Section title="Keluarga & kontak darurat">
        <Field label="Nama pasangan">
          <TextInput value={form.spouseName} onChange={(e) => set({ spouseName: e.target.value })} />
        </Field>
        <Field label="NIK pasangan">
          <TextInput value={form.spouseNik} onChange={(e) => set({ spouseNik: e.target.value.replace(/\D/g, "").slice(0, 16) })} maxLength={16} />
        </Field>
        <Field label="Jumlah tanggungan">
          <TextInput type="number" min={0} max={20} value={form.dependents} onChange={(e) => set({ dependents: e.target.value })} />
        </Field>
        <Field label="Ahli waris">
          <TextInput value={form.heirName} onChange={(e) => set({ heirName: e.target.value })} />
        </Field>
        <Field label="Hubungan ahli waris">
          <TextInput value={form.heirRelation} onChange={(e) => set({ heirRelation: e.target.value })} placeholder="Istri, anak, ..." />
        </Field>
        <Field label="HP ahli waris">
          <TextInput value={form.heirPhone} onChange={(e) => set({ heirPhone: e.target.value.replace(/\D/g, "").slice(0, 15) })} />
        </Field>
        <Field label="Kontak darurat">
          <TextInput value={form.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} />
        </Field>
        <Field label="Hubungan darurat">
          <TextInput value={form.emergencyRelation} onChange={(e) => set({ emergencyRelation: e.target.value })} />
        </Field>
        <Field label="HP darurat">
          <TextInput value={form.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value.replace(/\D/g, "").slice(0, 15) })} />
        </Field>
      </Section>

      <Section title="Pekerjaan & penghasilan">
        <Field label="Pekerjaan">
          <TextInput value={form.occupation} onChange={(e) => set({ occupation: e.target.value })} required />
        </Field>
        <Field label="Jenis pekerjaan">
          <SelectInput value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
            <option value="">Pilih</option>
            {MEMBER_OPTIONS.employmentType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Instansi / usaha">
          <TextInput value={form.employerName} onChange={(e) => set({ employerName: e.target.value })} />
        </Field>
        <Field label="Alamat kerja" className="sm:col-span-2">
          <TextInput value={form.workAddress} onChange={(e) => set({ workAddress: e.target.value })} />
        </Field>
        <Field label="Penghasilan / bulan">
          <MoneyInput value={form.monthlyIncome} onValueChange={(v) => set({ monthlyIncome: v })} />
        </Field>
        <Field label="Penghasilan lain">
          <MoneyInput value={form.otherIncome} onValueChange={(v) => set({ otherIncome: v })} />
        </Field>
      </Section>

      <Section title="Keanggotaan">
        <Field label="Cabang">
          <SelectInput
            value={form.branchId}
            required
            onChange={(e) => set({ branchId: e.target.value, unitId: "" })}
          >
            <option value="">Pilih cabang</option>
            {active.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Unit">
          <SelectInput value={form.unitId} onChange={(e) => set({ unitId: e.target.value })} disabled={!units.length}>
            <option value="">{units.length ? "Tanpa unit" : "Tidak ada unit"}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Jenis anggota">
          <SelectInput value={form.memberType} onChange={(e) => set({ memberType: e.target.value })}>
            {MEMBER_OPTIONS.memberType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Tanggal bergabung">
          <TextInput type="date" value={form.joinedOn} onChange={(e) => set({ joinedOn: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.slikConsent} onChange={(e) => set({ slikConsent: e.target.checked })} />
          Anggota memberi izin pengecekan SLIK
        </label>
        <Field label="Catatan" className="sm:col-span-3">
          <TextArea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Keterangan petugas, referensi anggota, atau catatan khusus" />
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}
