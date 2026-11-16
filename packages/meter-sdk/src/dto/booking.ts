import * as z from 'zod';
import {
  currencyCodeSchema,
  field,
  isoTimestampSchema,
  minorAmountSchema,
  opaqueIdSchema,
  pageSchema,
  personRefSchema,
  placeSchema
} from './common.ts';

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'pending_payment'
] as const;

export const bookingStatusSchema = field(
  z.enum(BOOKING_STATUSES),
  'Booking lifecycle: pending (awaiting a driver), confirmed (driver assigned), in_progress, completed, canceled, pending_payment (rider must pay before it is dispatched).'
);

export const bookingRiderSchema = z
  .strictObject({
    display_name: field(z.string().nullable(), 'Rider display name, or null.'),
    phone: field(
      z.string().nullable(),
      'Rider phone (E.164). Only for fleet owners/admins, the assigned driver, or the rider themselves; null otherwise.',
      { roles: ['owner', 'admin', 'driver', 'rider'] }
    ),
    email: field(
      z.string().nullable(),
      'Rider email. Only for fleet owners/admins or the rider themselves; null otherwise.',
      { roles: ['owner', 'admin', 'rider'] }
    )
  })
  .meta({
    description: 'The rider on a booking. Contact details depend on the viewer.'
  });

export const bookingRideOptionSchema = z
  .strictObject({
    id: field(opaqueIdSchema, 'Ride option id.'),
    name: field(z.string(), 'Ride option name.'),
    type: field(z.string(), 'Ride option type.'),
    capacity: field(z.number().int(), 'Passenger capacity.')
  })
  .meta({ description: 'The vehicle class the rider booked.' });

export const bookingEstimateSchema = z
  .strictObject({
    currency: field(currencyCodeSchema, 'Currency of total_minor.'),
    total_minor: field(
      minorAmountSchema,
      'Quoted total shown to the rider, in minor units.'
    )
  })
  .meta({ description: 'The upfront estimate quoted at booking time.' });

export const bookingActionStatusSchema = z.strictObject({
  cancellation_settlement: field(
    z.enum(['pending', 'processing', 'completed', 'manual_handoff']).nullable(),
    'Native cancellation processor progress. Completed is not proof of a charge, refund or notification delivery; manual_handoff requires human review.'
  ),
  payment_reminder_delivery: field(
    z
      .enum([
        'pending',
        'preparing',
        'sending',
        'completed',
        'superseded',
        'unknown'
      ])
      .nullable(),
    'Latest agent reminder delivery state; sending or unknown must not be automatically resent.'
  ),
  has_ambiguous_reminder: field(
    z.boolean(),
    'A reminder may have been delivered; inspect before another reminder.'
  )
});

export const bookingSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, 'Opaque booking id (a scheduled ride).'),
    fleet_id: field(
      z.string().nullable(),
      'Fleet the ride was booked with, or null for a solo driver booking.'
    ),
    status: bookingStatusSchema,
    agent_action_status: field(
      bookingActionStatusSchema.optional(),
      'Details-only agent cancellation and reminder progress; omitted from list_bookings.'
    ),
    is_asap: field(
      z.boolean(),
      'True for on-demand ("as soon as possible") rides.'
    ),
    is_time_booking: field(
      z.boolean(),
      'True for hourly / by-the-hour bookings.'
    ),
    booking_source: field(
      z.string().nullable(),
      'Where the booking came from: web, web_embedded, rider_app, meter_app, admin_web, voice, messaging.'
    ),
    scheduled_at: field(isoTimestampSchema, 'Requested pickup time.'),
    timezone: field(z.string(), 'IANA timezone of the pickup.'),
    pickup: field(placeSchema, 'Pickup place.'),
    dropoff: field(
      placeSchema.nullable(),
      'Drop-off place, or null for open-ended time bookings.'
    ),
    stop_count: field(z.number().int(), 'Number of intermediate stops.'),
    passenger_count: field(z.number().int(), 'Passengers requested.'),
    estimated_distance_meters: field(
      z.number().nullable(),
      'Estimated route distance.',
      { unit: 'meters' }
    ),
    estimated_duration_seconds: field(
      z.number().nullable(),
      'Estimated route duration.',
      { unit: 'seconds' }
    ),
    estimate: field(
      bookingEstimateSchema.nullable(),
      'Upfront quote, or null when not priced.'
    ),
    ride_option: field(
      bookingRideOptionSchema.nullable(),
      'Vehicle class booked, or null.'
    ),
    assigned_driver: field(
      personRefSchema.nullable(),
      'Driver assigned to the ride, or null while pending.'
    ),
    preferred_driver: field(
      personRefSchema.nullable(),
      'Driver the rider or dispatcher preferred, or null.'
    ),
    rider: field(
      bookingRiderSchema.nullable(),
      'The rider, or null for a driver-entered booking without a rider.'
    ),
    notes: field(
      z.string().nullable(),
      'Pickup instructions the rider or dispatcher wrote for the driver.'
    ),
    flight_number: field(
      z.string().nullable(),
      'Flight number for airport pickups, or null.'
    ),
    cancellation_reason: field(
      z.string().nullable(),
      'Stored cancellation reason enum, or null.'
    ),
    pre_payment_status: field(
      z.string(),
      'Payment authorization state (stored enum).'
    ),
    trip_id: field(
      z.string().nullable(),
      'Linked metered trip once the ride is completed, or null.'
    ),
    created_at: field(isoTimestampSchema, 'When the booking was created.'),
    updated_at: field(isoTimestampSchema, 'When the booking last changed.')
  })
  .meta({
    description:
      'A booking (scheduled ride). No payment-provider ids, internal snapshots or dispatch internals.'
  });
export type Booking = z.infer<typeof bookingSchema>;

export const bookingPageSchema = pageSchema(bookingSchema).meta({
  description:
    'Result of list_bookings. Cursor pagination is by scheduled time.'
});
export type BookingPage = z.infer<typeof bookingPageSchema>;

export const AUDIT_ACTOR_ROLES = [
  'owner',
  'admin',
  'driver',
  'fleet_member',
  'rider',
  'system',
  'unknown'
] as const;

export const bookingAuditChangeSchema = z
  .strictObject({
    field: field(
      z.string(),
      'Machine name of the changed field (e.g. "scheduled_time").'
    ),
    label: field(z.string(), 'Human label of the changed field.'),
    old: field(
      z.string().nullable(),
      'Previous value as display text, or null.'
    ),
    new: field(z.string().nullable(), 'New value as display text, or null.')
  })
  .meta({ description: 'One redacted field change inside an audit entry.' });

export const bookingAuditEntrySchema = z
  .strictObject({
    at: field(isoTimestampSchema, 'When the event happened.'),
    event: field(z.string(), 'Short event title, e.g. "Driver assigned".'),
    summary: field(z.string().nullable(), 'One-line human summary, or null.'),
    actor_role: field(
      z.enum(AUDIT_ACTOR_ROLES),
      'Role of whoever acted: owner, admin, driver, fleet_member (fleet user of unrecorded role), rider, system (automation), unknown. Never an id or name.'
    ),
    category: field(
      z.string(),
      'Event category: booking_change, status, dispatch, notification, payment, route, rider, driver, system.'
    ),
    outcome: field(
      z.string(),
      'ok, invalid (rejected request), error, pending or unknown.'
    ),
    field_changes: field(
      z.array(bookingAuditChangeSchema),
      'Redacted field-level changes, possibly empty.'
    )
  })
  .meta({
    description:
      'A redacted booking timeline entry. Raw audit JSON is never exposed.'
  });
export type BookingAuditEntry = z.infer<typeof bookingAuditEntrySchema>;

export const bookingAuditLogSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, 'The booking these entries belong to.'),
    entries: field(
      z.array(bookingAuditEntrySchema),
      'Timeline entries, newest first.'
    ),
    next_cursor: field(
      z.string().nullable(),
      'Cursor for the next (older) page, or null.'
    ),
    has_more: field(z.boolean(), 'True when older entries exist.')
  })
  .meta({ description: 'Result of get_booking_audit_log.' });
export type BookingAuditLog = z.infer<typeof bookingAuditLogSchema>;
