import type { McpToolDefinition, McpDomain, McpToolKind } from "./tools.ts";

/** Deterministic keyword matching shared by MCP discovery and Rio tool loading. */
export function findCatalogTools(
  catalog: readonly McpToolDefinition[],
  input: {
    query: string;
    domain?: McpDomain;
    kind?: McpToolKind;
    limit?: number;
  },
): McpToolDefinition[] {
  const limit = input.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error("Invalid tool discovery limit");
  const terms = [
    ...new Set(
      input.query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    ),
  ];
  return catalog
    .filter(
      (tool) =>
        (!input.domain || tool.domain === input.domain) &&
        (!input.kind || tool.kind === input.kind),
    )
    .map((tool) => ({
      tool,
      score: terms.reduce(
        (score, term) =>
          score +
          (tool.name.includes(term)
            ? 3
            : tool.title.toLowerCase().includes(term)
              ? 2
              : tool.description.toLowerCase().includes(term)
                ? 1
                : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.tool.name.localeCompare(b.tool.name, "en"),
    )
    .slice(0, limit)
    .map((entry) => entry.tool);
}
