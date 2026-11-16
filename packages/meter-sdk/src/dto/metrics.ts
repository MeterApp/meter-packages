import * as z from "zod";
import { currencyCodeSchema, field, opaqueIdSchema } from "./common.ts";

export const metricGrainSchema = z.enum(["day", "week", "month", "total"]);
export const metricDimensionSchema = z.enum([
  "currency",
  "surface",
  "channel",
  "cta",
  "driver",
  "member",
  "page",
  "query",
]);
export const metricUnitSchema = z.enum([
  "count",
  "minor_currency_units",
  "currency_units",
  "seconds",
  "meters",
  "ratio",
  "position",
  "minor_currency_units_per_hour",
]);
export const metricDefinitionSchema = z
  .strictObject({
    name: field(z.string(), "Fixed metric name accepted by query_metrics."),
    label: field(z.string(), "Human-readable metric label."),
    unit: field(
      metricUnitSchema,
      "Unit of each value; monetary values retain their currency.",
    ),
    timezone: field(
      z.enum(["UTC", "America/Los_Angeles"]),
      "Reporting calendar timezone for source dates.",
    ),
    source: field(
      z.enum([
        "ledger",
        "payouts",
        "bookings",
        "storefront",
        "driver_activity",
        "search",
      ]),
      "Authoritative source for this metric.",
    ),
    grains: field(
      z.array(metricGrainSchema),
      "Supported time bucket sizes; weeks begin Monday in the source reporting calendar.",
    ),
    dimensions: field(
      z.array(metricDimensionSchema),
      "Supported optional breakdowns.",
    ),
    additive: field(
      z.boolean(),
      "Whether values can be summed across time. Never sum money across currencies.",
    ),
    scopes: field(
      z.array(z.enum(["me", "fleet"])),
      "Own-account or authorized fleet scopes supported by this source.",
    ),
  })
  .meta({
    description:
      "One metric in the fixed registry; no arbitrary SQL or column selection.",
  });
export const metricRegistrySchema = z
  .strictObject({
    items: field(
      z.array(metricDefinitionSchema),
      "Available fixed metrics and supported aggregations.",
    ),
  })
  .meta({ description: "Result of list_metrics." });

export const metricRowSchema = z
  .strictObject({
    metric: field(z.string(), "Registry metric name."),
    period: field(
      z.string(),
      "Bucket start (ISO date) in the metric reporting calendar. A boundary bucket may contain only the requested portion. For total grain, period is the inclusive range start.",
    ),
    currency: field(
      currencyCodeSchema.nullable(),
      "Currency for money and currency-separated ledger rows, otherwise null.",
    ),
    dimension_value: field(
      z.string().nullable(),
      "Value of the requested breakdown, otherwise null.",
    ),
    value: field(
      z.number().finite().nullable(),
      "Metric value, or null when unavailable or unsafe to aggregate. Null is not zero.",
    ),
    comparison_value: field(
      z.number().finite().nullable(),
      "Value in the corresponding comparison bucket, or null when absent or unavailable.",
    ),
  })
  .meta({
    description: "One metric bucket, with optional aligned comparison.",
  });
export const metricQueryResultSchema = z
  .strictObject({
    scope: field(
      z.enum(["me", "fleet"]),
      "Authorization scope used for every source query.",
    ),
    fleet_id: field(
      opaqueIdSchema.nullable(),
      "Authorized fleet, or null for own-account metrics.",
    ),
    from: field(
      z.string(),
      "Inclusive date in each metric reporting calendar.",
    ),
    to: field(z.string(), "Exclusive date in each metric reporting calendar."),
    compare_to: field(
      z
        .strictObject({
          from: field(
            z.string(),
            "Inclusive comparison date in each metric reporting calendar.",
          ),
          to: field(
            z.string(),
            "Exclusive comparison date in each metric reporting calendar.",
          ),
        })
        .nullable(),
      "Comparison date range, or null when no comparison was requested.",
    ),
    grain: field(metricGrainSchema, "Requested time grain."),
    dimension: field(
      metricDimensionSchema.nullable(),
      "Requested breakdown, or null.",
    ),
    metrics: field(
      z.array(
        z.strictObject({
          name: field(z.string(), "Registry metric name."),
          unit: field(metricUnitSchema, "Unit for values of this metric."),
          timezone: field(
            z.enum(["UTC", "America/Los_Angeles"]),
            "Reporting calendar timezone for this metric.",
          ),
          additive: field(
            z.boolean(),
            "Whether summation across time is valid within one currency/dimension.",
          ),
          caveats: field(
            z.array(z.string()),
            "Source-specific limits, availability, lag and aggregation caveats.",
          ),
        }),
      ),
      "Metadata and caveats for each requested metric.",
    ),
    rows: field(
      z.array(metricRowSchema).max(50),
      "At most 50 rows across all metrics; narrow the range or use a wider grain when truncated.",
    ),
    truncated: field(
      z.boolean(),
      "More rows matched than the requested limit.",
    ),
  })
  .meta({
    description:
      "Bounded metric query with explicit missing data and per-metric caveats.",
  });
export type MetricDefinition = z.infer<typeof metricDefinitionSchema>;
export type MetricGrain = z.infer<typeof metricGrainSchema>;
export type MetricDimension = z.infer<typeof metricDimensionSchema>;
export type MetricQueryResult = z.infer<typeof metricQueryResultSchema>;
