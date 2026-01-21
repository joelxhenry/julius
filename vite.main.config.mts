import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@main': '/src/main',
      '@shared': '/src/shared',
    },
  },
  // Use ssr.external for Electron Forge's Vite plugin (it treats main as SSR build)
  ssr: {
    // Externalize these modules - they will be loaded at runtime from node_modules
    external: [
      'pg',
      'pg-native',
      'pg-pool',
      'pg-protocol',
      'pg-types',
      'pg-connection-string',
      'pgpass',
      'drizzle-orm',
      'drizzle-orm/node-postgres',
      'drizzle-orm/node-postgres/migrator',
      'sharp',
    ],
  },
  build: {
    // Ensure CommonJS output for Electron
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [
        'electron',
        'pg',
        'pg-native',
        'pg-pool',
        'pg-protocol',
        'pg-types',
        'pg-connection-string',
        'pgpass',
        'drizzle-orm',
        /^drizzle-orm\/.*/,
        'sharp',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
  },
  plugins: [
    {
      name: 'copy-migrations',
      writeBundle() {
        const src = path.join(process.cwd(), 'src/main/database/migrations');
        const dest = path.join(process.cwd(), '.vite/build/migrations');

        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
          console.log('Copied migrations to build directory');
        }
      },
    },
  ],
});
