#!/usr/bin/env bash
# Restaura un backup cifrado generado por backup.sh.
#
# Uso:
#   BACKUP_PASSPHRASE=... ./deploy/restore.sh ./backups/backup_YYYYMMDD_HHMMSS.tar.gz.enc
#   (o el .age con BACKUP_AGE_RECIPIENT y BACKUP_AGE_KEY)
#
# ATENCIÓN: sobrescribe la base de datos y las imágenes actuales. Hacé un backup
# nuevo antes de restaurar.
set -euo pipefail

BACKUP="${1:?Uso: $0 <backup.tar.gz.enc|backup.tar.gz.age>}"
PASSPHRASE="${BACKUP_PASSPHRASE:-}"
RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
AGE_KEY="${BACKUP_AGE_KEY:-}"

[ -f "$BACKUP" ] || { echo "No existe: $BACKUP" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Descifra.
case "$BACKUP" in
  *.age)
    [ -n "$RECIPIENT" ] || { echo "ERROR: para descifrar .age hace falta BACKUP_AGE_RECIPIENT" >&2; exit 1; }
    [ -n "$AGE_KEY" ] || { echo "ERROR: para descifrar .age hace falta BACKUP_AGE_KEY" >&2; exit 1; }
    age -d -i "$AGE_KEY" -o "$TMP/backup.tar.gz" "$BACKUP"
    ;;
  *.enc)
    : "${PASSPHRASE:?ERROR: hace falta BACKUP_PASSPHRASE}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -pass "env:BACKUP_PASSPHRASE" -in "$BACKUP" -out "$TMP/backup.tar.gz"
    ;;
  *.tar.gz)
    cp "$BACKUP" "$TMP/backup.tar.gz"
    ;;
  *)
    echo "ERROR: extensión no reconocida (usá .enc, .age o .tar.gz)" >&2
    exit 1
    ;;
esac

tar xzf "$TMP/backup.tar.gz" -C "$TMP"

# Restaura base de datos (root para poder recrear todo el esquema).
docker compose exec -T db sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < "$TMP/db.sql"

# Restaura imágenes subidas.
docker compose exec -T backend sh -c 'tar xzf - -C /app/app/uploads' \
  < "$TMP/uploads.tar.gz"

echo "Restauración completada desde $BACKUP"
