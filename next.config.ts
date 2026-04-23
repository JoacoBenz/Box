import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
};

// Sentry wraps the config whenever a DSN is present.
// Source map upload (ORG + PROJECT + AUTH_TOKEN) is optional: if those are set
// too, stack traces get symbolicated; if not, errors still arrive raw-but-useful.
const hasSentryDsn = !!process.env.SENTRY_DSN;
const canUploadSourcemaps =
  hasSentryDsn &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN;

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG ?? 'placeholder',
      project: process.env.SENTRY_PROJECT ?? 'placeholder',
      authToken: canUploadSourcemaps ? process.env.SENTRY_AUTH_TOKEN : undefined,
      silent: !process.env.CI,
      widenClientFileUpload: canUploadSourcemaps,
      disableLogger: true,
      tunnelRoute: '/monitoring',
      sourcemaps: canUploadSourcemaps ? undefined : { disable: true },
    })
  : nextConfig;
