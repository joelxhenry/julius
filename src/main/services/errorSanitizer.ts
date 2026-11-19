import { ErrorLogService } from './ErrorLogService';

export interface SanitizedError {
  /** true when userMessage is the original error message, passed through unchanged */
  safe: boolean;
  userMessage: string;
  technicalMessage: string;
  stack?: string;
  errorCode?: string;
}

const PG_CODE_MESSAGES: Record<string, string> = {
  '23505': 'This record already exists.',
  '23503': "This item is linked to other records and can't be modified or removed.",
  '23502': 'Required information is missing.',
};

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '57P01', '08006', '08001']);

const GENERIC_MESSAGE =
  'Something unexpected happened while processing your request. The issue has been logged for review.';
const CONNECTION_MESSAGE = 'Could not reach the database. Please check your connection and try again.';

// Business messages thrown deliberately by services (e.g. "Client already has an
// active invoice") are short, single-line, and don't mention SQL/driver internals.
// Anything else (driver errors, stack traces) is treated as technical and replaced.
const TECHNICAL_PATTERN =
  /\b(SELECT|INSERT|UPDATE|DELETE FROM|constraint|relation|duplicate key|column ".*" does not exist)\b|at [A-Za-z0-9_.]+ \(|\.ts:\d+|\.js:\d+|node_modules/i;

function extractCode(error: unknown): string | undefined {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

function extractCauseMessage(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown })?.cause;
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  return undefined;
}

function looksTechnical(message: string): boolean {
  return message.length > 150 || message.includes('\n') || TECHNICAL_PATTERN.test(message);
}

/**
 * Classifies a caught error into a user-safe message plus the full technical
 * detail for the error log. Known Postgres/connection error codes get a
 * friendly mapped message; deliberately-thrown short business messages pass
 * through unchanged; everything else falls back to a generic message.
 */
export function sanitizeError(error: unknown): SanitizedError {
  const baseMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  const causeMessage = extractCauseMessage(error);
  const technicalMessage = causeMessage ? `${baseMessage} (${causeMessage})` : baseMessage;
  const stack = error instanceof Error ? error.stack : undefined;
  const code = extractCode(error);

  if (code) {
    if (CONNECTION_CODES.has(code)) {
      return { safe: false, userMessage: CONNECTION_MESSAGE, technicalMessage, stack, errorCode: code };
    }
    return { safe: false, userMessage: PG_CODE_MESSAGES[code] ?? GENERIC_MESSAGE, technicalMessage, stack, errorCode: code };
  }

  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(baseMessage)) {
    return { safe: false, userMessage: CONNECTION_MESSAGE, technicalMessage, stack };
  }

  if (!causeMessage && !looksTechnical(baseMessage)) {
    return { safe: true, userMessage: baseMessage, technicalMessage, stack };
  }

  return { safe: false, userMessage: GENERIC_MESSAGE, technicalMessage, stack };
}

/**
 * Sanitizes + best-effort persists an error, returning the id of the inserted
 * log row (if any) so callers can show a reference number. Never throws.
 */
export async function recordError(
  error: unknown,
  meta: { source: 'ipc' | 'main' | 'renderer'; context?: string; employeeId?: number; employeeName?: string }
): Promise<SanitizedError & { logId?: number }> {
  const sanitized = sanitizeError(error);
  const svc = ErrorLogService.getInstance();
  if (!svc) return sanitized;
  try {
    const row = await svc.log({
      ...meta,
      userMessage: sanitized.userMessage,
      technicalMessage: sanitized.technicalMessage,
      stack: sanitized.stack,
      errorCode: sanitized.errorCode,
    });
    return { ...sanitized, logId: row.id };
  } catch (logErr) {
    console.error('Failed to persist error log:', logErr);
    return sanitized;
  }
}

/**
 * Drop-in replacement for the common `error instanceof Error ? error.message
 * : fallback` pattern used across inline IPC handlers. Returns a safe message
 * synchronously (business messages pass through, everything else uses the
 * caller's own fallback copy) and logs the technical detail in the background.
 */
export function reportError(error: unknown, fallback: string, context?: string): string {
  const sanitized = sanitizeError(error);
  const message = sanitized.safe ? sanitized.userMessage : fallback;
  const svc = ErrorLogService.getInstance();
  if (svc) {
    void svc
      .log({
        source: 'ipc',
        context,
        userMessage: message,
        technicalMessage: sanitized.technicalMessage,
        stack: sanitized.stack,
        errorCode: sanitized.errorCode,
      })
      .catch((logErr: unknown) => console.error('Failed to persist error log:', logErr));
  }
  return message;
}
