import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { flagString } from '../args.ts';
import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { paint, printJson } from '../output.ts';
import { parseToolResult } from '../render.ts';
import { buildToolArgs } from '../tools.ts';
import { resolveTool, toolUsage } from './call.ts';

/** Bounds a runaway export; each chunk is already capped server-side. */
const MAX_CHUNKS = 500;

/**
 * Pages `export_data` to the end and writes one file: CSV chunks are appended
 * (only the first carries the header), JSON chunks are concatenated into one
 * array. Same arguments and authorization as `meter call export_data`.
 */
export const exportCommand: CommandDefinition = {
  name: 'export',
  summary:
    'export <dataset> [--from] [--to] [--driver] [--format csv|json] [--out <file>|-] — download trips, bookings, customers, members, vehicles, ledger, settlements, trip_invoices or quotes as one file',
  usage:
    'meter export <dataset> [--fleet-id <id>] [--from <date>] [--to <date>] [--driver me|all|<member_id>] [--format csv|json] [--out <file>|-]\n  Pages export_data until the end and writes a single file (default: the server\'s file name in the current directory; --out - prints to stdout).\n  e.g. meter export trips --from 2026-09-01 --to 2026-10-01 --out september-trips.csv',
  async run(ctx: CommandContext): Promise<number> {
    const { io } = ctx;
    const tool = await resolveTool(ctx, 'export_data');
    if (ctx.args.flags['help'] === true) {
      io.stdout(`${toolUsage(tool)}\n`);
      return 0;
    }
    const [dataset, extra] = ctx.args.positionals;
    if (extra)
      throw new CliError(
        `Unexpected argument "${extra}".`,
        2,
        'Run `meter export --help`.'
      );
    const { out: outFlag, ...flags } = ctx.args.flags;
    const args = buildToolArgs(tool, flags, {
      jsonArgs: flagString(ctx.args.flags, 'args'),
      dryRun: false,
      positionalFields: dataset ? { dataset } : {}
    });
    const client = await ctx.clientContext.client();
    const csvChunks: string[] = [];
    const jsonRows: unknown[] = [];
    let filename: string | null = null;
    let format: string = typeof args['format'] === 'string' ? args['format'] : 'csv';
    let rows = 0;
    let cursor: string | undefined;
    for (let chunk = 0; ; chunk++) {
      if (chunk >= MAX_CHUNKS)
        throw new CliError(
          `Stopped after ${MAX_CHUNKS} chunks.`,
          1,
          'Narrow the date range with --from and --to.'
        );
      const result = await client.callTool(
        tool.name,
        cursor ? { ...args, cursor } : args
      );
      const parsed = parseToolResult(result);
      const data = parsed.data;
      if (parsed.isError || !data) {
        const message =
          typeof data?.['error'] === 'string'
            ? data['error']
            : parsed.text || 'The export failed.';
        throw new CliError(message, 1, parsed.nextSteps ?? undefined);
      }
      filename ??= typeof data['filename'] === 'string' ? data['filename'] : null;
      if (typeof data['format'] === 'string') format = data['format'];
      rows += typeof data['row_count'] === 'number' ? data['row_count'] : 0;
      if (typeof data['data'] === 'string') csvChunks.push(data['data']);
      else if (Array.isArray(data['data'])) jsonRows.push(...data['data']);
      const next = data['next_cursor'];
      if (typeof next !== 'string' || !next) break;
      cursor = next;
      if (io.isTTY && !io.quiet && !io.json)
        io.stderr(paint(io, 'dim', `  … ${rows} rows\n`));
    }
    const body =
      format === 'json'
        ? `${JSON.stringify(jsonRows, null, 2)}\n`
        : csvChunks
            .map((chunk) => chunk.replace(/\r?\n$/, ''))
            .filter(Boolean)
            .join('\n') + '\n';
    const out =
      typeof outFlag === 'string' && outFlag
        ? outFlag
        : (filename ?? `${String(args['dataset'])}.${format}`);
    if (out === '-') {
      io.stdout(body);
      return 0;
    }
    const target = path.resolve(ctx.cwd, out);
    await writeFile(target, body, 'utf8');
    if (io.json) printJson(io, { file: target, rows, format });
    else if (!io.quiet)
      io.stdout(
        `${paint(io, 'green', '✓')} Wrote ${rows} ${rows === 1 ? 'row' : 'rows'} to ${target}\n`
      );
    return 0;
  }
};
