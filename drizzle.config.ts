import type { Config } from 'drizzle-kit';
import path from 'node:path';

export default {
  schema: './src/main/database/schema/index.ts',
  out: './src/main/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.cwd(), 'dev.db'),
  },
} satisfies Config;
