# Release & Deployment Runbook

How to cut a release, enable the download site, sign builds later, and validate a
fresh install end-to-end. See [`.plans/deployment-and-updates-plan.md`](.plans/deployment-and-updates-plan.md)
for the full design.

---

## Prerequisites (one time)

- [ ] **Repository is public.** Auto-update uses `update.electronjs.org`, which
      only serves **public** GitHub repos, and GitHub Pages is simplest on a
      public repo. If the source must stay private, switch the update feed to a
      self-hosted static source (changes `forge.config.ts` + `AutoUpdater.ts`).
- [ ] **GitHub Pages enabled:** Settings → Pages → Deploy from branch →
      `master` / `docs`. Site: `https://joelxhenry.github.io/julius/`.

---

## Cutting a release

1. Bump the version in `package.json` (e.g. `1.0.0` → `1.0.1`) and commit.
2. Tag and push:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. The **Release** workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml))
   builds on `windows-latest` and uploads a **draft** GitHub Release.
4. Review the draft on GitHub. Confirm the assets are present:
   - `TurboJulius-Setup.exe` (the installer)
   - a `.nupkg` package
   - `RELEASES` (the Squirrel manifest auto-update reads)
5. **Publish** the release. Auto-update only sees published (non-draft) releases.

Clients pick up the update within ~1 hour (or immediately via **Settings →
About → Check for updates**), download it, and prompt to restart.

> The download button on the Pages site always points at the newest published
> release, so it needs no per-release edits.

---

## Code signing (when a certificate is available)

Builds are currently **unsigned** — users see a Windows SmartScreen "unknown
publisher" prompt on first install (documented on the download page). Auto-update
still works. The pipeline is already signing-ready; to turn it on:

1. Obtain an Authenticode certificate (OV, or EV to also clear SmartScreen
   reputation immediately).
2. Base64-encode the `.pfx`:
   ```bash
   base64 -w0 code-sign.pfx > cert.txt
   ```
3. Add repo **secrets** (Settings → Secrets and variables → Actions):
   - `WINDOWS_CERTIFICATE_BASE64` — contents of `cert.txt`
   - `WINDOWS_CERTIFICATE_PASSWORD` — the `.pfx` password
4. That's it. On the next tagged release the workflow decodes the cert to a file
   and sets `WINDOWS_CERTIFICATE_FILE` / `WINDOWS_CERTIFICATE_PASSWORD`;
   `forge.config.ts` then signs the Squirrel installer. No code changes.

Nothing else needs to change — unsigned builds keep working until the secrets
exist.

---

## Fresh-machine validation (before announcing a release)

**Host (clean Windows VM):**
- [ ] Run `installer/host-setup.bat` as administrator; it completes without errors.
- [ ] `C:\JuliusData\connection-info.txt` is written with the DB + share details.
- [ ] From another machine: `ping HOST` works and `\\HOST\JuliusData` opens.

**Client (clean Windows VM):**
- [ ] Download from the Pages site and install (walk through SmartScreen).
- [ ] First-run wizard: choose **Client**, enter the host DB details, **Test** +
      **Connect** succeed.
- [ ] Storage step: **LAN**, path `\\HOST\JuliusData`, path test passes.
- [ ] App loads; data and inventory images appear.

**Update loop (the critical test):**
- [ ] Install version _N_ on the client.
- [ ] Publish _N+1_.
- [ ] Client shows the update prompt; **Restart now** installs it; the app
      relaunches on _N+1_ (check Settings → About).

---

## Notes / known follow-ups

- **Shared-DB migrations:** clients auto-run migrations on connect. Auto-update
  keeps everyone on the same version, which neutralizes most risk; a schema
  compatibility check on connect is a possible future hardening.
- **`better-sqlite3`** is still a dependency though the live DB is PostgreSQL —
  confirm whether it's still needed (legacy import) before trimming build size.
- **Backups:** verify `installer/backup.ps1` runs under the scheduled task on the
  real host (see `installer/README.md`).
