import { describe, expect, it } from 'vitest';
import {
  buildToolArgs,
  catalogToolSpecs,
  fieldsFromJsonSchema,
  findCatalogTool,
  remoteToolSpec,
  type ToolSpec
} from './tools.ts';

describe('catalog-driven coercion', () => {
  it('exposes every catalog tool with typed fields', () => {
    const specs = catalogToolSpecs();
    expect(specs.map((spec) => spec.name)).toContain('list_trips');
    const trips = specs.find((spec) => spec.name === 'list_trips');
    const limit = trips?.fields.find((field) => field.name === 'limit');
    expect(limit).toMatchObject({
      kind: 'integer',
      required: false,
      default: 50
    });
    const bookings = specs.find((spec) => spec.name === 'list_bookings');
    expect(
      bookings?.fields.find((field) => field.name === 'status')
    ).toMatchObject({ kind: 'array', element: 'enum' });
    expect(
      bookings?.fields.find((field) => field.name === 'sort')?.enum
    ).toEqual(['asc', 'desc']);
  });

  it('coerces numbers, booleans, enums, arrays and dates from flags', () => {
    const tool = findCatalogTool('list_bookings') as ToolSpec;
    const args = buildToolArgs(tool, {
      'fleet-id': '11111111-1111-4111-8111-111111111111',
      status: ['pending', 'confirmed,in_progress'],
      after: '2026-09-11',
      sort: 'asc',
      limit: '10'
    });
    expect(args).toEqual({
      fleet_id: '11111111-1111-4111-8111-111111111111',
      status: ['pending', 'confirmed', 'in_progress'],
      after: '2026-09-11',
      sort: 'asc',
      limit: 10,
      scope: 'auto'
    });
    const earnings = findCatalogTool('get_earnings') as ToolSpec;
    expect(
      buildToolArgs(earnings, { 'include-members': 'true', scope: 'fleet' })
    ).toMatchObject({
      include_members: true,
      scope: 'fleet',
      granularity: 'day'
    });
    expect(buildToolArgs(earnings, { 'include-members': true })).toMatchObject({
      include_members: true
    });
  });

  it('rejects bad values with usage errors', () => {
    const tool = findCatalogTool('list_trips') as ToolSpec;
    expect(() => buildToolArgs(tool, { limit: 'abc' })).toThrow(
      /--limit must be a number/
    );
    expect(() => buildToolArgs(tool, { limit: '500' })).toThrow(
      /Invalid arguments for list_trips: limit/
    );
    expect(() => buildToolArgs(tool, { bogus: '1' })).toThrow(
      /Unknown option --bogus/
    );
    expect(() =>
      buildToolArgs(findCatalogTool('list_bookings') as ToolSpec, {
        sort: 'sideways'
      })
    ).toThrow(/Choose one of: asc, desc/);
    expect(() =>
      buildToolArgs(findCatalogTool('get_trip') as ToolSpec, {})
    ).toThrow(/Missing required option --trip-id/);
    expect(() => buildToolArgs(tool, {}, { dryRun: true })).toThrow(
      /has no dry_run argument/
    );
  });

  it('merges --args JSON first and lets flags override', () => {
    const tool = findCatalogTool('list_trips') as ToolSpec;
    expect(
      buildToolArgs(
        tool,
        { limit: '3' },
        { jsonArgs: '{"driver":"all","limit":99}' }
      )
    ).toMatchObject({ driver: 'all', limit: 3 });
    expect(() => buildToolArgs(tool, {}, { jsonArgs: '[1]' })).toThrow(
      /JSON object/
    );
  });

  it('ignores global CLI flags and maps positionals onto fields', () => {
    const tool = findCatalogTool('get_booking') as ToolSpec;
    const args = buildToolArgs(
      tool,
      { json: true, api: 'http://x', token: 't' },
      {
        positionalFields: { booking_id: '33333333-3333-4333-8333-333333333333' }
      }
    );
    expect(args).toEqual({
      booking_id: '33333333-3333-4333-8333-333333333333'
    });
  });
});

describe('remote (future) tools from JSON schema', () => {
  const descriptor = {
    name: 'update_booking_notes',
    description: 'writes notes',
    inputSchema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string' },
        notes: { type: 'string' },
        priority: { type: 'integer', default: 1 },
        tags: {
          type: 'array',
          items: { type: 'string', enum: ['vip', 'late'] }
        },
        dry_run: { type: 'boolean', default: false }
      },
      required: ['booking_id', 'notes']
    }
  };

  it('derives fields with required/default/enum info', () => {
    const fields = fieldsFromJsonSchema(descriptor.inputSchema);
    expect(fields.find((field) => field.name === 'booking_id')).toMatchObject({
      kind: 'string',
      required: true
    });
    expect(fields.find((field) => field.name === 'priority')).toMatchObject({
      kind: 'integer',
      required: false,
      default: 1
    });
    expect(fields.find((field) => field.name === 'tags')).toMatchObject({
      kind: 'array',
      element: 'enum',
      enum: ['vip', 'late']
    });
  });

  it('coerces flags and passes --dry-run through', () => {
    const tool = remoteToolSpec(descriptor);
    const args = buildToolArgs(
      tool,
      {
        'booking-id': 'b1',
        notes: 'call ahead',
        priority: '2',
        tags: 'vip,late'
      },
      { dryRun: true }
    );
    expect(args).toEqual({
      booking_id: 'b1',
      notes: 'call ahead',
      priority: 2,
      tags: ['vip', 'late'],
      dry_run: true
    });
    expect(() =>
      buildToolArgs(tool, { 'booking-id': 'b1', notes: 'x', tags: 'unknown' })
    ).toThrow(/Choose one of: vip, late/);
  });
});
