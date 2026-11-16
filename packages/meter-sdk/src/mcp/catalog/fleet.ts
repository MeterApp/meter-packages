import * as z from "zod";
import {
  fleetDetailSchema,
  fleetSettingsWriteSchema,
  fleetSummarySchema,
  onboardingChecklistSchema,
} from "../../dto/index.ts";
import {
  fleetIdSchema,
  limitSchema,
  cursorSchema,
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const phoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9()\-.\s]+$/, "Use digits, spaces, +, (), - and . only.");

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color such as #1E90FF.");

export const fleetSchemas = {
  list_fleets: z.object({
    limit: limitSchema.optional().describe("Page size, 1-100 (default 50)."),
    cursor: cursorSchema,
  }),
  get_fleet: z.object({ fleet_id: fleetIdSchema }),
  update_fleet_settings: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe("Fleet display name shown to riders."),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .describe(
        "Public description shown on the booking page. Use null to clear.",
      ),
    contact_phone: phoneSchema
      .nullable()
      .optional()
      .describe("Public contact phone riders can call. Use null to clear."),
    contact_whatsapp: phoneSchema
      .nullable()
      .optional()
      .describe("Public WhatsApp number. Use null to clear."),
    dispatch_phone: phoneSchema
      .nullable()
      .optional()
      .describe("Dispatch desk phone number. Use null to clear."),
    website: z
      .string()
      .trim()
      .url()
      .max(500)
      .regex(/^https?:\/\//i, "Use an http:// or https:// URL.")
      .nullable()
      .optional()
      .describe("Public website URL including https://. Use null to clear."),
    city: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe("Primary city the fleet operates in."),
    country_iso_code: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .optional()
      .describe('ISO 3166-1 alpha-2 country code, e.g. "US".'),
    region_iso_code: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .toUpperCase()
      .nullable()
      .optional()
      .describe('ISO 3166-2 region/state code, e.g. "TX". Use null to clear.'),
    currency_iso_code: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .optional()
      .describe(
        'ISO 4217 currency code, e.g. "USD". Changing it does not convert existing fares.',
      ),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe('IANA timezone, e.g. "America/Chicago".'),
    primary_color: hexColorSchema
      .nullable()
      .optional()
      .describe("Brand primary color as #RRGGBB. Use null to clear."),
    secondary_color: hexColorSchema
      .nullable()
      .optional()
      .describe("Brand secondary color as #RRGGBB. Use null to clear."),
    show_driver_locations: z
      .boolean()
      .optional()
      .describe(
        "Whether riders see live driver locations on the public booking page.",
      ),
    allow_fleet_custom_fares: z
      .boolean()
      .optional()
      .describe(
        "Whether drivers may run the meter with their own custom fares.",
      ),
    allow_outside_origin_pickup: z
      .boolean()
      .optional()
      .describe(
        "Whether riders may request pickups outside the service zones.",
      ),
    allow_outside_destination_dropoff: z
      .boolean()
      .optional()
      .describe(
        "Whether riders may request drop-offs outside the service zones.",
      ),
    icon_id: z
      .string()
      .regex(/^ai-\d{13}-[1-4]$/)
      .optional()
      .describe("generate_fleet_icons option to use as the app icon."),
  }),
  get_onboarding_checklist: z.strictObject({ fleet_id: fleetIdSchema }),
} as const;

export const fleetTools = {
  list_fleets: {
    name: "list_fleets",
    title: "List my fleets",
    description:
      "List the fleets the caller belongs to with their role and whether each fleet is operational (onboarded and billing active). Use it to pick a fleet_id when whoami shows more than one fleet. Returns FleetSummary items with name, city, country, currency and timezone. Riders and solo drivers get an empty list. Any signed-in user may call it. Page with cursor and limit (max 100).",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: fleetSchemas.list_fleets,
    outputSchema: z.object({
      items: z.array(fleetSummarySchema),
      next_cursor: z.string().nullable().optional(),
      has_more: z.boolean().optional(),
    }),
    returns: "FleetSummary",
    example: {},
    annotations: READ_ONLY,
  },
  get_fleet: {
    name: "get_fleet",
    title: "Get fleet details",
    description:
      "Describe one fleet: public info (name, city, currency, timezone, contact and dispatch phones, website, description), service zones by name, bookable ride options with headline fare rates, and member and vehicle counts. Owners and admins additionally get booking_settings (dispatch and payment policy, lead time, cancellation terms), admin_settings (payout fraction, collection mode) and driver_invite (the code and link that add new drivers to the fleet). Drivers get the public part only. Requires membership in the fleet. Do not use it to list members or vehicles; use list_fleet_members and list_vehicles.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access: {
      personas: ["fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: fleetSchemas.get_fleet,
    outputSchema: fleetDetailSchema,
    returns: "FleetDetail",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  update_fleet_settings: {
    name: "update_fleet_settings",
    title: "Update fleet settings",
    description:
      "Update the fleet profile and public contact details, including its display name, description, phone numbers, website link, city, country, region, currency, time zone, brand colors, or a previously generated icon. You can also set rider visibility of driver locations, permission to use custom fares, and out-of-zone pickup and drop-off rules. Owners and admins only. Send the fields you intend to change. Preview with dry_run: true, then confirm using the saved proposal_id and the same settings.",
    domain: "fleet",
    kind: "write",
    risk: "standard",
    escalate: { sensitive: ["currency_iso_code", "allow_fleet_custom_fares"] },
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: fleetSchemas.update_fleet_settings,
    outputSchema: fleetSettingsWriteSchema,
    returns: "FleetSettingsWrite",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
      contact_phone: "+1 512 555 0100",
      website: "https://fleet-x.example",
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  get_onboarding_checklist: {
    name: "get_onboarding_checklist",
    title: "Get fleet onboarding checklist",
    description:
      "Setup progress for a fleet the caller administers, as a checklist: fleet profile (name, contact, country, currency), brand icon, service area, at least one ride option with a fare, booking settings, at least one vehicle, at least one driver, payouts connected (a yes/no only), a shareable booking link, and the first booking received. Each item says whether it is done, whether riders can book without it, and how to complete it: the MCP tool to call (update_fleet_settings, update_ride_option, update_booking_settings, assign_vehicle) or the web page to send the human to. Also returns booking_page_status and the public booking URL. Owners and admins only; works on fleets that are not operational yet. Use it to drive a new fleet to its first booking.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: fleetSchemas.get_onboarding_checklist,
    outputSchema: onboardingChecklistSchema,
    returns: "OnboardingChecklist",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
} as const;
