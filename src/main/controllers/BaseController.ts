import { recordError } from '../services/errorSanitizer';

export abstract class BaseController<TService> {
  protected service: TService;

  constructor(service: TService) {
    this.service = service;
  }

  /**
   * Never returns a raw/technical error to the renderer. Known business
   * errors (short messages deliberately thrown by services) pass through
   * unchanged; anything else (driver errors, stack traces, etc.) is replaced
   * with a generic, non-technical message. The full technical detail is
   * always persisted to the error log (see errorSanitizer.ts), reviewable
   * from Settings > Error Logs.
   */
  async handleError(error: any, context?: string): Promise<{ success: false; error: string; logId?: number }> {
    console.error('Controller error:', error);
    const { safe, userMessage, logId } = await recordError(error, {
      source: 'ipc',
      context: context ?? this.constructor.name,
    });

    return {
      success: false,
      error: !safe && logId ? `${userMessage} (Ref #${logId})` : userMessage,
      logId,
    };
  }

  wrapSuccess<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }
}
