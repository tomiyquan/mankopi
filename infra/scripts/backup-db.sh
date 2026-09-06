#!/bin/sh
set -eu
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=${BACKUP_DIR:-/backups}
mkdir -p "$DEST/daily"
FILE="$DEST/daily/mankopi-$STAMP.sql.gz"
pg_dump | gzip > "$FILE"
echo "backup written $FILE"

# retain 7 daily + 4 weekly (Sunday dumps)
find "$DEST/daily" -name "*.sql.gz" -mtime +7 -delete
if [ "$(date -u +%u)" = "7" ]; then
  mkdir -p "$DEST/weekly"
  cp "$FILE" "$DEST/weekly/"
  ls -1t "$DEST/weekly"/*.sql.gz | tail -n +5 | xargs -r rm --
fi
