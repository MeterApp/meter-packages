import { MeterMcpError } from '@meterapp/meter-sdk/client';

/** Exit codes: 0 success, 1 failure, 2 usage error. */
export type ExitCode = 0 | 1 | 2;

export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly hint: string | undefined;

  constructor(message: string, exitCode: ExitCode = 1, hint?: string) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.hint = hint;
  }
}

/** Actionable next step for an HTTP status returned by the MCP endpoint. */
export function fixHintFor(
  status: number | null | undefined
): string | undefined {
  switch (status) {
    case 401:
      return 'Run `meter login` (or set METER_ACCESS_TOKEN) to sign in; the stored session may have expired.';
    case 403:
      return 'Your role does not allow this. Run `meter whoami` to see your fleets and roles.';
    case 404:
      return 'The MCP endpoint was not found. Check --api / METER_API_ORIGIN (default https://www.meterapp.co).';
    case 429:
      return 'Rate limited. Wait a few seconds and retry.';
    case 0:
    case null:
    case undefined:
      return undefined;
    default:
      return status >= 500
        ? 'Temporary problem on the Meter side. Retry shortly.'
        : undefined;
  }
}

export interface RenderedError {
  message: string;
  hint?: string;
  requestId?: string | null;
  exitCode: ExitCode;
  status?: number | null;
  code?: string;
}

/** Turns any thrown value into a user-facing message, hint and exit code. */
export function describeError(error: unknown): RenderedError {
  if (error instanceof CliError) {
    return {
      message: error.message,
      hint: error.hint,
      exitCode: error.exitCode
    };
  }
  if (error instanceof MeterMcpError) {
    const rendered: RenderedError = {
      message: error.message,
      hint: fixHintFor(error.status),
      requestId: error.requestId,
      exitCode: 1,
      status: error.status
    };
    if (error.rpcError) rendered.code = String(error.rpcError.code);
    return rendered;
  }
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    const causeText = cause instanceof Error ? ` (${cause.message})` : '';
    const rendered: RenderedError = {
      message: `${error.message || error.name}${causeText}`,
      exitCode: 1
    };
    if (
      /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(
        `${error.message}${causeText}`
      )
    ) {
      rendered.hint =
        'Network problem. Check connectivity and --api / METER_API_ORIGIN.';
    }
    return rendered;
  }
  return { message: String(error), exitCode: 1 };
}
