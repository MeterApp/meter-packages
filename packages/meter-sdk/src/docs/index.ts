/**
 * Machine-readable field documentation, generated from the zod DTO schemas.
 *
 * Every DTO field carries a `.meta({ description, roles?, unit? })` (see
 * `field()` in `dto/common.ts`). This module walks the schemas so the docs can
 * never drift from the shapes the server actually returns. `explain_data`
 * serves these to agents; the SDK test asserts every leaf has a description.
 */
import * as z from 'zod';
import { DTO_SCHEMAS, type DtoName } from '../dto/index.ts';
import type { FieldMeta } from '../dto/common.ts';

export interface FieldDoc {
  /** Dot path inside the DTO; `[]` marks array elements, e.g. `items[].pickup.address`. */
  path: string;
  /** JSON type: string, number, integer, boolean, object, array, enum, or a union like "string|null". */
  type: string;
  description: string;
  /** Allowed values for enum fields. */
  enum?: string[];
  /** Who sees the field; omitted means everyone who can see the parent object. */
  roles?: string[];
  unit?: string;
  optional: boolean;
  nullable: boolean;
}

export interface DtoDoc {
  name: DtoName;
  description: string;
  fields: FieldDoc[];
}

type AnySchema = z.ZodType;

interface Unwrapped {
  inner: AnySchema;
  optional: boolean;
  nullable: boolean;
  meta: Partial<FieldMeta>;
}

function readMeta(schema: AnySchema): Partial<FieldMeta> {
  const meta = schema.meta() as Partial<FieldMeta> | undefined;
  return meta ?? {};
}

/** Strips optional/nullable/default wrappers, keeping the first description found. */
function unwrap(schema: AnySchema): Unwrapped {
  let inner = schema;
  let optional = false;
  let nullable = false;
  let meta: Partial<FieldMeta> = readMeta(schema);
  // Bounded loop: wrappers nest a handful deep at most.
  for (let depth = 0; depth < 8; depth += 1) {
    const def = inner.def as { type: string; innerType?: AnySchema };
    if (def.type === 'optional') optional = true;
    else if (def.type === 'nullable') nullable = true;
    else if (
      def.type !== 'default' &&
      def.type !== 'readonly' &&
      def.type !== 'nonoptional'
    )
      break;
    if (!def.innerType) break;
    inner = def.innerType;
    meta = { ...readMeta(inner), ...meta };
  }
  return { inner, optional, nullable, meta };
}

function enumValues(schema: AnySchema): string[] | undefined {
  const def = schema.def as {
    type: string;
    entries?: Record<string, string | number>;
    values?: unknown[];
  };
  if (def.type === 'enum' && def.entries)
    return Object.values(def.entries).map(String);
  if (def.type === 'literal' && def.values) return def.values.map(String);
  return undefined;
}

function typeName(schema: AnySchema): string {
  const def = schema.def as {
    type: string;
    format?: string;
    options?: AnySchema[];
  };
  switch (def.type) {
    case 'number':
      return def.format === 'safeint' ||
        def.format === 'int' ||
        def.format?.endsWith('int')
        ? 'integer'
        : 'number';
    case 'enum':
    case 'literal':
      return 'enum';
    case 'union':
      return (def.options ?? [])
        .map((option) => typeName(unwrap(option).inner))
        .join('|');
    default:
      return def.type;
  }
}

function walk(schema: AnySchema, prefix: string, out: FieldDoc[]): void {
  const def = schema.def as {
    type: string;
    shape?: Record<string, AnySchema>;
    element?: AnySchema;
  };
  if (def.type === 'object' && def.shape) {
    for (const [key, child] of Object.entries(def.shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const { inner, optional, nullable, meta } = unwrap(child);
      const innerDef = inner.def as { type: string };
      const doc: FieldDoc = {
        path,
        type: typeName(inner),
        description: meta.description ?? '',
        optional,
        nullable
      };
      const values = enumValues(inner);
      if (values) doc.enum = values;
      if (meta.roles) doc.roles = [...meta.roles];
      if (meta.unit) doc.unit = meta.unit;
      out.push(doc);
      if (innerDef.type === 'object') walk(inner, path, out);
      else if (innerDef.type === 'array') {
        const element = unwrap(
          (inner.def as unknown as { element: AnySchema }).element
        ).inner;
        if ((element.def as { type: string }).type === 'object')
          walk(element, `${path}[]`, out);
      }
    }
  } else if (def.type === 'array' && def.element) {
    walk(unwrap(def.element).inner, `${prefix}[]`, out);
  }
}

/** Field docs for one schema (any zod object), paths relative to its root. */
export function describeSchema(schema: AnySchema): FieldDoc[] {
  const out: FieldDoc[] = [];
  walk(unwrap(schema).inner, '', out);
  return out;
}

export function describeDto(name: DtoName): DtoDoc {
  const schema = DTO_SCHEMAS[name] as AnySchema;
  return {
    name,
    description: readMeta(schema).description ?? '',
    fields: describeSchema(schema)
  };
}

/** Every DTO's docs, computed once. */
export const DTO_DOCS: Readonly<Record<DtoName, DtoDoc>> = Object.fromEntries(
  (Object.keys(DTO_SCHEMAS) as DtoName[]).map((name) => [
    name,
    describeDto(name)
  ])
) as Record<DtoName, DtoDoc>;

/** Look up a single field (exact path, or a path suffix such as "pickup.address"). */
export function findFieldDocs(name: DtoName, fieldPath: string): FieldDoc[] {
  const needle = fieldPath.trim().replace(/^\.+|\.+$/g, '');
  if (!needle) return DTO_DOCS[name].fields;
  return DTO_DOCS[name].fields.filter(
    (fieldDoc) =>
      fieldDoc.path === needle ||
      fieldDoc.path.endsWith(`.${needle}`) ||
      fieldDoc.path.endsWith(`[].${needle}`) ||
      fieldDoc.path.split(/\.|\[\]\./).pop() === needle
  );
}

/** Compact text rendering for tool results and llms-style docs. */
export function formatDtoDocs(
  doc: DtoDoc,
  fields: FieldDoc[] = doc.fields
): string {
  const lines = [`${doc.name}: ${doc.description}`];
  for (const fieldDoc of fields) {
    const flags = [
      fieldDoc.type + (fieldDoc.nullable ? '|null' : ''),
      fieldDoc.optional ? 'optional' : null,
      fieldDoc.unit ? `unit=${fieldDoc.unit}` : null,
      fieldDoc.roles ? `roles=${fieldDoc.roles.join(',')}` : null
    ]
      .filter(Boolean)
      .join('; ');
    const values = fieldDoc.enum
      ? ` Values: ${fieldDoc.enum.join(' | ')}.`
      : '';
    lines.push(
      `  ${fieldDoc.path} (${flags}): ${fieldDoc.description}${values}`
    );
  }
  return lines.join('\n');
}
