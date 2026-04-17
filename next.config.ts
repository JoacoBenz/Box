import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
};

// Sentry wraps the config only when a DSN is present.
// Uploading source maps requires SENTRY_AUTH_TOKEN (+ ORG + PROJECT) at build time.
const shouldWrapWithSentry =
  !!process.env.SENTRY_DSN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN;

export default shouldWrapWithSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG!,
      project: process.env.SENTRY_PROJECT!,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      tunnelRoute: '/monitoring',
    })
  : nextConfig;
