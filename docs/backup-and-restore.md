# FitPath Backup and Restore

FitPath backups are logical PostgreSQL dumps plus a private copy of the
operational R2 bucket. They are designed for disaster recovery and restore
testing, not for public distribution.

## Prerequisites

The machine or scheduled job needs:

- Bash, `pg_dump`, `pg_restore`, and AWS CLI v2;
- network access to Neon and both R2 buckets;
- environment variables supplied by a secret manager or protected scheduler
  configuration. Do not commit them or place them in command-line arguments.

The backup job requires the following variables:

```text
DATABASE_URL
R2_ENDPOINT
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
BACKUP_R2_ENDPOINT
BACKUP_R2_BUCKET_NAME
BACKUP_R2_ACCESS_KEY_ID
BACKUP_R2_SECRET_ACCESS_KEY
```

The operational R2 credentials must be limited to list/read on the operational
bucket. The backup credentials must be distinct and limited to list/read/write/
delete on the dedicated backup bucket. Keep the backup bucket private and do
not configure a public bucket domain.

## Create a backup

Run from the repository root:

```bash
bash scripts/backup.sh
```

The script creates one immutable package under
`backups/<backup-id>/` in the backup bucket:

```text
database/fitpath.dump
storage/...
storage-checksums.sha256
manifest.json
```

`fitpath.dump` is a compressed PostgreSQL custom-format dump and can be read
by `pg_restore`. The manifest contains the UTC timestamp, backup ID, dump
filename and SHA-256, plus storage object count and checksum-inventory SHA-256.
The script intentionally does not print a database URL or credentials.

The R2 copy is made through a local private temporary directory. This allows
the operational credentials to be read-only and backup credentials to be
limited to the backup bucket; it also avoids exposing credentials in AWS CLI
arguments or logs.

## Retention

Each successful package receives a daily reference. On Sunday it also receives
a weekly reference, and on the first UTC day of a month it receives a monthly
reference. These are small JSON references, not duplicate backup packages.

`scripts/prune-backups.sh`, which `backup.sh` calls after a successful upload,
keeps:

- 7 daily references;
- 5 weekly references;
- 12 monthly references.

It deletes a package only after no retained reference points to it. Run the
backup job once per day (for example, using a scheduler or CI schedule). A
weekly or monthly promotion on the same day never creates another full backup.

## Restore to a non-production target

Restoration is intentionally guarded. It requires a target database URL in
`DATABASE_URL`, a dedicated non-production R2 target, and this exact
confirmation:

```bash
export RESTORE_TARGET_ENV=staging
export RESTORE_CONFIRM=RESTORE_TO_NON_PRODUCTION
bash scripts/restore-backup.sh <backup-id>
```

Additional restore variables:

```text
BACKUP_R2_ENDPOINT
BACKUP_R2_BUCKET_NAME
BACKUP_R2_ACCESS_KEY_ID
BACKUP_R2_SECRET_ACCESS_KEY
DATABASE_URL                 # target database, never production
RESTORE_R2_ENDPOINT
RESTORE_R2_BUCKET_NAME       # separate non-production bucket
RESTORE_R2_ACCESS_KEY_ID
RESTORE_R2_SECRET_ACCESS_KEY
```

The restore script downloads the package, verifies the database-dump checksum,
runs `pg_restore --clean --if-exists --no-owner --no-privileges`, then copies
the stored objects into the target R2 bucket. It does not use `--delete` for
target storage, so an operator can inspect or remove unrelated target objects
separately. The target database is destructive because it is cleaned before
restore; never point `DATABASE_URL` at production.

## Suggested operational checks

Schedule a non-production restore test regularly. Confirm that:

1. `pg_restore --list database/fitpath.dump` succeeds after retrieval.
2. expected application data is present in the target database;
3. object count in the target bucket matches the package manifest; and
4. production and backup bucket policies remain private and separately scoped.
