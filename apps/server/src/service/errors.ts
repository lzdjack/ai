// Errors a service throws for the client; the error handler turns them into ApiError (code
// `domain.reason`, message from i18n `error.<code>`).
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly data?: unknown,
    /** seconds, for 429 */
    readonly retryAfter?: number,
  ) {
    super(code);
    this.name = 'ApiFailure';
  }
}

/** PostgreSQL error code of a failed statement (drizzle wraps the driver error). */
export const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
