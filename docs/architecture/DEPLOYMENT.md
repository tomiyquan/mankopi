# Deployment Docker

Prinsip: **satu set image, dua overlay Compose.** Laptop dan VPS menjalankan service yang sama.

## Service

| Service | Port internal | Publik lokal | Publik VPS |
|---|---|---|---|
| caddy (proxy) | 80 / 443 | 8080 | 80 / 443 |
| api | 3000 | via :8080/api | tidak |
| worker | — | tidak | tidak |
| web | 80 | tidak (via proxy) | tidak |
| postgres | 5432 | 55432 (debug) | tidak |
| redis | 6379 | 6379 (debug) | tidak |
| minio | 9000 / 9001 | 9000 / 9001 | tidak |

## Perintah

Lokal (web + API + worker + proxy di container):

```bash
pnpm docker:up
```

Membuka http://localhost:8080. Overlay lokal men-seed admin dan mengekspos port debug.

VPS:

```bash
# di server, .env.prod permission 600
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.prod.yml --env-file .env.prod pull
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d
bash infra/scripts/migrate.sh
```

Image: `mankopi/api:<git-sha>`, `mankopi/web:<git-sha>`, `mankopi/worker` memakai image api dengan command `node apps/api/dist/worker.js`.

## Checklist go-live VPS

1. Domain + DNS A ke VPS
2. Firewall hanya 22 (atau SSH kustom), 80, 443
3. `.env.prod` berisi `JWT_SECRET`, password DB, dan `DOMAIN` + `ACME_EMAIL`
4. TLS Caddy hijau
5. Job backup `pg_dump` harian ke storage terpisah
6. Uji restore di staging/lokal
7. Migrasi + seed platform admin, lalu ganti password
8. Mobile EAS menunjuk `https://api.<domain>` atau origin publik

Go-live ditunda jika TLS atau backup belum hijau. Volume Docker bukan pengganti backup.
