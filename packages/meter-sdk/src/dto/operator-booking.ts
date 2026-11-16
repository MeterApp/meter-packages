import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";
import { BOOKING_STATUSES } from "./booking.ts";
import {
  rideCancellationPolicySchema,
  ridePlaceSchema,
  ridePriceSchema,
} from "./rider-ride.ts";
import { writeResultSchema } from "./settings.ts";

/** Channels the customer is told through when the booking is created. */
export const CUSTOMER_NOTIFICATION_CHANNELS = ["sms", "email"] as const;

export const bookedCustomerSchema = z.strictObject({
  rider_id: field(
    z.uuid().nullable(),
    "Customer id; null in a preview of a customer Meter does not know yet.",
  ),
  first_name: field(z.string().nullable(), "First name, or null."),
  last_name: field(z.string().nullable(), "Last name, or null."),
  phone: field(z.string().nullable(), "Phone (E.164), or null.", {
    roles: ["owner", "admin", "self"],
  }),
  email: field(z.string().nullable(), "Email, or null.", {
    roles: ["owner", "admin", "self"],
  }),
  is_new: field(
    z.boolean(),
    "True when confirming creates this customer (a new Meter rider or a rider new to your customers).",
  ),
});

export const operatorBookingSchema = z
  .strictObject({
    booking_id: field(
      z.uuid().nullable(),
      "Created booking id for get_booking; null in a preview.",
    ),
    status: field(
      z.enum(BOOKING_STATUSES).nullable(),
      "Booking status after creation; null in a preview.",
    ),
    fleet_id: field(opaqueIdSchema, "Fleet taking the booking."),
    fleet_name: field(z.string().nullable(), "Fleet display name."),
    customer: field(bookedCustomerSchema, "Who rides."),
    pickup: field(ridePlaceSchema, "Pickup."),
    dropoff: field(
      ridePlaceSchema.nullable(),
      "Drop-off, or null for a metered ride without one.",
    ),
    stops: field(z.array(ridePlaceSchema), "Intermediate stops in order."),
    pickup_time: field(
      z.string().nullable(),
      "Pickup time (ISO 8601 with offset), or null for as soon as possible.",
      { unit: "ISO 8601" },
    ),
    timezone: field(z.string().nullable(), "IANA timezone of the pickup."),
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
      "Ride option booked.",
    ),
    price: field(ridePriceSchema, "Quoted fare the customer pays."),
    payment: field(
      z.enum(["after_trip"]),
      "after_trip: nothing is charged at booking; the customer pays the driver after the ride (cash, card in person or an invoice). For upfront payment through a Meter link use create_quote then send_quote instead.",
    ),
    cancellation_policy: field(
      rideCancellationPolicySchema,
      "Cancellation policy that applies to the customer.",
    ),
    notes: field(z.string().nullable(), "Notes for the driver, or null."),
    flight_number: field(z.string().nullable(), "Flight number, or null."),
    driver_id: field(
      z.uuid().nullable(),
      "Driver requested for the booking, or null for the fleet's dispatch to pick one.",
    ),
    driver_assignment: field(
      z.enum(["none", "requested", "assigned", "failed"]),
      "none: no driver chosen. requested: a preview that assigns driver_id on confirm. assigned: the driver has the booking. failed: the booking exists but the assignment was refused; use assign_booking.",
    ),
    customer_notifications: field(
      z.array(z.enum(CUSTOMER_NOTIFICATION_CHANNELS)),
      "How the customer is told about the booking (confirmation with a tracking link). Empty when Meter has no phone or email for them.",
    ),
  })
  .meta({
    id: "OperatorBooking",
    description:
      "A booking an operator creates for a customer: preview, or the created booking.",
  });
export type OperatorBooking = z.infer<typeof operatorBookingSchema>;

export const operatorBookingWriteSchema = writeResultSchema(
  "booking",
  operatorBookingSchema,
  "Preview or result of create_booking.",
).meta({ id: "OperatorBookingWrite" });
export type OperatorBookingWrite = z.infer<typeof operatorBookingWriteSchema>;

export const quoteBookingConversionSchema = z
  .strictObject({
    quote_id: field(z.uuid(), "Quote converted."),
    quote_status: field(
      z.string(),
      "Quote status: open/draft in a preview, converted after confirming.",
    ),
    booking_id: field(
      z.uuid().nullable(),
      "Booking created from the quote for get_booking; null in a preview.",
    ),
    booking_status: field(
      z.enum(BOOKING_STATUSES).nullable(),
      "Booking status after creation; null in a preview.",
    ),
    pickup_at: field(z.string().nullable(), "Quoted pickup time (ISO 8601).", {
      unit: "ISO 8601",
    }),
    currency: field(z.string(), "ISO 4217 currency code."),
    total_unit_amount: field(
      z.number().int().nonnegative().nullable(),
      "Fare the customer pays (custom price when set), in minor units.",
      { unit: "minor currency units" },
    ),
    payment: field(
      z.enum(["after_trip"]),
      "after_trip: the customer pays the driver after the ride; nothing is charged now.",
    ),
    driver_id: field(
      z.uuid().nullable(),
      "Driver to assign (fleet quotes), or null.",
    ),
    driver_assignment: field(
      z.enum(["none", "requested", "assigned", "failed"]),
      "none, requested (preview), assigned, or failed (booking exists; use assign_booking).",
    ),
  })
  .meta({
    id: "QuoteBookingConversion",
    description: "A quote turned into a booking by its operator.",
  });
export type QuoteBookingConversion = z.infer<
  typeof quoteBookingConversionSchema
>;

export const quoteBookingConversionWriteSchema = writeResultSchema(
  "conversion",
  quoteBookingConversionSchema,
  "Preview or result of book_quote.",
).meta({ id: "QuoteBookingConversionWrite" });
