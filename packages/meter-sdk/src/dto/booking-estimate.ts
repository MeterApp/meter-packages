import * as z from "zod";

const location = z.strictObject({
  latitude: z.number().min(-90).max(90).describe("Latitude in degrees."),
  longitude: z.number().min(-180).max(180).describe("Longitude in degrees."),
});
export const bookingEstimateInputSchema = z
  .strictObject({
    fleet_id: z
      .string()
      .uuid()
      .optional()
      .describe("Fleet ID. Set exactly one of fleet_id or fare_id."),
    fare_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Your own personal fare ID; private fares of other drivers are unavailable.",
      ),
    ride_option_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional ride option belonging to the selected fleet."),
    service_type: z
      .enum(["POINT_TO_POINT", "METERED", "TIME"])
      .default("POINT_TO_POINT")
      .describe("Ride product. Personal fares support point-to-point only."),
    origin: location.describe("Pickup coordinates."),
    destination: location
      .optional()
      .describe(
        "Drop-off coordinates; required for point-to-point, optional for TIME.",
      ),
    waypoints: z
      .array(location)
      .max(10)
      .optional()
      .describe("Up to ten intermediate stops, in travel order."),
    start_timestamp: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe(
        "Scheduled pickup with timezone, at least one minute in the future; omit for ASAP.",
      ),
    duration_minutes: z
      .number()
      .int()
      .min(15)
      .max(10080)
      .optional()
      .describe(
        "TIME booking duration in minutes, matching fleet slot and minimum rules.",
      ),
    passenger_count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(1)
      .describe(
        "Requested passengers; fleet estimate-v2 falls back to one above its maximum capacity.",
      ),
    enable_payment_method_scoped_card_fees: z
      .boolean()
      .default(false)
      .describe(
        "Match estimate-v2 opt-in: keep cash as active total and expose a separate card variant. Personal fares use their existing payment policy.",
      ),
  })
  .superRefine((value, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (!!value.fleet_id === !!value.fare_id)
      issue("Set exactly one of fleet_id or fare_id.");
    if (
      value.fare_id &&
      (value.service_type !== "POINT_TO_POINT" || value.ride_option_id)
    )
      issue(
        "Personal fares support point-to-point without a fleet ride option.",
      );
    if (value.service_type === "POINT_TO_POINT" && !value.destination)
      issue("Point-to-point requires a destination.");
    if (
      value.service_type === "TIME" &&
      (!value.duration_minutes || value.waypoints?.length)
    )
      issue(
        "TIME requires duration_minutes; it takes an optional destination but no waypoints.",
      );
    if (value.service_type !== "TIME" && value.duration_minutes)
      issue("duration_minutes is only valid for TIME.");
    if (!value.destination && value.waypoints?.length)
      issue("Waypoints require a destination.");
  });
const amount = z.number().int().nullable();
export const bookingQuoteEstimateSchema = z
  .strictObject({
    fleet_id: z
      .string()
      .uuid()
      .nullable()
      .describe("Fleet being estimated, or null for your personal fare."),
    timezone: z.string().describe("Pickup timezone resolved from coordinates."),
    service_type: z
      .enum(["POINT_TO_POINT", "METERED", "TIME"])
      .describe("Requested ride product."),
    estimates: z
      .array(
        z.strictObject({
          ride_option_id: z
            .string()
            .uuid()
            .nullable()
            .describe("Fleet ride option, or null for a personal fare."),
          name: z
            .string()
            .describe("Ride option or personal fare display name."),
          capacity: z
            .number()
            .int()
            .nullable()
            .describe("Fleet option capacity; null for a personal fare."),
          recommended: z
            .boolean()
            .describe(
              "The first capacity-suitable option, matching estimate-v2.",
            ),
          passenger_count: z
            .number()
            .int()
            .describe(
              "Effective passenger count after estimate-v2 normalization.",
            ),
          currency: z.string().describe("Currency code for all amounts."),
          total_unit_amount: amount.describe(
            "Active estimate in currency minor units; null for rate-only metered service.",
          ),
          cash_unit_amount: amount.describe(
            "Cash variant in currency minor units when calculated.",
          ),
          card_unit_amount: amount.describe(
            "Card variant in currency minor units when calculated.",
          ),
          card_fee_unit_amount: amount.describe(
            "Card processing fee in currency minor units when calculated.",
          ),
          distance_meters: z
            .number()
            .nonnegative()
            .nullable()
            .describe("Estimated distance; null when no route is priced."),
          duration_seconds: z
            .number()
            .nonnegative()
            .nullable()
            .describe("Estimated route or booked TIME duration in seconds."),
          settlement_mode: z
            .enum([
              "fixed_quote",
              "time_minimum_plus_overtime",
              "metered_actuals",
            ])
            .describe(
              "How the eventual booking fare settles; an estimate is not an accepted quote.",
            ),
          routing: z
            .enum([
              "road",
              "route_with_gaps",
              "straight_line",
              "time",
              "rate_only",
            ])
            .describe("Road estimate, approximation, or non-route pricing."),
        }),
      )
      .describe("Estimates for eligible fleet options or one personal fare."),
    limitations: z
      .array(
        z.enum([
          "estimate_only",
          "availability_not_reserved",
          "no_discounts_or_tip",
          "currency_inferred",
          "some_options_unavailable",
        ]),
      )
      .describe(
        "Explicit limits: no booking, quote, reservation, discount, tip, or acknowledgement is created.",
      ),
  })
  .describe(
    "Read-only booking price estimates with currency minor units and explicit limitations.",
  );
export type BookingEstimateInput = z.infer<typeof bookingEstimateInputSchema>;
export type BookingQuoteEstimate = z.infer<typeof bookingQuoteEstimateSchema>;
