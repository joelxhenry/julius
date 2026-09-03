# Deployment, Installation & Remote Updates — Plan

**Status:** Proposed
**Repo:** `joelxhenry/julius` (product name: `turbo-julius`)
**App type:** Electron Forge + Vite desktop app, PostgreSQL backend (node-postgres/Drizzle), Sharp image storage.

## Decisions locked in
- **Update delivery:** GitHub Releases, each client checks directly via `update.electronjs.org` (clients have internet).
- **PostgreSQL on host:** guided installer script (installs official PostgreSQL, creates DB/role, runs migrations).
- **Code signing:** none yet — builds are unsigned; SmartScreen warnings must be documented, and this is revisited later.

---

## 1. Architecture recap (roles)

The system is a LAN client–server setup with two machine roles. The *same* installed app can act as either; role is chosen at first run.

| | **Host machine** (one per site) | **Client machine** (many) |
|---|---|---|
| PostgreSQL | Installed + running, listens on LAN (`0.0.0.0:5432`) | — connects to host |
| File storage (`inventory-images`) | Owns the folder, shared over LAN (SMB) | — reads/writes the LAN share |
| Julius app | Optional (host can also be a workstation) | Yes |
| Updates | From GitHub Releases | From GitHub Releases |

Key existing building blocks we reuse (do **not** rebuild):
- `src/main/config/ConfigManager.ts` — encrypted `config.json` (DB host/port/user/password).
- `src/main/database/index.ts` — connects to Postgres, runs migrations + seeds on startup.
- `DatabaseSettingsTab.tsx` / `DatabaseSettingsController` + `testDatabaseConnection()` — client-side connection config + test.
- `StorageSettingsTab.tsx` / `ImageStorageService` — already supports `local | lan` storage with a custom path.

The gap this plan fills: (a) a public download + instructions site, (b) automated host provisioning, (c) a first-run role/connection wizard, (d) an auto-update mechanism with user prompts, (e) a release/build pipeline.

---

## 2. Workstreams

### A. GitHub Pages landing site (download + instructions)

**Goal:** a public page with a prominent download button and complete setup instructions.

- New folder `docs/` in the repo, served via **GitHub Pages → Deploy from branch → `master` /docs** (simplest; no separate repo).
- Contents:
  - `docs/index.html` (or `index.md` with a Jekyll theme) — hero with **Download for Windows** button linking to the *latest release* asset: `https://github.com/joelxhenry/julius/releases/latest/download/TurboJulius-Setup.exe`. The `/releases/latest/download/<asset>` URL is stable across versions.
  - Two clearly separated guides: **"Setting up the Host machine"** and **"Installing on a workstation (client)"**.
  - A short **"Updating"** section explaining auto-update prompts.
  - Screenshots of the first-run wizard and the update prompt.
  - System requirements (Windows 10/11 x64, LAN, host static IP recommended).
  - A note about the unsigned-installer SmartScreen prompt with the exact "More info → Run anyway" steps.
- **Deliverables:** `docs/index.html`, `docs/host-setup.md`, `docs/client-setup.md`, `docs/updating.md`, `docs/troubleshooting.md`, assets under `docs/img/`.

### B. Host provisioning script (PostgreSQL + file share + firewall)

**Goal:** one guided script turns a fresh Windows machine into the Julius host.

Deliver `installer/host-setup.ps1` (PowerShell, run as Administrator). Idempotent — safe to re-run. Steps:

1. **Preflight:** check admin rights, Windows version, x64, whether Postgres is already installed (detect service `postgresql-x64-16`).
2. **Install PostgreSQL 16** silently via the EDB installer:
   - Download the EDB Windows installer to a temp path (pin a known version + verify SHA-256).
   - Run unattended: `postgresql-16.x-windows-x64.exe --mode unattended --superpassword <pw> --serverport 5432 --enable-stackbuilder 0`.
   - Alternatively support an **offline mode**: if the installer `.exe` is placed next to the script (shipped on USB), skip the download.
3. **Create app role + database:** using `psql`/`createdb`, create a dedicated non-superuser role (e.g. `julius_app`) and database `julius`, owned by that role. Store nothing hard-coded — generate or prompt for the password and print it once.
4. **Configure LAN access:**
   - `postgresql.conf`: `listen_addresses = '*'`.
   - `pg_hba.conf`: add a `scram-sha-256` rule for the LAN subnet only (e.g. `host julius julius_app 192.168.0.0/16 scram-sha-256`), **not** `0.0.0.0/0`.
   - Restart the service.
5. **Windows Firewall:** open TCP 5432 inbound scoped to the LAN profile only.
6. **File storage share:**
   - Create `C:\JuliusData\inventory-images`.
   - Create an SMB share (`New-SmbShare`) with least-privilege permissions for the workstation accounts.
   - Print the UNC path (`\\HOST\JuliusData\inventory-images`) for use in client Storage settings.
7. **Migrations + seeds:** the app runs migrations automatically on first DB connection (`initDatabase`), so this can be left to first app launch — but the script should offer to run a bundled `migrate` step so the DB is ready before any client connects. (Reuse the existing `drizzle-kit migrate` / `runMigrationsAndSeeds` path via a small bundled CLI, or simply document "launch the app on the host once".)
8. **Output summary:** host IP, port, database name, app role, file share UNC path — everything a client needs, written to `C:\JuliusData\connection-info.txt`.

Also deliver `installer/host-setup-README.md` and consider a tiny `installer/host-setup.bat` wrapper that relaunches the `.ps1` elevated (so a non-technical admin can double-click).

> **Backup note (add to host guide):** schedule `pg_dump` of the `julius` DB + a copy of `inventory-images` to a second disk. Include a ready-to-use `installer/backup.ps1` + Task Scheduler instructions.

### C. First-run wizard (role + connection) in the app

**Goal:** on first launch, the app asks whether this machine is Host or Client, then gathers connection details — instead of silently writing the `password123`/`localhost` default from `ConfigManager.getDefaultConfig()`.

- Detect "unconfigured" state (no `config.json`, or config still equal to defaults) in the main process at startup and route the renderer to a **Setup wizard** before the main UI.
- Wizard steps:
  1. **Choose role:** *This is the Host* / *This is a Client workstation*.
  2. **Database connection:** host IP, port, database, user, password — with a **Test connection** button (reuse `testDatabaseConnection`). Client machines type the host's LAN IP here.
  3. **File storage:** set type to `lan` and the UNC path from the host (reuse `StorageSettingsTab` logic), or `local` if single-machine.
  4. **Finish:** save via `ConfigManager.save()` (password already encrypted at rest), then boot normally.
- Reuse existing `DatabaseSettingsTab` / `StorageSettingsTab` components inside the wizard rather than duplicating forms.
- **Touchpoints:** `src/main.ts` startup gate, a new `src/renderer/pages/setup/` flow, and a small `configManager.isConfigured()` helper.

### D. Auto-update with user prompts (the core "remote update" feature)

**Goal:** when a new version is published to GitHub Releases, running clients detect it, prompt the user, download, and install on restart.

Mechanism: **Squirrel.Windows autoUpdater + `update-electron-app`** pointed at `update.electronjs.org` (free, hosted by Electron, works for public GitHub repos — the repo must be public, releases must be non-draft, and asset naming must match Squirrel's `RELEASES` output, which `MakerSquirrel` already produces).

1. Add dependency `update-electron-app` (wraps `electron.autoUpdater` + the feed URL + logging).
2. New module `src/main/updater/AutoUpdater.ts`:
   - Initialize only in **packaged** builds (`app.isPackaged`) and only on Windows (Squirrel). No-op in dev.
   - Configure `updateElectronApp({ repo: 'joelxhenry/julius', updateInterval: '1 hour', notifyUser: false })` — we handle notification ourselves for a controlled UX.
   - Wire `autoUpdater` events → IPC to the renderer:
     - `update-available` → renderer shows a non-blocking notification/badge ("Update downloading…").
     - `update-downloaded` → renderer shows a **modal**: *"Version X.Y.Z is ready. Restart now / Later."* On "Restart now" call `autoUpdater.quitAndInstall()`.
     - `error` → log quietly (don't nag users on flaky networks).
   - Add a **manual "Check for updates"** button in Settings → About that triggers `autoUpdater.checkForUpdates()` and reports "You're up to date" / "Update found".
3. Renderer prompt UI: a small `UpdatePrompt` component mounted app-wide, driven by an `useAppUpdates` hook subscribing to the IPC channel. Show current version + release notes link.
4. Show the app version somewhere visible (Settings → About), sourced from `app.getVersion()`.

**Unsigned caveat (must document, and revisit):** Squirrel auto-update *works* without signing, but:
- First install triggers SmartScreen "unknown publisher" — documented in the site + host/client guides.
- Some AV/endpoint tools may quarantine unsigned Squirrel installs.
- **Recommendation:** treat code signing as a fast-follow. An OV/EV Authenticode cert removes SmartScreen friction and hardens update trust. Plan the build pipeline (below) so adding `signtool` later is a config change, not a rework.

### E. Build & release pipeline (GitHub Actions)

**Goal:** pushing a version tag produces a published GitHub Release with the Squirrel installer + `RELEASES` metadata that auto-update consumes.

1. **Publisher config** in `forge.config.ts`: add `@electron-forge/publisher-github` targeting `joelxhenry/julius`, `prerelease: false`, `draft: true` (publish manually after smoke-test, or `draft: false` to auto-publish).
2. **Workflow** `.github/workflows/release.yml`:
   - Trigger on tag `v*.*.*`.
   - `runs-on: windows-latest` (Squirrel + native modules `better-sqlite3`/`sharp`/`pg` must build on Windows).
   - Steps: checkout → setup Node → `npm ci` → `npm run rebuild` (electron-rebuild for native modules) → `npm run publish` (electron-forge make + publish) with `GITHUB_TOKEN`.
   - Verify the release contains: `TurboJulius-Setup.exe`, the `.nupkg`, and `RELEASES`.
3. **Versioning:** bump `package.json` `version`, commit, tag `vX.Y.Z`, push. Document this in `docs/CONTRIBUTING`/release runbook. (Optionally automate the bump.)
4. **`.gitignore` hygiene:** the working tree currently tracks `dist/assets/*` build artifacts — stop committing built assets; releases come from CI, not the repo. (Separate cleanup task.)

### F. Fresh-machine validation

- Spin up a clean Windows VM as **Host**: run `host-setup.ps1`, confirm Postgres reachable from another machine, share reachable.
- Clean VM as **Client**: download from the Pages site, install (walk through SmartScreen), run first-run wizard against the host, confirm data + images load.
- **Update test:** install version N on the client, publish N+1, confirm the prompt appears, restart, confirm N+1 runs. This is the make-or-break test for the whole feature.

---

## 3. Suggested sequencing (phased)

**Phase 1 — Auto-update foundation (highest value, enables everything after).**
- D: `AutoUpdater` module + IPC + renderer prompt + "Check for updates".
- E: publisher config + `release.yml`.
- Validate the N → N+1 update loop end-to-end. *Once this ships, every later fix reaches users automatically.*

**Phase 2 — Onboarding UX.**
- C: first-run role/connection wizard (kills the silent `password123` default).
- About page with version + manual update check.

**Phase 3 — Host provisioning.**
- B: `host-setup.ps1` (+ offline mode, firewall, SMB share, backup script).

**Phase 4 — Public distribution.**
- A: GitHub Pages site with download + host/client/updating/troubleshooting guides and screenshots.

**Phase 5 — Hardening (fast-follow).**
- Code signing in the pipeline; repo artifact cleanup; scoped `pg_hba` review; backup automation verification.

---

## 4. Concrete deliverables checklist

- [ ] `src/main/updater/AutoUpdater.ts` + IPC channels + `src/renderer/.../UpdatePrompt.tsx` + `useAppUpdates` hook
- [ ] `update-electron-app` dependency; `@electron-forge/publisher-github` in `forge.config.ts`
- [ ] Settings → About tab (version + "Check for updates")
- [ ] `.github/workflows/release.yml`
- [ ] First-run wizard: `src/renderer/pages/setup/*`, `main.ts` startup gate, `ConfigManager.isConfigured()`
- [ ] `installer/host-setup.ps1` (+ `.bat` elevator, `host-setup-README.md`, `backup.ps1`)
- [ ] `docs/` GitHub Pages site (index + host/client/updating/troubleshooting + images)
- [ ] Repo hygiene: stop tracking `dist/assets/*`
- [ ] Fresh-VM validation runbook

---

## 5. Open risks / notes

- **Public repo requirement:** `update.electronjs.org` only serves public repos. If the source must stay private, switch to a self-hosted feed (e.g. `MakerSquirrel` output on a static host, or `electron-release-server`) — this changes Workstream D/E. Confirm the repo can be public, or that only the *releases* are public.
- **Static host IP:** DB connection stores the host IP; if the host uses DHCP the IP can change. Recommend a static/reserved IP or hostname in the host guide.
- **Migrations on shared DB:** clients auto-run migrations on connect (`initDatabase`). With many clients + one DB, a client on a newer version could migrate the DB out from under older clients. Mitigation: since auto-update keeps clients on the same version, keep the update window short; longer term, gate migrations to the host or add a schema-version compatibility check on connect.
- **Unsigned installs** — SmartScreen/AV friction until a cert is in place (Phase 5).
- **`better-sqlite3` present** but the live DB is Postgres — confirm whether SQLite is still used (legacy import?) so the build doesn't ship dead native deps.
