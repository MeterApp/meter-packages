import * as z from "zod";
import { currencyCodeSchema, minorAmountSchema } from "./common.ts";
import { writeResultSchema } from "./settings.ts";

/** Closed receipt only. Never return raw pricing/profile/provider snapshots. */
export const tripAdjustmentReceiptSchema = z.strictObject({
  trip_id: z.uuid().describe("Trip identifier for the confirmed adjustment."),
  currency: currencyCodeSchema.describe(
    "Exact receipt currency; determines the minor-unit exponent.",
  ),
  previous_total_minor: minorAmountSchema.describe(
    "Active receipt total before this command, in minor units.",
  ),
  total_minor: minorAmountSchema.describe(
    "Confirmed active total, or confirmed cash amount, in minor units.",
  ),
  fee_id: z
    .string()
    .nullable()
    .describe("Added or removed saved fee identifier; null for other changes."),
  discount_id: z
    .string()
    .nullable()
    .describe(
      "Added or removed saved discount identifier; null for other changes.",
    ),
  is_paid: z
    .boolean()
    .describe("Whether this command recorded the trip as paid."),
  payment_method: z
    .enum(["cash"])
    .nullable()
    .describe("Cash when this command recorded cash received; otherwise null."),
});
export type TripAdjustmentReceipt = z.infer<typeof tripAdjustmentReceiptSchema>;
export const tripAdjustmentWriteSchema = writeResultSchema(
  "trip_adjustment",
  tripAdjustmentReceiptSchema
    .nullable()
    .describe(
      "Current finite receipt in preview or frozen confirmed command proof.",
    ),
  "Preview or confirmed trip adjustment. Amounts are in the currency's smallest unit; cash-paid is bookkeeping.",
);
