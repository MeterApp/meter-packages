/**
 * Operator tools for booking rides on behalf of customers and managing the
 * customer list: what the web console's Create booking flow, quote "Create
 * booking" action and Customers page do.
 */
import * as z from "zod";
import {
  CUSTOMER_IMPORT_MAX_ROWS,
  customerImportWriteSchema,
  customerWriteSchema,
} from "../../dto/customer-writes.ts";
import {
  operatorBookingWriteSchema,
  quoteBookingConversionWriteSchema,
} from "../../dto/operator-booking.ts";
import { rideLocationSchema } from "./rider-rides.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";

const nameSchema = (part: string) =>
  z.string().trim().min(1).max(100).describe(`Customer ${part} name.`);
const phoneSchema = z
  .string()
  .trim()
  .min(4)
  .max(40)
  .describe(
    "Customer mobile number, ideally E.164 (+15551234567). A national number is read in the fleet's country.",
  );
const emailSchema = z
  .email()
  .max(254)
  .describe(
    "Customer email. Only finds a rider Meter already knows; a new customer needs a phone number.",
  );

const newCustomerSchema = z
  .strictObject({
    first_name: nameSchema("first").optional(),
    last_name: nameSchema("last").optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((value) => Boolean(value.phone || value.email), {
    message: "Pass the customer's phone or email.",
  });

const importRowSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Full name; split into first and last at the first space."),
    first_name: nameSchema("first").optional(),
    last_name: nameSchema("last").optional(),
    phone: z.string().trim().max(40).optional().describe("Mobile number."),
    email: z.string().trim().max(254).optional().describe("Email."),
  })
  .describe("One customer.");

export const customerBookingSchemas = {
  create_booking: z
    .strictObject({
      fleet_id: fleetIdSchema,
      rider_id: z
        .uuid()
        .optional()
        .describe(
          "Existing customer from list_customers. Use this or customer.",
        ),
      customer: newCustomerSchema
        .optional()
        .describe(
          "Customer by phone (found or created and added to your customers) or by email (existing riders only). Use this or rider_id.",
        ),
      pickup: rideLocationSchema.describe(
        "Pickup: an address/place text (resolved server-side; ambiguous text is refused) or a place with coordinates.",
      ),
      dropoff: rideLocationSchema
        .optional()
        .describe("Drop-off; required unless service_type is METERED."),
      stops: z
        .array(rideLocationSchema)
        .max(10)
        .optional()
        .describe("Up to 10 intermediate stops, in order."),
      pickup_time: z.iso
        .datetime({ offset: true })
        .optional()
        .describe(
          "Pickup time, ISO 8601 with offset. Omit for as soon as possible.",
        ),
      passengers: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(1)
        .describe("Passenger count (default 1)."),
      ride_option_id: z
        .uuid()
        .optional()
        .describe(
          "Ride option from get_fleet or quote_booking; omit for the recommended one.",
        ),
      service_type: z
        .enum(["POINT_TO_POINT", "METERED"])
        .optional()
        .describe(
          "POINT_TO_POINT (fixed price, default) or METERED. Omitted: metered when the fleet has no fixed-price option for the trip.",
        ),
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
      driver_id: z
        .uuid()
        .optional()
        .describe(
          "Fleet driver (list_fleet_members) to assign right away; omit to leave it to dispatch.",
        ),
      dry_run: dryRunSchema,
      proposal_id: proposalIdSchema,
    })
    .refine((value) => Boolean(value.rider_id) !== Boolean(value.customer), {
      message: "Pass exactly one of rider_id or customer.",
    }),
  book_quote: z.strictObject({
    quote_id: z.uuid().describe("Draft or open quote from list_quotes."),
    driver_id: z
      .uuid()
      .optional()
      .describe("Fleet driver to assign the booking to (fleet quotes only)."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  create_customer: z
    .strictObject({
      fleet_id: fleetIdSchema.describe(
        "Fleet to add the customer to (owners/admins). Omit as a solo driver.",
      ),
      first_name: nameSchema("first").optional(),
      last_name: nameSchema("last").optional(),
      phone: phoneSchema.optional(),
      email: emailSchema.optional(),
      dry_run: dryRunSchema,
      proposal_id: proposalIdSchema,
    })
    .refine((value) => Boolean(value.phone || value.email), {
      message: "Pass the customer's phone or email.",
    }),
  update_customer: z.strictObject({
    fleet_id: fleetIdSchema.describe(
      "Fleet the customer belongs to (owners/admins). Omit as a solo driver.",
    ),
    rider_id: z.uuid().describe("Customer from list_customers."),
    first_name: nameSchema("first"),
    last_name: nameSchema("last"),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  import_customers: z
    .strictObject({
      fleet_id: fleetIdSchema.describe(
        "Fleet to import into (owners/admins). Omit as a solo driver.",
      ),
      customers: z
        .array(importRowSchema)
        .min(1)
        .max(CUSTOMER_IMPORT_MAX_ROWS)
        .optional()
        .describe(
          `Up to ${CUSTOMER_IMPORT_MAX_ROWS} customers. Use this or csv.`,
        ),
      csv: z
        .string()
        .min(1)
        .max(100_000)
        .optional()
        .describe(
          `CSV text with a header row naming columns name, first_name, last_name, phone and/or email (other columns are ignored); up to ${CUSTOMER_IMPORT_MAX_ROWS} data rows.`,
        ),
      default_country: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional()
        .describe(
          "ISO country (e.g. US) for phone numbers written without a + country code; defaults to the fleet's country.",
        ),
      dry_run: dryRunSchema,
      proposal_id: proposalIdSchema,
    })
    .refine((value) => Boolean(value.customers) !== Boolean(value.csv), {
      message: "Pass exactly one of customers or csv.",
    }),
} as const;

const ADMINS = {
  personas: ["fleet_owner", "fleet_admin"],
  requiresOperationalFleet: true,
} as const;
const ADMINS_AND_SOLO = {
  personas: ["fleet_owner", "fleet_admin", "solo_driver"],
  requiresOperationalFleet: true,
} as const;
const CREATE_WRITE = { ...SETTINGS_WRITE, idempotentHint: false };

export const customerBookingTools = {
  create_booking: {
    name: "create_booking",
    title: "Book a ride for a customer",
    description:
      "Create a fleet booking on behalf of a customer, as the console's Create booking flow does: pickup, drop-off, stops, pickup time (or ASAP), ride option, passengers, driver notes, flight number, and optionally a driver to assign. The customer is an existing rider_id or a phone/email (a new phone number creates the customer). Call with dry_run: true first and show the human the quoted fare, route, time, customer and how the customer is told (SMS/email confirmation with a tracking link); then repeat the same arguments with proposal_id. Payment: nothing is charged at booking, the customer pays the driver after the ride (cash, card in person or invoice). For upfront payment through a Meter link, a custom price, or a solo driver's own booking, use create_quote, then price_quote / send_quote / book_quote. Fleet owners/admins only. Cancel through the Meter booking console.",
    domain: "bookings",
    kind: "write",
    risk: "standard",
    access: ADMINS,
    exposure: "on_demand",
    inputSchema: customerBookingSchemas.create_booking,
    outputSchema: operatorBookingWriteSchema,
    returns: "OperatorBookingWrite",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      customer: {
        first_name: "Maria",
        last_name: "Garcia",
        phone: "+15551234567",
      },
      pickup: "JFK Terminal 4",
      dropoff: { latitude: 40.7128, longitude: -74.006, name: "Hotel" },
      pickup_time: "2026-11-02T08:30:00-05:00",
      dry_run: true,
    },
    annotations: {
      ...CREATE_WRITE,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  book_quote: {
    name: "book_quote",
    title: "Book a quote now (create booking from quote)",
    description:
      "Turn a draft or open quote into a booking without waiting for the customer to accept it, as the console's Create booking action on a quote does. Keeps the quote's route, time and price (including a custom price set with price_quote). Nothing is charged: the customer pays the driver after the ride. Optionally assign a fleet driver. Fleet owners/admins and solo drivers (their own quotes). Preview with dry_run: true and show the price and pickup time, then confirm with proposal_id. To have the customer pay upfront, send_quote instead and let them accept and pay on the link.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: ADMINS_AND_SOLO,
    exposure: "on_demand",
    inputSchema: customerBookingSchemas.book_quote,
    outputSchema: quoteBookingConversionWriteSchema,
    returns: "QuoteBookingConversionWrite",
    example: {
      quote_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  create_customer: {
    name: "create_customer",
    title: "Add a customer",
    description:
      "Add a customer (rider) to a fleet's Customers list or a solo driver's own customers by phone number: finds the Meter rider with that number or creates one, links them to you and fills a missing first/last name. An email finds only a rider Meter already knows. Sends the customer nothing. Fleet owners/admins and solo drivers. Preview with dry_run: true, then confirm with proposal_id. Use the returned rider_id with create_booking or create_quote; import many at once with import_customers.",
    domain: "customers",
    kind: "write",
    risk: "standard",
    access: ADMINS_AND_SOLO,
    exposure: "on_demand",
    inputSchema: customerBookingSchemas.create_customer,
    outputSchema: customerWriteSchema,
    returns: "CustomerWrite",
    example: {
      first_name: "Maria",
      last_name: "Garcia",
      phone: "+15551234567",
      dry_run: true,
    },
    annotations: CREATE_WRITE,
  },
  update_customer: {
    name: "update_customer",
    title: "Edit a customer's name",
    description:
      "Set a customer's first and last name, as the console's Customers page allows: only while the rider's name is missing or incomplete. A name the rider already set is their own account name and stays locked (the result says so). Phone and email belong to the rider's account and cannot be changed. Fleet owners/admins and solo drivers, for their own customers. Preview with dry_run: true, then confirm with proposal_id.",
    domain: "customers",
    kind: "write",
    risk: "standard",
    access: ADMINS_AND_SOLO,
    exposure: "on_demand",
    inputSchema: customerBookingSchemas.update_customer,
    outputSchema: customerWriteSchema,
    returns: "CustomerWrite",
    example: {
      rider_id: "55555555-5555-4555-8555-555555555555",
      first_name: "Maria",
      last_name: "Garcia",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  import_customers: {
    name: "import_customers",
    title: "Import customers (bulk, CSV)",
    description: `Bulk-add customers to a fleet or a solo driver's customer list from a list or CSV text (columns name, first_name, last_name, phone, email), up to ${CUSTOMER_IMPORT_MAX_ROWS} rows per call. dry_run: true reports every row: create (new rider), add_existing, update_name (fills a missing name), unchanged, duplicate (same phone/email earlier in the file) and invalid rows with the reason; confirming with proposal_id writes them. Idempotent: rows are matched by normalized phone or email, so re-importing the same file changes nothing. Customers are not messaged or subscribed to anything. Fleet owners/admins and solo drivers.`,
    domain: "customers",
    kind: "write",
    risk: "standard",
    access: ADMINS_AND_SOLO,
    exposure: "on_demand",
    inputSchema: customerBookingSchemas.import_customers,
    outputSchema: customerImportWriteSchema,
    returns: "CustomerImportWrite",
    example: {
      csv: "name,phone,email\nMaria Garcia,+15551234567,maria@example.com",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
} as const;
