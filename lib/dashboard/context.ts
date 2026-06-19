import type { PrismaClient } from '@/app/generated/prisma/client';

export interface DashboardDates {
  semanaAtras: Date;
  inicioMes: Date;
  inicioMesAnterior: Date;
  inicioAño: Date;
  inicioAñoAnterior: Date;
  hace90Dias: Date;
}

// The tenant-scoped client returned by tenantPrisma() extends PrismaClient
// with query middleware but keeps the same model surface.
export interface DashboardContext {
  tdb: PrismaClient;
  tenantId: number;
  userId: number;
  areaId: number | null;
  directorAreaId: number | null;
  dates: DashboardDates;
}

export function buildDates(): DashboardDates {
  const now = new Date();
  return {
    semanaAtras: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    inicioMes: new Date(now.getFullYear(), now.getMonth(), 1),
    inicioMesAnterior: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    inicioAño: new Date(now.getFullYear(), 0, 1),
    inicioAñoAnterior: new Date(now.getFullYear() - 1, 0, 1),
    hace90Dias: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  };
}
