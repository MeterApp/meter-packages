export { metricsSchemas, metricsTools } from "./catalog/metrics.ts";
export { reviewsSchemas, reviewsTools } from "./catalog/reviews.ts";
export * from "./discovery.ts";
export * from "./handoff.ts";
/**
 * Shared MCP contract for Meter: tool catalog plus tool-result helpers used by
 * every server implementation. Needs `zod` (the SDK's only peer dependency).
 */
import * as z from "zod";
import {
  DTO_DOCS,
  findFieldDocs,
  formatDtoDocs,
  type DtoDoc,
  type FieldDoc,
} from "../docs/index.ts";
import { DTO_SCHEMAS, type DtoName } from "../dto/index.ts";
import {
  isMcpToolName,
  MCP_TOOL_LIST,
  MCP_TOOLS,
  type McpToolDefinition,
  type McpToolName,
} from "./tools.ts";

export * from "./tools.ts";
export * from "./surfaces.ts";

export type McpTextContent = { type: "text"; text: string };

export type McpToolResult = {
  content: McpTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Machine-readable error codes every Meter tool error carries in structuredContent.code. */
export const MCP_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid_argument",
  "fleet_required",
  "fleet_not_operational",
  "internal_error",
  "proposal_stale",
  "proposal_expired",
  "proposal_declined",
  "proposal_mismatch",
  "proposal_not_found",
  "connection_read_only",
  "writes_disabled",
  "tool_disabled",
  "rate_limited",
] as const;
export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

/** A DTO as both compact JSON text and structured content, with a next-step hint. */
export function jsonToolResult(
  value: Record<string, unknown>,
  nextSteps?: string,
): McpToolResult {
  const text = nextSteps
    ? `${JSON.stringify(value)}\n\nNext: ${nextSteps}`
    : JSON.stringify(value);
  return { content: [{ type: "text", text }], structuredContent: value };
}

/** An `isError` result whose text tells the agent what to do next. */
export function errorToolResult(
  code: McpErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): McpToolResult {
  const text = `${message}\n\nNext: ${nextStepFor(code)}`;
  return {
    isError: true,
    content: [{ type: "text", text }],
    structuredContent: { error: message, code, ...extra },
  };
}

/** Standard guidance for error results, keyed by Meter error code. */
export function nextStepFor(code: McpErrorCode): string {
  switch (code) {
    case "proposal_stale":
    case "proposal_expired":
      return "Show the fresh proposal and its changes to the human and request confirmation again before applying.";
    case "proposal_declined":
      return "The human declined this proposal. Do not retry it; wait for a new instruction.";
    case "proposal_mismatch":
      return "The arguments do not match the saved proposal. Preview the intended values and ask for confirmation again.";
    case "proposal_not_found":
      return "Preview the intended change to obtain a proposal visible to this connection; never guess proposal ids.";
    case "connection_read_only":
      return "Ask the human to enable changes for this app in Meter Connected apps before trying a write again.";
    case "writes_disabled":
    case "tool_disabled":
      return "This operation is temporarily disabled. Tell the human; do not retry or switch tools to bypass it.";
    case "rate_limited":
      return "Wait for the indicated retry interval before trying again; do not bypass the quota with another tool or connection.";
    case "unauthenticated":
      return "The session token is missing or expired. Ask the human to reconnect the Meter connector (sign in again); never paste tokens into prompts.";
    case "forbidden":
      return 'The signed-in person\'s role does not allow this. Call whoami to see their fleets and roles, and use a tool that fits (for example get_earnings scope "me" instead of get_accounting_summary).';
    case "not_found":
      return "The id is unknown or not visible to this person. Take ids only from earlier results (list_trips, list_bookings, list_fleets); do not construct them.";
    case "invalid_argument":
      return "Fix the arguments as described and retry once. Call describe_api with the tool name to see the argument schema.";
    case "fleet_required":
      return "The person belongs to several fleets. Call list_fleets, ask which fleet they mean if unclear, and pass fleet_id.";
    case "fleet_not_operational":
      return 'The fleet has not finished onboarding or its billing is inactive, so fleet-wide data is unavailable. Own-data tools (driver="me", scope "me") still work.';
    default:
      return "Retry once if this looks transient; otherwise report the message and request_id to the human.";
  }
}

function formatToolSummary(tool: McpToolDefinition): string {
  const shape = (tool.inputSchema as z.ZodObject).shape as Record<
    string,
    z.ZodType
  >;
  const args = Object.entries(shape).map(([name, schema]) => {
    const optional = schema.safeParse(undefined).success;
    const description = schema.description ?? schema.meta()?.description ?? "";
    return `    - ${name}${optional ? "" : " (required)"}: ${description}`;
  });
  return [
    `${tool.name} — ${tool.title} [personas: ${tool.access.personas.join(", ")}; domain: ${tool.domain}; kind: ${tool.kind}; risk: ${tool.risk}${tool.returns ? `; returns: ${tool.returns}` : ""}]`,
    `  ${tool.description}`,
    ...(tool.escalate
      ? [`  sensitive when changing: ${tool.escalate.sensitive.join(", ")}`]
      : []),
    args.length ? "  arguments:" : "  arguments: none",
    ...args,
    `  example: ${JSON.stringify({ name: tool.name, arguments: tool.example })}`,
  ].join("\n");
}

/** Text catalog for `describe_api`. */
export function formatApiReference(toolName?: string): string {
  const header = [
    "Meter MCP — read tools over the signed-in person's Meter data, plus settings write tools (readOnlyHint false) that accept dry_run: true to preview changes.",
    "personas describe discovery eligibility; record permissions and subscription requirements are enforced for every call.",
    "writes: pass only the fields to change; unknown fields are rejected; results carry applied, dry_run and changes[] (field, from, to).",
    "Ids are opaque; money is in minor units (*_minor); distances in meters; durations in seconds; timestamps ISO 8601. Page with cursor/limit (<= 100).",
    "",
  ];
  if (toolName) {
    if (!isMcpToolName(toolName)) {
      return `${header.join("\n")}Unknown tool "${toolName}". Known tools:\n${MCP_TOOL_LIST.map((tool) => `  ${tool.name}`).join("\n")}`;
    }
    const tool = MCP_TOOLS[toolName] as McpToolDefinition;
    const parts = [header.join("\n"), formatToolSummary(tool)];
    if (tool.returns && tool.returns in DTO_DOCS) {
      parts.push("", formatDtoDocs(DTO_DOCS[tool.returns as DtoName]));
    }
    return parts.join("\n");
  }
  // The full reference lists what an MCP server serves; a first-party tool
  // (no surface) is still described when asked for by name.
  return (
    header.join("\n") +
    MCP_TOOL_LIST.filter((tool) => tool.surfaces?.length !== 0)
      .map(formatToolSummary)
      .join("\n\n")
  );
}

export interface ExplainDataResult {
  tool: McpToolName;
  dto: DtoName | null;
  description: string;
  fields: FieldDoc[];
  text: string;
}

/** Field documentation for `explain_data`. */
export function explainToolData(
  toolName: string,
  fieldPath?: string,
): ExplainDataResult | null {
  if (!isMcpToolName(toolName)) return null;
  const tool = MCP_TOOLS[toolName] as McpToolDefinition;
  const dtoName =
    tool.returns && tool.returns in DTO_SCHEMAS
      ? (tool.returns as DtoName)
      : null;
  if (!dtoName) {
    return {
      tool: toolName,
      dto: null,
      description: `${tool.name} returns free-form documentation text, not a data object.`,
      fields: [],
      text: `${tool.name} returns free-form documentation text, not a data object.`,
    };
  }
  const doc: DtoDoc = DTO_DOCS[dtoName];
  const fields = fieldPath ? findFieldDocs(dtoName, fieldPath) : doc.fields;
  const text = fields.length
    ? formatDtoDocs(doc, fields)
    : `${doc.name}: no field matches "${fieldPath}". Known fields:\n${doc.fields.map((fieldDoc) => `  ${fieldDoc.path}`).join("\n")}`;
  return {
    tool: toolName,
    dto: dtoName,
    description: doc.description,
    fields,
    text,
  };
}
