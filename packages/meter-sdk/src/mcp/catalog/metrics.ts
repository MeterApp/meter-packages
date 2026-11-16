import * as z from "zod";
import {
  metricDimensionSchema,
  metricGrainSchema,
  metricQueryResultSchema,
  metricRegistrySchema,
} from "../../dto/metrics.ts";
import { fleetIdSchema, READ_ONLY } from "./shared.ts";
const range = {
  from: z.iso.date().describe("Inclusive calendar date."),
  to: z.iso.date().describe("Exclusive calendar date; at most 186 days."),
};
export const metricsSchemas = {
  list_metrics: z.strictObject({}),
  query_metrics: z.strictObject({
    metrics: z
      .array(z.string().min(1))
      .min(1)
      .max(5)
      .describe("One to five unique names from list_metrics."),
    scope: z
      .enum(["me", "fleet"])
      .default("me")
      .describe("Own account or authorized operational fleet."),
    fleet_id: fleetIdSchema,
    grain: metricGrainSchema
      .default("day")
      .describe(
        "Day, Monday-start week, calendar month, or whole-range total in the source timezone. Total rows use the range start as period.",
      ),
    dimension: metricDimensionSchema
      .optional()
      .describe(
        "Optional breakdown supported by every requested metric. Ledger driver and payout member breakdowns require total grain.",
      ),
    ...range,
    compare_to: z
      .strictObject(range)
      .optional()
      .describe(
        "Comparison range with the same number of calendar buckets. Whole calendar months may differ in day count; each paired partial bucket requires equal day counts, including month-to-date. Buckets align by ordinal position.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .describe(
        "Maximum result rows across metrics, periods and currencies; inspect truncated.",
      ),
  }),
} as const;
const access = {
  personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;
export const metricsTools = {
  list_metrics: {
    name: "list_metrics",
    title: "List available metrics",
    description:
      "List the fixed metric registry, source units, timezones, dimensions and aggregation rules. Use these names in query_metrics.",
    domain: "insights",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: metricsSchemas.list_metrics,
    outputSchema: metricRegistrySchema,
    returns: "MetricRegistry",
    example: {},
    annotations: READ_ONLY,
  },
  query_metrics: {
    name: "query_metrics",
    title: "Query metrics",
    description:
      "Query one to five registered metrics with a bounded range and optional comparison. Defaults to your own account; fleet scope requires an operational fleet's owner or admin. Money stays separated by currency. Null means unavailable, never zero. Read each metric's timezone, units and caveats before comparing.",
    domain: "insights",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: metricsSchemas.query_metrics,
    outputSchema: metricQueryResultSchema,
    returns: "MetricQueryResult",
    example: {
      metrics: ["ledger.gross_amount"],
      scope: "me",
      grain: "week",
      from: "2026-09-01",
      to: "2026-10-01",
      limit: 50,
    },
    annotations: READ_ONLY,
  },
} as const;
