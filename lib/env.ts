import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
  NEXTAUTH_URL: z.string().min(1, 'NEXTAUTH_URL is required'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Mercado Pago (opcional — billing se activa cuando todas estén presentes)
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_PLAN_ID: z.string().optional(),
  // Mission Control (opcional): cuando ambas están seteadas, lib/logger.ts
  // envía warn/error al dashboard. APP_RELEASE etiqueta los reportes (deploy).
  MISSION_CONTROL_URL: z.string().optional(),
  MISSION_CONTROL_API_KEY: z.string().optional(),
  APP_RELEASE: z.string().optional(),
});

function validateEnv() {
  if (process.env.SKIP_ENV_VALIDATION === 'true' || process.env.SKIP_ENV_VALIDATION === '1') {
    return process.env as unknown as z.infer<typeof envSchema>;
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
    throw new Error('Invalid environment variables');
  }
  return result.data;
}

export const env = validateEnv();
