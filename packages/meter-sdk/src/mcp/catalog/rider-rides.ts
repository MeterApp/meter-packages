import * as z from "zod";
import {
  placeSearchSchema,
  quoteRequestWriteSchema,
  rideEstimateSchema,
  rideRequestWriteSchema,
  rideStatusSchema,
  riderFleetPageSchema,
} from "../../dto/index.ts";
import {
  cursorSchema,
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const coordinatesSchema = z.strictObject({
  latitude: z.number().min(-90).max(90).describe("Latitude in degrees."),
  longitude: z.number().min(-180).max(180).describe("Longitude in degrees."),
});

/** A ride location: free text resolved server-side, or a place from search_places. */
export const rideLocationSchema = z.union([
  z
    .string()
    .trim()
    .min(3)
    .max(300)
    .describe("Address or place name; resolved server-side."),
  z
    .strictObject({
      address: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .optional()
        .describe("Address."),
      name: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe("Place name."),
      place_id: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .optional()
        .describe("place_id from search_places."),
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .optional()
        .describe("Latitude in degrees, with longitude."),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .optional()
        .describe("Longitude in degrees, with latitude."),
    })
    .refine(
      (value) =>
        (value.latitude === undefined) === (value.longitude === undefined),
      { message: "Pass latitude and longitude together." },
    )
    .refine(
      (value) =>
        value.latitude !== undefined || Boolean(value.address || value.name),
      { message: "Pass coordinates or an address." },
    ),
]);

const rideFleetIdSchema = z
  .string()
  .uuid()
  .describe("Fleet id from find_fleets.");
const pickupTimeSchema = z.iso
  .datetime({ offset: true })
  .optional()
  .describe("Pickup time, ISO 8601 with offset. Omit for as soon as possible.");
const passengersSchema = z
  .number()
  .int()
  .min(1)
  .max(20)
  .default(1)
  .describe("Passenger count (default 1).");
const serviceTypeSchema = z
  .enum(["POINT_TO_POINT", "METERED"])
  .optional()
  .describe(
    "POINT_TO_POINT (fixed price, the default) or METERED. When omitted, metered options are priced if the fleet has no fixed-price options.",
  );

const rideShape = {
  fleet_id: rideFleetIdSchema,
  pickup: rideLocationSchema.describe("Pickup location."),
  dropoff: rideLocationSchema
    .optional()
    .describe("Drop-off location; required for fixed-price rides."),
  stops: z
    .array(rideLocationSchema)
    .max(10)
    .optional()
    .describe("Up to 10 intermediate stops, in order."),
  pickup_time: pickupTimeSchema,
  passengers: passengersSchema,
  ride_option_id: z
    .string()
    .uuid()
    .optional()
    .describe("Ride option from estimate_ride; omit for the recommended one."),
  service_type: serviceTypeSchema,
};

export const riderRideSchemas = {
  find_fleets: z.strictObject({
    near: coordinatesSchema
      .optional()
      .describe("Point to search around, e.g. the pickup."),
    address: z
      .string()
      .trim()
      .min(3)
      .max(300)
      .optional()
      .describe("Address to search around when coordinates are unknown."),
    query: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe("Fleet name or city text; searches beyond the nearby area."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Page size, 1-50 (default 20)."),
    cursor: cursorSchema,
  }),
  search_places: z.strictObject({
    query: z
      .string()
      .trim()
      .min(3)
      .max(300)
      .describe("Address, landmark or business to look up."),
    near: coordinatesSchema
      .optional()
      .describe("Bias results toward this point."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(5)
      .describe("Maximum candidates, 1-5 (default 5)."),
  }),
  estimate_ride: z.strictObject(rideShape),
  request_ride: z.strictObject({
    ...rideShape,
    preferred_driver_id: z
      .string()
      .uuid()
      .optional()
      .describe("Driver the rider asks for, if the fleet allows requests."),
    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe("Notes for the driver (gate code, luggage …)."),
    flight_number: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .optional()
      .describe("Flight number for an airport pickup."),
    promo_code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe("Fleet promo code."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  request_quote: z.strictObject({
    ...rideShape,
    follow_up: z
      .boolean()
      .default(false)
      .describe(
        "true asks the fleet to reply to the rider about this quote (special requests, questions); false only saves it for the rider.",
      ),
    special_request: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe(
        "What the rider asks the fleet, in the rider's words. With follow_up only.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  get_ride_status: z.strictObject({
    booking_id: z
      .string()
      .uuid()
      .describe("Your booking id from request_ride or list_bookings."),
  }),
} as const;

const RIDER = {
  personas: ["rider"],
  requiresOperationalFleet: false,
} as const;

export const riderRideTools = {
  find_fleets: {
    name: "find_fleets",
    title: "Find fleets to book",
    description:
      "Find taxi fleets the rider can book: saved fleets first (is_saved), then publicly listed fleets serving the point given by near or address, or matching query anywhere. Returns public profile fields only: name, city, rating, payment at booking, ride products and the public booking page. Use a fleet_id with estimate_ride.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderRideSchemas.find_fleets,
    outputSchema: riderFleetPageSchema,
    returns: "RiderFleetPage",
    example: { near: { latitude: 40.7128, longitude: -74.006 } },
    annotations: READ_ONLY,
  },
  search_places: {
    name: "search_places",
    title: "Look up a place",
    description:
      "Turn text such as an address, airport or business into up to five candidate places with coordinates. Confirm the right candidate with the human when several are plausible, then use it as pickup, dropoff or a stop. Rate limited per caller.",
    domain: "bookings",
    kind: "read",
    risk: "none",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderRideSchemas.search_places,
    outputSchema: placeSearchSchema,
    returns: "PlaceSearch",
    example: { query: "JFK Terminal 4" },
    annotations: READ_ONLY,
  },
  estimate_ride: {
    name: "estimate_ride",
    title: "Price a ride",
    description:
      "Price a ride with one fleet: each ride option's price (minor units, currency, formatted, fixed/estimate/metered), capacity and cancellation policy, plus route distance and duration. Locations may be text (resolved server-side; ambiguous text is refused, use search_places) or places from search_places. Omit pickup_time for as soon as possible. Books nothing and holds no money. Rate limited per caller.",
    domain: "bookings",
    kind: "read",
    risk: "none",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderRideSchemas.estimate_ride,
    outputSchema: rideEstimateSchema,
    returns: "RideEstimate",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      pickup: { latitude: 40.7128, longitude: -74.006, name: "Home" },
      dropoff: "JFK Terminal 4",
    },
    annotations: READ_ONLY,
  },
  request_ride: {
    name: "request_ride",
    title: "Request a ride",
    description:
      "Book a ride for yourself with a fleet. Call with dry_run: true first and show the human the route, pickup time, ride option, price, how they pay and the cancellation policy; then repeat the same arguments with proposal_id after they confirm. When the fleet takes no payment at booking the ride is booked at once. When it does, most assistants get next_step send_checkout_link: nothing is booked yet; send the human the Meter link (valid 30 minutes) to confirm and pay there, then check list_bookings or get_ride_status. Meter's own apps hold the card already saved in the rider's account instead. Cards are never entered here. A changed price refuses the booking with a fresh preview. At most a few bookings per hour.",
    domain: "bookings",
    kind: "write",
    risk: "sensitive",
    access: RIDER,
    exposure: "listed",
    inputSchema: riderRideSchemas.request_ride,
    outputSchema: rideRequestWriteSchema,
    returns: "RideRequestWrite",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      pickup: { latitude: 40.7128, longitude: -74.006, name: "Home" },
      dropoff: "JFK Terminal 4",
      pickup_time: "2026-10-20T08:30:00-04:00",
      dry_run: true,
    },
    // Creates a real-world dispatch and may hold the rider's saved card.
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  request_quote: {
    name: "request_quote",
    title: "Save or request a quote",
    description:
      "Save a quote for a ride with one fleet at the estimated price, for the rider themselves, so they can book it later; with follow_up: true the fleet is also asked to reply about it (a special request, a question, a custom price). Call with dry_run: true first and show the human the route, pickup time, ride option, price and what the fleet is asked; then repeat the same arguments with proposal_id after they confirm. Books nothing and holds no money: the rider books and pays on the Meter quote page (action_link), or answers a quote the fleet sends back with respond_to_quote. Rate limited per caller.",
    domain: "quotes",
    kind: "write",
    risk: "low",
    access: RIDER,
    exposure: "listed",
    // First-party for now: Rio offers it on a fleet's website. The Meter Rides
    // server lists every tool upfront within a fixed size it has no room in.
    surfaces: [],
    inputSchema: riderRideSchemas.request_quote,
    outputSchema: quoteRequestWriteSchema,
    returns: "QuoteRequestWrite",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      pickup: { latitude: 40.7128, longitude: -74.006, name: "Home" },
      dropoff: "JFK Terminal 4",
      pickup_time: "2026-10-20T08:30:00-04:00",
      follow_up: true,
      special_request: "We are 6 people with skis. Do you have a van?",
      dry_run: true,
    },
    // Each confirmation saves a new quote; the fleet it may notify is in Meter.
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  get_ride_status: {
    name: "get_ride_status",
    title: "Check a ride",
    description:
      "Status of one of your own rides: stage, pickup and drop-off, scheduled time, the driver's first name, photo, phone and vehicle once assigned, ETA and driver position while the trip is live, what cancelling now would cost, and the receipt page once completed. Other people's bookings return not-found.",
    domain: "bookings",
    kind: "read",
    risk: "none",
    access: { ...RIDER, recordScoped: true },
    exposure: "listed",
    inputSchema: riderRideSchemas.get_ride_status,
    outputSchema: rideStatusSchema,
    returns: "RideStatus",
    example: { booking_id: "33333333-3333-4333-8333-333333333333" },
    annotations: READ_ONLY,
  },
} as const;
