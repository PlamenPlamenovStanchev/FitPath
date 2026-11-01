#!/usr/bin/env bash
# Creates one immutable FitPath backup package and retention references.

set -euo pipefail
set +x

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-lib.sh
source "$SCRIPT_DIRECTORY/backup-lib.sh"

for variable in DATABASE_URL R2_ENDPOINT R2_BUCKET_NAME BACKUP_R2_ENDPOINT BACKUP_R2_BUCKET_NAME; do
  require_env "$variable"
done
for command in pg_dump aws find sort awk od tr wc xargs; do
  require_command "$command"
done
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  printf 'Required command is unavailable: sha256sum or shasum\n' >&2
  exit 1
fi

create_work_directory
trap remove_work_directory EXIT
configure_operational_and_backup_credentials

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_id="$(date -u +%Y%m%dT%H%M%SZ)-$(od -An -N4 -tx4 /dev/urandom | tr -d ' \n')"
package_directory="$WORK_DIRECTORY/$backup_id"
mkdir -p "$package_directory/database" "$package_directory/storage"

printf 'Backup ID: %s\n' "$backup_id"
printf 'Backup start time (UTC): %s\n' "$timestamp"

if ! PGDATABASE="$DATABASE_URL" pg_dump \
  --format=custom \
  --compress=9 \
  --file="$package_directory/database/fitpath.dump" \
  --no-owner \
  --no-privileges; then
  printf 'Backup failed: pg_dump failed for backup ID %s.\n' "$backup_id" >&2
  exit 1
fi

if ! operational_aws s3 sync "s3://${R2_BUCKET_NAME}/" "$package_directory/storage/" --only-show-errors; then
  printf 'Backup failed: storage backup failed for backup ID %s.\n' "$backup_id" >&2
  exit 1
fi

storage_checksum_file="$package_directory/storage-checksums.sha256"
if find "$package_directory/storage" -type f -print -quit | grep -q .; then
  find "$package_directory/storage" -type f -print0 | sort -z | xargs -0 sha256sum > "$storage_checksum_file"
else
  : > "$storage_checksum_file"
fi

database_checksum="$(sha256_file "$package_directory/database/fitpath.dump")"
storage_checksum="$(sha256_file "$storage_checksum_file")"
storage_object_count="$(find "$package_directory/storage" -type f | wc -l | tr -d ' ')"

cat > "$package_directory/manifest.json" <<EOF
{
  "backupId": "${backup_id}",
  "timestamp": "${timestamp}",
  "database": {
    "filename": "database/fitpath.dump",
    "sha256": "${database_checksum}"
  },
  "storage": {
    "prefix": "storage/",
    "objectCount": ${storage_object_count},
    "checksumsFilename": "storage-checksums.sha256",
    "checksumsSha256": "${storage_checksum}"
  }
}
EOF

if ! backup_aws s3 sync "$package_directory/" "s3://${BACKUP_R2_BUCKET_NAME}/backups/${backup_id}/" --only-show-errors; then
  printf 'Backup failed: archive upload failed for backup ID %s.\n' "$backup_id" >&2
  exit 1
fi

write_reference() {
  local tier="$1"
  local label="$2"
  local reference_file="$WORK_DIRECTORY/${tier}-${label}.json"
  cat > "$reference_file" <<EOF
{"backupId":"${backup_id}","timestamp":"${timestamp}"}
EOF
  backup_aws s3 cp "$reference_file" "s3://${BACKUP_R2_BUCKET_NAME}/retention/${tier}/${label}.json" --only-show-errors
}

write_reference daily "$(date -u +%F)"
if [[ "$(date -u +%u)" == "7" ]]; then
  write_reference weekly "$(date -u +%G-W%V)"
fi
if [[ "$(date -u +%d)" == "01" ]]; then
  write_reference monthly "$(date -u +%Y-%m)"
fi

if ! bash "$SCRIPT_DIRECTORY/prune-backups.sh"; then
  printf 'Backup failed: retention pruning failed for backup ID %s.\n' "$backup_id" >&2
  exit 1
fi
printf 'Backup completed successfully: %s\n' "$backup_id"
