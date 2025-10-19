import type { CaptureContext } from '@sentry/types';

let sentry: typeof import('@sentry/nextjs') | null = null;

async function loadSentry() {
  if (sentry) {
    return sentry;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    sentry = await import('@sentry/nextjs');
  }

  return sentry;
}

export const monitoring = {
  async captureException(error: Error, context?: CaptureContext) {
    const loaded = await loadSentry();
    if (!loaded?.captureException) {
      return;
    }

    loaded.captureException(error, context);
  },
  async captureMessage(message: string, context?: CaptureContext) {
    const loaded = await loadSentry();
    if (!loaded?.captureMessage) {
      return;
    }

    loaded.captureMessage(message, context);
  },
};
