import * as z from "zod";
import {
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  pageSchema,
} from "./common.ts";
import { BOOKING_STATUSES } from "./booking.ts";

export const customerSchema = z
  .strictObject({
    rider_id: z
      .uuid()
      .describe("Rider id for get_customer, update_booking or quotes."),
    first_name: field(z.string().nullable(), "Rider first name, or null."),
    last_name: field(z.string().nullable(), "Rider last name, or null."),
    phone: field(
      z.string().nullable(),
      "Rider phone (E.164), or null. Only fleet owners/admins and the solo driver who serves the rider see it.",
      { roles: ["owner", "admin", "self"] },
    ),
    email: field(
      z.string().nullable(),
      "Rider email, or null. Only fleet owners/admins and the solo driver who serves the rider see it.",
      { roles: ["owner", "admin", "self"] },
    ),
    first_seen_at: isoTimestampSchema.describe(
      "When the rider first booked with this fleet or driver.",
    ),
    last_booking_at: isoTimestampNullableSchema.describe(
      "When the rider last booked, or null.",
    ),
  })
  .meta({
    id: "Customer",
    description:
      "A rider who has booked with the fleet (or with a solo driver). Contact fields follow the web console's customer list.",
  });
export type Customer = z.infer<typeof customerSchema>;

export const customerPageSchema = pageSchema(customerSchema).meta({
  id: "CustomerPage",
  description: "Customers, most recent booking first.",
});
export type CustomerPage = z.infer<typeof customerPageSchema>;

export const customerDetailSchema = z
  .strictObject({
    customer: customerSchema,
    recent_bookings: field(
      z.array(
        z.strictObject({
          booking_id: z.uuid().describe("Booking id for get_booking."),
          status: z.enum(BOOKING_STATUSES).describe("Booking status."),
          scheduled_time: isoTimestampNullableSchema,
        }),
      ),
      "Up to 20 of the rider's bookings with this fleet or driver, newest first.",
    ),
  })
  .meta({
    id: "CustomerDetail",
    description: "One customer with their recent bookings.",
  });
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
