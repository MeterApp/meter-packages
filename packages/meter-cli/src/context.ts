import type { ParsedArgs } from './args.ts';
import type { ClientContext } from './client.ts';
import type { Env, Io } from './output.ts';

export interface CommandContext {
  args: ParsedArgs;
  io: Io;
  env: Env;
  cwd: string;
  clientContext: ClientContext;
  /** Overrides for tests: in-process fetch and clock. */
  now(): number;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  summary: string;
  usage: string;
  run(ctx: CommandContext): Promise<number>;
}
