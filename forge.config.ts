import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as fs from 'fs';
import * as path from 'path';

// Windows reserved device names that cannot be used as filenames
const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

// Check if a filename is a Windows reserved name
function isWindowsReservedName(filename: string): boolean {
  const baseName = path.basename(filename).toLowerCase().split('.')[0];
  return WINDOWS_RESERVED_NAMES.has(baseName);
}

// Recursively copy directory, skipping Windows reserved filenames
function copyDirSafe(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip Windows reserved names
    if (isWindowsReservedName(entry.name)) {
      console.log(`Skipping reserved Windows filename: ${srcPath}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSafe(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Resolve a dependency the way Node does: search `<dir>/node_modules/<dep>` from
// the requiring package's directory upward through every ancestor node_modules,
// ending at the root node_modules. Returns the resolved package directory or null.
function resolveDepDir(fromDir: string, dep: string, rootNodeModules: string): string | null {
  const nmSegment = `${path.sep}node_modules${path.sep}`;
  const candidates: string[] = [path.join(fromDir, 'node_modules')];

  // Every ancestor node_modules directory along fromDir's path.
  let s = fromDir;
  let i = s.lastIndexOf(nmSegment);
  while (i !== -1) {
    candidates.push(s.substring(0, i + nmSegment.length - 1)); // ".../node_modules"
    s = s.substring(0, i);
    i = s.lastIndexOf(nmSegment);
  }
  if (!candidates.includes(rootNodeModules)) candidates.push(rootNodeModules);

  for (const nm of candidates) {
    const candidate = path.join(nm, dep);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  return null;
}

// Walk a package's dependency graph on disk (following real nesting), collecting
// the names of every package that lives at the TOP-LEVEL node_modules and must
// be copied explicitly. Packages nested inside another package's node_modules
// are copied recursively with their parent, so they are only descended into —
// but their own hoisted (top-level) dependencies are still collected here. This
// mirrors npm's hoisting layout, where different versions of the same package
// (e.g. readable-stream v2 vs v3) coexist and pull different transitive deps.
function collectTopLevelDeps(
  pkgDir: string,
  rootNodeModules: string,
  topLevelNames: Set<string>,
  seenDirs: Set<string>
) {
  if (seenDirs.has(pkgDir)) return;
  seenDirs.add(pkgDir);

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  let deps: Record<string, string> = {};
  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.optionalDependencies || {}) };
  } catch {
    return; // malformed — nothing more to walk
  }

  for (const dep of Object.keys(deps)) {
    const depDir = resolveDepDir(pkgDir, dep, rootNodeModules);
    if (!depDir) continue; // builtin, missing optional, etc.

    // Is this the copy at the top-level node_modules (vs nested under a parent)?
    if (path.dirname(depDir) === rootNodeModules || path.dirname(path.dirname(depDir)) === rootNodeModules) {
      topLevelNames.add(path.relative(rootNodeModules, depDir).split(path.sep).join('/'));
    }
    collectTopLevelDeps(depDir, rootNodeModules, topLevelNames, seenDirs);
  }
}

// Copy node_modules that need to be external (not bundled)
function copyNodeModules(buildPath: string) {
  const modulesToCopy = [
    // pg and its dependencies
    'pg', 'pg-pool', 'pg-protocol', 'pg-types', 'pg-connection-string', 'pgpass',
    // pg-types dependencies
    'pg-int8', 'postgres-array', 'postgres-bytea', 'postgres-date', 'postgres-interval',
    // postgres-interval dependencies
    'xtend',
    // pgpass dependencies
    'split2',
    // pg-protocol dependencies
    'buffer-writer', 'packet-reader', 'obuf',
    // drizzle-orm
    'drizzle-orm',
    // sharp and its native dependencies
    'sharp',
    'color', 'color-convert', 'color-name', 'color-string', 'is-arrayish', 'simple-swizzle',
    'detect-libc', 'semver',
  ];

  const srcNodeModules = path.join(process.cwd(), 'node_modules');

  // Backup feature: externalized packages + their full dependency closure,
  // resolved on disk so nested version trees (e.g. readable-stream v2 under
  // archiver) and their hoisted deps (process-nextick-args, etc.) are included.
  const backupRoots = ['@googleapis/drive', 'google-auth-library', 'archiver', 'unzipper'];
  const backupDeps = new Set<string>(backupRoots);
  const seenDirs = new Set<string>();
  for (const root of backupRoots) {
    collectTopLevelDeps(path.join(srcNodeModules, root), srcNodeModules, backupDeps, seenDirs);
  }
  for (const dep of backupDeps) {
    if (!modulesToCopy.includes(dep)) modulesToCopy.push(dep);
  }

  // Also copy @img scoped packages (sharp native binaries)
  const imgScopePath = path.join(srcNodeModules, '@img');
  if (fs.existsSync(imgScopePath)) {
    const imgPackages = fs.readdirSync(imgScopePath);
    for (const pkg of imgPackages) {
      modulesToCopy.push(`@img/${pkg}`);
    }
  }
  const destNodeModules = path.join(buildPath, 'node_modules');

  if (!fs.existsSync(destNodeModules)) {
    fs.mkdirSync(destNodeModules, { recursive: true });
  }

  for (const mod of modulesToCopy) {
    const srcPath = path.join(srcNodeModules, mod);
    const destPath = path.join(destNodeModules, mod);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      // Ensure parent directory exists for scoped packages (e.g. @img/sharp-win32-x64)
      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      copyDirSafe(srcPath, destPath);
      console.log(`Copied ${mod} to ${destPath}`);
    }
  }
}

// Optional Windows code signing. Inert unless the certificate env vars are set
// (e.g. in the release workflow via repo secrets), so unsigned local/CI builds
// keep working. When a cert becomes available, provide these and signing turns
// on with no other changes — see RELEASE.md.
const windowsCertificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const windowsCertificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
const windowsSigning = windowsCertificateFile
  ? { certificateFile: windowsCertificateFile, certificatePassword: windowsCertificatePassword }
  : {};

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,
    icon: './resources/icon',
    extraResource: ['./resources/icon.png'],
    afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {
      try {
        copyNodeModules(buildPath);
        callback();
      } catch (err) {
        callback(err as Error);
      }
    }],
  },
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    new MakerSquirrel({
      name: 'TurboJulius',
      setupExe: 'TurboJulius-Setup.exe',
      setupIcon: './resources/icon.ico',
      ...windowsSigning,
    }),
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    // Publishes make artifacts (Squirrel Setup.exe, .nupkg, RELEASES) to GitHub
    // Releases. `update.electronjs.org` serves these to clients for auto-update.
    // Requires GITHUB_TOKEN in the environment (set by the release workflow).
    new PublisherGithub({
      repository: {
        owner: 'joelxhenry',
        name: 'julius',
      },
      // Publish directly as a normal "latest" release (not a draft, not a
      // prerelease) so /releases/latest/download/<asset> resolves immediately
      // and clients auto-update. Set draft:true again if you want a manual
      // review/publish gate before customers can download.
      draft: false,
      prerelease: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
