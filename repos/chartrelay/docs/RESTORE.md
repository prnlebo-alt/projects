# Restoring ChartRelay from a backup

Rehearsed on 2026-09-24 against a real database. Everything below was executed, not written from
memory — an untested restore is a hope, not a backup.

## The thing that will bite you

The database runs in WAL mode. On a live instance the main file is often **almost empty** and nearly
all of the data is sitting in the `-wal` file beside it:

```
chartrelay.db          4,096 bytes
chartrelay.db-wal    819,912 bytes
chartrelay.db-shm     32,768 bytes
```

**Copying `chartrelay.db` on its own restores an empty database.** It will open without error, pass an
integrity check, and contain nothing. That is the failure this page exists to prevent.

`npm run backup` does not have this problem: the admin endpoint takes the snapshot with `VACUUM INTO`,
which writes a fully checkpointed, self-contained copy from inside a read transaction. Use it, or copy
all three files together. Never copy just the one.

## Taking a backup

```bash
npm run backup
```

Downloads a snapshot to `./backups/` and keeps 14 days. Needs `ADMIN_TOKEN` matching the server and
`BACKUP_URL` or `APP_URL`; both may live in `.env.local`. Railway's own managed backups are a Pro-plan
feature and this deployment is on Hobby, so this script is the only backup that exists.

## Restoring

1. **Check the snapshot before trusting it.** A corrupt backup discovered during a restore is worse
   than no backup, because you have already deleted something.

   ```bash
   sqlite3 backups/chartrelay-YYYY-MM-DD-HHMM.sqlite "PRAGMA integrity_check;"
   ```

   Anything other than `ok` — stop and use an older snapshot.

2. **Look at what is in it.** A snapshot of the wrong moment is also a bad restore.

   ```bash
   sqlite3 backups/chartrelay-YYYY-MM-DD-HHMM.sqlite "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM workspaces; SELECT COUNT(*) FROM renders;"
   ```

3. **Keep the current file.** Rename rather than delete, including its `-wal` and `-shm`. If the
   restore is wrong you want the option to go back.

4. **Put the snapshot in place** as `chartrelay.db` on the volume, with no `-wal` or `-shm` beside it.
   A stale WAL from the old database next to a restored file is corruption.

5. **Start the app.** Migrations run on open and are additive, so a snapshot from an older schema is
   brought forward automatically. Verified in the drill: a snapshot taken before the activation table
   existed gained it on first open, with every existing row intact.

6. **Check the app, not the file.** Sign in, draw a chart, and open `/api/health`.

## What the drill proved

- `VACUUM INTO` produced a snapshot that passed `integrity_check` and contained all nine tables.
- The restored copy opened cleanly and every row survived: 2 users, 2 workspaces, 1 render, 2 API keys.
- Migrations ran forward on the restored file and created the table it did not have.
- Copying only `chartrelay.db` restores an empty database. Do not do it.

## What is still untested

Restoring onto the Railway volume itself. The drill ran locally, so the file mechanics are proven and
the platform steps — stopping the service, replacing the file on the mounted volume, starting it — are
not. Do that once before there is a customer to lose.
