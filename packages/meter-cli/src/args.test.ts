import { describe, expect, it } from 'vitest';
import { flagString, parseArgs } from './args.ts';

describe('parseArgs', () => {
  it('splits command, positionals and flags', () => {
    const parsed = parseArgs([
      'trips',
      'list',
      '--limit',
      '5',
      '--json',
      '--driver=all',
      'extra'
    ]);
    expect(parsed.command).toBe('trips');
    expect(parsed.positionals).toEqual(['list', 'extra']);
    expect(parsed.flags).toEqual({ limit: '5', json: true, driver: 'all' });
  });

  it('handles --no-flag, short flags, negative numbers and --', () => {
    const parsed = parseArgs([
      'login',
      '--no-browser',
      '-hq',
      '--offset',
      '-5',
      '--',
      '--not-a-flag'
    ]);
    expect(parsed.flags).toEqual({
      browser: false,
      help: true,
      quiet: true,
      offset: '-5'
    });
    expect(parsed.positionals).toEqual(['--not-a-flag']);
  });

  it('takes a lone - as a flag value', () => {
    expect(parseArgs(['export', 'trips', '--out', '-']).flags).toEqual({
      out: '-'
    });
  });

  it('collects repeated flags into arrays', () => {
    const parsed = parseArgs([
      'bookings',
      'list',
      '--status',
      'pending',
      '--status',
      'confirmed'
    ]);
    expect(parsed.flags['status']).toEqual(['pending', 'confirmed']);
    expect(flagString(parsed.flags, 'status')).toBe('confirmed');
  });

  it('treats a value-less unknown flag as boolean and rejects unknown short flags', () => {
    expect(parseArgs(['call', 'x', '--verbose']).flags['verbose']).toBe(true);
    expect(() => parseArgs(['-z'])).toThrow(/Unknown option -z/);
  });
});
