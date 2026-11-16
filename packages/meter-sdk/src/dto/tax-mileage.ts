import * as z from "zod";
import { field, currencyCodeSchema, minorAmountSchema } from "./common.ts";

const period = {
  start_date: field(z.string(), "Inclusive ISO period start."),
  end_date: field(z.string(), "Exclusive ISO period end."),
  complete: field(
    z.boolean(),
    "False when the report excludes rows. Narrow the period before treating totals as complete.",
  ),
  fleet_id: field(z.string().nullable(), "Fleet constraint, otherwise null."),
  driver_id: field(
    z.string().nullable(),
    "Driver constraint, otherwise all authorized fleet drivers.",
  ),
};

export const taxSummarySchema = z
  .strictObject({
    ...period,
    included_trip_count: field(
      z.number().int().nonnegative(),
      "Trips included in these totals.",
    ),
    skipped_trip_count: field(
      z.number().int().nonnegative(),
      "Fetched trips with missing fares, unsupported fare models/currencies or unusable prices.",
    ),
    assumed_currency_count: field(
      z.number().int().nonnegative(),
      "Included trips whose missing currency used the console USD fallback.",
    ),
    totals: field(
      z
        .array(
          z.strictObject({
            currency: currencyCodeSchema,
            currency_fraction_digits: field(
              z.number().int().min(0).max(4),
              "Number of decimal places in this currency; minor amounts use this exponent.",
            ),
            taxable_fare_minor: field(
              minorAmountSchema,
              "Discounted taxable fare in minor currency units.",
            ),
            tax_collected_minor: field(
              minorAmountSchema,
              "Collected trip tax in minor currency units.",
            ),
            non_taxable_income_minor: field(
              minorAmountSchema,
              "Income outside the taxable subtotal in minor currency units.",
            ),
            trip_count: field(
              z.number().int().nonnegative(),
              "Included trips in this currency.",
            ),
          }),
        )
        .max(500),
      "Saved-trip price totals, separately by currency. These are not a tax filing or a settlement report.",
    ),
  })
  .meta({
    description:
      "Tax amounts from native scalar trip pricing. Advanced fare models are omitted and mark the report incomplete.",
  });

export const mileageReportSchema = z
  .strictObject({
    ...period,
    trip_count: field(
      z.number().int().nonnegative(),
      "Included non-excluded mileage records.",
    ),
    total_meters: field(
      z.number().nonnegative(),
      "Included tracked distance in meters.",
    ),
    business_meters: field(
      z.number().nonnegative(),
      "Business classified distance in meters.",
    ),
    commute_meters: field(
      z.number().nonnegative(),
      "Commute classified distance in meters.",
    ),
    fleet_online_meters: field(
      z.number().nonnegative(),
      "Fleet online classified distance in meters.",
    ),
    personal_meters: field(
      z.number().nonnegative(),
      "Personal classified distance in meters.",
    ),
    unclassified_meters: field(
      z.number().nonnegative(),
      "Distance without a confirmed classification in meters.",
    ),
    excluded_meters: field(
      z.number().nonnegative(),
      "Excluded distance in meters.",
    ),
    review_count: field(
      z.number().int().nonnegative(),
      "Mileage records still needing review.",
    ),
  })
  .meta({
    description:
      "Native Mileage tracker classifications. No location traces or assumed tax deduction rate.",
  });

export type TaxSummary = z.infer<typeof taxSummarySchema>;
export type MileageReport = z.infer<typeof mileageReportSchema>;
