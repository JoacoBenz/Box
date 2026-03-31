import { prisma } from './prisma';

export async function getTenantConfig(tenantId: number, clave: string): Promise<string | null> {
  const config = await prisma.configuracion.findUnique({
    where: { tenant_id_clave: { tenant_id: tenantId, clave } },
  });
  return config?.valor ?? null;
}

export async function getTenantConfigBool(tenantId: number, clave: string, defaultVal: boolean): Promise<boolean> {
  const valor = await getTenantConfig(tenantId, clave);
  if (valor === null) return defaultVal;
  return valor === 'true' || valor === '1';
}

export async function getTenantConfigNumber(tenantId: number, clave: string, defaultVal: number): Promise<number> {
  const valor = await getTenantConfig(tenantId, clave);
  if (valor === null) return defaultVal;
  const parsed = Number(valor);
  return isNaN(parsed) ? defaultVal : parsed;
}
