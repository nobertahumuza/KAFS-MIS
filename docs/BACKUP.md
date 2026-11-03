# Backup & Restore Runbook

This system holds members' phone numbers, NINs, loans and savings ledgers. The
backup strategy below follows **3-2-1**: at least 3 copies, on 2 different
media, with 1 copy offsite — encrypted at rest, automatic, and tested.

## What is backed up

| Asset | How | Where it lands |
|---|---|---|
| **PostgreSQL database** (all 115 tables: members, NINs, loans, savings, shares, audit trail, SMS logs, member photos stored as base64) | `pg_dump -Fc` → AES-256 encrypted | Private repo `nobertahumuza/KAFS-MIS-backups` |
| **Uploaded member documents** | Stored in S3-compatible object storage (`S3_*` env vars) — see below | Your bucket (R2/B2/S3) |
| **Source code** | Git (already) | `nobertahumuza/KAFS-MIS` |

The nightly pipeline is [`.github/workflows/nightly-backup.yml`](../.github/workflows/nightly-backup.yml):

```
02:00 UTC daily (05:00 EAT)
  pg_dump (read-only)  →  AES-256 (gpg)  →  round-trip verify
       ↓                                    (decrypt → pg_restore --list → byte compare)
  push to private backup repo  →  prune (30 daily + 12 monthly)
```

The round-trip verify step runs **before** the archive is pushed: if the
ciphertext cannot be decrypted and read back byte-for-byte, the run fails and
you get a red Actions run instead of a false sense of security.

## One-time setup (do this once)

### 1. Create the private backup repository

1. Open <https://github.com/new>
2. Repository name: `KAFS-MIS-backups`
3. Visibility: **Private** (critical — this holds encrypted member data)
4. Do **not** initialize with README
5. Create repository

### 2. Create a fine-grained access token

1. GitHub → Settings → Developer settings → **Personal access tokens** →
   **Fine-grained tokens** → Generate new token
2. Expiration: choose what you're comfortable with (rotate before it lapses)
3. Repository access: **Only select repositories** → `KAFS-MIS-backups`
4. Permissions → Repository permissions → **Contents: Read and write**
5. Generate and copy the token (you'll only see it once)

### 3. Store the passphrase

Generate a long random passphrase (a password manager's generator works well,
e.g. 32+ characters) and **save it in your password manager**. This is the
only thing standing between a leaked backup repo and your members' data —
if it's lost, the backups are unrecoverable by design.

### 4. Set the three secrets on `KAFS-MIS`

Repo → Settings → Secrets and variables → **Actions** → New repository secret:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon **direct** (non-pooler) connection string. In the Neon console → Connection string, pick the **Direct** option (host without `-pooler`). `pg_dump` over the pooler works less reliably. Use a **read-only** role if you create one (SQL below). |
| `BACKUP_PASSPHRASE` | The passphrase from step 3 |
| `BACKUP_REPO_TOKEN` | The fine-grained token from step 2 |

### 5. Verify

Actions → **Nightly encrypted database backup** → **Run workflow**. It should
go green in ~1 minute and you should see `database/kafs-YYYY-MM-DD.dump.gpg`
in the private repo. From then on it runs by itself every night.

### 6. (Recommended) a read-only database role for the backup

In the Neon SQL editor, so a leaked `DATABASE_URL` secret can only *read*:

```sql
CREATE ROLE backup_reader LOGIN PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE neondb TO backup_reader;
GRANT USAGE ON SCHEMA public TO backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_reader;
```

Then store that role's connection string (also direct, non-pooler) as the
`DATABASE_URL` secret instead of the owner's.

## Restore runbook

Restores are done manually and deliberately — never from an automated job.

### Restore into a scratch database (verify first)

```bash
# 1. Fetch an archive from the private backup repo
git clone https://github.com/nobertahumuza/KAFS-MIS-backups.git
cd KAFS-MIS-backups

# 2. Decrypt (you'll be prompted for the passphrase)
gpg --decrypt --output kafs.dump database/kafs-2026-11-03.dump.gpg

# 3. Inspect without touching anything
pg_restore --list kafs.dump | head
```

### Restore into a real database

```bash
# Point at the target, then:
pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" kafs.dump
```

For a **clean** target (empty database), add `--clean --if-exists` to
recreate objects that already exist. For a **live production** database,
prefer restoring into a fresh Neon branch and validating there first
(Neon console → Branches → Create branch), then swap.

### Post-restore checklist

- [ ] Member count matches the manifest / expected number
- [ ] Latest savings ledger entry is the expected one
- [ ] Login works, a photo displays, an SMS template exists
- [ ] `AuditTrail` has recent rows

## Quarterly restore test (required)

A backup that has never been restored is a hope, not a backup. Every quarter:

1. Trigger a manual workflow run (or take the newest archive)
2. Restore it into a **scratch** database (a Neon branch, or local Postgres)
3. Run `node scripts/restore-check.js <connection-string>` — it prints row
   counts for every critical table and fails if anything looks empty
4. Record the date in your notes

## Retention

- **Daily**: last 30 archives (~1 month)
- **Monthly**: 1 archive per month, last 12 months (overwritten each month)
- Pruning happens in the workflow itself, so the repo never grows unbounded

To keep a longer-lived copy: once a quarter, download the newest `.dump.gpg`
to an external drive or a second private location. That's your second media
copy for 3-2-1.

## Member document storage (S3-compatible)

Uploads go through `src/app/api/upload` → `src/lib/storage.ts`, which writes
to any S3-compatible store. In production, if `S3_*` is not configured the
endpoint returns **503** (rather than silently writing to Vercel's ephemeral
filesystem). Local development falls back to `public/uploads/`.

Configure in Vercel → Settings → Environment variables:

| Var | Example (Cloudflare R2) |
|---|---|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `kafs-documents` |
| `S3_ACCESS_KEY_ID` | from R2 → API tokens |
| `S3_SECRET_ACCESS_KEY` | from R2 → API tokens |
| `S3_PUBLIC_URL` | `https://pub-<hash>.r2.dev` (or your custom domain) |

R2 and Backblaze B2 both have a free tier (10 GB) — more than enough here.
The documents live in your bucket, so back that bucket up with the provider's
versioning/replication, or include it in the quarterly external-drive copy.

## Security practices

- **Encryption**: every archive is AES-256 (gpg symmetric) before it leaves
  the CI runner. The private repo is a second layer, not the only one.
- **Passphrase**: lives in a GitHub Actions secret *and* your password
  manager — never in code, never in chat, never in the repo.
- **No PII in metadata**: the manifest contains only timestamp, size, sha256
  and the dumper version — no table names with counts, no member data.
- **Least privilege**: the push token can only write to `KAFS-MIS-backups`;
  the optional `backup_reader` role can only SELECT.
- **Audit**: every workflow run is logged in GitHub Actions with who
  triggered it and what it pushed.
- **What we never do**: trigger `/api/cron/*` or post test transactions to
  production as part of backup testing.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Run fails at "Dump database" with auth error | `DATABASE_URL` secret missing/rotated, or you used the `-pooler` host — use the **direct** connection string |
| Run fails at "Encrypt" | `BACKUP_PASSPHRASE` missing |
| Run fails at "Push" | `BACKUP_REPO_TOKEN` expired or missing Contents:write on `KAFS-MIS-backups` |
| `pg_dump: server version mismatch` warning | The PGDG install step pins client 18; if Neon upgrades past it, bump `postgresql-client-18` in the workflow |
| Restore fails with `role "postgres" does not exist` | Restore with `--no-owner` (already the default in the runbook) |
