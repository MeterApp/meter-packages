import * as z from "zod";
import {
  customerDetailSchema,
  customerPageSchema,
} from "../../dto/customer.ts";
import {
  cursorSchema,
  fleetIdSchema,
  limitSchema,
  READ_ONLY,
} from "./shared.ts";

export const customersSchemas = {
  list_customers: z.strictObject({
    fleet_id: fleetIdSchema.describe(
      "Fleet whose customers to list (owners/admins). Omit as a solo driver to list your own customers.",
    ),
    query: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Only customers whose name, phone or email contains this text.",
      ),
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  get_customer: z.strictObject({
    rider_id: z.uuid().describe("Customer from list_customers."),
    fleet_id: fleetIdSchema.describe(
      "Fleet the customer booked with (owners/admins). Omit as a solo driver.",
    ),
  }),
} as const;

const access = {
  personas: ["fleet_owner", "fleet_admin", "solo_driver"],
  requiresOperationalFleet: true,
} as const;

export const customersTools = {
  list_customers: {
    name: "list_customers",
    title: "List customers",
    description:
      "Riders who have booked with a fleet, most recent booking first, with name, phone and email as the web console's Customers page shows them. Fleet owners/admins of an operational fleet; a solo driver sees their own customers. Fleet drivers get a permission error. Filter with query; page with cursor and limit. Use rider_id with get_customer, update_booking or quotes.",
    domain: "customers",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: customersSchemas.list_customers,
    outputSchema: customerPageSchema,
    returns: "CustomerPage",
    example: { query: "garcia" },
    annotations: READ_ONLY,
  },
  get_customer: {
    name: "get_customer",
    title: "Get a customer",
    description:
      "One rider who has booked with the fleet (or with the calling solo driver): name, phone, email, first and last booking, and up to 20 recent bookings to open with get_booking. Fleet owners/admins of an operational fleet, or the solo driver. A rider who never booked with that fleet is not found.",
    domain: "customers",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: customersSchemas.get_customer,
    outputSchema: customerDetailSchema,
    returns: "CustomerDetail",
    example: { rider_id: "55555555-5555-4555-8555-555555555555" },
    annotations: READ_ONLY,
  },
} as const;
