/**
 * Human-readable rendering of MCP tool results: pages become tables, single
 * objects become key/value blocks, and the server's "Next:" hint is kept.
 */
import type { McpCallToolResult } from '@meterapp/meter-sdk/client';
import { keyValues, paint, table, type Io } from './output.ts';

export interface ParsedToolResult {
  data: Record<string, unknown> | null;
  text: string;
  nextSteps: string | null;
  isError: boolean;
}

export function parseToolResult(result: McpCallToolResult): ParsedToolResult {
  const text = (result.content ?? [])
    .filter((entry) => entry.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text as string)
    .join('\n');
  let data: Record<string, unknown> | null = result.structuredContent ?? null;
  let nextSteps: string | null = null;
  const marker = text.lastIndexOf('\n\nNext: ');
  if (marker >= 0) nextSteps = text.slice(marker + 8).trim();
  if (!data) {
    const jsonText = marker >= 0 ? text.slice(0, marker) : text;
    try {
      const parsed: unknown = JSON.parse(jsonText.trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  return { data, text, nextSteps, isError: result.isError === true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Flattens one level of nested objects into `parent.child` columns; deeper values are JSON. */
export function flattenRow(
  row: Record<string, unknown>,
  maxDepth = 1
): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  const visit = (
    value: Record<string, unknown>,
    prefix: string,
    depth: number
  ) => {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        isPlainObject(child) &&
        depth < maxDepth &&
        Object.keys(child).length > 0
      )
        visit(child, path, depth + 1);
      else out.push([path, child]);
    }
  };
  visit(row, '', 0);
  return out;
}

export function renderItems(items: unknown[], io: Pick<Io, 'color'>): string {
  const rows = items.filter(isPlainObject);
  if (rows.length === 0) return paint(io, 'dim', '(no items)');
  const columns: string[] = [];
  const flattened = rows.map((row) => {
    const entries = flattenRow(row);
    for (const [key] of entries) if (!columns.includes(key)) columns.push(key);
    return new Map(entries);
  });
  const body = flattened.map((row) =>
    columns.map((column) => truncate(formatScalar(row.get(column)), 48))
  );
  return table(body, columns);
}

function truncate(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
}

export function renderObject(
  data: Record<string, unknown>,
  io: Pick<Io, 'color'>
): string {
  const sections: string[] = [];
  const scalars: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) scalars.push([key, paint(io, 'dim', '(none)')]);
      else if (value.every(isPlainObject))
        sections.push(`${paint(io, 'bold', key)}\n${renderItems(value, io)}`);
      else scalars.push([key, value.map(formatScalar).join(', ')]);
    } else if (isPlainObject(value)) {
      const nested = flattenRow(value, 2).map(
        ([path, child]) =>
          [`${key}.${path}`, formatScalar(child)] as [string, string]
      );
      scalars.push(...nested);
    } else {
      scalars.push([key, formatScalar(value)]);
    }
  }
  const head = scalars.length ? keyValues(io, scalars) : '';
  return [head, ...sections].filter(Boolean).join('\n\n');
}

/** Readable rendering of a successful tool result. */
export function renderToolResult(
  parsed: ParsedToolResult,
  io: Pick<Io, 'color'>
): string {
  const { data } = parsed;
  if (!data) return parsed.text || paint(io, 'dim', '(empty result)');
  const items = data['items'];
  const lines: string[] = [];
  if (Array.isArray(items)) {
    lines.push(renderItems(items, io));
    const rest = Object.entries(data).filter(([key]) => key !== 'items');
    const cursor = data['next_cursor'];
    const footer = rest
      .filter(([key]) => key !== 'next_cursor')
      .map(([key, value]) => `${key}: ${formatScalar(value)}`);
    footer.unshift(`${items.length} item${items.length === 1 ? '' : 's'}`);
    if (typeof cursor === 'string' && cursor)
      footer.push(`more: pass --cursor ${cursor}`);
    lines.push(paint(io, 'dim', footer.join(' · ')));
  } else {
    lines.push(renderObject(data, io));
  }
  if (parsed.nextSteps)
    lines.push(paint(io, 'dim', `Next: ${parsed.nextSteps}`));
  return lines.join('\n');
}
