import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Backfill a trialing suscripciones row for every tenant that existed
 * before the billing migration was introduced.
 *
 * Run this AFTER applying the billing migration but BEFORE deploying the
 * code that enforces subscriptions in proxy.ts. Otherwise legacy tenants
 * get redirected to /facturacion?reason=no_subscription on every request.
 *
 * Idempotent: re-running skips tenants that already have a subscription.
 * The `__platform__` tenant (super-admin) is intentionally excluded — it
 * has no billing relation.
 *
 * Usage:
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-legacy-subscriptions.ts
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-legacy-subscriptions.ts --dry-run
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-legacy-subscriptions.ts --trial-days=30
 */

const DEFAULT_PLAN_NOMBRE = 'box-principal';
const DEFAULT_TRIAL_DAYS = 30; // Grace period for existing users to adapt

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const trialArg = args.find((a) => a.startsWith('--trial-days='));
  const trialDays = trialArg ? Number(trialArg.split('=')[1]) : DEFAULT_TRIAL_DAYS;
  if (!Number.isFinite(trialDays) || trialDays < 0) {
    throw new Error(`Invalid --trial-days: ${trialArg}`);
  }
  return { dryRun, trialDays };
}

async function main() {
  const { dryRun, trialDays } = parseArgs();

  console.log(
    `[backfill] mode=${dryRun ? 'DRY-RUN' : 'WRITE'} trial_days=${trialDays} plan=${DEFAULT_PLAN_NOMBRE}`,
  );

  const plan = await prisma.planes.findUnique({ where: { nombre: DEFAULT_PLAN_NOMBRE } });
  if (!plan) {
    console.error(
      `[backfill] ERROR: plan '${DEFAULT_PLAN_NOMBRE}' not found. Run 'npx prisma db seed' first or apply the billing migration.`,
    );
    process.exit(1);
  }

  const tenantsToBackfill = await prisma.tenants.findMany({
    where: {
      slug: { not: '__platform__' },
      suscripcion: null,
    },
    select: { id: true, nombre: true, slug: true, estado: true, desactivado: true },
    orderBy: { id: 'asc' },
  });

  const totalTenants = await prisma.tenants.count();
  const alreadyHave = totalTenants - tenantsToBackfill.length - 1; // -1 for __platform__
  console.log(
    `[backfill] total tenants=${totalTenants} already_with_sub=${alreadyHave} to_backfill=${tenantsToBackfill.length}`,
  );

  if (tenantsToBackfill.length === 0) {
    console.log('[backfill] nothing to do.');
    return;
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  for (const tenant of tenantsToBackfill) {
    const line = `  - tenant ${tenant.id} (${tenant.slug}) estado=${tenant.estado}${tenant.desactivado ? ' DESACTIVADO' : ''}`;
    if (dryRun) {
      console.log(`${line} → would create trialing sub ending ${trialEndsAt.toISOString()}`);
      continue;
    }
    try {
      await prisma.suscripciones.create({
        data: {
          tenant_id: tenant.id,
          plan_id: plan.id,
          estado: 'trialing',
          trial_starts_at: now,
          trial_ends_at: trialEndsAt,
        },
      });
      console.log(`${line} → created`);
    } catch (err) {
      // Unique violation means someone raced us; treat as success.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Unique') || msg.includes('tenant_id')) {
        console.log(`${line} → already exists, skipping`);
      } else {
        console.error(`${line} → FAILED: ${msg}`);
        throw err;
      }
    }
  }

  console.log(
    `[backfill] done. ${dryRun ? 'No writes performed (dry-run).' : `${tenantsToBackfill.length} tenant(s) now in ${trialDays}-day trial.`}`,
  );
}

main()
  .catch((err) => {
    console.error('[backfill] fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
