import { describe, expect, it } from 'vitest';
import { createClientContext, mcpUrlFor, resolveApp } from './client.ts';
import { CliError } from './errors.ts';

describe('choosing the MCP server', () => {
  it('prefers --app, then METER_APP, then Meter for Drivers & Fleets', () => {
    expect(resolveApp({}, {})).toBe('fleet');
    expect(resolveApp({}, { METER_APP: 'rider' })).toBe('rider');
    expect(resolveApp({ app: 'fleet' }, { METER_APP: 'rider' })).toBe('fleet');
    expect(resolveApp({}, {}, 'rider')).toBe('rider');
    expect(resolveApp({ app: 'fleet' }, {}, 'rider')).toBe('fleet');
    expect(() => resolveApp({ app: 'driver' }, {})).toThrow(CliError);
  });

  it('builds the URL of each server', () => {
    expect(mcpUrlFor('https://www.meterapp.co/')).toBe(
      'https://www.meterapp.co/api/mcp/fleet'
    );
    expect(mcpUrlFor('https://www.meterapp.co', 'rider')).toBe(
      'https://www.meterapp.co/api/mcp/rider'
    );
    const context = createClientContext({ app: 'fleet' }, {});
    expect(context.app).toBe('fleet');
    expect(context.mcpUrl).toBe('https://www.meterapp.co/api/mcp/fleet');
  });
});
