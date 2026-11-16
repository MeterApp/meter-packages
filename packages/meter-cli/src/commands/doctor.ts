import { MeterMcpError } from '@meterapp/meter-sdk/client';
import type { CommandContext, CommandDefinition } from '../context.ts';
import {
  fetchAuthorizationServerMetadata,
  fetchProtectedResourceMetadata
} from '../oauth/discovery.ts';
import { fail, ok, paint, printJson, table } from '../output.ts';
import { parseToolResult } from '../render.ts';

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  latencyMs: number | null;
  notes: string;
  hint?: string;
}

export const MIN_NODE_MAJOR = 20;

async function timed(
  name: string,
  run: () => Promise<{ ok: boolean; notes: string; hint?: string }>,
  now: () => number
): Promise<DoctorCheck> {
  const started = now();
  try {
    const result = await run();
    const check: DoctorCheck = {
      name,
      status: result.ok ? 'pass' : 'fail',
      latencyMs: now() - started,
      notes: result.notes
    };
    if (result.hint && !result.ok) check.hint = result.hint;
    return check;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint =
      error instanceof Error &&
      'hint' in error &&
      typeof (error as { hint?: unknown }).hint === 'string'
        ? (error as { hint: string }).hint
        : undefined;
    const check: DoctorCheck = {
      name,
      status: 'fail',
      latencyMs: now() - started,
      notes: message
    };
    if (hint) check.hint = hint;
    return check;
  }
}

export async function runDoctor(
  ctx: CommandContext,
  onCheck?: (check: DoctorCheck) => void
): Promise<DoctorCheck[]> {
  const { clientContext } = ctx;
  const now = () => ctx.now();
  const checks: DoctorCheck[] = [];
  const push = (check: DoctorCheck) => {
    checks.push(check);
    onCheck?.(check);
  };

  const major = Number(process.versions.node.split('.')[0]);
  push({
    name: 'node',
    status: major >= MIN_NODE_MAJOR ? 'pass' : 'fail',
    latencyMs: null,
    notes: `node ${process.version}`,
    ...(major >= MIN_NODE_MAJOR
      ? {}
      : { hint: `Meter CLI needs Node.js ${MIN_NODE_MAJOR} or newer.` })
  });

  push(
    await timed(
      'origin',
      async () => {
        const response = await clientContext.fetch(`${clientContext.origin}/`, {
          method: 'HEAD',
          redirect: 'manual'
        });
        return {
          ok: response.status < 500,
          notes: `HEAD ${clientContext.origin}/ → ${response.status}`,
          hint: 'Check --api / METER_API_ORIGIN.'
        };
      },
      now
    )
  );

  let issuer: string | null = null;
  push(
    await timed(
      'resource-metadata',
      async () => {
        const { metadata } = await fetchProtectedResourceMetadata(
          clientContext.origin,
          clientContext.fetch
        );
        issuer = metadata.authorization_servers?.[0] ?? null;
        return {
          ok: Boolean(issuer),
          notes: issuer
            ? `authorization server ${issuer}`
            : 'no authorization_servers listed',
          hint: 'The deployment has no OAuth server configured; `meter login --token` still works.'
        };
      },
      now
    )
  );

  if (issuer) {
    const knownIssuer: string = issuer;
    push(
      await timed(
        'authorization-server',
        async () => {
          const { metadata, url } = await fetchAuthorizationServerMetadata(
            knownIssuer,
            clientContext.fetch
          );
          const registration = metadata.registration_endpoint
            ? 'dynamic registration on'
            : 'no dynamic registration (use --client-id)';
          return {
            ok: true,
            notes: `${url.replace(knownIssuer, '')} · ${registration}`
          };
        },
        now
      )
    );
  } else {
    push({
      name: 'authorization-server',
      status: 'skip',
      latencyMs: null,
      notes: 'skipped: no issuer'
    });
  }

  push(
    await timed(
      'mcp-endpoint',
      async () => {
        const response = await clientContext.fetch(clientContext.mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              clientInfo: { name: 'meter-doctor', version: '0' }
            }
          })
        });
        const challenge = response.headers.get('www-authenticate');
        if (response.status === 401)
          return {
            ok: Boolean(challenge),
            notes: challenge
              ? `401 with WWW-Authenticate challenge`
              : '401 without WWW-Authenticate',
            hint: 'The endpoint must advertise resource_metadata in WWW-Authenticate.'
          };
        return {
          ok: response.status === 200,
          notes: `POST ${clientContext.mcpUrl} → ${response.status}`,
          hint: 'Unexpected status from the MCP endpoint.'
        };
      },
      now
    )
  );

  const token = await clientContext.token().catch((error: unknown) => {
    push({
      name: 'session',
      status: 'fail',
      latencyMs: null,
      notes: error instanceof Error ? error.message : String(error),
      hint: 'Run `meter login`.'
    });
    return null;
  });
  if (!token) {
    if (!checks.some((check) => check.name === 'session')) {
      push({
        name: 'session',
        status: 'fail',
        latencyMs: null,
        notes: 'no stored session or METER_ACCESS_TOKEN',
        hint: 'Run `meter login`.'
      });
    }
    push({
      name: 'whoami',
      status: 'skip',
      latencyMs: null,
      notes: 'skipped: not signed in'
    });
    return checks;
  }
  push({
    name: 'session',
    status: 'pass',
    latencyMs: null,
    notes: `token from ${token.source}`
  });

  push(
    await timed(
      'whoami',
      async () => {
        const client = await clientContext.client();
        try {
          const result = parseToolResult(await client.callTool('whoami', {}));
          if (result.isError)
            return {
              ok: false,
              notes:
                typeof result.data?.['error'] === 'string'
                  ? result.data['error']
                  : 'tool error',
              hint: result.nextSteps ?? undefined
            };
          const profile = result.data?.['profile'] as
            Record<string, unknown> | undefined;
          const fleets = Array.isArray(result.data?.['fleets'])
            ? (result.data['fleets'] as unknown[]).length
            : 0;
          const name =
            [profile?.['first_name'], profile?.['last_name']]
              .filter(Boolean)
              .join(' ') ||
            (profile?.['email'] as string | undefined) ||
            'signed in';
          return {
            ok: true,
            notes: `${name}; ${fleets} fleet${fleets === 1 ? '' : 's'}`
          };
        } catch (error) {
          if (error instanceof MeterMcpError && error.status === 401)
            return {
              ok: false,
              notes: 'token rejected (401)',
              hint: 'Run `meter login` again; the session expired or was revoked.'
            };
          throw error;
        }
      },
      now
    )
  );
  return checks;
}

export function doctorSummary(checks: DoctorCheck[]): {
  passed: number;
  failed: number;
  skipped: number;
  ok: boolean;
} {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  const skipped = checks.filter((check) => check.status === 'skip').length;
  return { passed, failed, skipped, ok: failed === 0 };
}

export const doctorCommand: CommandDefinition = {
  name: 'doctor',
  summary:
    'Check Node, the API origin, OAuth metadata, the MCP endpoint and the stored session',
  usage: 'meter doctor [--json] [--api <origin>]',
  async run(ctx: CommandContext): Promise<number> {
    const { io } = ctx;
    if (!io.json && !io.quiet)
      io.stderr(`Checking ${ctx.clientContext.origin}…\n`);
    const checks = await runDoctor(ctx, (check) => {
      if (io.json || io.quiet || !io.isTTY) return;
      const mark =
        check.status === 'pass'
          ? paint(io, 'green', '✓')
          : check.status === 'fail'
            ? paint(io, 'red', '✗')
            : paint(io, 'dim', '·');
      io.stderr(`${mark} ${check.name}\n`);
    });
    const summary = doctorSummary(checks);
    if (io.json) {
      printJson(io, {
        ok: summary.ok,
        origin: ctx.clientContext.origin,
        summary,
        checks
      });
      return summary.ok ? 0 : 1;
    }
    const rows = checks.map((check) => [
      check.name,
      check.status === 'pass'
        ? paint(io, 'green', 'pass')
        : check.status === 'fail'
          ? paint(io, 'red', 'FAIL')
          : paint(io, 'dim', 'skip'),
      check.latencyMs === null ? '—' : `${check.latencyMs} ms`,
      check.notes
    ]);
    const hints = checks
      .filter((check) => check.status === 'fail' && check.hint)
      .map(
        (check) => `  ${paint(io, 'yellow', '→')} ${check.name}: ${check.hint}`
      );
    io.stdout(`${table(rows, ['check', 'status', 'latency', 'notes'])}\n`);
    if (hints.length) io.stdout(`\nFixes:\n${hints.join('\n')}\n`);
    const line = `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`;
    io.stdout(`\n${summary.ok ? ok(io, line) : fail(io, line)}\n`);
    return summary.ok ? 0 : 1;
  }
};
