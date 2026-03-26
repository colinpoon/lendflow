/**
 * Structured logger for server-side code.
 *
 * - Production: JSON lines for log aggregation (Vercel, Datadog, etc.)
 * - Development: human-readable with emoji prefixes
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Extraction complete', { documentId, processingTimeMs });
 *   logger.warn('Rate limit approached', { userId, remaining });
 *   logger.error('Extraction failed', { error: err.message, documentId });
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (IS_PRODUCTION) {
    // JSON lines for log aggregation
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(JSON.stringify(entry));
  } else {
    // Human-readable for development
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]';
    const metaStr = meta && Object.keys(meta).length > 0
      ? ' ' + JSON.stringify(meta)
      : '';
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => formatLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => formatLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => formatLog('error', message, meta),
};
