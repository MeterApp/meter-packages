import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  minorAmountSchema,
  placeSchema,
} from "./common.ts";
import { BOOKING_STATUSES } from "./booking.ts";
import { writeResultSchema } from "./settings.ts";

/** Driver-side steps an agent may record, in the order the driver apps offer them. */
export const BOOKING_PROGRESS_STEPS = [
  "enroute_to_pickup",
  "arrived_at_pickup",
  "picked_up",
] as const;
export type BookingProgressStep = (typeof BOOKING_PROGRESS_STEPS)[number];

export const BOOKING_LIFECYCLE_EVENTS = [
  "accepted",
  ...BOOKING_PROGRESS_STEPS,
  "completed",
  "no_show_reported",
  "pickup_time_changed",
] as const;

/** Minimal immutable outcome: use get_booking for currently visible details. */
export const bookingLifecycleSchema = z
  .strictObject({
    booking_id: z.uuid().describe("Booking identifier for get_booking."),
    event: field(
      z.enum(BOOKING_LIFECYCLE_EVENTS),
      "What this command recorded on the booking.",
    ),
    status: z
      .enum(BOOKING_STATUSES)
      .describe("Booking status frozen at command completion."),
    assigned_driver_id: z
      .uuid()
      .nullable()
      .describe("Assigned driver at completion, or null when unassigned."),
    scheduled_time: isoTimestampSchema,
    trip_id: z
      .uuid()
      .nullable()
      .describe(
        "Trip created by completion, for get_trip; null for every other event.",
      ),
    rider_confirmation_pending: field(
      z.boolean(),
      "True when a new pickup time changed the price and the rider must accept it before it takes effect; the booking keeps its old time until then.",
    ),
  })
  .meta({
    id: "BookingLifecycle",
    description:
      "Immutable minimal outcome of a driver or dispatcher booking step; read current details with get_booking.",
  });
export type BookingLifecycle = z.infer<typeof bookingLifecycleSchema>;

export const bookingLifecycleWriteSchema = writeResultSchema(
  "booking",
  bookingLifecycleSchema,
  "Preview or confirmed saved booking step with immutable outcome.",
).meta({ id: "BookingLifecycleWrite" });
export type BookingLifecycleWrite = z.infer<typeof bookingLifecycleWriteSchema>;

export const DISPATCH_OFFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;

export const dispatchOfferSchema = z
  .strictObject({
    dispatch_id: z
      .uuid()
      .describe("Offer to answer with respond_to_dispatch_offer."),
    booking_id: z.uuid().describe("Offered booking, for get_booking."),
    status: field(
      z.enum(DISPATCH_OFFER_STATUSES),
      "pending: waiting for this driver; accepted/declined: answered; expired: the driver did not answer in time; cancelled: withdrawn because the booking went to someone else or stopped waiting for a driver.",
    ),
    expires_at: isoTimestampSchema,
    scheduled_time: isoTimestampNullableSchema,
    pickup: placeSchema.nullable(),
    dropoff: placeSchema.nullable(),
    pickup_distance_meters: field(
      z.number().nonnegative().nullable(),
      "Driving distance from the driver to the pickup when offered.",
      { unit: "meters" },
    ),
    pickup_duration_seconds: field(
      z.number().nonnegative().nullable(),
      "Driving time from the driver to the pickup when offered.",
      { unit: "seconds" },
    ),
    trip_distance_meters: field(
      z.number().nonnegative().nullable(),
      "Pickup-to-drop-off route distance.",
      { unit: "meters" },
    ),
    trip_duration_seconds: field(
      z.number().nonnegative().nullable(),
      "Pickup-to-drop-off route duration.",
      { unit: "seconds" },
    ),
    expected_payout: minorAmountSchema
      .nullable()
      .describe(
        "What the driver is expected to earn after fees and fleet share, in minor units; null when unknown.",
      ),
    currency: currencyCodeSchema.nullable(),
  })
  .meta({
    id: "DispatchOffer",
    description:
      "A ride offered to the calling driver by realtime dispatch. Offers expire within seconds to minutes.",
  });
export type DispatchOffer = z.infer<typeof dispatchOfferSchema>;

export const dispatchOffersSchema = z
  .strictObject({
    items: field(
      z.array(dispatchOfferSchema),
      "The caller's offers that are still waiting for an answer; empty when none.",
    ),
  })
  .meta({ id: "DispatchOffers", description: "Pending dispatch offers." });
export type DispatchOffers = z.infer<typeof dispatchOffersSchema>;

export const dispatchOfferWriteSchema = writeResultSchema(
  "dispatch_offer",
  dispatchOfferSchema,
  "Preview or confirmed answer to a dispatch offer.",
).meta({ id: "DispatchOfferWrite" });
export type DispatchOfferWrite = z.infer<typeof dispatchOfferWriteSchema>;
