import * as z from "zod";
import {
  fareReadSchema,
  fareReadPageSchema,
  fareAuditPageSchema,
} from "../../dto/index.ts";
import { READ_ONLY, limitSchema, cursorSchema } from "./shared.ts";
const scope = {
  scope: z
    .enum(["me", "fleet"])
    .default("me")
    .describe("Own inventory or the selected fleet."),
  fleet_id: z
    .string()
    .uuid()
    .optional()
    .describe("Fleet for fleet scope; omit only with exactly one membership."),
  source: z
    .enum(["custom", "saved_official"])
    .default("custom")
    .describe(
      "Custom inventory or saved official tariffs. Inactive saved tariffs remain readable.",
    ),
};
export const fareReadSchemas = {
  list_fares: z.strictObject({
    ...scope,
    limit: limitSchema,
    cursor: cursorSchema,
  }),
  get_fare: z.strictObject({
    ...scope,
    fare_id: z.string().uuid().describe("Fare id from list_fares."),
  }),
  get_fare_audit_log: z.strictObject({
    ...scope,
    fare_id: z.string().uuid().describe("Current custom fare id."),
    limit: limitSchema,
    cursor: cursorSchema,
  }),
};
const access = {
  personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;
export const fareReadTools = {
  list_fares: {
    name: "list_fares",
    title: "List fares",
    description:
      "List a bounded page of own or fleet custom fares, or saved official tariffs. Drivers cannot see hidden fleet fares. Headline rates may not describe advanced pricing; inspect get_fare.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "listed",
    inputSchema: fareReadSchemas.list_fares,
    outputSchema: fareReadPageSchema,
    returns: "FareReadPage",
    example: { scope: "me", source: "custom", limit: 50 },
    annotations: READ_ONLY,
  },
  get_fare: {
    name: "get_fare",
    title: "Get fare pricing",
    description:
      "Read full supported pricing for an authorized current custom fare or saved official tariff. No currency guessing or read-side mutation. Unsupported legacy models are explicitly identified.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fareReadSchemas.get_fare,
    outputSchema: fareReadSchema,
    returns: "FareRead",
    example: { fare_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  get_fare_audit_log: {
    name: "get_fare_audit_log",
    title: "Get fare pricing history",
    description:
      "Read bounded pricing-only history of an authorized current custom fare. Stops at ownership or driver-visibility changes. Deleted-fare ownership cannot be established from legacy logs; saved tariff ingest history is private.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fareReadSchemas.get_fare_audit_log,
    outputSchema: fareAuditPageSchema,
    returns: "FareAuditPage",
    example: { fare_id: "11111111-1111-4111-8111-111111111111", limit: 50 },
    annotations: READ_ONLY,
  },
} as const;
