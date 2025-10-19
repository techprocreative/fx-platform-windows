type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);

  switch (level) {
    case 'error':
      console.error(serialized);
      break;
    case 'warn':
      console.warn(serialized);
      break;
    default:
      console.log(serialized);
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    log('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    log('warn', message, meta);
  },
  error(message: string, error?: Error, meta?: LogMeta) {
    log('error', message, {
      error: error?.message,
      stack: error?.stack,
      ...meta,
    });
  },
  debug(message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, meta);
    }
  },
};
