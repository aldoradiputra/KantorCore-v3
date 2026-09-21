# Backups & restore drill (D49)

pgBackRest with point-in-time recovery to an S3-compatible bucket (NEO on Biznet),
in a **separate bucket with its own credentials**. A restore drill runs **monthly**.

## Setup (database host)
1. Install pgBackRest on the DB host.
2. Copy `pgbackrest.conf.example` → `/etc/pgbackrest/pgbackrest.conf`; fill endpoint,
   bucket, region, and data dir. Put `repo1-s3-key` / `repo1-s3-key-secret` in the
   environment or a root-only file — never in the repo (D54).
3. Configure Postgres archiving: `archive_mode = on`,
   `archive_command = 'pgbackrest --stanza=kantorcore archive-push %p'`,
   `wal_level = replica`. Restart Postgres.
4. Create the stanza and take the first backup:
   ```
   pgbackrest --stanza=kantorcore stanza-create
   pgbackrest --stanza=kantorcore --type=full backup
   ```
5. Schedule: full weekly, diff daily, plus continuous WAL archiving.

## Monthly restore drill (evidence required)
1. Restore into a scratch directory / throwaway instance:
   ```
   pgbackrest --stanza=kantorcore --delta restore
   ```
2. Start it, confirm a known row exists and the latest WAL replayed.
3. Record the drill (date, backup id, recovery target, result) and attach it to the
   tracking issue. The **first drill is part of A5's definition of done.**
