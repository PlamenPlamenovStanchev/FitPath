#!/usr/bin/env bash
# Shared helpers for FitPath backup and restore scripts. Do not enable xtrace
# in callers: these scripts intentionally keep credentials out of output.

set -euo pipefail
set +x

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$1" >&2
    exit 1
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

create_work_directory() {
  WORK_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/fitpath-backup.XXXXXX")"
  chmod 700 "$WORK_DIRECTORY"
  CREDENTIAL_FILE="$WORK_DIRECTORY/credentials"
}

remove_work_directory() {
  if [[ -n "${WORK_DIRECTORY:-}" && -d "$WORK_DIRECTORY" ]]; then
    rm -rf "$WORK_DIRECTORY"
  fi
}

configure_backup_credentials() {
  require_env BACKUP_R2_ACCESS_KEY_ID
  require_env BACKUP_R2_SECRET_ACCESS_KEY

  cat > "$CREDENTIAL_FILE" <<EOF
[backup]
aws_access_key_id = ${BACKUP_R2_ACCESS_KEY_ID}
aws_secret_access_key = ${BACKUP_R2_SECRET_ACCESS_KEY}
EOF
  chmod 600 "$CREDENTIAL_FILE"
}

configure_operational_and_backup_credentials() {
  require_env R2_ACCESS_KEY_ID
  require_env R2_SECRET_ACCESS_KEY
  require_env BACKUP_R2_ACCESS_KEY_ID
  require_env BACKUP_R2_SECRET_ACCESS_KEY

  cat > "$CREDENTIAL_FILE" <<EOF
[operational]
aws_access_key_id = ${R2_ACCESS_KEY_ID}
aws_secret_access_key = ${R2_SECRET_ACCESS_KEY}
[backup]
aws_access_key_id = ${BACKUP_R2_ACCESS_KEY_ID}
aws_secret_access_key = ${BACKUP_R2_SECRET_ACCESS_KEY}
EOF
  chmod 600 "$CREDENTIAL_FILE"
}

operational_aws() {
  AWS_SHARED_CREDENTIALS_FILE="$CREDENTIAL_FILE" AWS_EC2_METADATA_DISABLED=true \
    aws --profile operational --endpoint-url "$R2_ENDPOINT" "$@"
}

backup_aws() {
  AWS_SHARED_CREDENTIALS_FILE="$CREDENTIAL_FILE" AWS_EC2_METADATA_DISABLED=true \
    aws --profile backup --endpoint-url "$BACKUP_R2_ENDPOINT" "$@"
}
