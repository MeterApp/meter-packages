import * as z from 'zod';
import {
  field,
  fleetRoleSchema,
  isoTimestampNullableSchema,
  opaqueIdSchema
} from './common.ts';

export const fleetSummarySchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, 'Opaque fleet id.'),
    name: field(z.string().nullable(), 'Fleet display name.'),
    city: field(z.string().nullable(), 'Primary city the fleet operates in.'),
    country_iso_code: field(
      z.string().nullable(),
      'ISO 3166-1 alpha-2 country code.'
    ),
    currency_iso_code: field(
      z.string().nullable(),
      'ISO 4217 currency the fleet prices in.'
    ),
    timezone: field(
      z.string().nullable(),
      'IANA timezone of the fleet, e.g. "America/New_York".'
    ),
    role: fleetRoleSchema,
    is_operational: field(
      z.boolean(),
      'True when onboarding is complete and billing is active; admin-only tools require this.'
    ),
    created_at: field(isoTimestampNullableSchema, 'When the fleet was created.')
  })
  .meta({ description: 'A fleet as seen in list_fleets.' });
export type FleetSummary = z.infer<typeof fleetSummarySchema>;

export const fleetZoneSchema = z
  .strictObject({
    zone_id: field(z.number().int(), 'Zone id, unique within Meter.'),
    name: field(z.string(), 'Zone name (e.g. "Downtown", "Airport").'),
    description: field(
      z.string().nullable(),
      'Optional description of the zone.'
    )
  })
  .meta({ description: 'A service or pricing zone. Geometry is not exposed.' });

export const fareSummarySchema = z
  .strictObject({
    display_name: field(
      z.string().nullable(),
      'Fare name shown to drivers and riders.'
    ),
    currency_code: field(z.string(), 'ISO 4217 currency of the rates below.'),
    base: field(
      z.number(),
      'Flag-drop / base fare in major currency units (e.g. 3.50 = $3.50).',
      {
        unit: 'major currency units'
      }
    ),
    minimum_fare: field(
      z.number(),
      'Minimum total fare in major currency units.',
      {
        unit: 'major currency units'
      }
    ),
    distance_rate: field(
      z.number(),
      'Rate per distance unit (mile, or kilometer when `metric` is true) in major units.',
      {
        unit: 'major currency units per mile or km'
      }
    ),
    minute_rate: field(z.number(), 'Rate per minute in major currency units.', {
      unit: 'major currency units per minute'
    }),
    wait_time_minute_rate: field(
      z.number(),
      'Rate per minute of waiting in major currency units.',
      {
        unit: 'major currency units per minute'
      }
    ),
    metric: field(
      z.boolean(),
      'True when distance_rate is per kilometer; false when per mile.'
    )
  })
  .meta({
    description:
      'Headline rates of a fare. Full fare models and tiers are not exposed.'
  });

export const rideOptionSchema = z
  .strictObject({
    id: field(opaqueIdSchema, 'Ride option id.'),
    name: field(z.string(), 'Ride option name (e.g. "Sedan", "Van").'),
    type: field(
      z.string(),
      'Ride option type as stored (e.g. "standard", "xl").'
    ),
    capacity: field(z.number().int(), 'Passenger capacity.'),
    default_fare: field(
      fareSummarySchema.nullable(),
      'Default fare for this option, or null.'
    )
  })
  .meta({
    description: 'A bookable ride option (vehicle class) the fleet offers.'
  });

export const fleetBookingSettingsSchema = z
  .strictObject({
    dispatch_mode: field(
      z.string(),
      'How bookings are dispatched to drivers (stored enum).'
    ),
    payment_mode: field(
      z.string().nullable(),
      'Booking payment mode (stored enum), or null for the default.'
    ),
    pre_payment_enabled: field(
      z.boolean(),
      'Whether riders must authorize payment before the ride.'
    ),
    min_lead_time_seconds: field(
      z.number().int(),
      'Minimum notice for a scheduled booking.',
      { unit: 'seconds' }
    ),
    time_slot_minutes: field(
      z.number().int().nullable(),
      'Booking time-slot granularity, or null.',
      { unit: 'minutes' }
    ),
    minimum_duration_minutes: field(
      z.number().int().nullable(),
      'Minimum length of an hourly booking, or null when none is set.',
      { unit: 'minutes' }
    ),
    cancellation_fee_fraction: field(
      z.number(),
      'Cancellation fee as a fraction of the fare (0-1).'
    ),
    cancellation_grace_period_seconds: field(
      z.number().int(),
      'Free-cancellation window after booking.',
      {
        unit: 'seconds'
      }
    ),
    individual_passenger_capacity: field(
      z.number().int(),
      'Default passenger capacity for individual bookings.'
    )
  })
  .meta({
    description: 'Booking policy of the fleet. Owners and admins only.'
  });

export const fleetAdminSettingsSchema = z
  .strictObject({
    default_driver_payout_fraction: field(
      z.number().nullable(),
      'Default share of each fare paid to the driver (0-1), or null when payouts are not configured.'
    ),
    allow_fleet_custom_fares: field(
      z.boolean(),
      'Whether drivers may use custom fares.'
    ),
    show_driver_locations: field(
      z.boolean(),
      'Whether riders see live driver locations on the public booking page.'
    ),
    trip_collection_mode: field(
      z.string().nullable(),
      'Deprecated: no longer affects how trip payments are collected. Kept for compatibility; may be null.'
    ),
    tip_split_behavior: field(
      z.string().nullable(),
      'How tips are split between fleet and driver (stored enum), or null.'
    ),
    pass_credit_card_fees_to_customer: field(
      z.boolean().nullable(),
      'Whether card fees are added to the rider total.'
    )
  })
  .meta({
    description:
      'Operational settings. Owners and admins only; never contains payment-provider identifiers.'
  });

export const fleetDriverInviteSchema = z
  .strictObject({
    code: field(
      z.string(),
      'Six-character invite code a driver can enter in the Meter app to join.'
    ),
    url: field(
      z.string(),
      'Invite link to share with drivers; opening it joins this fleet after sign-in.'
    )
  })
  .meta({
    description:
      'The fleet invite owners and admins share with new drivers. Anyone with the code or link can join as a driver, so share it only with people you want in the fleet.'
  });
export type FleetDriverInvite = z.infer<typeof fleetDriverInviteSchema>;

export const fleetDetailSchema = fleetSummarySchema
  .extend({
    description: field(
      z.string().nullable(),
      'Public fleet description (bio).'
    ),
    contact_phone: field(
      z.string().nullable(),
      'Public contact phone of the fleet.'
    ),
    dispatch_phone: field(
      z.string().nullable(),
      'Public dispatch phone of the fleet.'
    ),
    website: field(z.string().nullable(), 'Public website URL.'),
    member_count: field(z.number().int(), 'Number of members (all roles).'),
    vehicle_count: field(z.number().int(), 'Number of active fleet vehicles.'),
    service_zones: field(
      z.array(fleetZoneSchema),
      'Service/pricing zones by name.'
    ),
    ride_options: field(
      z.array(rideOptionSchema),
      'Bookable ride options with headline fares.'
    ),
    booking_settings: field(
      fleetBookingSettingsSchema.nullable(),
      'Booking policy; null for drivers.',
      {
        roles: ['owner', 'admin']
      }
    ),
    admin_settings: field(
      fleetAdminSettingsSchema.nullable(),
      'Operational settings; null for drivers.',
      {
        roles: ['owner', 'admin']
      }
    ),
    driver_invite: field(
      fleetDriverInviteSchema.nullable(),
      'How new drivers join this fleet; null for drivers.',
      {
        roles: ['owner', 'admin']
      }
    )
  })
  .meta({
    description:
      'Result of get_fleet. Drivers get public info; owners/admins also get settings and the driver invite.'
  });
export type FleetDetail = z.infer<typeof fleetDetailSchema>;
