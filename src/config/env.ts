import 'dotenv/config';
import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord ID');

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((value) => (value === undefined ? fallback : ['true', '1', 'yes'].includes(value)));

const csvIds = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(',').map((id) => id.trim()).filter(Boolean) : []))
  .pipe(z.array(snowflake));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DISCORD_TOKEN: z.string().min(1, 'is required'),
  DISCORD_CLIENT_ID: snowflake,
  DEV_GUILD_ID: snowflake.optional(),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a MongoDB connection string'),
  MONGODB_DB_NAME: z.string().min(1).default('clanky'),
  MONGODB_WATCH_CHANGES: bool(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OWNER_IDS: csvIds,
  SUPPORT_URL: z.url().optional(),
  ENABLE_MESSAGE_CONTENT: bool(true),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  // Treat empty strings in .env as "not set" so optional values stay optional.
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
  );

  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('\n❌ Invalid environment configuration:\n');
    for (const issue of parsed.error.issues) {
      console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\n   Copy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isDev = env.NODE_ENV === 'development';
