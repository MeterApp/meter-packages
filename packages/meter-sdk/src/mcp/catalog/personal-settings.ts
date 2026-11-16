import * as z from "zod";
import {
  driverSiteReadSchema,
  driverSiteSettingsWriteSchema,
  notificationChannelSchema,
  notificationPreferencesSchema,
  notificationPreferenceWriteSchema,
  notificationQuietHoursSchema,
  personalBookingSettingsSchema,
  personalBookingSettingsWriteSchema,
} from "../../dto/personal-settings.ts";
import { bookingHoursSchema } from "../../dto/settings.ts";
import {
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const writeFields = { dry_run: dryRunSchema, proposal_id: proposalIdSchema };
const categoryKey = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe(
    "A category identifier returned by get_my_notification_preferences.",
  );
const nonnegativeInt = z.number().int().min(0).max(2147483647);
export const personalSettingsSchemas = {
  get_my_driver_site: z.strictObject({}),
  update_my_driver_site: z.strictObject({
    ...writeFields,
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional()
      .describe(
        "Public address segment. Required for a new site; past addresses continue to redirect.",
      ),
    business_name: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional()
      .describe("Public business name. Null uses the driver's name."),
    bio: z
      .string()
      .trim()
      .max(600)
      .nullable()
      .optional()
      .describe("Public biography. Null clears it."),
    service_area: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .describe("Public service area description. Null clears it."),
    primary_color: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^#[0-9a-f]{6}$/)
      .nullable()
      .optional()
      .describe("Public accent color as #RRGGBB. Null restores the default."),
    show_phone: z
      .boolean()
      .optional()
      .describe("Allow displaying your phone number on your public site."),
  }),
  get_my_booking_settings: z.strictObject({}),
  update_my_booking_settings: z.strictObject({
    ...writeFields,
    booking_fare_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "Personal point-to-point fare ID from list_fares. Null disables point-to-point bookings.",
      ),
    time_booking_fare_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "Personal hourly fare ID from list_fares. Null disables hourly bookings.",
      ),
    payment_mode: z
      .enum(["payments_optional", "pre_payment_required"])
      .optional()
      .describe(
        "Whether riders pay after the trip or must authorize payment upfront.",
      ),
    min_lead_time_seconds: nonnegativeInt
      .optional()
      .describe("Minimum notice before pickup in seconds."),
    time_slot_minutes: z
      .literal([15, 30, 45, 60])
      .nullable()
      .optional()
      .describe("Hourly booking slot size in minutes. Null clears it."),
    minimum_duration_minutes: nonnegativeInt
      .nullable()
      .optional()
      .describe(
        "Minimum hourly booking duration in minutes. Use a multiple of the slot size. Null clears it.",
      ),
    cancellation_grace_period_seconds: z
      .literal([0, 300, 600, 1800, 3600, 21600, 43200, 86400])
      .optional()
      .describe("Free cancellation window in seconds."),
    cancellation_fee_fraction: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Cancellation fee as a fraction of the fare."),
    cancellation_fee_minimum_unit_amount: nonnegativeInt
      .optional()
      .describe(
        "Minimum cancellation fee in minor units of the booking fare currency.",
      ),
    individual_passenger_capacity: z
      .number()
      .int()
      .min(1)
      .max(99)
      .optional()
      .describe("Maximum passengers for a personal booking."),
    availability: bookingHoursSchema
      .max(7)
      .optional()
      .describe(
        "Weekly personal booking hours. Include all seven days to set the full schedule. Omitted days preserve their current hours.",
      ),
    availability_timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("IANA timezone for weekly booking hours."),
    booking_buffer_minutes: z
      .literal([0, 15, 30, 45, 60])
      .optional()
      .describe("Extra minutes between bookings."),
    travel_time_buffer_enabled: z
      .boolean()
      .optional()
      .describe("Add drive time to the buffer between bookings."),
  }),
  get_my_notification_preferences: z.strictObject({
    category_key: categoryKey.optional(),
    channel: notificationChannelSchema.optional(),
  }),
  update_my_notification_preference: z.strictObject({
    ...writeFields,
    category_key: categoryKey,
    channel: notificationChannelSchema,
    enabled: z
      .boolean()
      .optional()
      .describe("Enable or disable the selected channel for this category."),
    quiet_hours: notificationQuietHoursSchema
      .nullable()
      .optional()
      .describe("Set quiet hours for this preference. Null clears them."),
  }),
} as const;

const account = {
  domain: "account",
  access: {
    personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
    requiresOperationalFleet: false,
  },
  exposure: "listed",
} as const;
const read = {
  ...account,
  kind: "read",
  risk: "none",
  annotations: READ_ONLY,
} as const;
const write = {
  ...account,
  kind: "write",
  risk: "standard",
  annotations: SETTINGS_WRITE,
} as const;

export const personalSettingsTools = {
  get_my_driver_site: {
    ...read,
    name: "get_my_driver_site",
    title: "Get my driver website settings",
    description:
      "Read the signed-in solo driver's public website address, business name, biography, service area, accent color and phone visibility.",
    inputSchema: personalSettingsSchemas.get_my_driver_site,
    outputSchema: driverSiteReadSchema,
    returns: "DriverSite",
    example: {},
  },
  update_my_driver_site: {
    ...write,
    name: "update_my_driver_site",
    title: "Update my driver website settings",
    description:
      "Create or edit the signed-in solo driver's website, including its public address, content and phone visibility. Preview with dry_run: true and confirm the saved proposal. Old addresses still redirect after renaming.",
    escalate: { sensitive: ["slug", "show_phone"] },
    inputSchema: personalSettingsSchemas.update_my_driver_site,
    outputSchema: driverSiteSettingsWriteSchema,
    returns: "DriverSiteSettingsWrite",
    example: { service_area: "Downtown and the airport", dry_run: true },
    annotations: {
      ...write.annotations,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  get_my_booking_settings: {
    ...read,
    name: "get_my_booking_settings",
    title: "Get my personal booking settings",
    description:
      "Read the signed-in solo driver's booking fares, payment and cancellation policy, pickup notice, weekly booking hours, passenger capacity and buffers. Fleet members use get_fleet for fleet booking policy.",
    inputSchema: personalSettingsSchemas.get_my_booking_settings,
    outputSchema: personalBookingSettingsSchema,
    returns: "PersonalBookingSettings",
    example: {},
  },
  update_my_booking_settings: {
    ...write,
    name: "update_my_booking_settings",
    title: "Update my personal booking settings",
    description:
      "Change the signed-in solo driver's personal booking policy, fares, availability, capacity or buffers. Send only intended settings and preview with dry_run: true. Apply only with the saved proposal after confirmation. This never edits a fleet's booking policy.",
    escalate: {
      sensitive: [
        "payment_mode",
        "booking_fare_id",
        "time_booking_fare_id",
        "cancellation_fee_fraction",
        "cancellation_fee_minimum_unit_amount",
      ],
    },
    inputSchema: personalSettingsSchemas.update_my_booking_settings,
    outputSchema: personalBookingSettingsWriteSchema,
    returns: "PersonalBookingSettingsWrite",
    example: { min_lead_time_seconds: 7200, dry_run: true },
  },
  get_my_notification_preferences: {
    ...read,
    name: "get_my_notification_preferences",
    title: "Get my notification preferences",
    description:
      "Read your notification categories, enabled channels and quiet hours. Filter by category or delivery channel if useful. Shows which settings are required for your account role.",
    inputSchema: personalSettingsSchemas.get_my_notification_preferences,
    outputSchema: notificationPreferencesSchema,
    returns: "NotificationPreferences",
    example: { channel: "push" },
  },
  update_my_notification_preference: {
    ...write,
    name: "update_my_notification_preference",
    title: "Update my notification preference",
    description:
      "Set delivery or quiet hours for one of your own notification categories and channels. Read its identifier first. Required delivery cannot be turned off. Preview with dry_run: true, then confirm the saved proposal.",
    inputSchema: personalSettingsSchemas.update_my_notification_preference,
    outputSchema: notificationPreferenceWriteSchema,
    returns: "NotificationPreferenceWrite",
    example: {
      category_key: "message_fleet",
      channel: "push",
      quiet_hours: null,
      dry_run: true,
    },
  },
} as const;
