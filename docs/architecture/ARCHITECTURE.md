# Arsitektur Mankopi

Dokumen ini mengunci keputusan desain. Implementasi mengikuti batas modul di sini; jangan impor tabel lintas domain.

## Keputusan yang dikunci

- Multi-tenant SaaS, setiap tenant multi-cabang/unit
- Modular monolith NestJS (bukan microservices di hari pertama)
- Isolasi: `tenant_id` + PostgreSQL RLS; jalur dedicated DB untuk tenant besar
- Ledger double-entry sebagai satu-satunya sumber kebenaran keuangan
- Domain event memicu jurnal, laporan, dan UI realtime
- Mobile kolektor offline-first (Expo), di luar Docker
- Deploy: Docker Compose satu kontrak, overlay lokal vs VPS
- Object storage MinIO (S3-compatible)
- Kepatuhan OJK: data + laporan + validasi dirancang dari ledger, bukan tempelan
- Kwitansi lapangan: cetak (PDF/print/Bluetooth) + bagikan WhatsApp
- Kalender libur per tenant + default libur nasional
- VPS: HTTPS wajib sebelum API publik; backup Postgres harian ke storage terpisah; uji restore berkala

## Prinsip

1. Uang tidak diubah di tempat — hanya jurnal immutable + jurnal balik.
2. Event domain adalah sumber kebenaran operasional.
3. Isolasi tenant di gateway, RLS, Redis key, dan prefix object storage.
4. Modul bicara lewat event/interface, bukan join lintas skema.
5. Kolektor lapangan tidak boleh tergantung sinyal.

## Batas modul

| Modul | Boleh | Tidak boleh |
|---|---|---|
| platform | Tenant, paket, template COA, feature flag | Transaksi koperasi |
| identity | User, role, permission, sesi | Aturan bunga |
| org | Cabang, unit, kas, assignment kolektor | Jurnal |
| membership | Anggota, KYC, simpanan pokok/wajib sebagai produk keanggotaan | Posting jurnal langsung |
| savings | Produk dan mutasi simpanan | Mesin angsuran |
| credit | Produk, akad, jadwal, bunga, denda | UI kolektor |
| collection | Rute, kartu harian, setoran, rekonsiliasi | COA |
| ledger | No perkiraan, jurnal, periode, closing | Aturan bunga |
| reporting | Neraca, arus kas, PHU, aging, NPL, SHU | Mutasi saldo |
| compliance | Mapping OJK, kolektabilitas, paket laporan, ekspor | Posting jurnal / hitung bunga |
| hr / payroll | Personalia, slip gaji, periode payroll | COA / posting jurnal langsung |
| notification | In-app, push, WhatsApp kwitansi | Bisnis domain |

Alur uang: `aksi bisnis → domain event → ledger posting → proyeksi laporan + realtime`.

## Tenancy

```
Platform
  └── Tenant (Koperasi)
        └── Branch
              └── Unit
                    └── Collector portfolio
```

Resolver urutan: klaim JWT → header `X-Tenant` (slug) → subdomain. Setiap request tenant men-set `app.tenant_id` untuk RLS.

Platform admin memakai peran bypass yang diaudit. File: `tenants/{tenantId}/...`.

## RBAC

`Role → Permission (resource:action)` + data scope: `platform | tenant | branch | unit | own_portfolio`.

Peran sistem tenant: ketua, manajer_cabang, bendahara, admin_anggota, analis_kredit, kolektor, auditor.

## Ledger (fase 2+)

Kelas akun: 1 Aktiva, 2 Kewajiban, 3 Ekuitas, 4 Pendapatan, 5 Beban. Jurnal seimbang, periode tertutup terkunci, koreksi hanya jurnal balik. Laporan dibangun dari buku besar.

## Kredit (fase 4+)

Engine murni di `packages/loan-engine`. Frekuensi harian–bulanan. Metode: flat, declining, anuitas, harian efektif. Dasar bunga produk: per tahun, per hari, atau total dari pokok. Produk mengatur toleransi hari dan denda (nominal/persen, sekali atau per hari). Alokasi default: denda → bunga → pokok. Kalender tenant mengatur due-date; denda dihitung setelah toleransi. Kolektabilitas 1–5 tetap dari hari lewat tempo.

## Collection & mobile (fase 5+)

Kartu tagih harian dari `schedule_items`. Kwitansi idempotent (`client_receipt_id`). Server berwenang atas saldo. Kwitansi: satu nomor server, render PDF, cetak, dan WhatsApp.

## Realtime

WebSocket room `tenant:{id}` dan `branch:{id}`. Trigger: setoran, kas, pengajuan, overdue, tutup kas.

## Docker

Satu set service: `api`, `worker`, `web`, `postgres`, `redis`, `minio`, `proxy` (Caddy).

- Lokal: `docker-compose.yml` + `docker-compose.override.yml` — port debug terbuka, HTTP.
- VPS: + `docker-compose.prod.yml` — pull image registry, TLS, tanpa expose Postgres/Redis, resource limit, backup.

Mobile tidak di-container. Migrasi dijalankan container/script `migrate`, bukan auto-migrate saat boot API.

## Scale-up

1. Satu API + worker, satu DB, Redis, MinIO.
2. Replica baca + cache laporan.
3. Pecah Collection jika volume tagihan memaksa.
4. Warehouse untuk BI; OLTP tetap PostgreSQL.
5. Dedicated DB per tenant enterprise.
6. Jangan pecah Ledger lebih dulu.

## Fase implementasi

1. Fondasi SaaS + Docker — tenant, identity, RBAC, cabang, audit
2. Ledger + mapping pos OJK
3. Anggota + simpanan + NIK/SLIK-ready
4. Kredit + kalender tenant
5. Collection + mobile (cetak + WA)
6. Analitik + paket laporan OJK/SIPEDAI

Di luar fase awal: marketplace, core banking antar-bank, AI scoring, submit otomatis portal OJK (menunggu kredensial resmi).
