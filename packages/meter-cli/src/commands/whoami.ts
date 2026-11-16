import type { CommandContext, CommandDefinition } from '../context.ts';
import { keyValues, paint, printJson } from '../output.ts';
import { parseToolResult, renderToolResult } from '../render.ts';
import { findCatalogTool } from '../tools.ts';
import { describeSession } from './login.ts';

export const whoamiCommand: CommandDefinition = {
  name: 'whoami',
  aliases: ['status'],
  summary:
    'Show who is signed in, their fleets and roles, and where the token comes from',
  usage: 'meter whoami [--json]',
  async run(ctx: CommandContext): Promise<number> {
    const { io, clientContext } = ctx;
    const session = await describeSession(ctx);
    const client = await clientContext.client();
    const result = await client.callTool('whoami', {});
    const parsed = parseToolResult(result);
    if (io.json) {
      printJson(io, {
        ...(parsed.data ?? {}),
        _session: {
          origin: clientContext.origin,
          token_source: session.source,
          expires_at: session.expires_at,
          is_error: parsed.isError
        }
      });
      return parsed.isError ? 1 : 0;
    }
    if (parsed.isError) {
      io.stderr(
        `${paint(io, 'red', '✗')} ${typeof parsed.data?.['error'] === 'string' ? parsed.data['error'] : parsed.text}\n`
      );
      if (parsed.nextSteps)
        io.stderr(`  ${paint(io, 'yellow', '→')} ${parsed.nextSteps}\n`);
      return 1;
    }
    io.stdout(`${renderToolResult(parsed, io)}\n\n`);
    io.stdout(
      `${keyValues(io, [
        ['Origin', clientContext.origin],
        [
          'Token',
          `${session.source}${session.expires_at ? ` (expires ${session.expires_at})` : ''}`
        ],
        ['Credentials', clientContext.credentialsPath]
      ])}\n`
    );
    const tool = findCatalogTool('whoami');
    if (tool)
      io.stdout(
        `${paint(io, 'dim', 'Next: meter fleets list · meter trips list · meter describe')}\n`
      );
    return 0;
  }
};
