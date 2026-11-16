import type { CommandDefinition } from '../context.ts';
import { agentConfigCommand, mcpCommand } from './agents.ts';
import { aliasCommands, callCommand } from './call.ts';
import { describeCommand, explainCommand } from './describe.ts';
import { doctorCommand } from './doctor.ts';
import { exportCommand } from './export.ts';
import { helpCommand, type HelpEntry } from './help.ts';
import { loginCommand, logoutCommand } from './login.ts';
import { updateCommand } from './update.ts';
import { whoamiCommand } from './whoami.ts';

export const COMMANDS: CommandDefinition[] = [
  loginCommand,
  logoutCommand,
  whoamiCommand,
  doctorCommand,
  ...aliasCommands(),
  exportCommand,
  callCommand,
  describeCommand,
  explainCommand,
  mcpCommand,
  agentConfigCommand,
  updateCommand,
  helpCommand(() => helpEntries())
];

export function helpEntries(): HelpEntry[] {
  return COMMANDS.map(({ name, summary, usage, aliases }) => ({
    name: aliases?.length ? `${name} (${aliases.join(', ')})` : name,
    summary,
    usage
  }));
}

export function findCommand(name: string): CommandDefinition | undefined {
  const needle = name.toLowerCase();
  return COMMANDS.find(
    (command) => command.name === needle || command.aliases?.includes(needle)
  );
}
