/**
 * DTOs for the settings write tools and the onboarding checklist.
 *
 * Every write tool returns the same envelope: `applied` (false on dry runs),
 * `dry_run`, the list of field-level `changes` (field, from, to) and the
 * updated object under a tool-specific key. Objects are strict allowlists
 * like every other DTO.
 */
import * as z from 'zod';
import {
  field,
  fleetRoleSchema,
  isoTimestampNullableSchema,
  opaqueIdSchema
} from './common.ts';
import { fareSummarySchema } from './fleet.ts';
import { vehicleSchema } from './vehicle.ts';

/** A JSON scalar or small structure as it appears in a settings field. */
export const settingValueSchema = field(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
    z.array(z.record(z.string(), z.unknown()))
  ]),
  'The value of a setting: string, number, boolean, null, or a list.'
);

export const fieldChangeSchema = z
  .strictObject({
    field: field(
      z.string(),
      'Name of the changed argument, exactly as passed to the tool (e.g. "contact_phone", "fare.base").'
    ),
    from: field(settingValueSchema, 'Value before the change.'),
    to: field(settingValueSchema, 'Value after the change.')
  })
  .meta({
    description:
      'One field the tool changed (or would change on a dry run). Fields whose new value equals the current value are not listed.'
  });
export type FieldChange = z.infer<typeof fieldChangeSchema>;

/** Public confirmation warnings; storage-only note metadata is never exposed. */
export const changeProposalNoteSchema = z
  .strictObject({
    code: field(z.string(), 'Stable warning or explanatory-note code.'),
    text: field(
      z.string(),
      'Human-readable consequence or context to show with the proposed changes.'
    )
  })
  .meta({
    description:
      'A saved proposal warning that the human should see before confirming.'
  });

/** Saved proposal metadata. No approval-page or pending-approval states exist. */
export const changeProposalSchema = z.strictObject({
  id: field(opaqueIdSchema, 'Opaque saved proposal id.'),
  notes: field(
    z.array(changeProposalNoteSchema).optional(),
    'Warnings and consequences to show alongside the exact changes before confirmation; absent on older servers or when there are no notes.'
  ),
  status: field(
    z.string(),
    'Current saved proposal state; unknown future states must be preserved.'
  ),
  risk: field(
    z.enum(['low', 'standard', 'sensitive']),
    'Effective risk after field-level escalation.'
  ),
  expires_at: field(
    z.iso.datetime({ offset: true }),
    'Time after which this proposal can no longer be applied.'
  ),
  applied_at: field(
    z.iso.datetime({ offset: true }).nullable().optional(),
    'Time the proposal was applied, if it was applied.'
  ),
  replayed: field(
    z.boolean().optional(),
    'True when returning a stored result without applying again.'
  )
});
export type ChangeProposal = z.infer<typeof changeProposalSchema>;

const writeEnvelopeShape = {
  status: field(
    z.string().optional(),
    'Saved-proposal outcome; absent on older servers.'
  ),
  proposal: field(
    changeProposalSchema.nullable().optional(),
    'Saved proposal and expiry. Confirm its exact changes before applying; absent on older servers.'
  ),
  applied: field(
    z.boolean(),
    'True when the change was written. False on a dry run or when nothing differed from the current values.'
  ),
  dry_run: field(
    z.boolean(),
    'True when the call was a preview: values were validated and authorized but nothing was written.'
  ),
  changes: field(
    z.array(fieldChangeSchema),
    'Field-level changes (empty when every requested value already matched). Summarize these back to the human.'
  )
};

/** Wrap an updated DTO in the standard write-result envelope under `key`. */
export function writeResultSchema<K extends string, T extends z.ZodType>(
  key: K,
  updated: T,
  description: string
) {
  return z
    .strictObject({
      ...writeEnvelopeShape,
      [key]: updated
    } as typeof writeEnvelopeShape & { [P in K]: T })
    .meta({ description });
}

export const fleetSettingsSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, 'Opaque fleet id.'),
    name: field(z.string().nullable(), 'Fleet display name shown to riders.'),
    description: field(
      z.string().nullable(),
      'Public description (bio) shown on the booking page.'
    ),
    contact_phone: field(
      z.string().nullable(),
      'Public contact phone riders can call.'
    ),
    contact_whatsapp: field(
      z.string().nullable(),
      'Public WhatsApp number, or null.'
    ),
    dispatch_phone: field(
      z.string().nullable(),
      'Phone number the dispatch desk answers, or null.'
    ),
    website: field(z.string().nullable(), 'Public website URL, or null.'),
    city: field(z.string().nullable(), 'Primary city the fleet operates in.'),
    country_iso_code: field(
      z.string().nullable(),
      'ISO 3166-1 alpha-2 country code.'
    ),
    region_iso_code: field(
      z.string().nullable(),
      'ISO 3166-2 region/state code, or null.'
    ),
    currency_iso_code: field(
      z.string().nullable(),
      'ISO 4217 currency the fleet prices in.'
    ),
    timezone: field(z.string().nullable(), 'IANA timezone of the fleet.'),
    primary_color: field(
      z.string().nullable(),
      'Brand primary color as a hex string (e.g. "#1E90FF"), or null.'
    ),
    secondary_color: field(
      z.string().nullable(),
      'Brand secondary color as a hex string, or null.'
    ),
    show_driver_locations: field(
      z.boolean(),
      'Whether riders see live driver locations on the public booking page.'
    ),
    allow_fleet_custom_fares: field(
      z.boolean(),
      'Whether drivers may run the meter with their own custom fares.'
    ),
    allow_outside_origin_pickup: field(
      z.boolean(),
      'Whether riders may request pickups outside the service zones.'
    ),
    allow_outside_destination_dropoff: field(
      z.boolean(),
      'Whether riders may request drop-offs outside the service zones.'
    )
  })
  .meta({
    description:
      'Editable public and operational settings of a fleet (owners/admins). Never contains join codes, payout or payment-provider data.'
  });
export type FleetSettings = z.infer<typeof fleetSettingsSchema>;

export const fleetSettingsWriteSchema = writeResultSchema(
  'fleet',
  fleetSettingsSchema,
  'Result of update_fleet_settings: what changed and the fleet settings after the call.'
);
export type FleetSettingsWrite = z.infer<typeof fleetSettingsWriteSchema>;

export const DISPATCH_MODES = [
  'NONE',
  'ALL_ONLINE_DRIVERS',
  'AUTO_DISPATCH'
] as const;
export const BOOKING_PAYMENT_MODES = [
  'disabled',
  'payments_optional',
  'pre_payment_required'
] as const;
export const DRIVER_CANCELLATION_REASONS = [
  'vehicle_issue',
  'safety',
  'payment_dispute',
  'address_unreachable',
  'rider_request',
  'driver_other'
] as const;
export const DRIVER_CANCELLATION_FEE_MODES = [
  'none',
  'standard_cancellation_fee',
  'support_review'
] as const;
export const DRIVER_POST_PICKUP_CANCELLATION_MODES = [
  'disabled',
  'driver_cancel',
  'support_approval'
] as const;
export const CANCELLATION_GRACE_PERIOD_SECONDS = [
  0, 300, 600, 1800, 3600, 21600, 43200, 86400
] as const;
export const NO_SHOW_GRACE_PERIOD_SECONDS = [
  0, 60, 180, 300, 600, 900
] as const;
export const TIME_SLOT_MINUTES = [15, 30, 45, 60] as const;

export const bookingHoursSchema = z.array(
  z.strictObject({
    day: field(
      z.enum([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      ]),
      'Day of the week in fleet timezone.'
    ),
    enabled: field(z.boolean(), 'Whether riders may book on this day.'),
    start_time: field(
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      'Opening time, HH:mm in fleet timezone.'
    ),
    end_time: field(
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      'Closing time, HH:mm. Earlier than opening means overnight.'
    )
  })
);

export const bookingSettingsSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, 'The fleet these settings belong to.'),
    availability: field(
      bookingHoursSchema.optional(),
      'Weekly booking hours in fleet timezone. Overnight windows are supported; omitted days normalize to open all day. Absent only in replayed results saved before availability was exposed.'
    ),
    dispatch_mode: field(
      z.enum(DISPATCH_MODES),
      'How new bookings reach drivers: NONE (dispatcher assigns manually), ALL_ONLINE_DRIVERS (offered to every online driver), AUTO_DISPATCH (nearest available driver).'
    ),
    payment_mode: field(
      z.enum(BOOKING_PAYMENT_MODES),
      'pre_payment_required: riders add a card when they book; it is authorized before pickup and charged the final fare after the trip. payments_optional: no card at booking; riders pay the driver after the trip (cash, Tap to Pay, payment link) or online from their trip receipt. disabled: deprecated; merged into payments_optional and no longer stored.'
    ),
    min_lead_time_seconds: field(
      z.number().int(),
      'Minimum notice between booking and pickup.',
      { unit: 'seconds' }
    ),
    time_slot_minutes: field(
      z.number().int().nullable(),
      'Granularity of hourly (time) bookings, or null when not set.',
      { unit: 'minutes' }
    ),
    minimum_duration_minutes: field(
      z.number().int().nullable(),
      'Minimum length of an hourly booking, or null.',
      { unit: 'minutes' }
    ),
    cancellation_fee_fraction: field(
      z.number(),
      'Rider cancellation fee as a fraction of the fare (0-1) once the grace period has passed.'
    ),
    cancellation_fee_minimum_unit_amount: field(
      z.number(),
      "Minimum rider cancellation fee in the fleet currency's minor unit.",
      { unit: 'minor currency units' }
    ),
    cancellation_grace_period_seconds: field(
      z.number().int(),
      'How long after booking a rider may cancel for free.',
      { unit: 'seconds' }
    ),
    driver_cancellation_allowed_reasons: field(
      z.array(z.enum(DRIVER_CANCELLATION_REASONS)),
      'Reasons a driver may pick when cancelling an accepted booking.'
    ),
    driver_cancellation_fee_mode: field(
      z.enum(DRIVER_CANCELLATION_FEE_MODES),
      'What happens to the cancellation fee when a driver cancels.'
    ),
    driver_no_show_grace_period_seconds: field(
      z.number().int(),
      'How long a driver waits at pickup before reporting a no-show.',
      { unit: 'seconds' }
    ),
    driver_post_pickup_cancellation_mode: field(
      z.enum(DRIVER_POST_PICKUP_CANCELLATION_MODES),
      'Whether drivers may cancel after pickup and whether support must approve.'
    ),
    owner_booking_email_enabled: field(
      z.boolean(),
      'Whether the fleet owner is emailed about each new booking.'
    ),
    individual_passenger_capacity: field(
      z.number().int(),
      'Default passenger capacity for bookings without a ride option.'
    ),
    updated_at: field(
      isoTimestampNullableSchema,
      'When the settings last changed.'
    )
  })
  .meta({
    description:
      'Booking policy of a fleet (owners/admins): dispatch, payment, lead time, cancellation terms.'
  });
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const bookingSettingsWriteSchema = writeResultSchema(
  'booking_settings',
  field(
    bookingSettingsSchema.nullable(),
    'The booking settings after the call. Null only on a dry run for a fleet that has no booking settings yet; the real call creates them.'
  ),
  'Result of update_booking_settings: what changed and the booking settings after the call.'
);
export type BookingSettingsWrite = z.infer<typeof bookingSettingsWriteSchema>;

export const fareDetailSchema = fareSummarySchema
  .extend({
    fare_id: field(opaqueIdSchema, 'Opaque fare id.'),
    tax_rate: field(
      z.number(),
      'Tax rate applied to the fare as a fraction (0.08 = 8%).'
    ),
    distance_rounding: field(
      z.number().nullable(),
      'Distance rounding granularity in miles or km, or null.'
    ),
    minute_rate_speed_threshold_kph: field(
      z.number().nullable(),
      'When set, minute_rate only accrues below this speed (km/h); null charges time continuously.'
    ),
    hidden_from_drivers: field(
      z.boolean(),
      'True when drivers cannot pick this fare in the meter app.'
    ),
    description: field(
      z.string().nullable(),
      'Short description of when this fare applies, or null.'
    )
  })
  .meta({
    description:
      'Editable rates of a fare. Full fare models and tiers are not exposed.'
  });

export const rideOptionDetailSchema = z
  .strictObject({
    id: field(opaqueIdSchema, 'Ride option id.'),
    fleet_id: field(opaqueIdSchema, 'The fleet offering this option.'),
    name: field(z.string(), 'Ride option name (e.g. "Sedan", "Van").'),
    type: field(
      z.enum(['POINT_TO_POINT', 'TIME', 'METERED']),
      'POINT_TO_POINT: upfront quote from A to B; TIME: hourly booking; METERED: priced by the meter.'
    ),
    capacity: field(z.number().int(), 'Passenger capacity.'),
    fare: field(
      fareDetailSchema.nullable(),
      'The default fare (rate card) riders are quoted with, or null when none is attached.'
    )
  })
  .meta({
    description:
      'A bookable ride option with its editable default fare (owners/admins).'
  });
export type RideOptionDetail = z.infer<typeof rideOptionDetailSchema>;

export const rideOptionWriteSchema = writeResultSchema(
  'ride_option',
  rideOptionDetailSchema,
  'Result of update_ride_option: what changed and the ride option after the call.'
);
export type RideOptionWrite = z.infer<typeof rideOptionWriteSchema>;

export const vehicleAssignmentWriteSchema = writeResultSchema(
  'vehicle',
  vehicleSchema,
  'Result of assign_vehicle: the vehicle with its (new) assigned_driver.'
);
export type VehicleAssignmentWrite = z.infer<
  typeof vehicleAssignmentWriteSchema
>;

export const NAVIGATION_PROVIDERS = [
  'in_app',
  'apple_maps',
  'google_maps',
  'waze',
  'naver_maps'
] as const;

export const myProfileSchema = z
  .strictObject({
    id: field(opaqueIdSchema, 'Your profile id.'),
    first_name: field(z.string().nullable(), 'Your first name.'),
    last_name: field(z.string().nullable(), 'Your last name.'),
    display_name: field(
      z.string().nullable(),
      'First and last name combined, as other people see it.'
    ),
    email: field(z.string().nullable(), 'Your email (read-only here).', {
      roles: ['self']
    }),
    phone: field(z.string().nullable(), 'Your phone (read-only here).', {
      roles: ['self']
    }),
    company_name: field(
      z.string().nullable(),
      'Business name printed on your receipts.'
    ),
    preferred_navigation_provider: field(
      z.enum(NAVIGATION_PROVIDERS),
      'Navigation app the meter opens for directions.'
    ),
    hide_contact_on_receipt: field(
      z.boolean(),
      'Hide your phone and email on rider receipts (Meter Pro).'
    ),
    pass_credit_card_fees_to_customer: field(
      z.boolean(),
      'Add the Meter Pay card fee to the rider total instead of absorbing it (Meter Pro).'
    ),
    fleets: field(
      z.array(
        z.strictObject({
          fleet_id: field(opaqueIdSchema, 'Fleet id.'),
          role: fleetRoleSchema
        })
      ),
      'Your fleet memberships (read-only here; roles are changed by fleet owners in the console).'
    )
  })
  .meta({
    description:
      "The caller's own editable profile. Role, fleet, payout and verification data are not editable through this server."
  });
export type MyProfile = z.infer<typeof myProfileSchema>;

export const myProfileWriteSchema = writeResultSchema(
  'profile',
  myProfileSchema,
  'Result of update_my_profile: what changed and your profile after the call.'
);
export type MyProfileWrite = z.infer<typeof myProfileWriteSchema>;

export const availabilityShiftSchema = z
  .strictObject({
    start_time: field(
      z.string(),
      'Shift start as HH:MM (24-hour) in the schedule timezone.'
    ),
    end_time: field(
      z.string(),
      'Shift end as HH:MM (24-hour); must be after start_time.'
    )
  })
  .meta({ description: 'One availability window within a day.' });

export const availabilityDaySchema = z
  .strictObject({
    day_of_week: field(
      z.number().int().min(1).max(7),
      'ISO weekday: 1 = Monday ... 7 = Sunday.'
    ),
    shifts: field(
      z.array(availabilityShiftSchema),
      'Availability windows on that day, earliest first. Empty means unavailable.'
    )
  })
  .meta({ description: 'Availability for one weekday.' });

export const driverAvailabilitySchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, 'The driver (the caller).'),
    timezone: field(
      z.string(),
      'IANA timezone the shift times are expressed in.'
    ),
    days: field(
      z.array(availabilityDaySchema),
      'Seven entries, Monday (1) to Sunday (7).'
    ),
    updated_at: field(
      isoTimestampNullableSchema,
      'When the schedule last changed, or null when never saved.'
    )
  })
  .meta({
    description:
      "The caller's weekly availability that riders see when booking a specific driver."
  });
export type DriverAvailability = z.infer<typeof driverAvailabilitySchema>;

export const driverAvailabilityWriteSchema = writeResultSchema(
  'availability',
  driverAvailabilitySchema,
  'Result of update_my_availability: what changed and the weekly schedule after the call.'
);
export type DriverAvailabilityWrite = z.infer<
  typeof driverAvailabilityWriteSchema
>;

export const ONBOARDING_ITEM_KEYS = [
  'fleet_profile',
  'brand_icon',
  'service_area',
  'ride_option_with_fare',
  'booking_settings',
  'vehicle',
  'driver',
  'payouts_connected',
  'booking_link',
  'first_booking'
] as const;

export const onboardingItemSchema = z
  .strictObject({
    key: field(
      z.enum(ONBOARDING_ITEM_KEYS),
      'Stable identifier of the setup step.'
    ),
    title: field(z.string(), 'Short human title of the step.'),
    done: field(z.boolean(), 'True when the step is complete.'),
    required: field(
      z.boolean(),
      'True when riders cannot book until this step is done.'
    ),
    how_to: field(
      z.string(),
      'What to do next: the MCP tool that completes the step when one exists, otherwise the web page.'
    ),
    tool: field(
      z.string().nullable(),
      'Name of the MCP tool that completes this step, or null when it needs the web console.'
    ),
    url: field(
      z.string().nullable(),
      'Absolute web URL where a human completes the step, or null.'
    )
  })
  .meta({ description: 'One onboarding checklist item.' });

export const onboardingChecklistSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, 'The fleet.'),
    fleet_name: field(z.string().nullable(), 'Fleet display name.'),
    booking_page_status: field(
      z.enum(['public_listed', 'unlisted_slug', 'hidden_unavailable']),
      'public_listed: bookable and listed in the rider app; unlisted_slug: bookable by link only (billing inactive); hidden_unavailable: riders cannot book yet.'
    ),
    booking_page_url: field(
      z.string().nullable(),
      'Public booking page to share with riders, or null until the fleet has a public link.'
    ),
    done_count: field(z.number().int(), 'Items done.'),
    total_count: field(z.number().int(), 'Total items.'),
    required_remaining: field(
      z.array(z.enum(ONBOARDING_ITEM_KEYS)),
      'Ids of required items still open, in recommended order.'
    ),
    items: field(
      z.array(onboardingItemSchema),
      'Checklist items in recommended order.'
    )
  })
  .meta({
    description:
      'Result of get_onboarding_checklist: setup progress for a fleet with the tool or page that completes each step. Payment-provider ids are never included.'
  });
export type OnboardingChecklist = z.infer<typeof onboardingChecklistSchema>;
export type OnboardingItem = z.infer<typeof onboardingItemSchema>;
