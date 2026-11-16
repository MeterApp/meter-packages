import { describe, expect, it } from "vitest";
import {
  AGENT_HOSTS,
  mcpServersDocument,
  renderAgentConfig,
} from "./agent-config.ts";

const origin = "https://www.meterapp.co";

describe("agent-config", () => {
  it("uses a remote http entry for OAuth-capable hosts and a stdio entry for --local", () => {
    expect(
      mcpServersDocument({ host: "claude-code", origin, local: false }),
    ).toEqual({
      mcpServers: {
        "meter-fleet": {
          type: "http",
          url: "https://www.meterapp.co/api/mcp/fleet",
        },
      },
    });
    expect(
      mcpServersDocument({ host: "claude-desktop", origin, local: true }),
    ).toEqual({
      mcpServers: {
        "meter-fleet": {
          command: "npx",
          args: ["-y", "@meterapp/meter@latest", "mcp", "--app", "fleet"],
        },
      },
    });
    expect(
      mcpServersDocument({
        host: "claude-code",
        origin: "https://staging.example",
        local: true,
      }).mcpServers["meter-fleet"],
    ).toMatchObject({ env: { METER_API_ORIGIN: "https://staging.example" } });
  });

  it("renders host-specific instructions", () => {
    const snapshots: Record<(typeof AGENT_HOSTS)[number], RegExp[]> = {
      "claude-code": [
        /claude mcp add --transport http meter-fleet https:\/\/www\.meterapp\.co\/api\/mcp\/fleet/,
        /"type": "http"/,
      ],
      "claude-desktop": [
        /Add custom connector/,
        /Remote MCP server URL: https:\/\/www\.meterapp\.co\/api\/mcp\/fleet/,
      ],
      codex: [
        /codex mcp add meter-fleet --url https:\/\/www\.meterapp\.co\/api\/mcp\/fleet/,
        /\[mcp_servers\.meter-fleet\]/,
      ],
      chatgpt: [
        /Settings → Connectors → Create/,
        /MCP server URL: https:\/\/www\.meterapp\.co\/api\/mcp\/fleet/,
      ],
      generic: [
        /Tools:.*\bwhoami\b/,
        /Tools:.*\blist_fleets\b/,
        /"command": "npx"/,
      ],
    };
    for (const host of AGENT_HOSTS) {
      const text = renderAgentConfig({ host, origin, local: false });
      for (const pattern of snapshots[host])
        expect(text, host).toMatch(pattern);
      expect(text, host).not.toMatch(/Bearer/);
    }
    expect(
      renderAgentConfig({ host: "claude-code", origin, local: true }),
    ).toMatch(
      /claude mcp add meter-fleet -- npx -y @meterapp\/meter@latest mcp --app fleet/,
    );
    expect(renderAgentConfig({ host: "codex", origin, local: true })).toMatch(
      /codex mcp add meter-fleet -- npx -y @meterapp\/meter@latest mcp --app fleet/,
    );
  });

  it("configures one server per app with its own name and URL", () => {
    expect(
      mcpServersDocument({
        host: "claude-code",
        origin,
        local: false,
        app: "rider",
      }),
    ).toEqual({
      mcpServers: {
        "meter-rides": {
          type: "http",
          url: "https://www.meterapp.co/api/mcp/rider",
        },
      },
    });
    expect(
      mcpServersDocument({ host: "codex", origin, local: true, app: "fleet" }),
    ).toEqual({
      mcpServers: {
        "meter-fleet": {
          command: "npx",
          args: ["-y", "@meterapp/meter@latest", "mcp", "--app", "fleet"],
        },
      },
    });
    expect(
      renderAgentConfig({
        host: "claude-code",
        origin,
        local: false,
        app: "fleet",
      }),
    ).toContain(
      "claude mcp add --transport http meter-fleet https://www.meterapp.co/api/mcp/fleet",
    );
    expect(
      renderAgentConfig({
        host: "claude-desktop",
        origin,
        local: false,
        app: "rider",
      }),
    ).toContain("Name: Meter Rides");
  });
});
