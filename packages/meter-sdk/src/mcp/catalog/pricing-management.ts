import * as z from "zod";
import {
  dynamicPricingSchema,
  dynamicPricingWriteSchema,
  knownLocationListSchema,
  knownLocationWriteSchema,
  officialRateImportWriteSchema,
  officialRateListSchema,
  promoCodeEmailWriteSchema,
  promoCodeListSchema,
  promoCodeWriteSchema,
  serviceZoneListSchema,
  settlementModeSchema,
  zoneFaresWriteSchema,
} from "../../dto/pricing-management.ts";
import { rideLocationSchema } from "./rider-rides.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const writeFields = {
  fleet_id: fleetIdSchema,
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
const id = z.string().uuid();
const minorAmount = z.number().int().positive().max(100_000_000);
const usageLimit = z.number().int().positive().max(1_000_000);
const minFare = z
  .number()
  .int()
  .min(0)
  .max(100_000_000)
  .describe(
    "Minimum fare the code applies to, in integer minor currency units (e.g. 2000 = $20.00).",
  );
const expiresAt = z.iso
  .datetime({ offset: true })
  .describe('Future ISO 8601 expiry with offset, e.g. "2026-12-31T23:59:59Z".');

const promoCodeId = id.describe("Promo code id from list_promo_codes.");
const knownLocationId = id.describe(
  "Known location id from list_known_locations.",
);
const abbreviation = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Use letters, numbers, spaces, - or _")
  .describe(
    'Short code dispatchers type, e.g. "JFK"; stored uppercase and unique within the fleet.',
  );
const locationName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe('Display name, e.g. "JFK Airport Terminal 4".');

const policyPatch = z.strictObject({
  ride_option_id: id.describe("Ride option id from get_dynamic_pricing."),
  settlement_mode: settlementModeSchema
    .optional()
    .describe(
      "fixed_quote for every ride option; metered_actuals only for METERED; time_minimum_plus_overtime only for TIME. Omit to keep the current mode.",
    ),
  enabled: z
    .boolean()
    .optional()
    .describe(
      "Turn the variable final fare on or off. Ignored for fixed_quote, which is always saved active.",
    ),
  auto_apply_enabled: z
    .boolean()
    .optional()
    .describe(
      "Charge variable differences within the system cap automatically instead of asking the rider. Off whenever the policy is disabled or fixed.",
    ),
  grace_seconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60)
    .optional()
    .describe("Extra time before overtime or metered differences count."),
  rounding_increment_seconds: z
    .number()
    .int()
    .min(1)
    .max(24 * 60 * 60)
    .optional()
    .describe("Increment billed time is rounded up to, e.g. 60."),
});

const zonePair = z.strictObject({
  start_zone_id: z
    .number()
    .int()
    .describe("Pickup zone id from list_service_zones."),
  end_zone_id: z
    .number()
    .int()
    .nullable()
    .describe("Destination zone id; null means any destination."),
  ride_option_id: id
    .nullable()
    .describe("Ride option id; null sets the default mapping."),
  fare_id: id
    .nullable()
    .describe("Fare from list_fares, or null to remove this exact mapping."),
});

export const pricingManagementSchemas = {
  list_promo_codes: z.strictObject({
    fleet_id: fleetIdSchema,
    status: z
      .enum(["all", "redeemable", "active", "revoked"])
      .default("all")
      .describe(
        "redeemable: active and unexpired; active/revoked: by saved status; all (default).",
      ),
  }),
  create_promo_code: z.strictObject({
    ...writeFields,
    code: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/,
        "Use 2-64 letters, numbers, dashes or underscores",
      )
      .describe(
        'Code riders enter, 2-64 letters, numbers, - or _ (stored uppercase), e.g. "SUMMER15".',
      ),
    discount_type: z
      .enum(["fixed", "percentage"])
      .describe("fixed: a set amount off; percentage: a share of the fare."),
    discount_percentage: z
      .number()
      .positive()
      .max(100)
      .multipleOf(0.01)
      .optional()
      .describe("Percentage off for percentage codes, e.g. 15."),
    discount_unit_amount: minorAmount
      .optional()
      .describe(
        "Amount off for fixed codes, in integer minor currency units (e.g. 500 = $5.00).",
      ),
    max_discount_unit_amount: minorAmount
      .optional()
      .describe(
        "Cap on a percentage discount, in integer minor currency units.",
      ),
    min_fare_unit_amount: minFare.optional(),
    currency_code: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional()
      .describe(
        "ISO 4217 currency of the amounts; required whenever an amount is given. Use the fleet currency.",
      ),
    expires_at: expiresAt.optional(),
    total_usage_limit: usageLimit
      .optional()
      .describe("Maximum redemptions across all riders."),
    per_rider_usage_limit: usageLimit
      .optional()
      .describe("Maximum redemptions per rider, e.g. 1."),
  }),
  update_promo_code: z.strictObject({
    ...writeFields,
    promo_code_id: promoCodeId,
    expires_at: expiresAt
      .nullable()
      .optional()
      .describe("New future expiry, or null to never expire."),
    max_discount_unit_amount: minorAmount
      .nullable()
      .optional()
      .describe(
        "New cap for a percentage code in minor units, or null for no cap.",
      ),
    min_fare_unit_amount: minFare.nullable().optional(),
    total_usage_limit: usageLimit
      .nullable()
      .optional()
      .describe("New total redemption limit, or null for unlimited."),
    per_rider_usage_limit: usageLimit
      .nullable()
      .optional()
      .describe("New per-rider limit, or null for unlimited."),
    reactivate: z
      .literal(true)
      .optional()
      .describe("Reactivate a revoked code. Use disable_promo_code to revoke."),
  }),
  disable_promo_code: z.strictObject({
    ...writeFields,
    promo_code_id: promoCodeId,
  }),
  email_promo_code: z.strictObject({
    ...writeFields,
    promo_code_id: promoCodeId,
    emails: z
      .array(z.string().trim().email())
      .max(200)
      .default([])
      .describe("Addresses to send the code to (up to 200)."),
    include_fleet_riders: z
      .boolean()
      .default(false)
      .describe("Also send to every fleet rider with an email on file."),
  }),
  get_dynamic_pricing: z.strictObject({ fleet_id: fleetIdSchema }),
  update_dynamic_pricing: z.strictObject({
    ...writeFields,
    policies: z
      .array(policyPatch)
      .min(1)
      .max(100)
      .describe(
        "Policy changes, one per ride option. Omitted fields keep their current values.",
      ),
  }),
  list_official_rates: z.strictObject({
    fleet_id: fleetIdSchema,
    city: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional()
      .describe(
        'Narrow to tariffs whose city or jurisdiction name contains this text, e.g. "Chicago".',
      ),
  }),
  import_official_rate: z.strictObject({
    ...writeFields,
    official_rate_id: id.describe(
      "Importable official rate id from list_official_rates.",
    ),
  }),
  list_known_locations: z.strictObject({ fleet_id: fleetIdSchema }),
  create_known_location: z.strictObject({
    ...writeFields,
    abbreviation,
    name: locationName,
    location: rideLocationSchema.describe(
      "The place: an address resolved server-side, or an exact place with latitude/longitude.",
    ),
    routing_location: rideLocationSchema
      .optional()
      .describe(
        "Optional point trips route through instead, e.g. an airport ride-share pickup lot.",
      ),
  }),
  update_known_location: z.strictObject({
    ...writeFields,
    known_location_id: knownLocationId,
    abbreviation: abbreviation.optional(),
    name: locationName.optional(),
    location: rideLocationSchema
      .optional()
      .describe("New place: an address, or an exact place with coordinates."),
    routing_location: rideLocationSchema
      .nullable()
      .optional()
      .describe("New routing point, or null to remove it."),
  }),
  delete_known_location: z.strictObject({
    ...writeFields,
    known_location_id: knownLocationId,
  }),
  list_service_zones: z.strictObject({ fleet_id: fleetIdSchema }),
  set_zone_fares: z.strictObject({
    ...writeFields,
    pairs: z
      .array(zonePair)
      .min(1)
      .max(50)
      .describe(
        "Up to 50 distinct pickup/destination/ride-option mappings to set or remove in one preview, e.g. a whole zone-to-zone price matrix.",
      ),
  }),
} as const;

const access = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;
const confirm =
  "Preview with dry_run: true, show every change to the human, then confirm the saved proposal with identical arguments.";

export const pricingManagementTools = {
  list_promo_codes: {
    name: "list_promo_codes",
    title: "List promo codes",
    description:
      "List the fleet's booking promo codes with discount, currency, limits, expiry, status and usage (redemptions, total discount, emails sent). Amounts are integer minor currency units. Owners/admins only. Chain create_promo_code, update_promo_code, disable_promo_code or email_promo_code.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.list_promo_codes,
    outputSchema: promoCodeListSchema,
    returns: "PromoCodeList",
    example: { status: "redeemable" },
    annotations: READ_ONLY,
  },
  create_promo_code: {
    name: "create_promo_code",
    title: "Create a promo code",
    description: `Create a fleet booking promo code riders enter at checkout: a fixed amount (minor units) or a percentage off, with optional cap, minimum fare, expiry and usage limits. The code and discount cannot change later; create a new code for a different offer. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.create_promo_code,
    outputSchema: promoCodeWriteSchema,
    returns: "PromoCodeWrite",
    example: {
      code: "SUMMER15",
      discount_type: "percentage",
      discount_percentage: 15,
      max_discount_unit_amount: 1000,
      currency_code: "USD",
      per_rider_usage_limit: 1,
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  update_promo_code: {
    name: "update_promo_code",
    title: "Change a promo code",
    description: `Change a promo code's expiry, percentage cap, minimum fare or usage limits, or reactivate a revoked code. Omitted fields stay unchanged; the code and discount value are fixed. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.update_promo_code,
    outputSchema: promoCodeWriteSchema,
    returns: "PromoCodeWrite",
    example: {
      promo_code_id: "44444444-4444-4444-8444-444444444444",
      total_usage_limit: 100,
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  disable_promo_code: {
    name: "disable_promo_code",
    title: "Disable a promo code",
    description: `Revoke a promo code so riders can no longer redeem it. Bookings that already used it keep their discount. Reactivate later with update_promo_code. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.disable_promo_code,
    outputSchema: promoCodeWriteSchema,
    returns: "PromoCodeWrite",
    example: {
      promo_code_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  email_promo_code: {
    name: "email_promo_code",
    title: "Email a promo code to riders",
    description: `Email an active promo code with a booking link to typed addresses and/or every fleet rider with an email on file. Addresses that already received the code or opted out of the fleet's promo emails are skipped; a daily fleet limit applies. Sends real email to customers. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.email_promo_code,
    outputSchema: promoCodeEmailWriteSchema,
    returns: "PromoCodeEmailWrite",
    example: {
      promo_code_id: "44444444-4444-4444-8444-444444444444",
      include_fleet_riders: true,
      dry_run: true,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  get_dynamic_pricing: {
    name: "get_dynamic_pricing",
    title: "Read dynamic pricing",
    description:
      "Read how each ride option's final booking fare settles against its quote: fixed quote, metered actuals (METERED) or time minimum plus overtime (TIME), with auto-apply, grace and rounding, and whether Meter Pay is ready. Owners/admins only. Chain update_dynamic_pricing.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.get_dynamic_pricing,
    outputSchema: dynamicPricingSchema,
    returns: "DynamicPricing",
    example: {},
    annotations: READ_ONLY,
  },
  update_dynamic_pricing: {
    name: "update_dynamic_pricing",
    title: "Change dynamic pricing",
    description: `Change how ride options' final booking fares settle: fixed quote, or a variable final fare (metered actuals or time overtime) with auto-apply, grace and rounding. Variable fares are capped by Meter and riders approve manual adjustments. Requires Meter Pay. Affects new bookings. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.update_dynamic_pricing,
    outputSchema: dynamicPricingWriteSchema,
    returns: "DynamicPricingWrite",
    example: {
      policies: [
        {
          ride_option_id: "44444444-4444-4444-8444-444444444444",
          settlement_mode: "time_minimum_plus_overtime",
          enabled: true,
          auto_apply_enabled: true,
        },
      ],
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  list_official_rates: {
    name: "list_official_rates",
    title: "List official taxi tariffs",
    description:
      "List published city taxi tariffs in the fleet's country (up to 20, importable first), optionally narrowed by city, with headline rates, source and whether the fleet already imported one. Owners/admins only. Chain import_official_rate to copy one into an editable fleet fare.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.list_official_rates,
    outputSchema: officialRateListSchema,
    returns: "OfficialRateList",
    example: { city: "Chicago" },
    annotations: READ_ONLY,
  },
  import_official_rate: {
    name: "import_official_rate",
    title: "Import an official tariff",
    description: `Copy an importable published taxi tariff into a new fleet fare with its complete pricing (fees, tiers and fare model), linked to the tariff revision. Nothing uses the new fare until it is attached with create_ride_option, update_ride_option or set_zone_fares. Requires Meter Fleet. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.import_official_rate,
    outputSchema: officialRateImportWriteSchema,
    returns: "OfficialRateImportWrite",
    example: {
      official_rate_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  list_known_locations: {
    name: "list_known_locations",
    title: "List known locations",
    description:
      "List the fleet's known locations: short codes (JFK, HILTON) for frequent pickup and drop-off places offered first in booking address search, with address, coordinates and any routing point. Owners/admins only. Chain create_known_location, update_known_location or delete_known_location.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.list_known_locations,
    outputSchema: knownLocationListSchema,
    returns: "KnownLocationList",
    example: {},
    annotations: READ_ONLY,
  },
  create_known_location: {
    name: "create_known_location",
    title: "Add a known location",
    description: `Add a known location (an airport, hotel or landmark) with a unique short code. Text places are resolved server-side and refused when ambiguous; give exact coordinates instead. An optional routing point sends trips through e.g. a ride-share lot. Owners/admins only. ${confirm}`,
    domain: "fleet",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.create_known_location,
    outputSchema: knownLocationWriteSchema,
    returns: "KnownLocationWrite",
    example: {
      abbreviation: "JFK",
      name: "JFK Airport",
      location: "JFK Airport, Queens, NY",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  update_known_location: {
    name: "update_known_location",
    title: "Change a known location",
    description: `Change a known location's code, name, place or routing point (null removes the routing point). Omitted fields stay unchanged. Owners/admins only. ${confirm}`,
    domain: "fleet",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.update_known_location,
    outputSchema: knownLocationWriteSchema,
    returns: "KnownLocationWrite",
    example: {
      known_location_id: "44444444-4444-4444-8444-444444444444",
      name: "JFK Terminal 4",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  delete_known_location: {
    name: "delete_known_location",
    title: "Delete a known location",
    description: `Permanently delete a known location. Existing bookings keep their addresses; dispatchers can no longer pick the code. Owners/admins only. ${confirm}`,
    domain: "fleet",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.delete_known_location,
    outputSchema: knownLocationWriteSchema,
    returns: "KnownLocationWrite",
    example: {
      known_location_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  list_service_zones: {
    name: "list_service_zones",
    title: "List service zones",
    description:
      "List the fleet's service zones (id, name, area in km²). Zones limit where riders can book and define zone fares. Owners/admins only. Chain list_zone_fares and set_zone_fares to price zone pairs, or find_zone_boundary and save_service_zone to add or redraw a zone.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.list_service_zones,
    outputSchema: serviceZoneListSchema,
    returns: "ServiceZoneList",
    example: {},
    annotations: READ_ONLY,
  },
  set_zone_fares: {
    name: "set_zone_fares",
    title: "Set zone fares in bulk",
    description: `Set or remove up to 50 zone-to-zone fare mappings in one preview, e.g. a whole price matrix: each pair is pickup zone, destination zone (null = any), ride option (null = default) and fare (null removes it). Fares must be fully shown scalar fares; others need the Meter pricing editor. Owners/admins only. ${confirm}`,
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: pricingManagementSchemas.set_zone_fares,
    outputSchema: zoneFaresWriteSchema,
    returns: "ZoneFaresWrite",
    example: {
      pairs: [
        {
          start_zone_id: 1,
          end_zone_id: 2,
          ride_option_id: null,
          fare_id: "44444444-4444-4444-8444-444444444444",
        },
        {
          start_zone_id: 2,
          end_zone_id: 1,
          ride_option_id: null,
          fare_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
