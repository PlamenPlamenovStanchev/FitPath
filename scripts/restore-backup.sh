#!/usr/bin/env bash
# Restores one backup package only to an explicitly confirmed non-production target.

set -euo pipefail
set +x

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-lib.sh
source "$SCRIPT_DIRECTORY/backup-lib.sh"

backup_id="${1:-}"
if [[ -z "$backup_id" || ! "$backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ ]]; then
  printf 'Usage: RESTORE_TARGET_ENV=<non-production> RESTORE_CONFIRM=RESTORE_TO_NON_PRODUCTION bash scripts/restore-backup.sh <backup-id>\n' >&2
  exit 1
fi

if [[ "${RESTORE_TARGET_ENV:-}" == "production" || "${RESTORE_CONFIRM:-}" != "RESTORE_TO_NON_PRODUCTION" ]]; then
  printf 'Restore is limited to an explicitly confirmed non-production target.\n' >&2
  exit 1
fi

for variable in BACKUP_R2_BUCKET_NAME BACKUP_R2_ENDPOINT DATABASE_URL RESTORE_R2_ENDPOINT RESTORE_R2_BUCKET_NAME RESTORE_R2_ACCESS_KEY_ID RESTORE_R2_SECRET_ACCESS_KEY; do
  require_env "$variable"
done
for command in pg_restore aws grep sed; do
  require_command "$command"
done

create_work_directory
trap remove_work_directory EXIT
configure_backup_credentials

cat >> "$CREDENTIAL_FILE" <<EOF
[restore]
aws_access_key_id = ${RESTORE_R2_ACCESS_KEY_ID}
aws_secret_access_key = ${RESTORE_R2_SECRET_ACCESS_KEY}
EOF
chmod 600 "$CREDENTIAL_FILE"

restore_aws() {
  AWS_SHARED_CREDENTIALS_FILE="$CREDENTIAL_FILE" AWS_EC2_METADATA_DISABLED=true \
    aws --profile restore --endpoint-url "$RESTORE_R2_ENDPOINT" "$@"
}

package_directory="$WORK_DIRECTORY/$backup_id"
mkdir -p "$package_directory"
backup_aws s3 sync "s3://${BACKUP_R2_BUCKET_NAME}/backups/${backup_id}/" "$package_directory/" --only-show-errors

manifest="$package_directory/manifest.json"
dump_file="$package_directory/database/fitpath.dump"
if [[ ! -f "$manifest" || ! -f "$dump_file" ]]; then
  printf 'Backup package is incomplete or does not exist.\n' >&2
  exit 1
fi

expected_checksum="$(sed -n 's/.*"sha256": "\([a-f0-9]*\)".*/\1/p' "$manifest" | head -n 1)"
if [[ -z "$expected_checksum" || "$(sha256_file "$dump_file")" != "$expected_checksum" ]]; then
  printf 'Database dump checksum verification failed.\n' >&2
  exit 1
fi

pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$dump_file"

restore_aws s3 sync "$package_directory/storage/" "s3://${RESTORE_R2_BUCKET_NAME}/" --only-show-errors
printf 'Restore completed to non-production target: %s\n' "$RESTORE_TARGET_ENV"
