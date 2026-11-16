import { describe, expect, it } from 'vitest';
import {
  claudeInstalls,
  codexMarketplaces,
  METER_PLUGINS,
  refreshHostPlugins,
  type CommandRunner,
  type RunResult
} from './host-plugins.ts';

const CLAUDE_LIST = JSON.stringify([
  { id: 'supabase@claude-plugins-official', version: '0.1.15', scope: 'user' },
  { id: 'meter-fleet@meterapp-meter', version: '1.2.1', scope: 'user' }
]);

const CODEX_LIST = `Marketplace \`meterapp-meter\`
/Users/me/.codex/.tmp/marketplaces/meterapp-meter/.agents/plugins/marketplace.json

PLUGIN                STATUS              VERSION  SOURCE
meter-fleet@meterapp-meter  installed, enabled  1.2.1    /Users/me/.codex/.tmp/marketplaces/meterapp-meter
`;

function fakeRunner(answers: Record<string, RunResult>): {
  run: CommandRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const run: CommandRunner = async (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    return (
      answers[line] ?? {
        code: 127,
        stdout: '',
        stderr: `${command}: not found`
      }
    );
  };
  return { run, calls };
}

describe('host plugin installs', () => {
  it("reads Claude Code's JSON list and Codex's table", () => {
    expect(claudeInstalls(CLAUDE_LIST, 'meter-fleet')).toEqual([
      {
        id: 'meter-fleet@meterapp-meter',
        marketplace: 'meterapp-meter',
        scope: 'user'
      }
    ]);
    expect(claudeInstalls('not json', 'meter-fleet')).toEqual([]);
    expect(codexMarketplaces(CODEX_LIST, 'meter-fleet')).toEqual(['meterapp-meter']);
    expect(codexMarketplaces(CODEX_LIST, 'car-image')).toEqual([]);
  });

  it('refreshes the marketplace, then the plugin, in each host that has it', async () => {
    const { run, calls } = fakeRunner({
      'claude plugin list --json': { code: 0, stdout: CLAUDE_LIST, stderr: '' },
      'claude plugin marketplace update meterapp-meter --json': {
        code: 0,
        stdout: '',
        stderr: ''
      },
      'claude plugin update meter-fleet@meterapp-meter --json --scope user': {
        code: 0,
        stdout:
          '{"command":"update","outcome":"updated","message":"Updated meter from 1.2.1 to 1.2.2"}\n',
        stderr: ''
      },
      'codex plugin list': { code: 0, stdout: CODEX_LIST, stderr: '' },
      'codex plugin marketplace upgrade meterapp-meter': {
        code: 0,
        stdout: 'Upgraded marketplace `meterapp-meter`\n',
        stderr: ''
      }
    });
    expect(await refreshHostPlugins(METER_PLUGINS, run)).toEqual([
      {
        host: 'Claude Code',
        id: 'meter-fleet@meterapp-meter',
        ok: true,
        detail: 'Updated meter from 1.2.1 to 1.2.2'
      },
      {
        host: 'Codex',
        id: 'meter-fleet@meterapp-meter',
        ok: true,
        detail: 'Upgraded marketplace `meterapp-meter`'
      }
    ]);
    expect(calls).toEqual([
      'claude plugin list --json',
      'claude plugin marketplace update meterapp-meter --json',
      'claude plugin update meter-fleet@meterapp-meter --json --scope user',
      'codex plugin list',
      'codex plugin marketplace upgrade meterapp-meter'
    ]);
  });

  it('skips a host that is missing or lacks the plugin, and reports a marketplace that failed', async () => {
    expect(await refreshHostPlugins(METER_PLUGINS, fakeRunner({}).run)).toEqual(
      []
    );
    const { run } = fakeRunner({
      'claude plugin list --json': { code: 0, stdout: CLAUDE_LIST, stderr: '' },
      'claude plugin marketplace update meterapp-meter --json': {
        code: 1,
        stdout:
          '{"outcome":"failed","message":"could not fetch MeterApp/meter-plugins"}\n',
        stderr: ''
      }
    });
    expect(await refreshHostPlugins(METER_PLUGINS, run)).toEqual([
      {
        host: 'Claude Code',
        id: 'meter-fleet@meterapp-meter',
        ok: false,
        detail:
          'marketplace meterapp-meter: could not fetch MeterApp/meter-plugins'
      }
    ]);
  });

  it('points an install of the retired combined plugin at its replacements', async () => {
    const { run, calls } = fakeRunner({
      'claude plugin list --json': {
        code: 0,
        stdout: JSON.stringify([
          { id: 'meter@meterapp-meter', version: '1.5.3', scope: 'user' }
        ]),
        stderr: ''
      },
      'codex plugin list': {
        code: 0,
        stdout: 'meter@meterapp-meter  installed, enabled  1.5.3    /x\n',
        stderr: ''
      }
    });
    const detail =
      'replaced by meter-fleet and meter-rides: uninstall meter@meterapp-meter, then install either or both';
    expect(await refreshHostPlugins(METER_PLUGINS, run)).toEqual([
      {
        host: 'Claude Code',
        id: 'meter@meterapp-meter',
        ok: false,
        detail
      },
      { host: 'Codex', id: 'meter@meterapp-meter', ok: false, detail }
    ]);
    expect(calls).toEqual(['claude plugin list --json', 'codex plugin list']);
  });
});
