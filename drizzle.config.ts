import type { Config } from 'drizzle-kit';

// Use environment variables for drizzle-kit CLI operations
// This avoids loading ConfigManager which depends on Electron app
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'turbo_julius',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

export default {
  schema: './src/main/database/schema/index.ts',
  out: './src/main/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
  },
} satisfies Config;
