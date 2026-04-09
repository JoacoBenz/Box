import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Returns a Prisma client extended to automatically filter all queries by tenant_id.
 * ALL business logic MUST use this helper. Never use `prisma` directly for business queries.
 */
export function tenantPrisma(tenantId: number) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: any) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: any) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findUnique({ args, query }: any) {
          const result = await query(args);
          // Post-query tenant verification — return null if wrong tenant (don't throw/leak)
          if (result && (result as any).tenant_id !== undefined && (result as any).tenant_id !== tenantId) {
            return null;
          }
          return result;
        },
        async create({ args, query }: any) {
          if (args.data && typeof args.data === 'object' && !Array.isArray(args.data)) {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          return query(args);
        },
        async update({ args, query }: any) {
          // For updates with a where clause, verify the record belongs to this tenant
          if (args.where) {
            args.where = { ...args.where, tenant_id: tenantId };
          }
          return query(args);
        },
        async updateMany({ args, query }: any) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async delete({ args, query }: any) {
          if (args.where) {
            args.where = { ...args.where, tenant_id: tenantId };
          }
          return query(args);
        },
        async deleteMany({ args, query }: any) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async count({ args, query }: any) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
      },
    },
  });
}
