import * as z from "zod";
import { field } from "./common.ts";
import { fareSummarySchema } from "./fleet.ts";
import { fareReadSummarySchema } from "./fare-read.ts";
import { zoneFareReferenceSchema } from "./fleet-pricing.ts";
import { serviceZoneSchema } from "./service-zones.ts";
import { writeResultSchema } from "./settings.ts";

// ---------------------------------------------------------------------------
// Promo codes

const minorUnits = { unit: "minor currency units" } as const;

export const promoCodeSchema = z
  .strictObject({
    id: field(z.string().uuid(), "Promo code id."),
    code: field(
      z.string(),
      "The code riders enter at booking, stored uppercase. Fixed once created.",
    ),
    status: field(
      z.enum(["active", "revoked"]),
      "active: may be redeemed while unexpired; revoked: disabled by the fleet.",
    ),
    is_redeemable: field(
      z.boolean(),
      "True when active and unexpired: riders can redeem it now, usage limits aside.",
    ),
    discount_type: field(
      z.enum(["fixed", "percentage"]),
      "fixed: a set amount off; percentage: a share of the fare off.",
    ),
    discount_percentage: field(
      z.number().nullable(),
      "Percentage off for percentage codes, e.g. 15 means 15%; null for fixed codes.",
      { unit: "percent" },
    ),
    discount_unit_amount: field(
      z.number().int().nullable(),
      "Amount off for fixed codes; null for percentage codes.",
      minorUnits,
    ),
    max_discount_unit_amount: field(
      z.number().int().nullable(),
      "Cap on a percentage discount, or null for no cap.",
      minorUnits,
    ),
    min_fare_unit_amount: field(
      z.number().int().nullable(),
      "Minimum fare the code applies to, or null for any fare.",
      minorUnits,
    ),
    currency_code: field(
      z.string().nullable(),
      "ISO 4217 currency of every amount on this code; null when it has no amounts.",
    ),
    expires_at: field(
      z.string().nullable(),
      "ISO 8601 expiry, or null when it never expires.",
    ),
    total_usage_limit: field(
      z.number().int().nullable(),
      "Maximum redemptions across all riders, or null for unlimited.",
    ),
    per_rider_usage_limit: field(
      z.number().int().nullable(),
      "Maximum redemptions per rider, or null for unlimited.",
    ),
    redemption_count: field(
      z.number().int(),
      "Bookings that redeemed the code so far.",
    ),
    total_discount_unit_amount: field(
      z.number(),
      "Total discount given through the code so far.",
      minorUnits,
    ),
    emailed_count: field(
      z.number().int(),
      "Riders the code was emailed to from Meter.",
    ),
    created_at: field(z.string(), "ISO 8601 creation time."),
    revoked_at: field(
      z.string().nullable(),
      "ISO 8601 time the code was disabled, or null.",
    ),
  })
  .meta({
    description:
      "A fleet booking promo code with its limits and usage. Amounts are integer minor currency units.",
  });
export type PromoCode = z.infer<typeof promoCodeSchema>;

export const promoCodeListSchema = z
  .strictObject({
    items: field(z.array(promoCodeSchema), "Promo codes, newest first."),
  })
  .meta({ description: "The fleet's promo codes." });

export const promoCodeWriteSchema = writeResultSchema(
  "promo_code",
  promoCodeSchema
    .nullable()
    .describe("Saved promo code, or null on a create preview."),
  "Result of a promo code change: what changed and the saved code.",
);

export const promoCodeEmailSchema = z
  .strictObject({
    promo_code_id: field(z.string().uuid(), "Promo code that was emailed."),
    code: field(z.string(), "The code that was emailed."),
    recipients: field(
      z.number().int(),
      "Distinct addresses the send was addressed to.",
    ),
    sent: field(z.number().int(), "Emails accepted by the email provider."),
    already_sent: field(
      z.number().int(),
      "Addresses skipped because they already received this code.",
    ),
    opted_out: field(
      z.number().int(),
      "Addresses skipped because they opted out of this fleet's promo emails.",
    ),
    suppressed: field(
      z.number().int(),
      "Addresses skipped because email to them is suppressed (bounce, complaint, unsubscribe).",
    ),
    failed: field(z.number().int(), "Sends that failed."),
  })
  .meta({ description: "Outcome counts of emailing a promo code." });

export const promoCodeEmailWriteSchema = writeResultSchema(
  "email",
  promoCodeEmailSchema.nullable().describe("Send outcome, or null on preview."),
  "Result of email_promo_code: the planned recipients and, once confirmed, the send counts.",
);

// ---------------------------------------------------------------------------
// Dynamic pricing (booking settlement policies)

export const settlementModeSchema = z.enum([
  "fixed_quote",
  "metered_actuals",
  "time_minimum_plus_overtime",
]);

export const dynamicPricingRideOptionSchema = z
  .strictObject({
    ride_option_id: field(z.string().uuid(), "Ride option id."),
    name: field(z.string(), "Ride option name."),
    type: field(
      z.enum(["POINT_TO_POINT", "TIME", "METERED"]),
      "Booking type. Point-to-point always settles at the fixed quote.",
    ),
    allowed_settlement_modes: field(
      z.array(settlementModeSchema),
      "Modes this ride option may use: fixed_quote always; metered_actuals for METERED; time_minimum_plus_overtime for TIME.",
    ),
    settlement_mode: field(
      settlementModeSchema,
      "fixed_quote: the rider pays the quoted price. metered_actuals: the final fare follows the meter. time_minimum_plus_overtime: the booked time is a minimum and overtime is added.",
    ),
    enabled: field(
      z.boolean(),
      "Whether a variable (metered or overtime) final fare applies; false for fixed_quote.",
    ),
    auto_apply_enabled: field(
      z.boolean(),
      "Whether a variable difference within the system cap is charged automatically; otherwise the rider approves it.",
    ),
    grace_seconds: field(
      z.number().int(),
      "Extra time before overtime or metered differences count.",
      { unit: "seconds" },
    ),
    rounding_increment_seconds: field(
      z.number().int(),
      "Increment billed time is rounded up to.",
      { unit: "seconds" },
    ),
    source: field(
      z.enum(["saved", "fleet_default", "default"]),
      "saved: this ride option's own policy; fleet_default: inherited from the fleet-wide policy; default: Meter's default, nothing saved.",
    ),
    version: field(
      z.number().int().nullable(),
      "Saved policy version, or null when nothing is saved for this ride option.",
    ),
  })
  .meta({
    description: "How one ride option's final booking fare settles.",
  });

export const dynamicPricingSchema = z
  .strictObject({
    fleet_id: field(z.string().uuid(), "Fleet id."),
    meter_pay_ready: field(
      z.boolean(),
      "Whether the fleet has a Meter Pay account; policies cannot be saved without one (get_meter_pay_status).",
    ),
    ride_options: field(
      z.array(dynamicPricingRideOptionSchema),
      "Every ride option with its effective settlement policy.",
    ),
  })
  .meta({
    description:
      "Fleet dynamic pricing: how each ride option's final fare settles against the booking quote.",
  });

export const dynamicPricingWriteSchema = writeResultSchema(
  "dynamic_pricing",
  dynamicPricingSchema,
  "Result of update_dynamic_pricing: what changed and every ride option's policy.",
);

// ---------------------------------------------------------------------------
// Official rates

export const officialRateSchema = z
  .strictObject({
    id: field(
      z.string().uuid(),
      "Official rate id for import_official_rate.",
    ),
    display_name: field(z.string(), "Tariff name."),
    city_name: field(z.string(), "City or jurisdiction the tariff applies in."),
    state_code: field(z.string(), "State or region code."),
    country_code: field(z.string(), "ISO 3166-1 alpha-2 country."),
    source_url: field(
      z.string().nullable(),
      "Regulator page the tariff was published on, or null.",
    ),
    support_level: field(
      z.string(),
      "How completely Meter can price the tariff (e.g. live_meter_capable, estimate_capable).",
    ),
    is_importable: field(
      z.boolean(),
      "Whether the tariff is an exactly published, supported tariff the fleet can import.",
    ),
    unsupported_reason: field(
      z.string().nullable(),
      "Why the tariff cannot be imported, or null.",
    ),
    imported_fare_id: field(
      z.string().uuid().nullable(),
      "This fleet's newest fare imported from the tariff, or null.",
    ),
    fare: field(
      fareSummarySchema.nullable(),
      "Headline rates, or null when the saved tariff has no currency. Advanced pricing is not described here.",
    ),
    has_advanced_pricing: field(
      z.boolean(),
      "True when headline rates do not describe all pricing (fees, tiers or a fare model).",
    ),
  })
  .meta({
    description: "A published city taxi tariff available to the fleet.",
  });

export const officialRateListSchema = z
  .strictObject({
    country_code: field(
      z.string().nullable(),
      "Fleet country searched, or null when the fleet has no country.",
    ),
    items: field(
      z.array(officialRateSchema),
      "Up to 20 tariffs, importable first.",
    ),
  })
  .meta({ description: "Official taxi tariffs in the fleet's country." });

export const officialRateImportWriteSchema = writeResultSchema(
  "fare",
  fareReadSummarySchema
    .nullable()
    .describe("The new fleet fare, or null on preview."),
  "Result of import_official_rate: the fleet fare copied from the tariff.",
);

// ---------------------------------------------------------------------------
// Known locations

export const knownLocationSchema = z
  .strictObject({
    id: field(z.string().uuid(), "Known location id."),
    fleet_id: field(z.string().uuid(), "Fleet that owns the location."),
    abbreviation: field(
      z.string(),
      'Short code dispatchers type, e.g. "JFK"; unique within the fleet.',
    ),
    name: field(z.string(), "Display name."),
    address: field(z.string(), "Street address."),
    latitude: field(z.number(), "Latitude in degrees."),
    longitude: field(z.number(), "Longitude in degrees."),
    place_id: field(z.string().nullable(), "Map place id, or null."),
    routing: field(
      z
        .strictObject({
          name: field(z.string().nullable(), "Routing point name."),
          latitude: field(z.number(), "Latitude in degrees."),
          longitude: field(z.number(), "Longitude in degrees."),
          place_id: field(z.string().nullable(), "Map place id, or null."),
        })
        .nullable(),
      "Point trips are routed through instead (e.g. an airport ride-share lot), or null.",
    ),
    updated_at: field(z.string(), "ISO 8601 last change."),
  })
  .meta({
    description:
      "A fleet shortcut for a frequent pickup or drop-off place, offered first in booking address search.",
  });

export const knownLocationListSchema = z
  .strictObject({
    items: field(z.array(knownLocationSchema), "Locations by abbreviation."),
  })
  .meta({ description: "The fleet's known locations." });

export const knownLocationWriteSchema = writeResultSchema(
  "known_location",
  knownLocationSchema
    .nullable()
    .describe("Saved location, or null after deletion."),
  "Result of a known location change: what changed and the saved location.",
);

// ---------------------------------------------------------------------------
// Service zones and bulk zone fares

export const serviceZoneListSchema = z
  .strictObject({
    items: field(
      z.array(serviceZoneSchema),
      "Every zone of the fleet, by name.",
    ),
  })
  .meta({ description: "The fleet's service zones." });

export const zoneFaresWriteSchema = writeResultSchema(
  "zone_fares",
  z
    .strictObject({
      saved: field(
        z.array(zoneFareReferenceSchema),
        "Mappings that now exist for the requested pairs.",
      ),
      removed: field(
        z.number().int(),
        "Requested pairs whose mapping was removed.",
      ),
    })
    .nullable()
    .describe("Saved mappings, or null on preview."),
  "Result of set_zone_fares: what changed and the resulting mappings.",
);

export type DynamicPricing = z.infer<typeof dynamicPricingSchema>;
export type KnownLocation = z.infer<typeof knownLocationSchema>;
