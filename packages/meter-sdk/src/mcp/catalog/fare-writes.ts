import * as z from "zod";
import { fareWriteSchema } from "../../dto/fare-write.ts";
import { dryRunSchema, proposalIdSchema, SETTINGS_WRITE } from "./shared.ts";

const rate = z
  .number()
  .finite()
  .min(0)
  .max(10000)
  .describe("Major currency units; decimal precision is preserved.");
const fields = {
  display_name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("Fare name shown to drivers and riders."),
  currency_code: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .describe("Explicit saved ISO currency. Never infer a currency."),
  base: rate,
  minimum_fare: rate,
  distance_rate: rate.describe(
    "Per kilometer when metric is true, otherwise per mile.",
  ),
  minute_rate: rate,
  wait_time_minute_rate: rate,
  tax_rate: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .describe("Tax fraction: 0.08 means 8%."),
  metric: z.boolean().describe("True for kilometers, false for miles."),
};
const scope = {
  scope: z
    .enum(["me", "fleet"])
    .default("me")
    .describe("Own fare or an administered fleet fare."),
  fleet_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Required only for fleet scope when the caller has several fleets.",
    ),
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
export const fareWriteSchemas = {
  create_fare: z.strictObject({
    ...scope,
    ...fields,
    base: fields.base.default(0).describe(fields.base.description!),
    minimum_fare: fields.minimum_fare
      .default(0)
      .describe(fields.minimum_fare.description!),
    distance_rate: fields.distance_rate
      .default(0)
      .describe(fields.distance_rate.description!),
    minute_rate: fields.minute_rate
      .default(0)
      .describe(fields.minute_rate.description!),
    wait_time_minute_rate: fields.wait_time_minute_rate
      .default(0)
      .describe(fields.wait_time_minute_rate.description!),
    tax_rate: fields.tax_rate.default(0).describe(fields.tax_rate.description!),
    metric: fields.metric.default(false).describe(fields.metric.description!),
  }),
  update_fare: z.strictObject({
    ...scope,
    fare_id: z.string().uuid().describe("Custom fare id from list_fares."),
    ...(Object.fromEntries(
      Object.entries(fields).map(([name, schema]) => [
        name,
        schema.optional().describe(schema.description!),
      ]),
    ) as {
      [K in keyof typeof fields]: z.ZodOptional<(typeof fields)[K]>;
    }),
  }),
  delete_fare: z.strictObject({
    ...scope,
    fare_id: z
      .string()
      .uuid()
      .describe("Unused custom fare id from list_fares."),
  }),
};
const shared = {
  domain: "fares",
  kind: "write",
  risk: "sensitive",
  access: {
    personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    requiresOperationalFleet: false,
  },
  exposure: "on_demand",
  outputSchema: fareWriteSchema,
  returns: "FareWrite",
} as const;
const confirmation =
  "Preview with dry_run:true, show every change and currency, obtain an explicit yes, then confirm the saved proposal_id with identical arguments. Official published tariffs cannot be changed. This does not charge or refund anyone.";
export const fareWriteTools = {
  create_fare: {
    ...shared,
    name: "create_fare",
    title: "Create a custom fare",
    description: `Create an own or administered fleet scalar fare. Supply its currency and at least one positive price. Fleet currency must match. Rates are major currency units. Creating more than one personal custom fare requires Meter Pro access, checked again at confirmation. ${confirmation}`,
    inputSchema: fareWriteSchemas.create_fare,
    example: {
      scope: "me",
      display_name: "Standard",
      currency_code: "USD",
      base: 3.5,
      distance_rate: 2.75,
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  update_fare: {
    ...shared,
    name: "update_fare",
    title: "Update a custom fare",
    description: `Change only requested headline fields of a mutable scalar fare; existing fees and supported pricing remain intact. Advanced models require the Meter fare editor. Own fares referenced by a fleet cannot be edited here. Fleet edits affect every service using that fare. ${confirmation}`,
    inputSchema: fareWriteSchemas.update_fare,
    example: {
      scope: "me",
      fare_id: "11111111-1111-4111-8111-111111111111",
      base: 3.5,
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  delete_fare: {
    ...shared,
    name: "delete_fare",
    title: "Delete an unused custom fare",
    description: `Delete an own or administered fleet fare only when no current ride option, zone price, booking page or default selection uses it. Existing trip snapshots remain intact. An in-use fare requires the Meter editor. ${confirmation}`,
    inputSchema: fareWriteSchemas.delete_fare,
    example: {
      scope: "me",
      fare_id: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
