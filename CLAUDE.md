@AGENTS.md

## Convenciones del proyecto

### Stack (resumen)

- Next.js 16 (App Router + Turbopack) — middleware vive en `proxy.ts` (no `middleware.ts`).
- React 19, Ant Design 6 (no Tailwind, no shadcn).
- Prisma 7 con client generado en `app/generated/prisma/` (no estándar, no modificar).
- NextAuth 5 beta: token JWT con `tenantId`, `roles`, `areaId`, `centroCostoId`.
- Vitest (no Jest). Tests en `__tests__/`.

### Patrones

- **API routes** usan `lib/api-handler.ts` (`withAuth`, `withValidation`) — no instanciar
  auth/rate-limit/validación manualmente.
- **Validación** de entrada: Zod schemas en `lib/validators.ts`. Todo input externo debe
  validarse antes de pasar a Prisma.
- **Queries raw** sólo con `$queryRaw\`\`` parametrizado (nunca template strings crudos).
- **Errores en APIs**: usar `logApiError()` de `lib/logger.ts` — emite JSON estructurado y
  captura a Sentry si hay DSN.
- **Multi-tenancy**: toda query de dominio filtra por `tenant_id`. Override de admin via
  `lib/tenant-override.ts` (cookie `admin_tenant_id`).
- **Segregación de funciones**: no usar `session.user.id` raw para autorizar; usar
  helpers de `lib/permissions.ts`.

### Antipatrones (evitar)

- `catch {}` vacíos — bloquean debugging. Usar `logApiError`/`console.error` + contexto.
- `any` en rutas API — usar `Prisma.<Model>WhereInput`.
- `'use client'` cuando la página puede ser server component (inflan JS).
- `useEffect` + `setState` sincrónico (rule `react-hooks/set-state-in-effect` está a warn).
- Commits con `console.log` nuevos (ESLint los marca warning; los 2 allowed son `warn`/`error`).

### Workflow

- Branches: `feature/...`, `fix/...`, `chore/...`. Nunca commitear directo a `main`.
- Commits: conventional commits en inglés o español indistinto.
- Pre-commit (Husky) corre `lint-staged` → eslint --fix + prettier.
- CI bloquea: lint con errores, format:check, tests fallidos, build roto.

### Tareas frecuentes

- **Agregar endpoint**: crear `app/api/<ruta>/route.ts`, usar `withAuth` de `lib/api-handler.ts`.
- **Agregar model Prisma**: editar `prisma/schema.prisma`, `npx prisma migrate dev --name <desc>`,
  `npx prisma generate`.
- **Agregar validación**: extender schema en `lib/validators.ts` (no duplicar en endpoint).
- **Agregar test**: crear `__tests__/<nombre>.test.ts` siguiendo patrones existentes.

### No hacer

- No crear `middleware.ts` — `proxy.ts` es el middleware en Next 16.
- No mover `app/generated/prisma/` — el generator lo requiere ahí.
- No bajar NextAuth a v4 sin chequear compatibilidad con Auth.js v5 features usadas.
- No pushear directo a `main`. Siempre PR.
