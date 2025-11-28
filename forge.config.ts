import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
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
  ];
  const srcNodeModules = path.join(process.cwd(), 'node_modules');
  const destNodeModules = path.join(buildPath, 'node_modules');

  if (!fs.existsSync(destNodeModules)) {
    fs.mkdirSync(destNodeModules, { recursive: true });
  }

  for (const mod of modulesToCopy) {
    const srcPath = path.join(srcNodeModules, mod);
    const destPath = path.join(destNodeModules, mod);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      copyDirSafe(srcPath, destPath);
      console.log(`Copied ${mod} to ${destPath}`);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,
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
    }),
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerRpm({}),
    new MakerDeb({}),
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
