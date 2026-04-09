import type { RolNombre } from '@/types';

declare module 'next-auth' {
  interface User {
    tenantId: number;
    tenantName: string;
    areaId: number | null;
    areaNombre: string | null;
    centroCostoId: number | null;
    roles: RolNombre[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: number;
    tenantId: number;
    tenantName: string;
    areaId: number | null;
    areaNombre: string | null;
    centroCostoId: number | null;
    roles: RolNombre[];
  }
}
