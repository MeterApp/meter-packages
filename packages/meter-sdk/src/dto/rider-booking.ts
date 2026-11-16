import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";
import { actionLinkSchema } from "./handoff.ts";
import { ridePlaceSchema } from "./rider-ride.ts";
import { writeResultSchema } from "./settings.ts";

/**
 * Codes the rider rating and issue-report flows accept. The backend owns the
 * catalogs (server/ratings/tags.ts); a backend test keeps these in step.
 */
export const RIDE_RATING_TAG_CODES = [
  "friendly_professional",
  "excellent_driving",
  "clean_vehicle",
  "on_time",
  "helpful_luggage",
  "great_communication",
  "smooth_pickup_dropoff",
  "driver_behavior",
  "driving_safety",
  "vehicle_cleanliness",
  "driver_late",
  "pickup_dropoff_issue",
  "incorrect_route",
  "communication_problem",
  "vehicle_condition",
  "booking_dispatch_problem",
  "pricing_issue",
  "app_problem",
  "payment_problem",
  "notification_problem",
  "wrong_fare_shown",
  "trip_status_wrong",
  "other",
] as const;
export const RIDE_COMPLIMENT_TAG_CODES = [
  "friendly_professional",
  "excellent_driving",
  "clean_vehicle",
  "on_time",
  "helpful_luggage",
  "great_communication",
  "smooth_pickup_dropoff",
] as const;
export const RIDE_ISSUE_CATEGORY_CODES = [
  "app_problem",
  "notification_problem",
  "booking_problem",
  "dispatch_problem",
  "wrong_fare_shown",
  "payment_problem",
  "trip_status_wrong",
  "other",
] as const;

const moneySchema = z
  .strictObject({
    amount_minor: field(
      z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      "Amount in minor units.",
      { unit: "minor currency units" },
    ),
    currency: field(
      z.string().regex(/^[A-Z]{3}$/),
      "ISO 4217 currency code, upper-case.",
    ),
    display: field(z.string(), "Amount formatted for the human."),
  })
  .meta({ description: "A fare." });

const nextStep = field(
  z.enum(["confirm", "done", "open_link", "finish_payment"]),
  "confirm: a preview, ask the human then confirm with proposal_id. done: applied. open_link: Meter does not apply this in chat; send the human action_link and do not confirm. finish_payment: applied, but the bank needs the human; send action_link.",
);

export const rideChangeSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, "Booking id."),
    pickup: field(ridePlaceSchema, "Pickup after the change."),
    dropoff: field(ridePlaceSchema.nullable(), "Drop-off after the change."),
    stops: field(z.array(ridePlaceSchema), "Stops after the change, in order."),
    pickup_time: field(
      z.string().nullable(),
      "Scheduled pickup after the change (ISO 8601), or null for as soon as possible.",
      { unit: "ISO 8601" },
    ),
    timezone: field(z.string().nullable(), "IANA timezone of the pickup."),
    price_before: field(
      moneySchema.nullable(),
      "Fare before the change, or null when unknown.",
    ),
    price_after: field(
      moneySchema.nullable(),
      "Fare after the change, or null when unknown.",
    ),
    price_change_minor: field(
      z.number().int().nullable(),
      "New fare minus old fare in minor units; positive costs more. Null when unknown.",
      { unit: "minor currency units" },
    ),
    next_step: nextStep,
    action_link: field(
      actionLinkSchema.nullable(),
      "Booking page where the human makes or pays for the change; present for open_link and finish_payment.",
    ),
  })
  .meta({ description: "A change to one of the rider's own bookings." });
export type RideChange = z.infer<typeof rideChangeSchema>;
export const rideChangeWriteSchema = writeResultSchema(
  "ride_change",
  rideChangeSchema,
  "Preview or applied change to a rider's booking.",
).meta({ id: "RideChangeWrite" });

export const rideDetailsSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, "Booking id."),
    notes: field(z.string().nullable(), "Notes the driver sees, or null."),
    flight_number: field(
      z.string().nullable(),
      "Flight number the pickup follows, or null.",
    ),
  })
  .meta({ description: "Notes and flight number of a rider's booking." });
export type RideDetails = z.infer<typeof rideDetailsSchema>;
export const rideDetailsWriteSchema = writeResultSchema(
  "ride_details",
  rideDetailsSchema,
  "Preview or applied notes and flight number.",
).meta({ id: "RideDetailsWrite" });

export const quoteResponseSchema = z
  .strictObject({
    quote_id: field(opaqueIdSchema, "Quote id."),
    decision: field(z.enum(["accept", "decline"]), "The rider's answer."),
    status: field(
      z.string(),
      "Quote status: open before the answer, converted once accepted, declined once declined.",
    ),
    fleet_name: field(z.string().nullable(), "Who sent the quote."),
    pickup: field(ridePlaceSchema, "Pickup."),
    dropoff: field(ridePlaceSchema.nullable(), "Drop-off, or null."),
    pickup_time: field(
      z.string().nullable(),
      "Scheduled pickup (ISO 8601), or null for as soon as possible.",
      { unit: "ISO 8601" },
    ),
    price: field(moneySchema.nullable(), "Quoted price, or null."),
    expires_at: field(z.string(), "When the quote stops accepting answers.", {
      unit: "ISO 8601",
    }),
    payment: field(
      z.enum(["none_at_booking", "saved_card", "meter_page"]),
      "none_at_booking: accepting books the ride with nothing charged now. saved_card: the card saved in the rider's Meter account is held. meter_page: the human accepts and pays on Meter's quote page.",
    ),
    booking_id: field(
      opaqueIdSchema.nullable(),
      "Booking the accepted quote became; null otherwise.",
    ),
    next_step: nextStep,
    action_link: field(
      actionLinkSchema.nullable(),
      "Quote page (open_link) or booking page (done, finish_payment).",
    ),
  })
  .meta({ description: "The rider's answer to a fleet's quote." });
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export const quoteResponseWriteSchema = writeResultSchema(
  "quote_response",
  quoteResponseSchema,
  "Preview or applied answer to a quote.",
).meta({ id: "QuoteResponseWrite" });

export const rideRatingSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, "Booking id."),
    rating: field(z.number().int().min(1).max(5), "Stars, 1-5."),
    tags: field(z.array(z.enum(RIDE_RATING_TAG_CODES)), "Selected reasons."),
    comment: field(z.string().nullable(), "Comment, or null."),
    replaced_rating: field(
      z.number().int().min(1).max(5).nullable(),
      "The rider's earlier rating this one replaces, or null.",
    ),
    tip_link: field(
      actionLinkSchema.nullable(),
      "Meter page where the human can tip the driver; null when unavailable.",
    ),
  })
  .meta({ description: "The rider's rating of one completed ride." });
export type RideRating = z.infer<typeof rideRatingSchema>;
export const rideRatingWriteSchema = writeResultSchema(
  "ride_rating",
  rideRatingSchema,
  "Preview or saved ride rating.",
).meta({ id: "RideRatingWrite" });

export const rideIssueReportSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, "Booking id."),
    category: field(z.enum(RIDE_ISSUE_CATEGORY_CODES), "Issue category."),
    description: field(z.string(), "What went wrong."),
    reference_number: field(
      z.number().int().nullable(),
      "Meter support reference once filed; null in a preview.",
    ),
  })
  .meta({
    description:
      "An app, booking or payment problem reported to Meter. Never changes a rating.",
  });
export type RideIssueReport = z.infer<typeof rideIssueReportSchema>;
export const rideIssueReportWriteSchema = writeResultSchema(
  "ride_issue_report",
  rideIssueReportSchema,
  "Preview or filed ride issue report.",
).meta({ id: "RideIssueReportWrite" });

export const ratingPromptSchema = z
  .strictObject({
    prompt: field(
      z
        .strictObject({
          booking_id: field(opaqueIdSchema, "Booking to rate."),
          completed_at: field(z.string(), "When the ride ended.", {
            unit: "ISO 8601",
          }),
          prompt_expires_at: field(
            z.string(),
            "When Meter stops asking for this rating.",
            { unit: "ISO 8601" },
          ),
          driver_first_name: field(z.string().nullable(), "Driver first name."),
          fleet_name: field(z.string().nullable(), "Fleet display name."),
        })
        .nullable(),
      "The newest completed ride waiting for a rating, or null.",
    ),
    compliment_tags: field(
      z.array(z.enum(RIDE_COMPLIMENT_TAG_CODES)),
      "Reasons rate_ride accepts with 4-5 stars.",
    ),
    issue_tags: field(
      z.array(z.enum(RIDE_RATING_TAG_CODES)),
      "Reasons rate_ride accepts with 1-3 stars.",
    ),
  })
  .meta({
    id: "RatingPrompt",
    description: "Which ride to rate, and the reasons a rating may carry.",
  });
export type RatingPrompt = z.infer<typeof ratingPromptSchema>;
