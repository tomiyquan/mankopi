#!/bin/sh
set -eu
FILE=${1:?usage: restore-db.sh path/to/dump.sql.gz}
gunzip -c "$FILE" | psql "$DATABASE_URL"
echo "restore completed from $FILE"
