import {
  MEMBER_EDUCATION,
  MEMBER_EMPLOYMENT,
  MEMBER_GENDERS,
  MEMBER_HOUSE,
  MEMBER_MARITAL,
  MEMBER_RELIGIONS,
  MEMBER_TYPES,
} from "@mankopi/shared";
import type { MemberRow } from "./api";

export const GENDER_LABEL: Record<string, string> = { MALE: "Laki-laki", FEMALE: "Perempuan" };
export const RELIGION_LABEL: Record<string, string> = {
  ISLAM: "Islam",
  CHRISTIAN: "Kristen",
  CATHOLIC: "Katolik",
  HINDU: "Hindu",
  BUDDHIST: "Buddha",
  CONFUCIAN: "Konghucu",
  OTHER: "Lainnya",
};
export const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Belum kawin",
  MARRIED: "Kawin",
  WIDOWED: "Duda / janda",
  DIVORCED: "Cerai",
};
export const EDUCATION_LABEL: Record<string, string> = {
  SD: "SD",
  SMP: "SMP",
  SMA: "SMA / SMK",
  DIPLOMA: "Diploma",
  S1: "Sarjana (S1)",
  S2: "Magister (S2)",
  S3: "Doktor (S3)",
  OTHER: "Lainnya",
};
export const EMPLOYMENT_LABEL: Record<string, string> = {
  EMPLOYEE: "Karyawan",
  SELF_EMPLOYED: "Wiraswasta",
  FARMER: "Petani / nelayan",
  CIVIL_SERVANT: "ASN / TNI / Polri",
  INFORMAL: "Pekerja informal",
  RETIRED: "Pensiunan",
  OTHER: "Lainnya",
};
export const HOUSE_LABEL: Record<string, string> = {
  OWNED: "Milik sendiri",
  FAMILY: "Milik keluarga",
  RENT: "Sewa / kontrak",
  OFFICIAL: "Dinas",
  OTHER: "Lainnya",
};
export const MEMBER_TYPE_LABEL: Record<string, string> = {
  REGULAR: "Anggota biasa",
  EXTRAORDINARY: "Anggota luar biasa",
};

export const MEMBER_OPTIONS = {
  gender: MEMBER_GENDERS.map((v) => ({ value: v, label: GENDER_LABEL[v] })),
  religion: MEMBER_RELIGIONS.map((v) => ({ value: v, label: RELIGION_LABEL[v] })),
  maritalStatus: MEMBER_MARITAL.map((v) => ({ value: v, label: MARITAL_LABEL[v] })),
  education: MEMBER_EDUCATION.map((v) => ({ value: v, label: EDUCATION_LABEL[v] })),
  employmentType: MEMBER_EMPLOYMENT.map((v) => ({ value: v, label: EMPLOYMENT_LABEL[v] })),
  houseStatus: MEMBER_HOUSE.map((v) => ({ value: v, label: HOUSE_LABEL[v] })),
  memberType: MEMBER_TYPES.map((v) => ({ value: v, label: MEMBER_TYPE_LABEL[v] })),
};

export type MemberFormState = {
  nik: string;
  name: string;
  gender: string;
  religion: string;
  maritalStatus: string;
  education: string;
  placeOfBirth: string;
  dateOfBirth: string;
  motherName: string;
  npwp: string;
  familyCardNo: string;
  phone: string;
  phoneAlt: string;
  email: string;
  address: string;
  rtRw: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  spouseName: string;
  spouseNik: string;
  dependents: string;
  heirName: string;
  heirRelation: string;
  heirPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  occupation: string;
  employmentType: string;
  employerName: string;
  workAddress: string;
  monthlyIncome: string;
  otherIncome: string;
  houseStatus: string;
  yearsAtAddress: string;
  joinedOn: string;
  memberType: string;
  notes: string;
  slikConsent: boolean;
  branchId: string;
  unitId: string;
};

const COMPLETENESS: Array<keyof MemberRow> = [
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
];

export function emptyMemberForm(branchId = ""): MemberFormState {
  return {
    nik: "",
    name: "",
    gender: "",
    religion: "",
    maritalStatus: "",
    education: "",
    placeOfBirth: "",
    dateOfBirth: "",
    motherName: "",
    npwp: "",
    familyCardNo: "",
    phone: "",
    phoneAlt: "",
    email: "",
    address: "",
    rtRw: "",
    village: "",
    district: "",
    city: "",
    province: "",
    postalCode: "",
    spouseName: "",
    spouseNik: "",
    dependents: "",
    heirName: "",
    heirRelation: "",
    heirPhone: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    occupation: "",
    employmentType: "",
    employerName: "",
    workAddress: "",
    monthlyIncome: "",
    otherIncome: "",
    houseStatus: "",
    yearsAtAddress: "",
    joinedOn: new Date().toISOString().slice(0, 10),
    memberType: "REGULAR",
    notes: "",
    slikConsent: true,
    branchId,
    unitId: "",
  };
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function memberToForm(m: MemberRow): MemberFormState {
  return {
    ...emptyMemberForm(m.branchId ?? ""),
    nik: m.nik,
    name: m.name,
    gender: m.gender ?? "",
    religion: m.religion ?? "",
    maritalStatus: m.maritalStatus ?? "",
    education: m.education ?? "",
    placeOfBirth: m.placeOfBirth ?? "",
    dateOfBirth: dateInput(m.dateOfBirth),
    motherName: m.motherName ?? "",
    npwp: m.npwp ?? "",
    familyCardNo: m.familyCardNo ?? "",
    phone: m.phone ?? "",
    phoneAlt: m.phoneAlt ?? "",
    email: m.email ?? "",
    address: m.address ?? "",
    rtRw: m.rtRw ?? "",
    village: m.village ?? "",
    district: m.district ?? "",
    city: m.city ?? "",
    province: m.province ?? "",
    postalCode: m.postalCode ?? "",
    spouseName: m.spouseName ?? "",
    spouseNik: m.spouseNik ?? "",
    dependents: m.dependents != null ? String(m.dependents) : "",
    heirName: m.heirName ?? "",
    heirRelation: m.heirRelation ?? "",
    heirPhone: m.heirPhone ?? "",
    emergencyName: m.emergencyName ?? "",
    emergencyPhone: m.emergencyPhone ?? "",
    emergencyRelation: m.emergencyRelation ?? "",
    occupation: m.occupation ?? "",
    employmentType: m.employmentType ?? "",
    employerName: m.employerName ?? "",
    workAddress: m.workAddress ?? "",
    monthlyIncome: m.monthlyIncome != null ? String(Math.round(Number(m.monthlyIncome))) : "",
    otherIncome: m.otherIncome != null ? String(Math.round(Number(m.otherIncome))) : "",
    houseStatus: m.houseStatus ?? "",
    yearsAtAddress: m.yearsAtAddress != null ? String(m.yearsAtAddress) : "",
    joinedOn: dateInput(m.joinedOn) || new Date().toISOString().slice(0, 10),
    memberType: m.memberType ?? "REGULAR",
    notes: m.notes ?? "",
    slikConsent: Boolean(m.slikConsentAt),
    branchId: m.branchId ?? "",
    unitId: m.unitId ?? "",
  };
}

export function formToPayload(form: MemberFormState) {
  const num = (value: string) => (value.trim() ? Number(value) : null);
  return {
    nik: form.nik.trim(),
    name: form.name.trim(),
    gender: form.gender || null,
    religion: form.religion || null,
    maritalStatus: form.maritalStatus || null,
    education: form.education || null,
    placeOfBirth: form.placeOfBirth || null,
    dateOfBirth: form.dateOfBirth || null,
    motherName: form.motherName || null,
    npwp: form.npwp.replace(/\D/g, "") || null,
    familyCardNo: form.familyCardNo.replace(/\D/g, "") || null,
    phone: form.phone.replace(/\D/g, "") || null,
    phoneAlt: form.phoneAlt.replace(/\D/g, "") || null,
    email: form.email || null,
    address: form.address || null,
    rtRw: form.rtRw || null,
    village: form.village || null,
    district: form.district || null,
    city: form.city || null,
    province: form.province || null,
    postalCode: form.postalCode || null,
    spouseName: form.spouseName || null,
    spouseNik: form.spouseNik.replace(/\D/g, "") || null,
    dependents: num(form.dependents),
    heirName: form.heirName || null,
    heirRelation: form.heirRelation || null,
    heirPhone: form.heirPhone.replace(/\D/g, "") || null,
    emergencyName: form.emergencyName || null,
    emergencyPhone: form.emergencyPhone.replace(/\D/g, "") || null,
    emergencyRelation: form.emergencyRelation || null,
    occupation: form.occupation || null,
    employmentType: form.employmentType || null,
    employerName: form.employerName || null,
    workAddress: form.workAddress || null,
    monthlyIncome: num(form.monthlyIncome),
    otherIncome: num(form.otherIncome),
    houseStatus: form.houseStatus || null,
    yearsAtAddress: num(form.yearsAtAddress),
    joinedOn: form.joinedOn || null,
    memberType: form.memberType || "REGULAR",
    notes: form.notes || null,
    slikConsent: form.slikConsent,
    branchId: form.branchId || undefined,
    unitId: form.unitId || null,
  };
}

export function formatMemberAddress(m: Pick<MemberRow, "address" | "rtRw" | "village" | "district" | "city" | "province" | "postalCode">) {
  return [m.address, m.rtRw ? `RT/RW ${m.rtRw}` : null, m.village, m.district, m.city, m.province, m.postalCode]
    .filter(Boolean)
    .join(", ");
}

export function memberCompleteness(m: MemberRow) {
  const filled = COMPLETENESS.filter((key) => {
    const value = m[key];
    return value !== null && value !== undefined && value !== "";
  }).length;
  return { filled, total: COMPLETENESS.length, percent: Math.round((filled / COMPLETENESS.length) * 100) };
}

export function labeled(map: Record<string, string>, value?: string | null) {
  if (!value) return "—";
  return map[value] ?? value;
}
