# Box

Sistema multi-tenant de gestión de compras. SaaS B2B con workflow de solicitud →
validación → aprobación → compra → recepción, con segregación de funciones,
control presupuestario y auditoría.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Ant Design 6, Recharts
- **Auth**: NextAuth 5 (credentials + Google/Microsoft SSO)
- **DB**: PostgreSQL (Supabase) via Prisma 7
- **Storage**: Supabase Storage (facturas, adjuntos)
- **Email**: Resend + Gmail SMTP (fallback)
- **Billing**: Mercado Pago (Preapproval recurrente)
- **Observability**: Sentry (opcional, free tier) + structured JSON logger
- **Testing**: Vitest + coverage v8
- **CI**: GitHub Actions (lint + format + test + build)

## Quick start

Requiere Node 20+ y una DB PostgreSQL (Supabase recomendado por el free tier).

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd box
npm install

# 2. Configurar env
cp .env.example .env.local
# Editar .env.local con tus credenciales (DATABASE_URL, NEXTAUTH_SECRET, etc.)

# 3. Prisma: generar client + aplicar migraciones
npx prisma generate
npx prisma migrate deploy

# 4. (Opcional) Seed inicial
npx prisma db seed

# 5. Levantar
npm run dev
```

App en [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Dev server con Turbopack |
| `npm run build` | Build de producción |
| `npm start` | Correr el build |
| `npm run lint` | ESLint (reglas estrictas en código nuevo, warn en legacy) |
| `npm run lint:fix` | ESLint con auto-fix |
| `npm run format` | Prettier sobre todo el repo |
| `npm run format:check` | Verificar formato (usado en CI) |
| `npm test` | Vitest single-run |
| `npm run test:watch` | Vitest en modo watch |

Pre-commit hook (Husky) corre `lint-staged` sobre los archivos staged.

## Variables de entorno

Ver `.env.example`. Las requeridas están validadas con Zod en `lib/env.ts`.

Para CI/builds sin DB real, setear `SKIP_ENV_VALIDATION=true`.

### Sentry (opcional)

Sentry se activa automáticamente si `SENTRY_DSN` está seteado. Sin DSN, todo el
código de captura es no-op. Para upload de source maps en prod, setear también
`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

### Mercado Pago (billing)

Box cobra 152.000 ARS/mes con Preapproval de Mercado Pago (recurrencia
automática), trial de 14 días sin tarjeta. La integración se activa cuando
las 3 vars están seteadas:

- `MP_ACCESS_TOKEN` — `TEST-...` en dev, `APP_USR-...` en prod.
- `MP_PLAN_ID` — ID del Preapproval Plan que creaste en MP (ver `docs/mercadopago-setup.md`).
- `MP_WEBHOOK_SECRET` — signing secret del webhook (de Dashboard → Webhooks).

Sin esas 3 vars, los endpoints `/api/mercadopago/*` devuelven 503 y la UI de
facturación muestra el estado del trial sin opción de pagar (útil para dev
y CI).

Setup completo paso a paso: **`docs/mercadopago-setup.md`**.

## Arquitectura

```
app/                      # App Router (páginas + API routes)
  (auth)/                 # login, registro, recuperar, etc.
  (dashboard)/            # zona autenticada
    facturacion/          # redirect legacy → /perfil?tab=facturacion
  api/                    # 60+ endpoints REST agrupados por dominio
    mercadopago/          # webhook + checkout + cancelar + subscription
  generated/prisma/       # Prisma client generado (gitignored)
components/               # UI reusable (admin, layout, ThemeProvider, etc.)
  SubscriptionBanner.tsx  # banner de trial/past_due en el dashboard
hooks/                    # React hooks (useFetch, isMobile, useTheme)
lib/                      # Lógica de negocio, auth, permisos, validators
  api-handler.ts          # Wrapper con auth + rate limit + Zod
  auth.ts                 # NextAuth config
  logger.ts               # Structured logs + Sentry bridge
  permissions.ts          # Autorización + segregación de funciones
  plan-limits.ts          # canCreateArea / canAssignRole / getPlanUsage
  mercadopago.ts          # MP SDK singleton + verificación de firma webhook
  subscription.ts         # estado machine + helpers de webhook sync
  validators.ts           # Schemas Zod
prisma/                   # Schema + migraciones + seeds
proxy.ts                  # Middleware Next.js 16 (auth + roles + tenant + sub guard)
instrumentation.ts        # Sentry server/edge init
instrumentation-client.ts # Sentry client init
__tests__/                # Vitest (unit + integration)
```

## Billing (plan único con trial)

### Plan `box-principal`

| Dimensión | Límite |
|---|---|
| Precio | 152.000 ARS / mes |
| Trial | 14 días sin tarjeta |
| Áreas | 3 por tenant |
| Centros de costo | 2 por área (6 en total) |
| `responsable_area` | 1 por área |
| `director` / `tesoreria` / `admin` / `compras` | 1 por tenant cada uno |
| `solicitante` | ilimitado |

El plan se seedea via `prisma/seed.ts` y vía la propia migración `20260418000000_add_billing`.

### Máquina de estados

```
registro verificado → trialing (14d, sin Stripe customer todavía)
    ↓ admin click "Activar plan"
    → Stripe Checkout
    ↓ webhook checkout.session.completed
    → active (Stripe customer + subscription ligados)
    ↓ invoice.payment_failed (Stripe retry windows)
    → past_due (gracia de 3 días desde current_period_end)
    ↓ invoice.paid
    → active
    ↓ customer.subscription.deleted
    → canceled (sin acceso hasta reactivar)
```

`proxy.ts` gatea el dashboard: los estados que NO tienen acceso (`trialing`
vencido, `past_due` fuera de gracia, `canceled`, `unpaid`) redirigen a
`/facturacion?reason=<estado>`. Rutas exentas: `/facturacion`, `/api/stripe/*`,
`/api/auth/*`, `/api/health`, `/logout`.

### Enforcement de caps

Los POST de áreas, centros de costo y usuarios verifican el plan antes de crear.
Al exceder devuelven 403 con código `PLAN_LIMIT_AREAS` / `PLAN_LIMIT_CC_POR_AREA`
/ `PLAN_LIMIT_DIRECTOR` etc. El frontend los traduce a mensajes legibles.

## Multi-tenancy

Cada tabla de dominio incluye `tenant_id` y se consulta con `@@unique([tenant_id, id])`.
El token JWT contiene `tenantId`; `proxy.ts` fuerza re-auth si falta. Admins
pueden override el tenant via cookie (`lib/tenant-override.ts`) para soporte.

## Deploy

Recomendado: **Vercel Hobby** (free) + **Supabase free** + **Resend free**.

Variables críticas en el panel de Vercel:
- `DATABASE_URL`, `DIRECT_URL`
- `NEXTAUTH_URL` (URL pública), `NEXTAUTH_SECRET` (≥32 chars)
- `NEXT_PUBLIC_APP_URL`
- Supabase URLs + keys
- Resend API key (si usás email)
- Sentry vars (si activás)
- Mercado Pago: `MP_ACCESS_TOKEN`, `MP_PLAN_ID`, `MP_WEBHOOK_SECRET`
  (ver `docs/mercadopago-setup.md` para crear el plan + webhook antes del deploy)

## Convenciones

- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, `style:`, `refactor:`).
- **Formato**: Prettier aplica al guardar (via pre-commit hook).
- **Lint**: 0 errores requerido para mergear. Warnings se toleran en código legacy.
- **Tests**: agregar tests para lógica nueva en `__tests__/`. No requerido para UI.
- **Secrets**: nunca commitear `.env*` (gitignored). Documentar vars nuevas en `.env.example`.
