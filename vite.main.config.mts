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
  build: {
    rollupOptions: {
      external: [
        'electron',
        'pg',
        'crypto-js',
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
