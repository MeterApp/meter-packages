import { CliError } from './errors.ts';

export type FlagValue = string | boolean | string[];

export interface ParsedArgs {
  /** First positional token, or null when none was given. */
  command: string | null;
  /** Remaining positional tokens after the command. */
  positionals: string[];
  flags: Record<string, FlagValue>;
}

/** Flags that never take a value. `--no-<flag>` sets them to false. */
export const BOOLEAN_FLAGS = new Set([
  'json',
  'quiet',
  'help',
  'version',
  'browser',
  'color',
  'print',
  'write',
  'dry-run',
  'remote',
  'local',
  'force',
  'all'
]);

const SHORT_FLAGS: Record<string, string> = {
  h: 'help',
  v: 'version',
  q: 'quiet'
};

function store(
  flags: Record<string, FlagValue>,
  name: string,
  value: string | boolean
): void {
  const existing = flags[name];
  if (typeof value === 'string' && typeof existing === 'string') {
    flags[name] = [existing, value];
  } else if (typeof value === 'string' && Array.isArray(existing)) {
    existing.push(value);
  } else {
    flags[name] = value;
  }
}

/**
 * Hand-rolled argv parser: `--flag`, `--flag value`, `--flag=value`,
 * `--no-flag`, `-h`, `-v`, `-q` and `--` to end flag parsing. Boolean flags never
 * consume the following token, so `meter trips list --json --limit 5` works.
 * A flag given twice with values collects them into an array (`--status a --status b`).
 * Negative numbers are accepted as values (`--offset -5`).
 */
export function parseArgs(
  argv: readonly string[],
  booleanFlags: ReadonlySet<string> = BOOLEAN_FLAGS
): ParsedArgs {
  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];
  let onlyPositionals = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (onlyPositionals || token === '-' || !token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    if (token === '--') {
      onlyPositionals = true;
      continue;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equals = body.indexOf('=');
      if (equals >= 0) {
        store(flags, body.slice(0, equals), body.slice(equals + 1));
        continue;
      }
      if (
        body.startsWith('no-') &&
        body.length > 3 &&
        !booleanFlags.has(body)
      ) {
        flags[body.slice(3)] = false;
        continue;
      }
      if (booleanFlags.has(body)) {
        flags[body] = true;
        continue;
      }
      const next = argv[index + 1];
      // A lone `-` is a value (stdout/stdin), not a flag.
      if (
        next !== undefined &&
        (next === '-' || !next.startsWith('-') || /^-\d/.test(next))
      ) {
        store(flags, body, next);
        index += 1;
      } else {
        flags[body] = true;
      }
      continue;
    }
    const letters = token.slice(1);
    for (let position = 0; position < letters.length; position += 1) {
      const letter = letters[position] ?? '';
      const name = SHORT_FLAGS[letter];
      if (!name)
        throw new CliError(
          `Unknown option -${letter}`,
          2,
          'Run `meter --help` for usage.'
        );
      flags[name] = true;
    }
  }

  const [command = null, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

export function flagString(
  flags: Record<string, FlagValue>,
  name: string
): string | undefined {
  const value = flags[name];
  if (value === undefined || value === false) return undefined;
  if (value === true)
    throw new CliError(`Option --${name} requires a value`, 2);
  if (Array.isArray(value)) return value[value.length - 1];
  return value;
}

export function requireString(
  flags: Record<string, FlagValue>,
  name: string,
  hint?: string
): string {
  const value = flagString(flags, name);
  if (value === undefined || value === '') {
    throw new CliError(
      `Missing required option --${name}`,
      2,
      hint ?? 'Run `meter --help` for usage.'
    );
  }
  return value;
}

export function flagBoolean(
  flags: Record<string, FlagValue>,
  name: string
): boolean {
  return flags[name] === true;
}

export function flagChoice<T extends string>(
  flags: Record<string, FlagValue>,
  name: string,
  choices: readonly T[]
): T | undefined {
  const value = flagString(flags, name);
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!(choices as readonly string[]).includes(normalized)) {
    throw new CliError(
      `Invalid --${name} "${value}". Choose one of: ${choices.join(', ')}`,
      2
    );
  }
  return normalized as T;
}

/** Flags that belong to the CLI itself and must never be forwarded as tool arguments. */
export const GLOBAL_FLAGS = new Set([
  'json',
  'quiet',
  'help',
  'version',
  'color',
  'api',
  'app',
  'token',
  'args',
  'dry-run',
  'browser',
  'print',
  'write',
  'client-id',
  'host',
  'out'
]);
