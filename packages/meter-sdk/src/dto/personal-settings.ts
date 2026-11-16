import * as z from "zod";
import { field } from "./common.ts";
import { bookingHoursSchema, writeResultSchema } from "./settings.ts";

export const personalBookingSettingsSchema = z
  .strictObject({
    booking_fare_id: field(
      z.string().uuid().nullable(),
      "Point-to-point fare, or null when disabled.",
    ),
    time_booking_fare_id: field(
      z.string().uuid().nullable(),
      "Hourly fare, or null when disabled.",
    ),
    payment_mode: field(
      z.enum(["payments_optional", "pre_payment_required"]),
      "When riders pay for new bookings.",
    ),
    min_lead_time_seconds: field(
      z.number(),
      "Minimum notice for a pickup, in seconds.",
    ),
    time_slot_minutes: field(
      z.number().nullable(),
      "Hourly booking slot size in minutes.",
    ),
    minimum_duration_minutes: field(
      z.number().nullable(),
      "Minimum hourly booking duration in minutes.",
    ),
    cancellation_grace_period_seconds: field(
      z.number(),
      "Free cancellation window, in seconds.",
    ),
    cancellation_fee_fraction: field(
      z.number(),
      "Cancellation fee as a fraction of the fare.",
    ),
    cancellation_fee_minimum_unit_amount: field(
      z.number(),
      "Cancellation fee minimum in the selected fare's currency minor units.",
    ),
    individual_passenger_capacity: field(
      z.number(),
      "Maximum passengers for the personal booking page.",
    ),
    availability: field(bookingHoursSchema, "Weekly personal booking hours."),
    availability_timezone: field(
      z.string().nullable(),
      "IANA timezone for personal booking hours.",
    ),
    booking_buffer_minutes: field(
      z.number(),
      "Extra minutes between bookings.",
    ),
    travel_time_buffer_enabled: field(
      z.boolean(),
      "Whether travel time is added to the booking buffer.",
    ),
  })
  .describe("The signed-in driver's personal booking policy.");

export const notificationQuietHoursSchema = z.strictObject({
  start: field(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
    "Start in local 24-hour time.",
  ),
  end: field(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
    "End in local 24-hour time. May be the next day.",
  ),
  timezone: field(
    z.string().trim().min(1).max(100),
    "IANA timezone for the quiet hours.",
  ),
});
export const notificationChannelSchema = z.enum([
  "email",
  "sms",
  "whatsapp",
  "push",
]);

export const notificationPreferenceSchema = z
  .strictObject({
    category_key: field(
      z.string(),
      "Category identifier to use when changing this preference.",
    ),
    display_name: field(z.string(), "Name of the notification category."),
    channel: field(notificationChannelSchema, "Delivery channel."),
    enabled: field(
      z.boolean(),
      "Whether notifications are enabled for this category and channel.",
    ),
    forced_on: field(
      z.boolean(),
      "Whether the account role requires this channel to stay enabled.",
    ),
    quiet_hours: field(
      notificationQuietHoursSchema.nullable(),
      "Delivery quiet hours, or null when unset.",
    ),
  })
  .describe("A notification preference for the signed-in account.");

export const notificationPreferencesSchema = z
  .strictObject({
    preferences: field(
      z.array(notificationPreferenceSchema),
      "Matching preferences for the signed-in account.",
    ),
  })
  .describe("Notification preferences for the signed-in account.");

export const personalBookingSettingsWriteSchema = writeResultSchema(
  "booking_settings",
  personalBookingSettingsSchema,
  "Result of changing personal booking settings.",
);
export const notificationPreferenceWriteSchema = writeResultSchema(
  "preference",
  notificationPreferenceSchema,
  "Result of changing one personal notification preference.",
);

export type PersonalBookingSettings = z.infer<
  typeof personalBookingSettingsSchema
>;
export type NotificationPreference = z.infer<
  typeof notificationPreferenceSchema
>;

export const driverSiteSettingsSchema = z
  .strictObject({
    slug: field(
      z.string(),
      "The current address segment under meterapp.co/drivers.",
    ),
    url: field(z.string().url(), "The driver's public website URL."),
    business_name: field(
      z.string().nullable(),
      "Public business name, or null to show the driver's name.",
    ),
    bio: field(z.string().nullable(), "Public website biography."),
    service_area: field(
      z.string().nullable(),
      "Public service area description.",
    ),
    primary_color: field(
      z.string().nullable(),
      "Public accent color, or null to use the default.",
    ),
    show_phone: field(
      z.boolean(),
      "Whether the driver permits showing their phone on their website.",
    ),
  })
  .describe("The signed-in driver's public website settings.");
export const driverSiteReadSchema = z
  .strictObject({
    site: field(
      driverSiteSettingsSchema.nullable(),
      "The driver's site, or null before it is created.",
    ),
  })
  .describe("The signed-in driver's website.");
export const driverSiteSettingsWriteSchema = writeResultSchema(
  "site",
  driverSiteSettingsSchema,
  "Result of changing the driver's website settings.",
);
export type DriverSiteSettings = z.infer<typeof driverSiteSettingsSchema>;
