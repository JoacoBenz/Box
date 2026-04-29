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
- **Mercado Pago**: nunca instanciar `MercadoPagoConfig` directo — usar
  `getPreApproval()` / `getPayment()` de `lib/mercadopago.ts`, que devuelven `null` si no
  hay `MP_ACCESS_TOKEN`. Todos los endpoints devuelven 503 `MP_DISABLED` cuando no hay
  config (CI y dev sin cuenta siguen andando).

### Billing — dónde tocar qué

- **Subir el precio o cambiar los caps del plan**: editar `prisma/seed.ts` (para seeds
  futuros) y **crear una migración nueva** con
  `UPDATE "planes" SET ... WHERE nombre = 'box-principal'`. Nunca editar la migración
  inicial `20260418000000_add_billing` — ya está aplicada en prod. Después editar el
  monto del Preapproval Plan directo en el dashboard de MP (sí lo permite — confirmado
  2026-04 al bajar a 110k). Para suscriptores ya activos: cada `preapproval` tiene su
  propio `transaction_amount` snapshoteado al firmar, verificar en MP si propagó o
  si hay que actualizar/resuscribir individualmente.
- **Agregar un nuevo límite (ej: proveedores)**: agregar `limite_<recurso>` a `model planes`
  en `schema.prisma`, nueva migración, helper `canCreate<Recurso>` en `lib/plan-limits.ts`,
  check en el handler POST correspondiente + test en `plan-limits.test.ts`.
- **Agregar un rol capado**: agregarlo a `TENANT_SCOPED_ROLES` o `AREA_SCOPED_ROLES` +
  mapping en `planFieldForRole()` de `lib/plan-limits.ts` + columna `limite_<rol>` en
  `planes`.
- **Reaccionar a un nuevo evento de MP**: extender `handleEvent()` en
  `app/api/mercadopago/webhook/route.ts` y agregar el helper en `lib/subscription.ts`. Los
  handlers tienen que ser idempotentes porque MP reintenta.
- **Testing local de MP**: exponer localhost con ngrok/cloudflared y configurar el
  webhook en MP dashboard (test mode) hacia esa URL. Pagar con `5031 7557 3453 0604` +
  nombre titular `APRO`. Full playbook en `docs/mercadopago-setup.md`.

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
