# Turbo Julius — download site (`docs/`)

This folder is the public download & instructions page, served with **GitHub Pages**.

## Enable it (one time)

1. Push this folder to `master`.
2. On GitHub: **Settings → Pages**.
3. **Build and deployment → Source:** *Deploy from a branch*.
4. **Branch:** `master`, **Folder:** `/docs`. Save.
5. After a minute the site is live at `https://joelxhenry.github.io/julius/`.

`.nojekyll` is present so `index.html` is served exactly as written (no Jekyll
processing).

## What's here

- `index.html` — self-contained landing page (inline CSS, light/dark aware). The
  **Download for Windows** button points at
  `https://github.com/joelxhenry/julius/releases/latest/download/TurboJulius-Setup.exe`,
  which always resolves to the newest published release's installer.

## Keeping it current

- The download link is version-independent — no edits needed per release.
- The host setup steps link to `installer/README.md` (single source of truth).
- If the installer asset name changes in `forge.config.ts` (`setupExe`), update
  the two download URLs in `index.html` to match.

> The download link 404s until the first release is published (see
> `.github/workflows/release.yml`).
