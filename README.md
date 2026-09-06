# Mankopi

Sistem manajemen **koperasi simpan-pinjam** (SaaS multi-tenant): buku besar double-entry, anggota & KYC, simpanan, kredit, penagihan lapangan, PHU/SHU, serta laporan yang dibangun dari jurnal — bukan dari angka yang diketik ulang.

Open source. Hak cipta tetap milik [Tomi Prasetyo](https://github.com/tomiyquan). Lihat [LICENSE](LICENSE).

> Ini perangkat lunak operasional, bukan produk resmi OJK dan belum diaudit untuk produksi. Ubah semua kata sandi seed sebelum dipakai di data nyata.

## Untuk siapa

- **Pengurus koperasi** yang ingin mencatat simpan-pinjam dengan jejak jurnal.
- **Pengembang** yang ingin menjalankan, menyesuaikan, atau berkontribusi pada core KSP Indonesia.
- **Operator platform** yang menampung banyak koperasi dalam satu instalasi.

## Yang sudah jalan

- Multi-tenant + cabang/unit, RBAC berjenjang, audit trail
- Ledger double-entry, periode, neraca, PHU, arus kas, pos OJK
- Anggota (berkas identitas, keluarga, pekerjaan, penghasilan), simpanan pokok/wajib/sukarela
- Kredit: produk, pengajuan, tinjauan analis, putusan (setuju / bersyarat / tolak), pencairan, kolektabilitas 1–5
- Penagihan harian, bayar lebih awal, kwitansi, aplikasi kolektor (Expo, di luar Docker)
- Personalia & payroll, porsi beban, CKPN, tutup buku & alokasi SHU
- Analitik NPL/aging

Rancangan yang dikunci: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).  
Deploy: [docs/architecture/DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md).

## Prasyarat

- Node.js 22+
- pnpm 9 (`corepack enable`)
- Docker Engine + plugin Compose (untuk stack penuh)

## Mulai cepat (pengguna / pengurus yang self-host)

Seluruh web, API, worker, Caddy, Postgres, Redis, dan MinIO jalan sebagai container. Migrasi dan seed ikut saat `up`.

```bash
git clone https://github.com/tomiyquan/mankopi.git
cd mankopi
cp .env.example .env          # Windows: copy .env.example .env
pnpm docker:up
```

| Layanan | Alamat |
|---|---|
| Konsol (Caddy) | http://localhost:8080 |
| Web langsung (nginx) | http://localhost:8081 |
| API | http://localhost:8080/api |
| Postgres (host) | `127.0.0.1:55432` |
| MinIO console | http://localhost:9001 |

Akun seed (ganti segera):

| Peran | Email | Kata sandi |
|---|---|---|
| Operator platform | `admin@mankopi.local` | `ChangeMeNow!23` |
| Ketua tenant demo | `ketua@sejahtera.local` | sama, jika `SEED_DEMO_TENANT=true` |

Hanya mengutak-atik UI tanpa rebuild image:

```bash
pnpm --filter @mankopi/web dev
```

lalu buka http://localhost:5173.

Produksi / VPS: ikuti [DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md). Jangan pakai password seed, jangan expose Postgres/Redis, wajib HTTPS.

## Workspace (pengembang)

Monorepo pnpm + Turborepo.

| Path | Peran |
|---|---|
| `apps/api` | Modular monolith NestJS, Prisma, RLS |
| `apps/web` | Dashboard pengurus (React) |
| `apps/mobile` | Kolektor lapangan (Expo) |
| `packages/shared` | Tipe, permission, event, kode error |
| `packages/loan-engine` | Bunga, jadwal, alokasi, kolektabilitas |
| `packages/ledger-engine` | Validasi jurnal, anggaran, CKPN, SHU |

```bash
pnpm install
pnpm --filter @mankopi/shared build
pnpm --filter @mankopi/api prisma:generate
pnpm --filter @mankopi/api lint
pnpm --filter @mankopi/web lint
pnpm --filter @mankopi/api test
```

Setelah mengubah API atau image web, rebuild stack (`pnpm docker:up`) lalu hard-refresh browser.

## Keputusan desain yang jangan dilanggar

Baca [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) sebelum mengubah alur uang atau batas modul.

1. Uang hanya berubah lewat jurnal immutable; koreksi memakai jurnal balik.
2. Isolasi tenant: `tenant_id` + PostgreSQL RLS.
3. Modul tidak mengimpor tabel lintas domain (org tidak memposting jurnal, dsb.).
4. Mesin bunga/jadwal tinggal di `packages/loan-engine`, bukan di UI.
5. Mobile kolektor harus tetap bisa bekerja tanpa sinyal terus-menerus.

## Kontribusi

Kontribusi sangat diterima. Hak cipta kode yang Anda kirim tetap mengikuti lisensi MIT; Anda setuju kontribusi Anda dirilis di bawah lisensi yang sama, tanpa mengalihkan hak cipta proyek kepada siapa pun selain pemegang yang tercantum di [LICENSE](LICENSE).

1. Fork repo, branch dari `main` (`feat/…`, `fix/…`, `docs/…`).
2. Satu PR untuk satu masalah. Jangan campur format-massal dengan perubahan perilaku.
3. Sertakan tes jika mengubah engine (`loan-engine`, `ledger-engine`) atau aturan validasi.
4. Jangan commit `.env`, kunci, dump database, atau data anggota nyata.
5. Salin gaya yang sudah ada: copy produk berbahasa Indonesia, peran tenant memakai **ketua** (bukan label “admin”).
6. Jelaskan *mengapa* di deskripsi PR, plus cara menguji.

Laporkan bug lewat [Issues](https://github.com/tomiyquan/mankopi/issues): langkah repro, hasil yang diharapkan, dan apakah stack-nya Docker atau `pnpm dev`.

## Keamanan

Jangan membuka issue publik untuk celah yang bisa disalahgunakan (akses lintas tenant, bypass RLS, kebocoran jurnal). Kirim detail ke pemilik repo lewat GitHub Security Advisory atau kontak di profil [tomiyquan](https://github.com/tomiyquan).

## Status

Fase 1–6 sudah terpasang di konsol. Audit independen, uji beban, dan hardening produksi masih menyusul. Pakai di koperasi nyata hanya setelah Anda meninjau keamanan, backup, dan kesesuaian AD/ART sendiri.

## Lisensi

[MIT](LICENSE) © 2026 Tomi Prasetyo.

Anda bebas memakai, mengubah, dan mendistribusikan perangkat lunak ini, termasuk untuk keperluan komersial, selama pemberitahuan hak cipta dan lisensi tetap disertakan. Merek “Mankopi” dan hak cipta kode tetap milik pemegang lisensi di atas.
