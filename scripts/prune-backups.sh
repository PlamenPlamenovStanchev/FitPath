#!/usr/bin/env bash
# Applies retention to small R2 reference objects, then deletes unreferenced
# immutable backup packages. Invoke only after a successful backup upload.

set -euo pipefail
set +x

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-lib.sh
source "$SCRIPT_DIRECTORY/backup-lib.sh"

require_env BACKUP_R2_BUCKET_NAME
require_r2_endpoint BACKUP_R2_ENDPOINT
require_command aws

create_work_directory
trap remove_work_directory EXIT
configure_backup_credentials

list_references() {
  local tier="$1"
  backup_aws s3 ls "s3://${BACKUP_R2_BUCKET_NAME}/retention/${tier}/" --recursive \
    | awk '$4 ~ /^retention\/.+\.json$/ { print $4 }'
}

prune_reference_tier() {
  local tier="$1"
  local keep="$2"
  local references=()
  mapfile -t references < <(list_references "$tier" | sort)

  local remove_count=$(( ${#references[@]} - keep ))
  if (( remove_count <= 0 )); then
    return
  fi

  local index
  for ((index = 0; index < remove_count; index += 1)); do
    backup_aws s3 rm "s3://${BACKUP_R2_BUCKET_NAME}/${references[index]}" --only-show-errors
  done
}

prune_reference_tier daily 7
prune_reference_tier weekly 5
prune_reference_tier monthly 12

referenced_backup_ids="$WORK_DIRECTORY/referenced-backup-ids.txt"
: > "$referenced_backup_ids"
for tier in daily weekly monthly; do
  while IFS= read -r reference; do
    backup_aws s3 cp "s3://${BACKUP_R2_BUCKET_NAME}/${reference}" - --only-show-errors \
      | sed -n 's/.*"backupId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      >> "$referenced_backup_ids"
  done < <(list_references "$tier")
done
sort -u -o "$referenced_backup_ids" "$referenced_backup_ids"

while IFS= read -r manifest_key; do
  backup_id="${manifest_key#backups/}"
  backup_id="${backup_id%/manifest.json}"
  if ! grep -Fxq "$backup_id" "$referenced_backup_ids"; then
    backup_aws s3 rm "s3://${BACKUP_R2_BUCKET_NAME}/backups/${backup_id}/" --recursive --only-show-errors
  fi
done < <(backup_aws s3 ls "s3://${BACKUP_R2_BUCKET_NAME}/backups/" --recursive \
  | awk '$4 ~ /^backups\/[^/]+\/manifest\.json$/ { print $4 }')

daily_count="$(list_references daily | wc -l | tr -d ' ')"
weekly_count="$(list_references weekly | wc -l | tr -d ' ')"
monthly_count="$(list_references monthly | wc -l | tr -d ' ')"
printf 'Retention result: daily=%s/7 weekly=%s/5 monthly=%s/12.\n' \
  "$daily_count" "$weekly_count" "$monthly_count"
