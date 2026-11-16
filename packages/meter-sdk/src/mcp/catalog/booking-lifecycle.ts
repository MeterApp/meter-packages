/**
 * The driver side of a booking, as the native driver apps run it: claim a
 * booking or a dispatch offer, report each step to the pickup, complete it,
 * report a no-show and move the pickup time. Starting the trip and anything
 * that records live GPS stay in the apps.
 */
import * as z from "zod";
import {
  BOOKING_PROGRESS_STEPS,
  bookingLifecycleWriteSchema,
  dispatchOffersSchema,
  dispatchOfferWriteSchema,
} from "../../dto/booking-lifecycle.ts";
import {
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const bookingId = z
  .uuid()
  .describe("Booking from list_bookings or get_booking.");

export const bookingLifecycleSchemas = {
  accept_booking: z.strictObject({
    booking_id: bookingId,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  record_booking_progress: z.strictObject({
    booking_id: bookingId,
    step: z
      .enum(BOOKING_PROGRESS_STEPS)
      .describe(
        "enroute_to_pickup: driving to the rider. arrived_at_pickup: waiting at the pickup. picked_up: the rider is in the car. Steps go in this order on a started trip.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  complete_booking: z.strictObject({
    booking_id: bookingId,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  report_booking_no_show: z.strictObject({
    booking_id: bookingId,
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .describe(
        "Optional note for the fleet, e.g. how long the driver waited.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  change_booking_pickup_time: z.strictObject({
    booking_id: bookingId,
    scheduled_time: z.iso
      .datetime({ offset: true })
      .describe(
        'New pickup time, ISO 8601 with offset, e.g. "2026-11-02T08:30:00-05:00".',
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  list_dispatch_offers: z.strictObject({}),
  respond_to_dispatch_offer: z.strictObject({
    dispatch_id: z.uuid().describe("Offer from list_dispatch_offers."),
    response: z
      .enum(["accept", "decline"])
      .describe(
        "accept: take the booking. decline: pass, so dispatch offers it to the next driver.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
} as const;

const drivers = {
  personas: ["fleet_owner", "fleet_admin", "fleet_driver", "solo_driver"],
  requiresOperationalFleet: true,
  recordScoped: true,
} as const;
const fleetDrivers = {
  personas: ["fleet_owner", "fleet_admin", "fleet_driver"],
  requiresOperationalFleet: true,
  recordScoped: true,
} as const;
const example = {
  booking_id: "33333333-3333-4333-8333-333333333333",
  dry_run: true,
};

export const bookingLifecycleTools = {
  accept_booking: {
    name: "accept_booking",
    title: "Accept a booking",
    description:
      "Take a booking as its driver, as the driver app's Accept does: a fleet member claims an unassigned fleet booking, and a solo driver confirms their own. Preview with dry_run: true, show the scheduled time and pickup, then confirm the saved proposal_id with identical arguments. Refused when another driver already holds the booking; owners/admins assign other drivers with assign_booking. Never starts the trip, charges or authorizes a card.",
    domain: "bookings",
    kind: "write",
    risk: "standard",
    access: drivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.accept_booking,
    outputSchema: bookingLifecycleWriteSchema,
    returns: "BookingLifecycleWrite",
    example,
    annotations: SETTINGS_WRITE,
  },
  record_booking_progress: {
    name: "record_booking_progress",
    title: "Record a step to the pickup",
    description:
      "Record the next driver step on a started booking: enroute_to_pickup, arrived_at_pickup or picked_up, the same steps as the driver app's buttons; the rider is told and the driver app follows within seconds. Only the assigned driver, the solo booking owner or a fleet owner/admin. The trip must already be started in the driver app (starting needs live GPS and stays there). Preview with dry_run: true, then confirm the saved proposal_id with identical arguments.",
    domain: "bookings",
    kind: "write",
    risk: "standard",
    access: drivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.record_booking_progress,
    outputSchema: bookingLifecycleWriteSchema,
    returns: "BookingLifecycleWrite",
    example: { ...example, step: "arrived_at_pickup" },
    annotations: SETTINGS_WRITE,
  },
  complete_booking: {
    name: "complete_booking",
    title: "Complete a booking",
    description:
      "Finish a confirmed or in-progress booking without a recorded route, as the web console's Complete does: the trip is created at the booked fare and the rider's card is charged or the held payment captured (a pay-after-trip booking is left to collect). Fleet owners/admins complete any assigned booking; the assigned driver or solo owner completes their own (after picked_up when the trip recorded its steps). Preview with dry_run: true and show the fare and payment note, then confirm the saved proposal_id with identical arguments. Use the driver app instead to bill the metered route.",
    domain: "bookings",
    kind: "write",
    // Settlement can move money. Keep the fleet workflow in Meter.
    surfaces: [],
    risk: "sensitive",
    access: drivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.complete_booking,
    outputSchema: bookingLifecycleWriteSchema,
    returns: "BookingLifecycleWrite",
    example,
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
  report_booking_no_show: {
    name: "report_booking_no_show",
    title: "Report a rider no-show",
    description:
      "Cancel a started booking because the rider did not come out, as the driver app's No-show does. Only after the driver arrived at the pickup and waited out the fleet's no-show wait; only the assigned driver, the solo booking owner or a fleet owner/admin. The fleet's no-show fee is charged to the rider when its policy has one. Preview with dry_run: true and show the fee, then confirm the saved proposal_id with identical arguments.",
    domain: "bookings",
    kind: "write",
    // Settlement can move money. Keep the fleet workflow in Meter.
    surfaces: [],
    risk: "sensitive",
    access: drivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.report_booking_no_show,
    outputSchema: bookingLifecycleWriteSchema,
    returns: "BookingLifecycleWrite",
    example,
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  change_booking_pickup_time: {
    name: "change_booking_pickup_time",
    title: "Change a booking's pickup time",
    description:
      "Move a pending or confirmed booking to a new pickup time, as Edit pickup time in the driver app and console does. The fare is re-estimated for the new time; when the price rises the rider must accept it first and the booking keeps its old time until then (rider_confirmation_pending). Refused when the time is outside booking hours or clashes with another booking. The assigned driver, the solo booking owner or a fleet owner/admin. Preview with dry_run: true showing old and new time, then confirm the saved proposal_id with identical arguments.",
    domain: "bookings",
    kind: "write",
    risk: "standard",
    access: drivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.change_booking_pickup_time,
    outputSchema: bookingLifecycleWriteSchema,
    returns: "BookingLifecycleWrite",
    example: { ...example, scheduled_time: "2026-11-02T08:30:00-05:00" },
    annotations: SETTINGS_WRITE,
  },
  list_dispatch_offers: {
    name: "list_dispatch_offers",
    title: "List dispatch offers",
    description:
      "Rides realtime dispatch is offering the caller right now, with pickup, distance, timing and expected payout. Offers expire quickly (expires_at); answer one with respond_to_dispatch_offer. Empty when nothing is waiting. Fleet members only.",
    domain: "bookings",
    kind: "read",
    risk: "none",
    access: fleetDrivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.list_dispatch_offers,
    outputSchema: dispatchOffersSchema,
    returns: "DispatchOffers",
    example: {},
    annotations: { ...READ_ONLY, idempotentHint: false },
  },
  respond_to_dispatch_offer: {
    name: "respond_to_dispatch_offer",
    title: "Answer a dispatch offer",
    description:
      "Accept or decline a ride realtime dispatch offered the caller, as the driver app's offer card does. accept assigns the booking to the caller; decline passes it to the next driver. Preview with dry_run: true showing the pickup and expiry, then confirm the saved proposal_id with identical arguments before expires_at. An offer that expired or went to someone else is refused.",
    domain: "bookings",
    kind: "write",
    risk: "standard",
    access: fleetDrivers,
    exposure: "on_demand",
    inputSchema: bookingLifecycleSchemas.respond_to_dispatch_offer,
    outputSchema: dispatchOfferWriteSchema,
    returns: "DispatchOfferWrite",
    example: {
      dispatch_id: "66666666-6666-4666-8666-666666666666",
      response: "accept",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
} as const;
