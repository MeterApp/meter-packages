import {
  explainToolData,
  formatApiReference,
  MCP_INSTRUCTIONS,
  MCP_TOOL_LIST
} from '@meterapp/meter-sdk/mcp';
import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { printJson } from '../output.ts';
import {
  catalogToolSpecs,
  findCatalogTool,
  toolInputJsonSchema
} from '../tools.ts';
import { toolUsage } from './call.ts';

export const describeCommand: CommandDefinition = {
  name: 'describe',
  summary:
    'Describe the tool catalog, or one tool with its arguments, roles, example and result fields',
  usage:
    'meter describe [<tool>] [--json]\n  e.g. meter describe · meter describe list_trips · meter describe --json',
  async run(ctx: CommandContext): Promise<number> {
    const { io } = ctx;
    const name = ctx.args.positionals[0];
    if (io.json) {
      const specs = name
        ? [findCatalogTool(name)].filter(
            (tool): tool is NonNullable<typeof tool> => tool !== null
          )
        : catalogToolSpecs();
      if (name && specs.length === 0)
        throw new CliError(
          `Unknown tool "${name}".`,
          2,
          `Known tools: ${MCP_TOOL_LIST.map((tool) => tool.name).join(', ')}`
        );
      printJson(
        io,
        specs.map((spec) => ({
          name: spec.name,
          title: spec.title,
          description: spec.description,
          roles: spec.roles ?? null,
          input_schema: toolInputJsonSchema(spec),
          example: spec.example ?? {},
          cli: `meter call ${spec.name}${spec.fields.map((field) => ` --${field.name.replace(/_/g, '-')} <${field.kind}>`).join('')}`
        }))
      );
      return 0;
    }
    if (!name) {
      io.stdout(`${formatApiReference()}\n\n${MCP_INSTRUCTIONS}\n`);
      return 0;
    }
    const tool = findCatalogTool(name);
    if (!tool) {
      io.stdout(`${formatApiReference(name)}\n`);
      return 2;
    }
    io.stdout(`${toolUsage(tool)}\n\n${formatApiReference(name)}\n`);
    return 0;
  }
};

export const explainCommand: CommandDefinition = {
  name: 'explain',
  summary:
    "Explain a tool's result fields: meaning, type, unit, enum values and role visibility",
  usage:
    'meter explain <tool> [<field>] [--json]\n  e.g. meter explain list_trips · meter explain list_trips total_minor · meter explain get_booking pickup.address',
  async run(ctx: CommandContext): Promise<number> {
    const { io } = ctx;
    const [name, field] = ctx.args.positionals;
    if (!name)
      throw new CliError(
        'Missing tool name.',
        2,
        'Usage: meter explain <tool> [<field>]'
      );
    const explained = explainToolData(name, field);
    if (!explained)
      throw new CliError(
        `Unknown tool "${name}".`,
        2,
        `Known tools: ${MCP_TOOL_LIST.map((tool) => tool.name).join(', ')}`
      );
    if (io.json) {
      printJson(io, {
        tool: explained.tool,
        dto: explained.dto,
        description: explained.description,
        fields: explained.fields
      });
      return 0;
    }
    io.stdout(`${explained.text}\n`);
    return 0;
  }
};
