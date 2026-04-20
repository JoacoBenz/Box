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
- **Billing**: todo tenant activo tiene una fila en `suscripciones`. `proxy.ts` redirige
  a `/facturacion` si `hasAccess=false`. Antes de crear áreas/CCs/roles capados, llamar
  a los helpers de `lib/plan-limits.ts` y devolver 403 con `code: 'PLAN_LIMIT_*'`.
- **Stripe**: nunca llamar `new Stripe(...)` directo — usar `getStripe()` de `lib/stripe.ts`
  que devuelve `null` si no hay `STRIPE_SECRET_KEY`. Todos los endpoints devuelven 503
  `STRIPE_DISABLED` cuando no hay config (CI y dev sin cuenta siguen andando).

### Billing — dónde tocar qué

- **Subir el precio o cambiar los caps del plan**: editar `prisma/seed.ts` y la migración
  inicial `20260418000000_add_billing/migration.sql`, y actualizar el Price en Stripe
  (crear uno nuevo y pisar `STRIPE_PRICE_ID`; no se pueden editar precios existentes).
- **Agregar un nuevo límite (ej: proveedores)**: agregar `limite_<recurso>` a `model planes`
  en `schema.prisma`, nueva migración, helper `canCreate<Recurso>` en `lib/plan-limits.ts`,
  check en el handler POST correspondiente + test en `plan-limits.test.ts`.
- **Agregar un rol capado**: agregarlo a `TENANT_SCOPED_ROLES` o `AREA_SCOPED_ROLES` +
  mapping en `planFieldForRole()` de `lib/plan-limits.ts` + columna `limite_<rol>` en
  `planes`.
- **Reaccionar a un nuevo evento de Stripe**: extender el `switch` en
  `app/api/stripe/webhook/route.ts` y agregar el helper en `lib/subscription.ts`. Los
  handlers tienen que ser idempotentes porque Stripe reintenta.
- **Testing local de Stripe**: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  y pagar con `4242 4242 4242 4242`. Full playbook en `docs/stripe-setup.md`.

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
