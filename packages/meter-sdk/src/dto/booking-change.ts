import * as z from "zod";
import { writeResultSchema } from "./settings.ts";
import { BOOKING_STATUSES } from "./booking.ts";

/** Minimal immutable outcome: use get_booking for currently visible details. */
export const bookingChangeSchema = z
  .strictObject({
    booking_id: z.uuid().describe("Booking identifier for get_booking."),
    status: z
      .enum(BOOKING_STATUSES)
      .describe("Booking status frozen at command completion."),
    assigned_driver_id: z
      .uuid()
      .nullable()
      .describe("Assigned driver at completion, or null when unassigned."),
    rider_id: z
      .uuid()
      .nullable()
      .describe("Rider attached at completion, or null when absent."),
  })
  .meta({
    id: "BookingChange",
    description:
      "Immutable minimal booking outcome; read current details with get_booking.",
  });
export type BookingChange = z.infer<typeof bookingChangeSchema>;

export const bookingChangeWriteSchema = writeResultSchema(
  "booking",
  bookingChangeSchema,
  "Preview or confirmed saved booking change with immutable outcome.",
).meta({ id: "BookingChangeWrite" });
export type BookingChangeWrite = z.infer<typeof bookingChangeWriteSchema>;
