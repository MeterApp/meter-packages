import * as util from 'node:util';
import type { FlagValue } from './args.ts';

export type Style =
  'bold' | 'dim' | 'green' | 'red' | 'yellow' | 'cyan' | 'underline';

export type Env = Record<string, string | undefined>;

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
  isTTY: boolean;
  color: boolean;
  json: boolean;
  quiet: boolean;
}

export function createIo(
  flags: Record<string, FlagValue>,
  env: Env = process.env
): Io {
  const isTTY = Boolean(process.stdout.isTTY);
  const color =
    flags['color'] === false
      ? false
      : env['NO_COLOR'] !== undefined
        ? false
        : env['FORCE_COLOR'] !== undefined && env['FORCE_COLOR'] !== '0'
          ? true
          : isTTY;
  return {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    isTTY,
    color,
    json: flags['json'] === true,
    quiet: flags['quiet'] === true
  };
}

/** Colors when the runtime supports styleText; plain text on older Node 20. */
export function paint(
  io: Pick<Io, 'color'>,
  style: Style | Style[],
  text: string
): string {
  if (!io.color || typeof util.styleText !== 'function') return text;
  try {
    return util.styleText(style, text);
  } catch {
    return text;
  }
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function visibleLength(text: string): number {
  return text.replace(ANSI_PATTERN, '').length;
}

function pad(text: string, width: number): string {
  const missing = width - visibleLength(text);
  return missing > 0 ? text + ' '.repeat(missing) : text;
}

/** Fixed-width table; header row underlined with dashes. */
export function table(rows: string[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows;
  if (all.length === 0) return '';
  const columns = Math.max(...all.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(...all.map((row) => visibleLength(String(row[column] ?? ''))))
  );
  const render = (row: string[]) =>
    row
      .map((cell, column) =>
        column === columns - 1
          ? String(cell ?? '')
          : pad(String(cell ?? ''), widths[column] ?? 0)
      )
      .join('  ')
      .trimEnd();
  const lines: string[] = [];
  if (header) {
    lines.push(render(header));
    lines.push(widths.map((width) => '-'.repeat(width)).join('  '));
  }
  for (const row of rows) lines.push(render(row));
  return lines.join('\n');
}

/** Two-column key/value block. */
export function keyValues(
  io: Pick<Io, 'color'>,
  entries: Array<[string, string]>
): string {
  if (entries.length === 0) return '';
  const width = Math.max(...entries.map(([key]) => key.length));
  return entries
    .map(([key, value]) => `${paint(io, 'dim', pad(key, width))}  ${value}`)
    .join('\n');
}

export function printJson(io: Io, value: unknown): void {
  io.stdout(`${JSON.stringify(value, null, 2)}\n`);
}

export function ok(io: Pick<Io, 'color'>, text: string): string {
  return `${paint(io, 'green', '✓')} ${text}`;
}

export function warn(io: Pick<Io, 'color'>, text: string): string {
  return `${paint(io, 'yellow', '!')} ${text}`;
}

export function fail(io: Pick<Io, 'color'>, text: string): string {
  return `${paint(io, 'red', '✗')} ${text}`;
}
