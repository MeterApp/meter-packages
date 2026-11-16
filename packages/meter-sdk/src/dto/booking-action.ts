import * as z from "zod";
import { writeResultSchema } from "./settings.ts";

export const bookingCancellationSchema = z
  .strictObject({
    booking_id: z.uuid().describe("Booking identifier for get_booking."),
    outcome: z
      .literal("cancellation_committed")
      .describe(
        "The booking cancellation committed; provider settlement is separate.",
      ),
    settlement: z
      .literal("pending")
      .describe(
        "Financial/provider settlement was queued, not confirmed. Read get_booking for current handoff state.",
      ),
    fee_unit_amount: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .describe(
        "Approved cancellation fee in the explicit currency's minor units; not proof of a charge.",
      ),
    currency_code: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .describe("Supported currency of the approved fee."),
  })
  .meta({
    id: "BookingCancellation",
    description:
      "Minimal committed booking cancellation; never proof of provider money movement.",
  });
export const bookingPaymentReminderSchema = z
  .strictObject({
    booking_id: z.uuid().describe("Booking identifier for get_booking."),
    outcome: z
      .literal("reminder_queued")
      .describe("One bounded rider reminder was queued."),
    delivery: z
      .literal("pending")
      .describe(
        "Delivery was queued, not confirmed; ambiguous delivery is never automatically resent.",
      ),
  })
  .meta({
    id: "BookingPaymentReminder",
    description: "Minimal queued reminder; never proof of remote delivery.",
  });

export const bookingActionSchema = z.discriminatedUnion("outcome", [
  bookingCancellationSchema,
  bookingPaymentReminderSchema,
]);
export type BookingAction = z.infer<typeof bookingActionSchema>;
export const bookingCancellationWriteSchema = writeResultSchema(
  "booking_action",
  bookingCancellationSchema,
  "Preview or confirmed booking cancellation.",
).meta({ id: "BookingCancellationWrite" });
export const bookingPaymentReminderWriteSchema = writeResultSchema(
  "booking_action",
  bookingPaymentReminderSchema,
  "Preview or queued booking payment reminder.",
).meta({ id: "BookingPaymentReminderWrite" });
