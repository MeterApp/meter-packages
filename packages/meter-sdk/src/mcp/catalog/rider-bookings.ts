import * as z from "zod";
import {
  quoteResponseWriteSchema,
  ratingPromptSchema,
  RIDE_ISSUE_CATEGORY_CODES,
  RIDE_RATING_TAG_CODES,
  rideChangeWriteSchema,
  rideDetailsWriteSchema,
  rideIssueReportWriteSchema,
  rideRatingWriteSchema,
} from "../../dto/index.ts";
import { rideLocationSchema } from "./rider-rides.ts";
import {
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const bookingIdSchema = z
  .string()
  .uuid()
  .describe("Your booking id from list_bookings or request_ride.");

export const riderBookingSchemas = {
  change_ride: z.strictObject({
    booking_id: bookingIdSchema,
    pickup_time: z.iso
      .datetime({ offset: true })
      .optional()
      .describe("New pickup time, ISO 8601 with offset. Scheduled rides only."),
    pickup: rideLocationSchema.optional().describe("New pickup location."),
    dropoff: rideLocationSchema.optional().describe("New drop-off location."),
    stops: z
      .array(rideLocationSchema)
      .max(10)
      .optional()
      .describe("Replacement stops in order; [] removes every stop."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  update_ride_details: z.strictObject({
    booking_id: bookingIdSchema,
    notes: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .describe("Notes the driver sees (gate code, luggage …); null clears."),
    flight_number: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .nullable()
      .optional()
      .describe(
        "Flight number for an airport pickup, e.g. DL5463; null clears. It must match a real flight on the pickup date.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  respond_to_quote: z.strictObject({
    quote_id: z
      .string()
      .uuid()
      .describe("Quote id from list_quotes or get_quote."),
    decision: z
      .enum(["accept", "decline"])
      .describe("accept books the quoted ride; decline turns it down."),
    reason: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe("Why you decline, shared with the fleet. Decline only."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  get_rating_prompt: z.strictObject({}),
  rate_ride: z.strictObject({
    booking_id: bookingIdSchema,
    rating: z.number().int().min(1).max(5).describe("Stars, 1-5."),
    tags: z
      .array(z.enum(RIDE_RATING_TAG_CODES))
      .max(20)
      .optional()
      .describe(
        "Reasons from get_rating_prompt: compliments with 4-5 stars, issues with 1-3 stars.",
      ),
    comment: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .describe("Optional comment for the fleet."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  report_ride_issue: z.strictObject({
    booking_id: bookingIdSchema,
    category: z
      .enum(RIDE_ISSUE_CATEGORY_CODES)
      .describe("What kind of problem."),
    description: z
      .string()
      .trim()
      .min(3)
      .max(2000)
      .describe("What happened, in the rider's words."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
} as const;

const RIDER = {
  personas: ["rider"],
  requiresOperationalFleet: false,
  recordScoped: true,
} as const;

export const riderBookingTools = {
  change_ride: {
    name: "change_ride",
    title: "Change a ride",
    description:
      "Change the pickup time, pickup, drop-off or stops of one of your own bookings. Call with dry_run: true and show the human the new route, time and price (price_before, price_after, price_change_minor); confirm with proposal_id. When next_step is open_link the change needs a higher card hold, which Meter never takes in chat for this assistant: send the human action_link to change and pay on the booking page, and do not confirm. Pickup and time changes close shortly before pickup (the fleet's policy).",
    domain: "bookings",
    kind: "write",
    risk: "sensitive",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.change_ride,
    outputSchema: rideChangeWriteSchema,
    returns: "RideChangeWrite",
    example: {
      booking_id: "33333333-3333-4333-8333-333333333333",
      pickup_time: "2026-10-20T09:00:00-04:00",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  update_ride_details: {
    name: "update_ride_details",
    title: "Edit ride notes or flight",
    description:
      "Set or clear the driver notes or the flight number of one of your own upcoming bookings. Preview with dry_run: true, then confirm with proposal_id. A flight number that matches no flight on the pickup date is refused. The price never changes.",
    domain: "bookings",
    kind: "write",
    risk: "low",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.update_ride_details,
    outputSchema: rideDetailsWriteSchema,
    returns: "RideDetailsWrite",
    example: {
      booking_id: "33333333-3333-4333-8333-333333333333",
      notes: "Gate code 4512",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  respond_to_quote: {
    name: "respond_to_quote",
    title: "Accept or decline a quote",
    description:
      "Answer a quote a fleet sent you. Preview with dry_run: true and show the route, time, price, expiry and how payment works; confirm with proposal_id. Accepting books the ride. When payment is meter_page (next_step open_link) the human accepts and pays on Meter's quote page: send action_link and do not confirm. Declining is final and tells the fleet.",
    domain: "quotes",
    kind: "write",
    risk: "sensitive",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.respond_to_quote,
    outputSchema: quoteResponseWriteSchema,
    returns: "QuoteResponseWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      decision: "accept",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  get_rating_prompt: {
    name: "get_rating_prompt",
    title: "Ride waiting for a rating",
    description:
      "Your newest completed ride that still waits for a rating (within a week of the ride), or null, plus the reason codes rate_ride accepts. Use it after a ride ends to offer rating and tipping.",
    domain: "bookings",
    kind: "read",
    risk: "none",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.get_rating_prompt,
    outputSchema: ratingPromptSchema,
    returns: "RatingPrompt",
    example: {},
    annotations: READ_ONLY,
  },
  rate_ride: {
    name: "rate_ride",
    title: "Rate a ride",
    description:
      "Rate one of your own completed rides 1-5 stars with optional reasons and comment, within 30 days of the ride. Rating again replaces your earlier rating. Preview with dry_run: true, then confirm with proposal_id. The result includes tip_link, a Meter page where the human may tip; tipping never happens in chat.",
    domain: "bookings",
    kind: "write",
    risk: "low",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.rate_ride,
    outputSchema: rideRatingWriteSchema,
    returns: "RideRatingWrite",
    example: {
      booking_id: "33333333-3333-4333-8333-333333333333",
      rating: 5,
      tags: ["on_time"],
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  report_ride_issue: {
    name: "report_ride_issue",
    title: "Report a ride problem",
    description:
      "Report an app, booking, dispatch or payment problem with one of your own bookings to Meter support, including cancelled ones. It never changes a rating and is not shown to the driver. Preview with dry_run: true, then confirm with proposal_id; the result carries a support reference number. Refunds go through get_action_link request_refund.",
    domain: "feedback",
    kind: "write",
    risk: "low",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderBookingSchemas.report_ride_issue,
    outputSchema: rideIssueReportWriteSchema,
    returns: "RideIssueReportWrite",
    example: {
      booking_id: "33333333-3333-4333-8333-333333333333",
      category: "payment_problem",
      description: "I was charged twice for this ride.",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
} as const;
