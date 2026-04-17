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

## Arquitectura

```
app/                      # App Router (páginas + API routes)
  (auth)/                 # login, registro, recuperar, etc.
  (dashboard)/            # zona autenticada
  api/                    # 60+ endpoints REST agrupados por dominio
  generated/prisma/       # Prisma client generado (gitignored)
components/               # UI reusable (admin, layout, ThemeProvider, etc.)
hooks/                    # React hooks (useFetch, isMobile, useTheme)
lib/                      # Lógica de negocio, auth, permisos, validators
  api-handler.ts          # Wrapper con auth + rate limit + Zod
  auth.ts                 # NextAuth config
  logger.ts               # Structured logs + Sentry bridge
  permissions.ts          # Autorización + segregación de funciones
  validators.ts           # Schemas Zod
prisma/                   # Schema + migraciones + seeds
proxy.ts                  # Middleware Next.js 16 (auth + roles + tenant guard)
instrumentation.ts        # Sentry server/edge init
instrumentation-client.ts # Sentry client init
__tests__/                # Vitest (unit + integration)
```

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

## Convenciones

- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, `style:`, `refactor:`).
- **Formato**: Prettier aplica al guardar (via pre-commit hook).
- **Lint**: 0 errores requerido para mergear. Warnings se toleran en código legacy.
- **Tests**: agregar tests para lógica nueva en `__tests__/`. No requerido para UI.
- **Secrets**: nunca commitear `.env*` (gitignored). Documentar vars nuevas en `.env.example`.
