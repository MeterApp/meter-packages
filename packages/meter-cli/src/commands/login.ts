import { flagString } from '../args.ts';
import { openBrowser } from '../browser.ts';
import {
  clientsPath,
  decodeJwtPayload,
  deleteCredential,
  getCredential,
  maskToken,
  readRegisteredClient,
  saveCredential,
  saveRegisteredClient
} from '../config.ts';
import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { runLogin } from '../oauth/login.ts';
import { keyValues, ok, paint, printJson } from '../output.ts';

export const loginCommand: CommandDefinition = {
  name: 'login',
  summary:
    'Sign in through the browser (OAuth 2.1 + PKCE) and store the session with mode 0600',
  usage:
    'meter login [--no-browser] [--client-id <id>] [--token <access token>] [--api <origin>]\n  --no-browser   print the sign-in URL instead of opening a browser\n  --client-id    OAuth client id when dynamic registration is disabled (env METER_OAUTH_CLIENT_ID)\n  --token        store an existing access token instead of running the browser flow',
  async run(ctx: CommandContext): Promise<number> {
    const { io, clientContext, env } = ctx;
    const origin = clientContext.origin;
    const path = clientContext.credentialsPath;

    const pasted = flagString(ctx.args.flags, 'token')?.trim();
    if (pasted) {
      const payload = decodeJwtPayload(pasted);
      const exp =
        typeof payload?.['exp'] === 'number'
          ? payload['exp'] * 1000
          : undefined;
      const stored = await saveCredential(
        path,
        origin,
        exp
          ? { access_token: pasted, expires_at: exp }
          : { access_token: pasted }
      );
      if (io.json) {
        printJson(io, {
          ok: true,
          origin,
          credentials_path: path,
          token: maskToken(pasted),
          expires_at: stored.expires_at
            ? new Date(stored.expires_at).toISOString()
            : null,
          refreshable: false
        });
        return 0;
      }
      io.stdout(
        `${ok(io, `Stored the token for ${origin} at ${path} (mode 0600).`)}\n`
      );
      if (!exp)
        io.stdout(
          `${paint(io, 'dim', 'The token has no readable expiry and cannot be refreshed; run `meter login` again when it stops working.')}\n`
        );
      return 0;
    }

    const openInBrowser = ctx.args.flags['browser'] !== false;
    const clientId =
      flagString(ctx.args.flags, 'client-id')?.trim() ||
      env['METER_OAUTH_CLIENT_ID']?.trim() ||
      undefined;
    const clients = clientsPath(env);

    const result = await runLogin({
      fetch: clientContext.fetch,
      origin,
      clientId,
      readRegisteredClient: (issuer) => readRegisteredClient(clients, issuer),
      saveRegisteredClient: (issuer, client) =>
        saveRegisteredClient(clients, issuer, client),
      now: () => ctx.now(),
      onAuthorizationUrl(url) {
        io.stderr(
          `\nSign in to Meter in your browser:\n  ${paint(io, 'underline', url)}\n\n`
        );
        if (openInBrowser) {
          const opened = openBrowser(url);
          io.stderr(
            opened
              ? 'Opening your browser… (use --no-browser to skip)\n'
              : 'Open the link above in a browser.\n'
          );
        } else {
          io.stderr('Open the link above in a browser on this machine.\n');
        }
        io.stderr('Waiting for the sign-in to complete (5 minutes)…\n');
      }
    });

    const stored = await saveCredential(path, origin, result.credential);
    if (io.json) {
      printJson(io, {
        ok: true,
        origin,
        issuer: result.discovery.issuer,
        client_id: result.clientId,
        credentials_path: path,
        token: maskToken(stored.access_token),
        expires_at: stored.expires_at
          ? new Date(stored.expires_at).toISOString()
          : null,
        refreshable: Boolean(stored.refresh_token),
        scope: stored.scope ?? null
      });
      return 0;
    }
    io.stdout(`\n${ok(io, 'Signed in.')}\n`);
    io.stdout(
      `${keyValues(io, [
        ['Origin', origin],
        ['Authorization server', result.discovery.issuer],
        ['Saved to', `${path} (mode 0600)`],
        [
          'Expires',
          stored.expires_at
            ? `${new Date(stored.expires_at).toISOString()}${stored.refresh_token ? ' (refreshes automatically)' : ''}`
            : 'unknown'
        ],
        ['Token', maskToken(stored.access_token)]
      ])}\n`
    );
    io.stdout(
      `\nNext: meter whoami · meter fleets list · meter trips list · meter agent-config --host claude-code\n`
    );
    return 0;
  }
};

export const logoutCommand: CommandDefinition = {
  name: 'logout',
  summary: 'Remove the stored session for the current API origin',
  usage: 'meter logout [--api <origin>]',
  async run(ctx: CommandContext): Promise<number> {
    const { io, clientContext } = ctx;
    const removed = await deleteCredential(
      clientContext.credentialsPath,
      clientContext.origin
    );
    if (io.json) {
      printJson(io, { ok: true, removed, origin: clientContext.origin });
      return 0;
    }
    io.stdout(
      removed
        ? `${ok(io, `Signed out of ${clientContext.origin}.`)}\n`
        : `No stored session for ${clientContext.origin}.\n`
    );
    return 0;
  }
};

/** Shared by whoami/doctor: describes where the current token comes from. */
export async function describeSession(
  ctx: CommandContext
): Promise<{ source: string; expires_at: string | null }> {
  const resolved = await ctx.clientContext.token();
  if (!resolved)
    throw new CliError(
      'Not signed in.',
      1,
      `Run \`meter login\` (or set METER_ACCESS_TOKEN) for ${ctx.clientContext.origin}.`
    );
  const stored =
    resolved.source === 'stored'
      ? await getCredential(
          ctx.clientContext.credentialsPath,
          ctx.clientContext.origin
        )
      : null;
  return {
    source: resolved.source ?? 'unknown',
    expires_at: stored?.expires_at
      ? new Date(stored.expires_at).toISOString()
      : null
  };
}
