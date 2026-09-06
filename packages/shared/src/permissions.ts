export const PERMISSIONS = [
  { key: "platform:tenant:manage", resource: "platform.tenant", action: "manage", description: "Kelola koperasi (tenant)" },
  { key: "identity:user:manage", resource: "identity.user", action: "manage", description: "Kelola pengguna" },
  { key: "identity:role:manage", resource: "identity.role", action: "manage", description: "Kelola peran dan hak akses" },
  { key: "org:branch:manage", resource: "org.branch", action: "manage", description: "Kelola cabang dan unit" },
  { key: "org:branch:view", resource: "org.branch", action: "view", description: "Lihat cabang" },
  { key: "audit:view", resource: "audit", action: "view", description: "Lihat jejak audit" },
  { key: "member:view", resource: "member", action: "view", description: "Lihat anggota" },
  { key: "member:create", resource: "member", action: "create", description: "Daftar anggota" },
  { key: "member:export", resource: "member", action: "export", description: "Ekspor data anggota" },
  { key: "savings:view", resource: "savings", action: "view", description: "Lihat simpanan" },
  { key: "savings:post", resource: "savings", action: "post", description: "Mutasi simpanan" },
  { key: "loan:view", resource: "loan", action: "view", description: "Lihat pinjaman" },
  { key: "loan:create", resource: "loan", action: "create", description: "Pengajuan pinjaman" },
  { key: "loan:approve", resource: "loan", action: "approve", description: "Putusan kredit" },
  { key: "loan:restructure", resource: "loan", action: "restructure", description: "Restruktur pinjaman" },
  { key: "collection:view", resource: "collection", action: "view", description: "Lihat penagihan" },
  { key: "collection:create", resource: "collection", action: "create", description: "Input setoran lapangan" },
  { key: "ledger:view", resource: "ledger", action: "view", description: "Lihat jurnal dan buku besar" },
  { key: "ledger:post_manual", resource: "ledger", action: "post_manual", description: "Jurnal manual" },
  { key: "ledger:close", resource: "ledger", action: "close", description: "Tutup buku dan alokasi SHU" },
  { key: "report:neraca:view", resource: "report.neraca", action: "view", description: "Lihat neraca" },
  { key: "report:arus_kas:view", resource: "report.arus_kas", action: "view", description: "Lihat arus kas" },
  { key: "report:phu:view", resource: "report.phu", action: "view", description: "Lihat PHU" },
  { key: "compliance:view", resource: "compliance", action: "view", description: "Lihat paket laporan OJK" },
  { key: "compliance:export", resource: "compliance", action: "export", description: "Ekspor laporan OJK" },
  { key: "hr:employee:manage", resource: "hr.employee", action: "manage", description: "Kelola personalia" },
  { key: "hr:payroll:view", resource: "hr.payroll", action: "view", description: "Lihat payroll" },
  { key: "hr:payroll:post", resource: "hr.payroll", action: "post", description: "Proses dan posting payroll" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export function isPlatformPermission(key: string) {
  return key.startsWith("platform:");
}

export type RoleMeta = {
  name: string;
  summary: string;
  isTenantAdmin?: boolean;
};

/** Tidak ada peran bernama "admin" di koperasi. Ketua = admin tenant. */
export const ROLE_META: Record<string, RoleMeta> = {
  platform_admin: {
    name: "Platform Admin",
    summary: "Operator SaaS Mankopi. Bisa masuk ke semua koperasi. Bukan pengurus koperasi.",
  },
  ketua: {
    name: "Ketua / Pengurus",
    summary: "Admin koperasi. Mengatur pengguna, hak akses, dan seluruh operasional. Bukan operator platform.",
    isTenantAdmin: true,
  },
  manajer_cabang: {
    name: "Manajer Cabang",
    summary: "Operasional cabang. Bisa kelola pengguna, tetapi bukan admin koperasi — tidak mengatur hak akses dan putusan kredit.",
  },
  bendahara: {
    name: "Bendahara / Kasir",
    summary: "Kas, pembukuan, dan payroll: simpanan, jurnal, serta gaji personalia.",
  },
  admin_anggota: {
    name: "Admin Keanggotaan",
    summary: "Pendaftaran dan data anggota plus mutasi simpanan pokok/wajib/sukarela.",
  },
  analis_kredit: {
    name: "Analis Kredit",
    summary: "Pengajuan, putusan, dan restruktur pinjaman.",
  },
  kolektor: {
    name: "Kolektor",
    summary: "Kartu harian dan setoran lapangan.",
  },
  auditor: {
    name: "Auditor",
    summary: "Akses lihat/ekspor untuk audit dan paket OJK, tanpa mengubah transaksi.",
  },
};

export function mappedPermissionKeys(slug: string): readonly PermissionKey[] {
  return ROLE_PERMISSION_MAP[slug] ?? [];
}

export const ROLE_PERMISSION_MAP: Record<string, readonly PermissionKey[]> = {
  platform_admin: PERMISSIONS.map((p) => p.key),
  ketua: PERMISSIONS.filter((p) => p.key !== "platform:tenant:manage").map((p) => p.key),
  manajer_cabang: [
    "identity:user:manage",
    "org:branch:view",
    "audit:view",
    "member:view",
    "member:create",
    "savings:view",
    "savings:post",
    "loan:view",
    "loan:create",
    "collection:view",
    "collection:create",
    "ledger:view",
    "report:neraca:view",
    "report:arus_kas:view",
    "report:phu:view",
    "hr:employee:manage",
    "hr:payroll:view",
  ],
  bendahara: [
    "org:branch:view",
    "audit:view",
    "member:view",
    "savings:view",
    "savings:post",
    "loan:view",
    "collection:view",
    "ledger:view",
    "ledger:post_manual",
    "ledger:close",
    "report:neraca:view",
    "report:arus_kas:view",
    "report:phu:view",
    "hr:employee:manage",
    "hr:payroll:view",
    "hr:payroll:post",
  ],
  admin_anggota: [
    "org:branch:view",
    "member:view",
    "member:create",
    "member:export",
    "savings:view",
    "savings:post",
  ],
  analis_kredit: [
    "org:branch:view",
    "member:view",
    "loan:view",
    "loan:create",
    "loan:approve",
    "loan:restructure",
    "report:neraca:view",
  ],
  kolektor: ["collection:view", "collection:create", "member:view", "loan:view"],
  auditor: [
    "org:branch:view",
    "audit:view",
    "member:view",
    "member:export",
    "savings:view",
    "loan:view",
    "collection:view",
    "ledger:view",
    "report:neraca:view",
    "report:arus_kas:view",
    "report:phu:view",
    "compliance:view",
    "compliance:export",
    "hr:payroll:view",
  ],
};
