import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";
import { actionLinkSchema } from "./handoff.ts";
import { writeResultSchema } from "./settings.ts";

const currency = field(
  z.string().regex(/^[A-Z]{3}$/),
  "ISO 4217 currency code, upper-case.",
);
const minor = (description: string) =>
  field(
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    description,
    {
      unit: "minor currency units",
    },
  );

export const riderFleetSchema = z
  .strictObject({
    fleet_id: field(
      opaqueIdSchema,
      "Fleet id for estimate_ride and request_ride.",
    ),
    slug: field(z.string().nullable(), "Public booking-page slug, or null."),
    name: field(z.string().nullable(), "Fleet display name."),
    city: field(z.string().nullable(), "City the fleet is based in, or null."),
    region: field(z.string().nullable(), "Region or state code, or null."),
    country: field(
      z.string().nullable(),
      "ISO 3166-1 alpha-2 country, or null.",
    ),
    currency: field(
      z.string().nullable(),
      "ISO 4217 currency the fleet prices in, or null.",
    ),
    rating: field(
      z.strictObject({
        average: field(
          z.number().nullable(),
          "Average rider rating from 1 to 5, or null.",
        ),
        review_count: field(
          z.number().int().nonnegative(),
          "Number of reviews.",
        ),
      }),
      "Public rating summary.",
    ),
    is_saved: field(
      z.boolean(),
      "True when the rider already saved or booked this fleet; saved fleets come first.",
    ),
    payment_at_booking: field(
      z.enum(["saved_card", "pay_driver_after_trip"]),
      "saved_card: a card saved in the rider's Meter account is held when booking; pay_driver_after_trip: no card is needed to book.",
    ),
    service_types: field(
      z.array(z.string()),
      "Ride products offered: POINT_TO_POINT, METERED and/or TIME.",
    ),
    max_capacity: field(
      z.number().int().nullable(),
      "Largest passenger capacity among ride options, or null.",
    ),
    distance_meters: field(
      z.number().nonnegative().nullable(),
      "Distance from the searched point when known, or null.",
      { unit: "meters" },
    ),
    booking_url: field(
      z.string().url().nullable(),
      "Public booking page, or null when the fleet has no slug.",
    ),
  })
  .meta({
    description: "A fleet the rider can book. Public profile fields only.",
  });

export const riderFleetPageSchema = z
  .strictObject({
    items: field(
      z.array(riderFleetSchema),
      "Fleets, saved fleets first, then by rating and distance.",
    ),
    next_cursor: field(
      z.string().nullable(),
      "Send back as cursor for the next page; null when done.",
    ),
    has_more: field(z.boolean(), "True when another page exists."),
    scope: field(
      z.enum(["nearby", "global"]),
      "nearby: fleets serving the searched point plus saved fleets; global: every publicly listed fleet matching the query.",
    ),
  })
  .meta({ id: "RiderFleetPage", description: "Bookable fleets for a rider." });
export type RiderFleetPage = z.infer<typeof riderFleetPageSchema>;

export const placeCandidateSchema = z
  .strictObject({
    name: field(z.string(), "Place name."),
    address: field(z.string(), "Formatted address."),
    place_id: field(z.string().nullable(), "Google place id, or null."),
    latitude: field(z.number().min(-90).max(90), "Latitude in degrees."),
    longitude: field(z.number().min(-180).max(180), "Longitude in degrees."),
  })
  .meta({ description: "A candidate place for a pickup, stop or drop-off." });

export const placeSearchSchema = z
  .strictObject({
    places: field(
      z.array(placeCandidateSchema),
      "Best matches first. Confirm the right one with the human when more than one is plausible.",
    ),
  })
  .meta({ id: "PlaceSearch", description: "Places matching a text search." });
export type PlaceSearch = z.infer<typeof placeSearchSchema>;

export const ridePlaceSchema = z
  .strictObject({
    name: field(z.string().nullable(), "Place name, or null."),
    address: field(z.string().nullable(), "Formatted address, or null."),
  })
  .meta({ description: "A ride location as shown to the rider." });

export const ridePriceSchema = z
  .strictObject({
    amount_minor: minor("Price the rider is quoted, in minor units."),
    currency,
    display: field(
      z.string(),
      "Price formatted for the human in the request locale.",
    ),
    mode: field(
      z.enum(["fixed", "estimate", "metered"]),
      "fixed: the quoted price is the fare; estimate: the final fare can change (for example overtime); metered: charged by the meter, the amount is an estimate.",
    ),
    disclosure: field(
      z.string().nullable(),
      "Pricing disclosure to show the human before confirming, or null.",
    ),
  })
  .meta({ description: "Rider-facing ride price." });

export const rideCancellationPolicySchema = z
  .strictObject({
    grace_period_seconds: field(
      z.number().int().nonnegative(),
      "Free cancellation window after booking.",
      { unit: "seconds" },
    ),
    fee_minor: field(
      z.number().int().nonnegative().nullable(),
      "Fee for cancelling after the free window, in minor units; null when unknown or none.",
      { unit: "minor currency units" },
    ),
    currency: field(z.string().nullable(), "Currency of the fee, or null."),
    summary: field(z.string(), "One-sentence policy summary for the human."),
  })
  .meta({ description: "Rider cancellation policy for this ride." });

export const rideOptionEstimateSchema = z
  .strictObject({
    ride_option_id: field(
      opaqueIdSchema,
      "Send to request_ride as ride_option_id.",
    ),
    estimate_id: field(
      opaqueIdSchema,
      "Server estimate reference for this option.",
    ),
    name: field(z.string(), "Ride option name, e.g. Sedan."),
    capacity: field(
      z.number().int().nullable(),
      "Maximum passengers, or null.",
    ),
    recommended: field(
      z.boolean(),
      "True for the option best matching the passenger count.",
    ),
    price: field(ridePriceSchema, "Quoted price."),
    cancellation_policy: field(
      rideCancellationPolicySchema,
      "Cancellation policy for this option.",
    ),
    bookable_here: field(
      z.boolean(),
      "False when this option can only be booked in the Meter app (it needs pricing features an agent cannot show).",
    ),
  })
  .meta({ description: "One priced ride option." });

const routeShape = {
  fleet_id: field(opaqueIdSchema, "Fleet being booked."),
  fleet_name: field(z.string().nullable(), "Fleet display name."),
  pickup: field(ridePlaceSchema, "Pickup."),
  dropoff: field(
    ridePlaceSchema.nullable(),
    "Drop-off, or null for a metered ride without one.",
  ),
  stops: field(z.array(ridePlaceSchema), "Intermediate stops in order."),
  pickup_time: field(
    z.string().nullable(),
    "Requested pickup time (ISO 8601 with offset), or null for as soon as possible.",
    { unit: "ISO 8601" },
  ),
  timezone: field(z.string().nullable(), "IANA timezone of the pickup."),
  distance_meters: field(
    z.number().nonnegative().nullable(),
    "Estimated route distance.",
    { unit: "meters" },
  ),
  duration_seconds: field(
    z.number().nonnegative().nullable(),
    "Estimated route duration.",
    { unit: "seconds" },
  ),
};

export const rideEstimateSchema = z
  .strictObject({
    ...routeShape,
    options: field(
      z.array(rideOptionEstimateSchema),
      "Priced ride options, cheapest first.",
    ),
  })
  .meta({
    id: "RideEstimate",
    description: "Prices for a ride. Books nothing and holds no money.",
  });
export type RideEstimate = z.infer<typeof rideEstimateSchema>;

export const ridePaymentSchema = z
  .strictObject({
    method: field(
      z.enum(["saved_card", "meter_checkout", "pay_driver_after_trip"]),
      "saved_card: the default card in the rider's Meter account is held and charged by the fleet; meter_checkout: the human confirms and pays on Meter's own page (nothing is booked in chat); pay_driver_after_trip: no card is needed now.",
    ),
    card_brand: field(
      z.string().nullable(),
      "Brand of the saved card (e.g. visa), or null.",
    ),
    card_last4: field(
      z.string().nullable(),
      "Last four digits of the saved card, or null.",
    ),
  })
  .meta({
    description:
      "How the rider will pay. Never a card number or payment-provider id.",
  });

export const rideRequestSchema = z
  .strictObject({
    booking_id: field(
      opaqueIdSchema.nullable(),
      "Created booking id for get_ride_status; null in a preview.",
    ),
    booking_status: field(
      z.string().nullable(),
      "Booking status after creation (pending, confirmed …); null in a preview.",
    ),
    ...routeShape,
    passengers: field(z.number().int().positive(), "Passenger count."),
    ride_option: field(
      z.strictObject({
        ride_option_id: field(opaqueIdSchema, "Ride option id."),
        name: field(z.string(), "Ride option name."),
        capacity: field(
          z.number().int().nullable(),
          "Maximum passengers, or null.",
        ),
      }),
      "Selected ride option.",
    ),
    price: field(ridePriceSchema, "Quoted price."),
    payment: field(ridePaymentSchema, "How the rider pays."),
    cancellation_policy: field(
      rideCancellationPolicySchema,
      "Cancellation policy.",
    ),
    payment_authorization_failed: field(
      z.boolean(),
      "True when the booking was created but the card hold failed; send the human the finish_ride_payment link.",
    ),
    action_link: field(
      actionLinkSchema.nullable(),
      "Where the human tracks the ride, finishes payment or checks out on Meter; null in a preview.",
    ),
    next_step: field(
      z.enum(["confirm", "send_checkout_link", "track", "finish_payment"]),
      "confirm: a preview, ask the human. send_checkout_link: nothing is booked yet; send action_link, the human confirms and pays on Meter, then check list_bookings or get_ride_status. track: booked; share action_link. finish_payment: booked but the card hold failed; send action_link.",
    ),
    checkout_expires_at: field(
      z.string().nullable(),
      "When the Meter checkout link stops working (about 30 minutes); null unless next_step is send_checkout_link.",
      { unit: "ISO 8601" },
    ),
  })
  .meta({ description: "A ride request preview or the created booking." });
export type RideRequest = z.infer<typeof rideRequestSchema>;

export const rideRequestWriteSchema = writeResultSchema(
  "ride_request",
  rideRequestSchema,
  "Preview or created rider booking.",
).meta({ id: "RideRequestWrite" });

export const quoteRequestSchema = z
  .strictObject({
    quote_id: field(
      opaqueIdSchema.nullable(),
      "Saved quote id for get_quote and respond_to_quote; null in a preview.",
    ),
    status: field(
      z.string().nullable(),
      "Quote status once saved (open …); null in a preview.",
    ),
    ...routeShape,
    passengers: field(z.number().int().positive(), "Passenger count."),
    ride_option: field(
      z.strictObject({
        ride_option_id: field(opaqueIdSchema, "Ride option id."),
        name: field(z.string(), "Ride option name."),
        capacity: field(
          z.number().int().nullable(),
          "Maximum passengers, or null.",
        ),
      }),
      "Quoted ride option.",
    ),
    price: field(ridePriceSchema, "Quoted price."),
    follow_up_requested: field(
      z.boolean(),
      "True when the fleet is asked to reply to the rider about this quote.",
    ),
    special_request: field(
      z.string().nullable(),
      "What the rider asked the fleet, or null.",
    ),
    expires_at: field(
      z.string().nullable(),
      "When the saved quote stops being bookable; null in a preview.",
      { unit: "ISO 8601" },
    ),
    action_link: field(
      actionLinkSchema.nullable(),
      "Meter quote page where the human reviews, books and pays; null in a preview.",
    ),
    next_step: field(
      z.enum(["confirm", "done"]),
      "confirm: a preview, ask the human. done: the quote is saved; share action_link.",
    ),
  })
  .meta({ description: "A rider's own quote request preview or saved quote." });
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteRequestWriteSchema = writeResultSchema(
  "quote_request",
  quoteRequestSchema,
  "Preview or saved rider quote.",
).meta({ id: "QuoteRequestWrite" });

export const rideStatusSchema = z
  .strictObject({
    booking_id: field(opaqueIdSchema, "Booking id."),
    status: field(
      z.string(),
      "Booking status: pending, pending_payment, confirmed, in_progress, completed, canceled …",
    ),
    trip_state: field(
      z.string(),
      "Rider-facing stage: payment_required, pending, dispatching, assigned, arriving, in_progress, completed, canceled or unknown.",
    ),
    fleet_name: field(z.string().nullable(), "Fleet display name."),
    pickup: field(ridePlaceSchema, "Pickup."),
    dropoff: field(ridePlaceSchema.nullable(), "Drop-off, or null."),
    stops: field(z.array(ridePlaceSchema), "Intermediate stops."),
    scheduled_at: field(z.string().nullable(), "Scheduled pickup (ISO 8601).", {
      unit: "ISO 8601",
    }),
    timezone: field(z.string().nullable(), "IANA timezone of the pickup."),
    is_asap: field(z.boolean(), "True for an as-soon-as-possible ride."),
    price: field(
      z
        .strictObject({
          amount_minor: minor("Quoted total in minor units."),
          currency,
        })
        .nullable(),
      "Quoted total, or null when unknown.",
    ),
    driver: field(
      z
        .strictObject({
          first_name: field(z.string().nullable(), "Driver first name."),
          photo_url: field(z.string().nullable(), "Driver photo URL, or null."),
          phone: field(
            z.string().nullable(),
            "Driver phone the rider may call, or null.",
          ),
          vehicle: field(
            z
              .strictObject({
                make: field(z.string().nullable(), "Vehicle make."),
                model: field(z.string().nullable(), "Vehicle model."),
                color: field(z.string().nullable(), "Vehicle color."),
                license_plate: field(z.string().nullable(), "License plate."),
              })
              .nullable(),
            "Assigned vehicle, or null.",
          ),
        })
        .nullable(),
      "Assigned driver, or null before assignment.",
    ),
    tracking: field(
      z.strictObject({
        status: field(z.string(), "live, stale, not_started or unavailable."),
        pickup_eta: field(
          z.string().nullable(),
          "Estimated driver arrival at pickup (ISO 8601), or null.",
          { unit: "ISO 8601" },
        ),
        dropoff_eta: field(
          z.string().nullable(),
          "Estimated arrival at drop-off (ISO 8601), or null.",
          { unit: "ISO 8601" },
        ),
        driver_position: field(
          z
            .strictObject({
              latitude: field(z.number(), "Latitude in degrees."),
              longitude: field(z.number(), "Longitude in degrees."),
              updated_at: field(
                z.string().nullable(),
                "When the position was reported.",
              ),
            })
            .nullable(),
          "Driver position while the ride is live, or null.",
        ),
      }),
      "Live tracking; present only while the trip view provides it.",
    ),
    cancellation: field(
      z
        .strictObject({
          can_cancel: field(
            z.boolean(),
            "True when the rider can cancel with cancel_booking now.",
          ),
          fee_minor: field(
            z.number().int().nonnegative().nullable(),
            "Fee if cancelled now, in minor units; 0 when free.",
            { unit: "minor currency units" },
          ),
          currency: field(z.string().nullable(), "Currency of the fee."),
          free_until: field(
            z.string().nullable(),
            "End of the free cancellation window (ISO 8601), or null.",
            { unit: "ISO 8601" },
          ),
        })
        .nullable(),
      "What cancelling now would cost, or null when the ride can no longer be cancelled by the rider.",
    ),
    requires_payment_action: field(
      z.boolean(),
      "True when the human must finish payment (bank authentication or a new card); use the finish_ride_payment link.",
    ),
    track_url: field(
      z.string().url().nullable(),
      "Meter page where the human follows this ride and sees the receipt.",
    ),
    receipt_url: field(
      z.string().url().nullable(),
      "Receipt page once completed (requires sign-in), or null.",
    ),
    tip_url: field(
      z.string().url().nullable(),
      "Meter page where the human can tip the driver once the ride is completed, or null. A link only: nothing is charged from chat.",
    ),
  })
  .meta({
    id: "RideStatus",
    description: "Rider view of one of their own rides.",
  });
export type RideStatus = z.infer<typeof rideStatusSchema>;
