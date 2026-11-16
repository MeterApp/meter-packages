/**
 * Generic tool surface: every tool in the SDK catalog (and any extra tool the
 * remote server advertises) becomes `meter call <name> --<field> <value>`.
 * Flag values are coerced from the zod input schema, or from the JSON schema
 * in `tools/list` for tools this CLI build does not know yet.
 */
import * as z from 'zod';
import {
  isMcpToolName,
  MCP_TOOL_LIST,
  MCP_TOOLS,
  type McpToolDefinition
} from '@meterapp/meter-sdk/mcp';
import type { McpToolDescriptor } from '@meterapp/meter-sdk/client';
import { GLOBAL_FLAGS, type FlagValue } from './args.ts';
import { CliError } from './errors.ts';

export type FieldKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'unknown';

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Element kind for arrays. */
  element?: FieldKind;
  enum?: string[];
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  fields: FieldSpec[];
  /** Present when the tool comes from the SDK catalog; used for final validation. */
  schema?: z.ZodObject;
  source: 'catalog' | 'remote';
  roles?: string;
  example?: Record<string, unknown>;
}

type Def = {
  type: string;
  innerType?: z.ZodType;
  element?: z.ZodType;
  entries?: Record<string, string | number>;
  values?: unknown[];
  format?: string;
  defaultValue?: unknown;
  checks?: Array<{ _zod?: { def?: { format?: string; check?: string } } }>;
  options?: z.ZodType[];
};

function unwrap(schema: z.ZodType): {
  inner: z.ZodType;
  optional: boolean;
  defaultValue: unknown;
  description: string;
} {
  let inner = schema;
  let optional = false;
  let defaultValue: unknown;
  let description = schema.description ?? '';
  for (let depth = 0; depth < 8; depth += 1) {
    const def = inner.def as Def;
    if (def.type === 'optional' || def.type === 'nullable') optional = true;
    else if (def.type === 'default') {
      optional = true;
      defaultValue =
        typeof def.defaultValue === 'function'
          ? (def.defaultValue as () => unknown)()
          : def.defaultValue;
    } else if (def.type !== 'readonly' && def.type !== 'nonoptional') break;
    if (!def.innerType) break;
    inner = def.innerType;
    description ||= inner.description ?? '';
  }
  return { inner, optional, defaultValue, description };
}

function kindOf(schema: z.ZodType): {
  kind: FieldKind;
  enum?: string[];
  element?: FieldKind;
} {
  const def = schema.def as Def;
  switch (def.type) {
    case 'string':
      return { kind: 'string' };
    case 'number': {
      const isInt = def.checks?.some(
        (check) =>
          check._zod?.def?.check === 'number_format' &&
          /int/.test(check._zod?.def?.format ?? '')
      );
      return {
        kind: isInt || /int/.test(def.format ?? '') ? 'integer' : 'number'
      };
    }
    case 'boolean':
      return { kind: 'boolean' };
    case 'enum':
      return {
        kind: 'enum',
        enum: Object.values(def.entries ?? {}).map(String)
      };
    case 'literal':
      return { kind: 'enum', enum: (def.values ?? []).map(String) };
    case 'array': {
      const element = def.element
        ? kindOf(unwrap(def.element).inner)
        : { kind: 'unknown' as FieldKind };
      return { kind: 'array', element: element.kind, enum: element.enum };
    }
    case 'object':
      return { kind: 'object' };
    case 'union': {
      const kinds = (def.options ?? []).map((option) =>
        kindOf(unwrap(option).inner)
      );
      const first = kinds[0];
      return kinds.every((entry) => entry.kind === first?.kind) && first
        ? first
        : { kind: 'unknown' };
    }
    default:
      return { kind: 'unknown' };
  }
}

export function fieldsFromZod(schema: z.ZodObject): FieldSpec[] {
  const shape = schema.shape as Record<string, z.ZodType>;
  return Object.entries(shape).map(([name, child]) => {
    const { inner, optional, defaultValue, description } = unwrap(child);
    const kind = kindOf(inner);
    const spec: FieldSpec = {
      name,
      kind: kind.kind,
      required: !optional,
      description
    };
    if (kind.enum) spec.enum = kind.enum;
    if (kind.element) spec.element = kind.element;
    if (defaultValue !== undefined) spec.default = defaultValue;
    return spec;
  });
}

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

function jsonKind(schema: JsonSchema): {
  kind: FieldKind;
  enum?: string[];
  element?: FieldKind;
} {
  if (Array.isArray(schema.enum))
    return { kind: 'enum', enum: schema.enum.map(String) };
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants?.length) {
    const kinds = variants
      .map(jsonKind)
      .filter((entry) => entry.kind !== 'unknown');
    if (kinds[0] && kinds.every((entry) => entry.kind === kinds[0]?.kind))
      return kinds[0];
  }
  const type = Array.isArray(schema.type)
    ? schema.type.find((entry) => entry !== 'null')
    : schema.type;
  switch (type) {
    case 'string':
      return { kind: 'string' };
    case 'integer':
      return { kind: 'integer' };
    case 'number':
      return { kind: 'number' };
    case 'boolean':
      return { kind: 'boolean' };
    case 'object':
      return { kind: 'object' };
    case 'array': {
      const element = schema.items
        ? jsonKind(schema.items)
        : { kind: 'unknown' as FieldKind };
      return { kind: 'array', element: element.kind, enum: element.enum };
    }
    default:
      return { kind: 'unknown' };
  }
}

export function fieldsFromJsonSchema(
  schema: Record<string, unknown>
): FieldSpec[] {
  const typed = schema as JsonSchema;
  const required = new Set(typed.required ?? []);
  return Object.entries(typed.properties ?? {}).map(([name, child]) => {
    const kind = jsonKind(child);
    const spec: FieldSpec = {
      name,
      kind: kind.kind,
      required: required.has(name) && child.default === undefined,
      description: child.description ?? ''
    };
    if (kind.enum) spec.enum = kind.enum;
    if (kind.element) spec.element = kind.element;
    if (child.default !== undefined) spec.default = child.default;
    return spec;
  });
}

export function catalogToolSpec(definition: McpToolDefinition): ToolSpec {
  const schema = definition.inputSchema as z.ZodObject;
  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    fields: fieldsFromZod(schema),
    schema,
    source: 'catalog',
    roles: definition.access.personas.join(', '),
    example: definition.example
  };
}

export function remoteToolSpec(descriptor: McpToolDescriptor): ToolSpec {
  return {
    name: descriptor.name,
    title: descriptor.title ?? descriptor.name,
    description: descriptor.description ?? '',
    fields: fieldsFromJsonSchema(descriptor.inputSchema ?? {}),
    source: 'remote'
  };
}

export function catalogToolSpecs(): ToolSpec[] {
  return MCP_TOOL_LIST.map(catalogToolSpec);
}

export function findCatalogTool(name: string): ToolSpec | null {
  return isMcpToolName(name)
    ? catalogToolSpec(MCP_TOOLS[name] as McpToolDefinition)
    : null;
}

/** `--fleet-id` and `--fleet_id` both address the `fleet_id` field. */
export function normalizeFlagName(flag: string): string {
  return flag.replace(/-/g, '_');
}

function coerceScalar(
  field: FieldSpec,
  kind: FieldKind,
  raw: string,
  enumValues: string[] | undefined
): unknown {
  switch (kind) {
    case 'number':
    case 'integer': {
      const value = Number(raw);
      if (!Number.isFinite(value))
        throw new CliError(
          `--${field.name} must be a number (received "${raw}")`,
          2
        );
      if (kind === 'integer' && !Number.isInteger(value))
        throw new CliError(
          `--${field.name} must be an integer (received "${raw}")`,
          2
        );
      return value;
    }
    case 'boolean': {
      const lowered = raw.trim().toLowerCase();
      if (['true', 'yes', '1', 'on'].includes(lowered)) return true;
      if (['false', 'no', '0', 'off'].includes(lowered)) return false;
      throw new CliError(
        `--${field.name} must be true or false (received "${raw}")`,
        2
      );
    }
    case 'enum': {
      if (enumValues && !enumValues.includes(raw)) {
        throw new CliError(
          `Invalid --${field.name} "${raw}". Choose one of: ${enumValues.join(', ')}`,
          2
        );
      }
      return raw;
    }
    case 'object':
    case 'unknown': {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    default:
      return raw;
  }
}

export function coerceFieldValue(field: FieldSpec, value: FlagValue): unknown {
  if (value === true) {
    if (field.kind === 'boolean') return true;
    throw new CliError(
      `Option --${field.name} requires a value`,
      2,
      describeField(field)
    );
  }
  if (value === false) {
    if (field.kind === 'boolean') return false;
    throw new CliError(
      `Option --no-${field.name} is not valid for a ${field.kind} field`,
      2
    );
  }
  if (field.kind === 'array') {
    const parts = Array.isArray(value) ? value : [value];
    const items = parts.flatMap((part) => {
      const trimmed = part.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
          // fall through to comma splitting
        }
      }
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    });
    return items.map((item) =>
      coerceScalar(field, field.element ?? 'string', item, field.enum)
    );
  }
  const raw = Array.isArray(value) ? (value[value.length - 1] ?? '') : value;
  return coerceScalar(field, field.kind, raw, field.enum);
}

export function describeField(field: FieldSpec): string {
  const type =
    field.kind === 'array' ? `${field.element ?? 'string'}[]` : field.kind;
  const values = field.enum ? ` one of ${field.enum.join('|')}` : '';
  const fallback =
    field.default !== undefined
      ? ` (default ${JSON.stringify(field.default)})`
      : '';
  return `--${field.name.replace(/_/g, '-')} <${type}>${values}${field.required ? ' (required)' : ''}${fallback}${field.description ? `  ${field.description}` : ''}`;
}

export interface BuildArgsOptions {
  /** Raw JSON object merged first (`--args '{...}'`). */
  jsonArgs?: string;
  /** Sets dry_run: true when the tool has that field, errors otherwise. */
  dryRun?: boolean;
  /** Positional values mapped onto required fields in order (aliases use this for ids). */
  positionalFields?: Record<string, string>;
}

/** Builds and validates a tool's arguments from parsed flags. */
export function buildToolArgs(
  tool: ToolSpec,
  flags: Record<string, FlagValue>,
  options: BuildArgsOptions = {}
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (options.jsonArgs) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(options.jsonArgs);
    } catch (error) {
      throw new CliError(
        `--args must be a JSON object (${error instanceof Error ? error.message : String(error)})`,
        2
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new CliError('--args must be a JSON object', 2);
    Object.assign(args, parsed as Record<string, unknown>);
  }
  const byName = new Map(tool.fields.map((field) => [field.name, field]));
  for (const [name, value] of Object.entries(options.positionalFields ?? {})) {
    const field = byName.get(name);
    args[name] = field ? coerceFieldValue(field, value) : value;
  }
  for (const [flag, value] of Object.entries(flags)) {
    if (GLOBAL_FLAGS.has(flag)) continue;
    const name = normalizeFlagName(flag);
    const field = byName.get(name);
    if (!field) {
      const known =
        tool.fields
          .map((entry) => `--${entry.name.replace(/_/g, '-')}`)
          .join(', ') || '(none)';
      throw new CliError(
        `Unknown option --${flag} for ${tool.name}.`,
        2,
        `Accepted options: ${known}. Run \`meter describe ${tool.name}\`.`
      );
    }
    args[name] = coerceFieldValue(field, value);
  }
  if (options.dryRun) {
    if (!byName.has('dry_run'))
      throw new CliError(`${tool.name} has no dry_run argument.`, 2);
    args['dry_run'] = true;
  }
  for (const field of tool.fields) {
    if (field.required && args[field.name] === undefined) {
      throw new CliError(
        `Missing required option --${field.name.replace(/_/g, '-')} for ${tool.name}.`,
        2,
        describeField(field)
      );
    }
  }
  if (tool.schema) {
    const result = tool.schema.safeParse(args);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new CliError(
        `Invalid arguments for ${tool.name}: ${issues}`,
        2,
        `Run \`meter describe ${tool.name}\` for the argument schema.`
      );
    }
    return result.data as Record<string, unknown>;
  }
  return args;
}

/** JSON Schema for a catalog tool's input (for `describe --json`). */
export function toolInputJsonSchema(tool: ToolSpec): Record<string, unknown> {
  if (!tool.schema) return {};
  return z.toJSONSchema(tool.schema) as Record<string, unknown>;
}
