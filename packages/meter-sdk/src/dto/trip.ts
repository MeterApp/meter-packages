import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  minorAmountSchema,
  opaqueIdSchema,
  pageSchema,
  personRefSchema,
  placeSchema,
} from "./common.ts";

const adjustmentDetailsSchema = z.strictObject({
  fees: z
    .array(
      z.strictObject({
        fee_id: field(
          z.string().min(1).max(128).nullable(),
          "Saved removal id, or null when unsupported.",
        ),
        memo: field(
          z.string().max(1000).nullable(),
          "Bounded saved fee label.",
        ),
        amount_minor: field(
          minorAmountSchema.nullable(),
          "Stored amount in exact receipt minor units; null when unsupported.",
        ),
        taxable: field(
          z.boolean().nullable(),
          "Whether the fee is taxable, or null when unknown.",
        ),
        is_tip: field(
          z.boolean().nullable(),
          "Whether the fee is a tip, or null when unknown.",
        ),
      }),
    )
    .max(128)
    .describe("Bounded saved adjustment entries with exact selection IDs."),
  discounts: z
    .array(
      z.strictObject({
        discount_id: field(
          z.string().min(1).max(128).nullable(),
          "Saved removal id, or null when unsupported.",
        ),
        type: field(
          z.enum(["fixed", "percentage"]).nullable(),
          "Stored discount kind, or null when unsupported.",
        ),
        amount_minor: field(
          minorAmountSchema.nullable(),
          "Stored amount in exact receipt minor units; null when unsupported.",
        ),
        percentage: field(
          z.number().finite().min(0).max(100).nullable(),
          "Percentage discount from 0 to 100; null for fixed or unsupported discounts.",
        ),
        reason: field(
          z.string().max(1000).nullable(),
          "Bounded saved discount reason.",
        ),
      }),
    )
    .max(128)
    .describe("Bounded saved adjustment entries with exact selection IDs."),
  complete: field(
    z.boolean(),
    "Whether all saved entries fit the bounded response.",
  ),
});

export const tripSchema = z
  .strictObject({
    trip_id: field(opaqueIdSchema, "Opaque trip id."),
    driver: field(
      personRefSchema.nullable(),
      "The driver who ran the meter, or null if the account was deleted.",
    ),
    fleet_id: field(
      z.string().nullable(),
      "Fleet the trip was driven for, or null for a solo (non-fleet) trip.",
    ),
    booking_id: field(
      z.string().nullable(),
      "Linked booking id when the trip fulfilled a booking; otherwise null.",
    ),
    started_at: field(isoTimestampNullableSchema, "When the meter started."),
    ended_at: field(isoTimestampNullableSchema, "When the meter stopped."),
    duration_seconds: field(z.number().int().nullable(), "Metered duration.", {
      unit: "seconds",
    }),
    distance_meters: field(z.number().nullable(), "Metered distance.", {
      unit: "meters",
    }),
    pickup: field(placeSchema.nullable(), "Where the meter started."),
    dropoff: field(placeSchema.nullable(), "Where the meter stopped."),
    timezone: field(
      z.string().nullable(),
      "IANA timezone the trip happened in.",
    ),
    fare_name: field(
      z.string().nullable(),
      "Name of the fare (rate card) used.",
    ),
    currency: field(
      currencyCodeSchema.nullable(),
      "Currency of the amounts below.",
    ),
    total_minor: field(
      minorAmountSchema.nullable(),
      "Receipt total including fees, tip and tax, or null if no receipt.",
    ),
    cash_total_minor: field(
      minorAmountSchema.nullable().optional(),
      "get_trip includes the stored cash receipt total in exact currency minor units. Null means missing, malformed or unsupported currency; never infer cash from the active or card total. List pages omit this field.",
    ),
    tip_minor: field(
      minorAmountSchema.nullable(),
      "Tip included in the total, or null.",
    ),
    fee_count: field(
      z.number().int(),
      "Number of fees applied (tolls, airport fees, ...).",
    ),
    discount_count: field(z.number().int(), "Number of discounts applied."),
    adjustment_details: field(
      adjustmentDetailsSchema.optional(),
      "get_trip includes up to 128 fees and 128 discounts with exact removal ids. complete is false when the count or encoded byte budget omits entries. A null id cannot be removed by an agent; null money means the stored value or currency is unsupported. List pages omit these details.",
    ),
    is_paid: field(z.boolean(), "Whether the trip is marked paid."),
    payment_method: field(
      z.string().nullable(),
      "How the trip was paid: cash, card (Meter Pay), other, or null when not recorded.",
    ),
    void_status: field(
      z.enum(["void_requested", "voided"]).nullable(),
      "Set when the driver asked to void the trip (void_requested) or an admin voided it (voided).",
    ),
    created_at: field(
      isoTimestampSchema,
      "When the trip was uploaded to Meter.",
    ),
  })
  .meta({
    description:
      "A metered trip. No GPS traces, device info or payment-provider ids.",
  });
export type Trip = z.infer<typeof tripSchema>;

export const tripPageSchema = pageSchema(tripSchema).meta({
  description: "Result of list_trips: a page of trips, newest first.",
});
export type TripPage = z.infer<typeof tripPageSchema>;
