import * as z from "zod";
import { field } from "./common.ts";
import { fareSummarySchema } from "./fleet.ts";
import { publicFareModelV1Schema } from "./fare-model-v1.ts";

export const fareReadSummarySchema = fareSummarySchema
  .extend({
    id: field(z.string().uuid(), "Fare id."),
    source: field(
      z.enum(["custom", "saved_official"]),
      "Custom fare or saved published tariff; published tariffs are read-only.",
    ),
    has_advanced_pricing: field(
      z.boolean(),
      "True when headline rates do not describe all pricing; inspect get_fare before quoting or changing rates.",
    ),
    hidden_from_drivers: field(
      z.boolean(),
      "Whether this fleet fare is hidden from drivers. Hidden fares are admin-only.",
    ),
    currency_code: field(
      z.string().nullable(),
      "Saved currency, or null when legacy data omitted it. Never inferred or backfilled by these reads.",
    ),
  })
  .meta({
    description: "A fare headline. Advanced pricing requires get_fare.",
  });
export const farePublicFeeSchema = z.strictObject({
  name: field(z.string(), "Human fee name."),
  currency: field(
    z.string(),
    "Fee currency as stored; do not combine different currencies.",
  ),
  unitAmount: field(z.number(), "Fee amount in minor currency units.", {
    unit: "minor currency units",
  }),
  optional: field(
    z.boolean().nullable(),
    "Whether driver choice is required; null preserves legacy unspecified state.",
  ),
});
export const farePublicTierSchema = z.strictObject({
  threshold: field(
    z.number(),
    "Distance threshold in miles or kilometers according to metric.",
  ),
  rate: field(z.number(), "Major currency units per distance unit.", {
    unit: "major currency units per mile or km",
  }),
});
export const fareReadSchema = fareReadSummarySchema
  .extend({
    tax_rate: field(
      z.number(),
      "Tax percentage points as stored, e.g. 8 means eight percent.",
      { unit: "percentage points" },
    ),
    distance_rounding: field(
      z.number().nullable(),
      "Legacy distance-rounding increment in the fare distance unit.",
    ),
    minute_rate_speed_threshold_kph: field(
      z.number().nullable(),
      "Legacy speed threshold for time charging, in kilometers per hour.",
      { unit: "km/h" },
    ),
    distance_tiers: field(
      z.array(farePublicTierSchema).nullable(),
      "Complete supported legacy distance tiers, or null.",
    ),
    fees: field(
      z.array(farePublicFeeSchema).nullable(),
      "Complete supported legacy fees without internal identifiers.",
    ),
    fare_model: field(
      publicFareModelV1Schema.nullable(),
      "Complete supported canonical pricing. Amount fields ending minor are integer minor currency units. Semantic rule/tariff identifiers are retained for cross-references; source provenance is excluded.",
    ),
    pricing_status: field(
      z.enum(["supported", "unsupported_legacy"]),
      "Unsupported legacy pricing is not silently treated as complete; see limitations.",
    ),
    limitations: field(
      z.array(z.string()),
      "Concrete unsupported saved fields. Do not quote a complete price when nonempty.",
    ),
  })
  .meta({
    description:
      "Strict full supported fare pricing; preserves saved currency precision.",
  });
export const fareReadPageSchema = z
  .strictObject({
    items: field(z.array(fareReadSummarySchema), "Authorized fare headlines."),
    next_cursor: field(z.string().nullable(), "Next-page cursor, or null."),
    has_more: field(z.boolean(), "Whether another page exists."),
  })
  .meta({ description: "A bounded page of authorized fare headlines." });
export const fareAuditFieldNames = [
  "display_name",
  "currency_code",
  "base",
  "minimum_fare",
  "distance_rate",
  "minute_rate",
  "wait_time_minute_rate",
  "metric",
  "tax_rate",
  "distance_rounding",
  "minute_rate_speed_threshold_kph",
  "distance_tiers",
  "fees",
  "fare_model",
] as const;
const auditVariants = fareAuditFieldNames.map((name) =>
  z.strictObject({
    field: field(z.literal(name), "Public pricing field."),
    from: field(
      fareReadSchema.shape[name].nullable(),
      "Previous public value, or null for creation/missing value.",
    ),
    to: field(
      fareReadSchema.shape[name].nullable(),
      "New public value, or null for deletion/missing value.",
    ),
  }),
);
export const fareAuditChangeSchema = z.discriminatedUnion("field", [
  auditVariants[0]!,
  ...auditVariants.slice(1),
]);
export const fareAuditPageSchema = z
  .strictObject({
    items: field(
      z.array(
        z.strictObject({
          id: field(z.string().uuid(), "Audit entry id."),
          action: field(
            z.enum(["INSERT", "UPDATE", "DELETE"]),
            "Recorded operation.",
          ),
          changed_at: field(
            z.string(),
            "ISO timestamp of the recorded change.",
          ),
          changes: field(
            z.array(fareAuditChangeSchema),
            "Only validated public pricing changes; no actor identity or internal provenance.",
          ),
          omitted_pricing_fields: field(
            z.array(z.enum(fareAuditFieldNames)),
            "Public pricing fields whose legacy values could not be represented safely; internal fields are never listed.",
          ),
          agent_change_id: field(
            z.string().uuid().nullable(),
            "Saved change id only when visible to this actor and connection, otherwise null.",
          ),
        }),
      ),
      "Current-scope pricing history; historical ownership/visibility boundaries are not crossed.",
    ),
    next_cursor: field(
      z.string().nullable(),
      "Cursor for older entries, or null.",
    ),
    has_more: field(z.boolean(), "Whether older authorized entries exist."),
  })
  .meta({
    description:
      "A bounded page of pricing history within the current authorized ownership and visibility period.",
  });
export type FareRead = z.infer<typeof fareReadSchema>;
