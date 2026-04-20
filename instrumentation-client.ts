import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
    integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
