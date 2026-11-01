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

list_references_to_file() {
  local tier="$1"
  local destination="$2"
  local temporary_file="${destination}.tmp"

  if ! list_references "$tier" > "$temporary_file"; then
    rm -f "$temporary_file"
    printf 'Failed to list %s retention references; refusing to prune backups.\n' "$tier" >&2
    exit 1
  fi

  mv "$temporary_file" "$destination"
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
  reference_list="$WORK_DIRECTORY/${tier}-references.txt"
  list_references_to_file "$tier" "$reference_list"

  while IFS= read -r reference; do
    reference_contents="$(backup_aws s3 cp "s3://${BACKUP_R2_BUCKET_NAME}/${reference}" - --only-show-errors)"
    backup_id="$(sed -n 's/.*"backupId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$reference_contents")"

    if [[ ! "$backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ ]]; then
      printf 'Invalid backup ID in retention reference %s; refusing to prune backups.\n' "$reference" >&2
      exit 1
    fi

    printf '%s\n' "$backup_id" >> "$referenced_backup_ids"
  done < "$reference_list"
done
sort -u -o "$referenced_backup_ids" "$referenced_backup_ids"

if [[ ! -s "$referenced_backup_ids" ]]; then
  printf 'No valid retained backup references were found; refusing to prune backup packages.\n' >&2
  exit 1
fi

while IFS= read -r manifest_key; do
  backup_id="${manifest_key#backups/}"
  backup_id="${backup_id%/manifest.json}"
  if ! grep -Fxq "$backup_id" "$referenced_backup_ids"; then
    backup_aws s3 rm "s3://${BACKUP_R2_BUCKET_NAME}/backups/${backup_id}/" --recursive --only-show-errors
  fi
done < <(backup_aws s3 ls "s3://${BACKUP_R2_BUCKET_NAME}/backups/" --recursive \
  | awk '$4 ~ /^backups\/[^/]+\/manifest\.json$/ { print $4 }')

daily_count="$(wc -l < "$WORK_DIRECTORY/daily-references.txt" | tr -d ' ')"
weekly_count="$(wc -l < "$WORK_DIRECTORY/weekly-references.txt" | tr -d ' ')"
monthly_count="$(wc -l < "$WORK_DIRECTORY/monthly-references.txt" | tr -d ' ')"
printf 'Retention result: daily=%s/7 weekly=%s/5 monthly=%s/12.\n' \
  "$daily_count" "$weekly_count" "$monthly_count"
