import {
  MEMBER_EDUCATION,
  MEMBER_EMPLOYMENT,
  MEMBER_GENDERS,
  MEMBER_HOUSE,
  MEMBER_MARITAL,
  MEMBER_RELIGIONS,
  MEMBER_TYPES,
} from "@mankopi/shared";

export type MemberProfileInput = {
  nik?: string;
  name?: string;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  motherName?: string | null;
  npwp?: string | null;
  familyCardNo?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  email?: string | null;
  address?: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  spouseName?: string | null;
  spouseNik?: string | null;
  dependents?: number | null;
  heirName?: string | null;
  heirRelation?: string | null;
  heirPhone?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelation?: string | null;
  occupation?: string | null;
  employmentType?: string | null;
  employerName?: string | null;
  workAddress?: string | null;
  monthlyIncome?: number | null;
  otherIncome?: number | null;
  houseStatus?: string | null;
  yearsAtAddress?: number | null;
  joinedOn?: string | null;
  memberType?: string | null;
  notes?: string | null;
  slikConsent?: boolean;
  branchId?: string;
  unitId?: string | null;
};

const OPTIONAL_ENUMS: Array<[keyof MemberProfileInput, readonly string[]]> = [
  ["gender", MEMBER_GENDERS],
  ["religion", MEMBER_RELIGIONS],
  ["maritalStatus", MEMBER_MARITAL],
  ["education", MEMBER_EDUCATION],
  ["employmentType", MEMBER_EMPLOYMENT],
  ["houseStatus", MEMBER_HOUSE],
  ["memberType", MEMBER_TYPES],
];

export function blank(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function memberProfileError(input: MemberProfileInput, mode: "create" | "update"): string | null {
  const name = blank(input.name);
  const nik = blank(input.nik);
  if (mode === "create" || input.name !== undefined) {
    if (!name || name.length < 3) return "Nama lengkap minimal 3 karakter";
    if (name.length > 120) return "Nama terlalu panjang";
  }
  if (mode === "create" || input.nik !== undefined) {
    if (!nik || !/^\d{16}$/.test(nik)) return "NIK harus 16 digit";
  }
  if (mode === "create") {
    if (!blank(input.gender)) return "Jenis kelamin wajib diisi";
    if (!blank(input.placeOfBirth)) return "Tempat lahir wajib diisi";
    if (!blank(input.dateOfBirth)) return "Tanggal lahir wajib diisi";
    if (!blank(input.motherName)) return "Nama ibu kandung wajib diisi";
    if (!blank(input.phone)) return "Nomor HP wajib diisi";
    if (!blank(input.address)) return "Alamat lengkap wajib diisi";
    if (!blank(input.occupation)) return "Pekerjaan wajib diisi";
  }

  const dob = blank(input.dateOfBirth);
  if (dob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Tanggal lahir tidak valid";
    const born = new Date(`${dob}T00:00:00Z`);
    if (Number.isNaN(born.getTime())) return "Tanggal lahir tidak valid";
    const age = (Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 17) return "Anggota minimal berusia 17 tahun";
    if (age > 90) return "Tanggal lahir di luar rentang yang wajar";
  }

  const phone = blank(input.phone);
  if (phone && !/^\d{8,15}$/.test(phone.replace(/\D/g, ""))) return "Nomor HP harus 8–15 digit";
  const phoneAlt = blank(input.phoneAlt);
  if (phoneAlt && !/^\d{8,15}$/.test(phoneAlt.replace(/\D/g, ""))) return "Nomor HP alternatif harus 8–15 digit";
  const heirPhone = blank(input.heirPhone);
  if (heirPhone && !/^\d{8,15}$/.test(heirPhone.replace(/\D/g, ""))) return "Nomor HP ahli waris harus 8–15 digit";
  const emergencyPhone = blank(input.emergencyPhone);
  if (emergencyPhone && !/^\d{8,15}$/.test(emergencyPhone.replace(/\D/g, ""))) return "Nomor HP darurat harus 8–15 digit";

  const email = blank(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email tidak valid";
  const npwp = blank(input.npwp);
  if (npwp && !/^\d{15,16}$/.test(npwp)) return "NPWP harus 15 atau 16 digit";
  const kk = blank(input.familyCardNo);
  if (kk && !/^\d{16}$/.test(kk)) return "Nomor KK harus 16 digit";
  const spouseNik = blank(input.spouseNik);
  if (spouseNik && !/^\d{16}$/.test(spouseNik)) return "NIK pasangan harus 16 digit";
  const postal = blank(input.postalCode);
  if (postal && !/^\d{5}$/.test(postal)) return "Kode pos harus 5 digit";

  if (input.dependents != null && !(Number.isInteger(input.dependents) && input.dependents >= 0 && input.dependents <= 20)) {
    return "Jumlah tanggungan harus 0–20";
  }
  if (input.yearsAtAddress != null && !(Number.isInteger(input.yearsAtAddress) && input.yearsAtAddress >= 0 && input.yearsAtAddress <= 90)) {
    return "Lama tinggal harus 0–90 tahun";
  }
  if (input.monthlyIncome != null && !(input.monthlyIncome >= 0 && input.monthlyIncome <= 1_000_000_000_000)) {
    return "Penghasilan bulanan tidak valid";
  }
  if (input.otherIncome != null && !(input.otherIncome >= 0 && input.otherIncome <= 1_000_000_000_000)) {
    return "Penghasilan lain tidak valid";
  }
  const joined = blank(input.joinedOn);
  if (joined && !/^\d{4}-\d{2}-\d{2}$/.test(joined)) return "Tanggal bergabung tidak valid";

  for (const [key, allowed] of OPTIONAL_ENUMS) {
    const value = blank(input[key] as string | null | undefined);
    if (value && !allowed.includes(value)) return `Pilihan ${key} tidak dikenali`;
  }
  const notes = blank(input.notes);
  if (notes && notes.length > 2000) return "Catatan terlalu panjang";
  return null;
}

export function normalizePhone(value?: string | null) {
  const digits = blank(value)?.replace(/\D/g, "") ?? null;
  return digits;
}

export function toDate(value?: string | null) {
  const raw = blank(value);
  return raw ? new Date(`${raw}T00:00:00Z`) : null;
}

export type MemberWriteData = {
  name?: string;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: Date | null;
  motherName?: string | null;
  npwp?: string | null;
  familyCardNo?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  email?: string | null;
  address?: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  spouseName?: string | null;
  spouseNik?: string | null;
  dependents?: number | null;
  heirName?: string | null;
  heirRelation?: string | null;
  heirPhone?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelation?: string | null;
  occupation?: string | null;
  employmentType?: string | null;
  employerName?: string | null;
  workAddress?: string | null;
  monthlyIncome?: number | null;
  otherIncome?: number | null;
  houseStatus?: string | null;
  yearsAtAddress?: number | null;
  joinedOn?: Date | null;
  memberType?: string;
  notes?: string | null;
};

export function toMemberWrite(input: MemberProfileInput) {
  const data: MemberWriteData = {};
  const put = <K extends keyof MemberWriteData>(key: K, present: boolean, value: MemberWriteData[K]) => {
    if (present) data[key] = value;
  };
  put("name", input.name !== undefined, blank(input.name) ?? undefined);
  put("gender", input.gender !== undefined, blank(input.gender));
  put("religion", input.religion !== undefined, blank(input.religion));
  put("maritalStatus", input.maritalStatus !== undefined, blank(input.maritalStatus));
  put("education", input.education !== undefined, blank(input.education));
  put("placeOfBirth", input.placeOfBirth !== undefined, blank(input.placeOfBirth));
  put("dateOfBirth", input.dateOfBirth !== undefined, toDate(input.dateOfBirth));
  put("motherName", input.motherName !== undefined, blank(input.motherName));
  put("npwp", input.npwp !== undefined, blank(input.npwp));
  put("familyCardNo", input.familyCardNo !== undefined, blank(input.familyCardNo));
  put("phone", input.phone !== undefined, normalizePhone(input.phone));
  put("phoneAlt", input.phoneAlt !== undefined, normalizePhone(input.phoneAlt));
  put("email", input.email !== undefined, blank(input.email)?.toLowerCase() ?? null);
  put("address", input.address !== undefined, blank(input.address));
  put("rtRw", input.rtRw !== undefined, blank(input.rtRw));
  put("village", input.village !== undefined, blank(input.village));
  put("district", input.district !== undefined, blank(input.district));
  put("city", input.city !== undefined, blank(input.city));
  put("province", input.province !== undefined, blank(input.province));
  put("postalCode", input.postalCode !== undefined, blank(input.postalCode));
  put("spouseName", input.spouseName !== undefined, blank(input.spouseName));
  put("spouseNik", input.spouseNik !== undefined, blank(input.spouseNik));
  put("dependents", input.dependents !== undefined, input.dependents ?? null);
  put("heirName", input.heirName !== undefined, blank(input.heirName));
  put("heirRelation", input.heirRelation !== undefined, blank(input.heirRelation));
  put("heirPhone", input.heirPhone !== undefined, normalizePhone(input.heirPhone));
  put("emergencyName", input.emergencyName !== undefined, blank(input.emergencyName));
  put("emergencyPhone", input.emergencyPhone !== undefined, normalizePhone(input.emergencyPhone));
  put("emergencyRelation", input.emergencyRelation !== undefined, blank(input.emergencyRelation));
  put("occupation", input.occupation !== undefined, blank(input.occupation));
  put("employmentType", input.employmentType !== undefined, blank(input.employmentType));
  put("employerName", input.employerName !== undefined, blank(input.employerName));
  put("workAddress", input.workAddress !== undefined, blank(input.workAddress));
  put("monthlyIncome", input.monthlyIncome !== undefined, input.monthlyIncome ?? null);
  put("otherIncome", input.otherIncome !== undefined, input.otherIncome ?? null);
  put("houseStatus", input.houseStatus !== undefined, blank(input.houseStatus));
  put("yearsAtAddress", input.yearsAtAddress !== undefined, input.yearsAtAddress ?? null);
  put("joinedOn", input.joinedOn !== undefined, toDate(input.joinedOn));
  put("memberType", input.memberType !== undefined, blank(input.memberType) ?? "REGULAR");
  put("notes", input.notes !== undefined, blank(input.notes));
  return data;
}

export function formatMemberAddress(m: {
  address?: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}) {
  return [
    m.address,
    m.rtRw ? `RT/RW ${m.rtRw}` : null,
    m.village,
    m.district,
    m.city,
    m.province,
    m.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export const MEMBER_COMPLETENESS_KEYS = [
  "gender",
  "religion",
  "maritalStatus",
  "education",
  "placeOfBirth",
  "dateOfBirth",
  "motherName",
  "npwp",
  "familyCardNo",
  "phone",
  "email",
  "address",
  "village",
  "district",
  "city",
  "province",
  "spouseName",
  "heirName",
  "emergencyName",
  "occupation",
  "employmentType",
  "monthlyIncome",
  "houseStatus",
] as const;
