import { MCP_DOMAINS } from "./types.ts";
import * as z from "zod";
import {
  changeRequestPageSchema,
  listChangeRequestsInputSchema,
  whoamiSchema,
} from "../../dto/index.ts";
import { READ_ONLY } from "./shared.ts";
import { SDK_VERSION } from "../../version.ts";

export const MCP_SERVER_INFO = {
  name: "meter",
  title: "Meter",
  version: SDK_VERSION,
  websiteUrl: "https://www.meterapp.co",
} as const;

export const MCP_SCOPES_SUPPORTED = ["openid", "email", "profile"] as const;

const CONVENTIONS = `Conventions: every id is opaque; never guess or construct one, take ids from earlier results. Money is in the currency's minor unit (\`*_minor\`) unless a field says otherwise; fare rates are in major units (3.50 = $3.50) as shown in the console; distances are meters; durations are seconds; timestamps are ISO 8601. Lists are paginated: pass \`cursor\` from a result back in to get the next page, keep \`limit\` at or below 100. When a person belongs to exactly one fleet you may omit \`fleet_id\`; otherwise ask which fleet they mean or call \`list_fleets\`.`;

const WRITES = `Write tools always require a saved preview. Call with \`dry_run: true\` to validate and authorize the request and get exact \`changes\` (field, from, to) and a \`proposal\`, WITHOUT writing. A first call without dry_run also writes nothing and returns \`confirmation_required\`. Show the human every proposed change and ask for confirmation; always show sensitive changes in full. Then repeat the original intended arguments with \`proposal_id\` and \`dry_run: false\`. Older clients can repeat identical arguments without proposal_id. If the proposal expires or its basis changes, show the fresh proposal and ask again. Applied proposals replay their saved result without writing twice. Only pass intended fields; omitted fields stay unchanged and unknown fields are rejected. Fleet-scoped writes require owner/admin rights and also work during fleet setup; profile and availability writes affect only the caller. Every write runs with the signed-in person's permissions.`;

const PRIVACY = `Privacy: results already exclude payment-provider ids, GPS traces, internal notes and other people's contact details beyond what the fleet role allows. Do not try to infer them. Present money and times in the fleet's currency and timezone when talking to a human.`;

/** The combined server at /api/mcp: every tool the caller's personas allow. */
export const MCP_INSTRUCTIONS = [
  `Meter is the taxi meter and fleet platform: drivers run a meter in the Meter app, fleets (taxi companies) manage drivers, vehicles, fares, scheduled bookings and money, and riders book rides from fleets. This server gives an AI agent access to the data the signed-in person may already see in the Meter apps, plus write tools that change only what that person may already change in the apps, each after a saved preview and explicit confirmation. Riders can request rides for themselves and cancel their own rides; fleet staff can cancel bookings they manage. Nothing here moves money: when a fleet takes payment at booking, request_ride returns a Meter checkout link where the rider confirms and pays (accepting a paid quote, or a ride change that raises the card hold, returns a Meter page link the same way) (only Meter's own apps hold the rider's saved card directly), and a cancellation fee is whatever the fleet's policy sets. Cards, bank authentication and refunds stay in Meter through hand-off links. Website tools can create, update or delete public pages after a saved preview and explicit confirmation.`,
  `Roles: a person may belong to fleets as owner (controls billing and everything below), admin (manages members, vehicles, bookings, accounting, settings) or driver (sees only their own trips, bookings and earnings; edits only their own profile and availability). A person may also be a rider (sees and manages only their own rides: \`find_fleets\`, \`search_places\`, \`estimate_ride\`, \`request_ride\`, \`get_ride_status\`, \`list_bookings\`, \`cancel_booking\`). Fleet admin tools return an error for drivers; the error text says why.`,
  `How to start: call \`whoami\` first. It tells you who is signed in, which fleets they belong to and with which role, and which tools make sense next. Every authorized operation is advertised by \`tools/list\` with its own schema and annotations; call the relevant tool directly. Call \`describe_api\` for the domain index (pass domain to browse tools, or tool for detail), and \`explain_data\` (tool + optional field) for the meaning, units and enum values of any field.`,
  CONVENTIONS,
  WRITES,
  `Onboarding: for a new fleet call \`get_onboarding_checklist\`. It lists the setup steps (profile, service area, ride option and fares, booking settings, vehicles, drivers, payouts, booking link, first booking), which are done, and for each open step the tool that completes it or the web page to send the human to. Work through required items first.`,
  PRIVACY,
].join("\n\n");

/** The rider server at /api/mcp/rider: what a rider does in the Meter Rider app and on fleet booking pages. */
export const MCP_RIDER_INSTRUCTIONS = [
  `Meter Rides books taxi rides with Meter fleets (taxi companies) for the signed-in rider: find fleets near a place, price a ride, request it, track it, and review or cancel the rider's own bookings and quotes. Every tool acts only on the rider's own rides, with the rider's own permissions. Nothing here moves money: when a fleet takes payment at booking, request_ride returns a Meter checkout link where the rider confirms and pays (accepting a paid quote, or a ride change that raises the card hold, returns a Meter page link the same way) (only Meter's own apps hold the rider's saved card directly), and a cancellation fee is whatever the fleet's policy sets. Cards stay in Meter through hand-off links (get_action_link). Driver and fleet tools are on the separate Meter for Drivers & Fleets server (/api/mcp/fleet).`,
  `How to start: call \`whoami\` to see who is signed in. To book: \`find_fleets\` near the pickup, \`search_places\` when an address is ambiguous, \`estimate_ride\` for prices and ride options, then \`request_ride\`. Follow a ride with \`get_ride_status\`; \`list_bookings\` and \`get_booking\` show the rider's rides, \`list_quotes\` and \`get_quote\` the quotes fleets sent them, and \`respond_to_quote\` accepts or declines one. \`change_ride\` changes a booking's time or route, \`update_ride_details\` its driver notes or flight number, and \`cancel_booking\` cancels it, each after a saved preview. After a ride, \`get_rating_prompt\` and \`rate_ride\` rate it, \`report_ride_issue\` reports a problem to Meter, and \`get_action_link\` tip_ride gives the Meter page where the rider tips. Every available operation is listed as a separate tool with its input schema and annotations; call it directly. \`describe_api\` and \`explain_data\` explain arguments and fields.`,
  CONVENTIONS,
  WRITES,
  PRIVACY,
].join("\n\n");

/** The driver and fleet server at /api/mcp/fleet: what drivers do in the Meter app and fleet staff in the console. */
export const MCP_FLEET_INSTRUCTIONS = [
  `Meter for Drivers & Fleets is the taxi meter and fleet platform: drivers run a meter in the Meter app, fleets (taxi companies) manage drivers, vehicles, fares, scheduled bookings, quotes, invoices, their booking website and money. This server gives an AI agent access to the data the signed-in driver or fleet member may already see in the Meter app and console, plus write tools that change only what that person may already change there, each after a saved preview and explicit confirmation. Nothing here moves money: cards, payouts, bank authentication and refunds stay in Meter through hand-off links (get_action_link). Booking rides as a rider is on the separate Meter Rides server (/api/mcp/rider).`,
  `Roles: a person may belong to fleets as owner (controls billing and everything below), admin (manages members, vehicles, bookings, accounting, settings) or driver (sees only their own trips, bookings and earnings; edits only their own profile and availability). A driver without a fleet is a solo driver with their own fares, bookings and earnings. Fleet admin tools return an error for drivers; the error text says why.`,
  `How to start: call \`whoami\` first. It tells you who is signed in, which fleets they belong to and with which role, and which tools make sense next. Every authorized operation is advertised by \`tools/list\` with its own schema and annotations; call the relevant tool directly. Call \`describe_api\` for the domain index (pass domain to browse tools, or tool for detail), and \`explain_data\` (tool + optional field) for the meaning, units and enum values of any field.`,
  CONVENTIONS,
  WRITES,
  `Onboarding: for a new fleet call \`get_onboarding_checklist\`. It lists the setup steps (profile, service area, ride option and fares, booking settings, vehicles, drivers, payouts, booking link, first booking), which are done, and for each open step the tool that completes it or the web page to send the human to. Work through required items first.`,
  PRIVACY,
].join("\n\n");

export const metaSchemas = {
  find_tools: z.strictObject({
    query: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .describe("English keywords for tool names, titles and descriptions."),
    domain: z
      .enum(MCP_DOMAINS)
      .optional()
      .describe(
        "Optional domain filter; omit to search every authorized domain.",
      ),
    kind: z
      .enum(["read", "write", "handoff"])
      .optional()
      .describe("Optional operation kind; discovery does not execute it."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum matches, 1-20; defaults to 10."),
  }),
  run_read_tool: z.strictObject({
    tool: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe(
        "Concrete tool name returned by find_tools; nested dispatch is refused.",
      ),
    arguments: z
      .record(z.string(), z.unknown())
      .describe(
        "Original target arguments. Write preview and confirmation fields, including dry_run and proposal_id, belong inside this object.",
      ),
  }),
  run_write_tool: z.strictObject({
    tool: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe(
        "Concrete tool name returned by find_tools; nested dispatch is refused.",
      ),
    arguments: z
      .record(z.string(), z.unknown())
      .describe(
        "Original target arguments. Write preview and confirmation fields, including dry_run and proposal_id, belong inside this object.",
      ),
  }),
  list_change_requests: listChangeRequestsInputSchema,
  whoami: z.object({}),
  describe_api: z.object({
    domain: z
      .enum(MCP_DOMAINS)
      .optional()
      .describe(
        "A domain whose tools should be described. Choose domain or tool; omit both for the compact domain index.",
      ),
    tool: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe(
        "A tool name to describe in detail (arguments, personas, risk, example call, result fields). Choose tool or domain; omit both for the domain index.",
      ),
  }),
  explain_data: z.object({
    tool: z
      .string()
      .min(1)
      .max(80)
      .describe('The tool whose result you want explained, e.g. "list_trips".'),
    field: z
      .string()
      .min(1)
      .max(160)
      .optional()
      .describe(
        'A field name or dot path inside the result, e.g. "total_minor" or "items.pickup.address". Omit for every field.',
      ),
  }),
} as const;

export const metaTools = {
  find_tools: {
    name: "find_tools",
    title: "Find Meter tools",
    description:
      "Find authorized Meter tools by keywords, optionally narrowed to a domain or operation kind. Includes on-demand tools and returns bounded names, titles, risks and descriptions. Discovery does not grant access or execute a tool; call the matching run tool with the target's arguments.",
    domain: "meta",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    kind: "read",
    risk: "none",
    inputSchema: metaSchemas.find_tools,
    outputSchema: z.object({
      tools: z
        .array(
          z.object({
            name: z.string(),
            title: z.string(),
            kind: z.enum(["read", "write", "handoff"]),
            risk: z.enum(["none", "low", "standard", "sensitive"]),
            domain: z.enum(MCP_DOMAINS),
            description: z.string(),
          }),
        )
        .max(20),
    }),
    example: { query: "booking settings", limit: 10 },
    annotations: READ_ONLY,
  },
  run_read_tool: {
    name: "run_read_tool",
    title: "Run a Meter read tool",
    description:
      "Execute a discovered read tool with its original arguments. The target's input validation, account and record permissions, kill switch, read quota and output limits still apply. Refuses writes, handoffs and nested dispatch tools; discovery never authorizes a hidden target.",
    domain: "meta",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    kind: "read",
    risk: "none",
    inputSchema: metaSchemas.run_read_tool,
    example: { tool: "get_fleet", arguments: {} },
    annotations: READ_ONLY,
  },
  run_write_tool: {
    name: "run_write_tool",
    title: "Run a Meter write tool",
    description:
      "Execute a discovered write tool with its original arguments through the normal guarded saved-proposal flow. Preview with arguments.dry_run=true and show all changes; confirmation requires the target's saved proposal. Target permissions, connection grants, quotas and kill switches still apply. Refuses reads, handoffs and nested dispatch tools.",
    domain: "meta",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    kind: "write",
    risk: "sensitive",
    inputSchema: metaSchemas.run_write_tool,
    example: {
      tool: "update_my_profile",
      arguments: { first_name: "Ada", dry_run: true },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  list_change_requests: {
    name: "list_change_requests",
    title: "List my assistant changes",
    description:
      "Read the signed-in person’s assistant change history. Filter by exact proposal id, status, tool, or creation time; use the returned cursor for older entries. Fleet owners cannot read another person’s assistant history. Returns previewed field changes and safe outcome metadata, never stored tool input, internal identifiers, raw results or internal errors. This read does not confirm or repeat a change.",
    domain: "meta",
    kind: "read",
    risk: "none",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: metaSchemas.list_change_requests,
    outputSchema: changeRequestPageSchema,
    returns: "ChangeRequestPage",
    example: { limit: 25 },
    annotations: READ_ONLY,
  },

  whoami: {
    name: "whoami",
    title: "Who am I",
    description:
      "Call this first. Returns the signed-in person: profile (their own name, email and phone), every fleet they belong to with their role (owner, admin or driver), whether they are a rider, a plain-language list of what they can read here, and suggested_next_tools. Use it to decide which fleet_id to use and which tools apply; do not call it repeatedly in one session. Any signed-in user may call it.",
    domain: "meta",
    kind: "read",
    risk: "none",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: metaSchemas.whoami,
    outputSchema: whoamiSchema,
    returns: "Whoami",
    example: {},
    annotations: READ_ONLY,
  },
  describe_api: {
    name: "describe_api",
    title: "Describe the Meter MCP API",
    description:
      "Read API documentation only; never executes another tool or changes account data. Every authorized operation is advertised separately by tools/list with its own input schema and annotations. Without arguments returns a compact domain index with tool counts and listed tool names. With domain, describes that domain's tools, access, risk and sensitive-field escalations. With tool, returns full detail including arguments, an example call and result fields. Choose domain or tool. Responses are capped at 64 KB; use explain_data with a tool and field for more focused result-field documentation. Free and available to any signed-in user.",
    domain: "meta",
    kind: "read",
    risk: "none",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: metaSchemas.describe_api,
    example: { tool: "list_trips" },
    annotations: READ_ONLY,
  },
  explain_data: {
    name: "explain_data",
    title: "Explain result fields",
    description:
      "Self-documentation for data. Given a tool name (and optionally a field name or dot path) returns the meaning, JSON type, unit (minor currency units, seconds, meters, ISO 8601), allowed enum values and role visibility of the fields in that tool's result, generated from the same schemas the server validates against. Use it before interpreting money, statuses or timestamps for a human. Free and available to any signed-in user.",
    domain: "meta",
    kind: "read",
    risk: "none",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: metaSchemas.explain_data,
    example: { tool: "list_trips", field: "total_minor" },
    annotations: READ_ONLY,
  },
} as const;
