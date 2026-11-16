import * as z from "zod";
import {
  tripPageSchema,
  tripSchema,
  tripAdjustmentWriteSchema,
} from "../../dto/index.ts";
import {
  fleetIdSchema,
  limitSchema,
  cursorSchema,
  isoDateSchema,
  READ_ONLY,
  dryRunSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";

const adjustmentScope = {
  trip_id: z.uuid().describe("Trip id from get_trip or list_trips."),
  fleet_id: fleetIdSchema,
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
const minorAmount = z.number().int().safe().nonnegative();
export const TRIP_SORTS = [
  "start_time_desc",
  "start_time_asc",
  "fare_desc",
  "fare_asc",
  "distance_desc",
  "distance_asc",
] as const;
export const TRIP_PAYMENT_METHODS = [
  "cash",
  "terminal",
  "web_link",
  "web_link_prepaid",
  "square_app",
  "other",
  "none",
] as const;
const listTripsShape = {
  fleet_id: fleetIdSchema,
  driver: z
    .string()
    .min(1)
    .max(128)
    .default("me")
    .describe(
      '"me" (default) for the caller\'s own trips, "all" for every driver in the fleet (owners/admins only), or a member id from list_fleet_members (owners/admins only).',
    ),
  start_date: isoDateSchema
    .optional()
    .describe("Only trips that started at or after this time (ISO 8601)."),
  end_date: isoDateSchema
    .optional()
    .describe("Only trips that started at or before this time (ISO 8601)."),
  cursor: cursorSchema,
  limit: limitSchema,
};
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe("Exact trip currency from get_trip.currency.");

export const tripsSchemas = {
  add_trip_fee: z.strictObject({
    ...adjustmentScope,
    amount_minor: minorAmount
      .positive()
      .describe(
        "Fee in smallest currency units; for KWD, 125 minor units = 0.125 KWD.",
      ),
    currency,
    memo: z.string().trim().min(1).max(1000),
    taxable: z.boolean(),
    is_tip: z.boolean().default(false),
  }),
  remove_trip_fee: z.strictObject({
    ...adjustmentScope,
    fee_id: z
      .string()
      .min(1)
      .max(128)
      .describe("Exact saved fee id; do not invent an id."),
  }),
  add_trip_discount: z.strictObject({
    ...adjustmentScope,
    discount: z.discriminatedUnion("type", [
      z.strictObject({
        type: z.literal("fixed"),
        amount_minor: minorAmount,
        currency,
      }),
      z.strictObject({
        type: z.literal("percentage"),
        percentage: z.number().finite().min(0).max(100),
      }),
    ]),
    reason: z.string().trim().max(1000).optional(),
  }),
  remove_trip_discount: z.strictObject({
    ...adjustmentScope,
    discount_id: z
      .string()
      .min(1)
      .max(128)
      .describe("Exact saved discount id; do not invent an id."),
  }),
  mark_trip_cash_paid: z.strictObject({
    ...adjustmentScope,
    amount_minor: minorAmount.describe(
      "Exact get_trip.cash_total_minor confirmed by the user, in smallest currency units. Never substitute the active total or infer a missing cash amount.",
    ),
    currency,
    note: z.string().trim().max(1000).optional(),
  }),
  list_trips: z.object(listTripsShape),
  search_trips: z.object({
    ...listTripsShape,
    sort: z
      .enum(TRIP_SORTS)
      .optional()
      .describe(
        "start_time_desc (default), start_time_asc, fare_desc, fare_asc, distance_desc or distance_asc. Fare sorts by total_minor without currency conversion; trips without a value come last.",
      ),
    status: z
      .array(z.enum(["paid", "unpaid", "void_requested", "voided"]))
      .min(1)
      .max(4)
      .optional()
      .describe("Only trips in any of these payment or void states."),
    payment_method: z
      .array(z.enum(TRIP_PAYMENT_METHODS))
      .min(1)
      .max(TRIP_PAYMENT_METHODS.length)
      .optional()
      .describe(
        'Only these recorded payment methods; "none" matches trips with no method recorded.',
      ),
    min_total_minor: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        "Only trips whose receipt total is at least this (minor units).",
      ),
    max_total_minor: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        "Only trips whose receipt total is at most this (minor units).",
      ),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .optional()
      .describe("Only trips in this currency (ISO 4217)."),
    rider_id: z
      .uuid()
      .optional()
      .describe(
        "Only trips for this customer (rider_id from list_customers), through the booking or a manual rider link. Needs no date window.",
      ),
    booking_id: z
      .uuid()
      .optional()
      .describe(
        "Only the trip that fulfilled this booking. Needs no date window.",
      ),
    has_tip: z
      .boolean()
      .optional()
      .describe("true: only tipped trips; false: only trips without a tip."),
    search: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .optional()
      .describe(
        "Case-insensitive text matched against pickup and drop-off names and addresses, the fare name and the trip note.",
      ),
  }),
  get_trip: z.object({
    trip_id: z
      .string()
      .uuid()
      .describe("Trip id from list_trips or a booking's trip_id."),
  }),
} as const;

export const tripsTools = {
  add_trip_fee: {
    name: "add_trip_fee",
    title: "Add a trip fee",
    description:
      "Add a fee to an unpaid ordinary trip and recalculate its receipt atomically. Driver own trips or fleet admins. Bookings, invoices and provider-linked or uncertain payments require a human handoff. Preview first. Show dry_run: true preview, then repeat the exact proposal_id with dry_run: false only after explicit confirmation.",
    domain: "trips",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.add_trip_fee,
    outputSchema: tripAdjustmentWriteSchema,
    returns: "TripAdjustmentWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
      amount_minor: 125,
      currency: "KWD",
      memo: "Toll",
      taxable: false,
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  remove_trip_fee: {
    name: "remove_trip_fee",
    title: "Remove a trip fee",
    description:
      "Remove an exact saved fee from an unpaid ordinary trip and recalculate its receipt atomically. Driver own trips or fleet admins. Preview first; payment coordination contexts require a human handoff. Show dry_run: true preview, then repeat the exact proposal_id with dry_run: false only after explicit confirmation.",
    domain: "trips",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.remove_trip_fee,
    outputSchema: tripAdjustmentWriteSchema,
    returns: "TripAdjustmentWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
      fee_id: "saved-fee-id",
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  add_trip_discount: {
    name: "add_trip_discount",
    title: "Add a trip discount",
    description:
      "Add a fixed minor-unit or percentage discount to an unpaid ordinary trip and recalculate its receipt atomically. Driver own trips or fleet admins. Preview first; payment coordination contexts require a human handoff. Show dry_run: true preview, then repeat the exact proposal_id with dry_run: false only after explicit confirmation.",
    domain: "trips",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.add_trip_discount,
    outputSchema: tripAdjustmentWriteSchema,
    returns: "TripAdjustmentWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
      discount: { type: "percentage", percentage: 10 },
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  remove_trip_discount: {
    name: "remove_trip_discount",
    title: "Remove a trip discount",
    description:
      "Remove an exact saved discount from an unpaid ordinary trip and recalculate its receipt atomically. Driver own trips or fleet admins. Preview first; payment coordination contexts require a human handoff. Show dry_run: true preview, then repeat the exact proposal_id with dry_run: false only after explicit confirmation.",
    domain: "trips",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.remove_trip_discount,
    outputSchema: tripAdjustmentWriteSchema,
    returns: "TripAdjustmentWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
      discount_id: "saved-discount-id",
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  mark_trip_cash_paid: {
    name: "mark_trip_cash_paid",
    title: "Record cash payment",
    description:
      "Record a confirmed unpaid ordinary trip as cash paid. Current fleet owners or admins only. Read get_trip.cash_total_minor; a missing cash amount requires Meter. Bookkeeping only; this never collects, refunds or transfers money. Preview the exact cash total first. Provider, invoice, booking or uncertain-payment contexts require a human handoff. Show dry_run: true preview, then repeat the exact proposal_id with dry_run: false only after explicit confirmation.",
    domain: "trips",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.mark_trip_cash_paid,
    outputSchema: tripAdjustmentWriteSchema,
    returns: "TripAdjustmentWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
      amount_minor: 125,
      currency: "KWD",
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: false },
  },

  list_trips: {
    name: "list_trips",
    title: "List metered trips",
    description:
      'List completed metered trips, newest first, with times, distance, pickup and drop-off addresses, fare name, receipt total and tip, payment method and paid status. Drivers get only their own trips (driver="me"). Owners and admins may use driver="all" for every driver in the fleet or a member_id from list_fleet_members. Filter by start_date/end_date; page with cursor and limit (max 100). search_trips sorts and filters. Trips are metered rides, not bookings: use list_bookings for scheduled rides that have not happened yet. No GPS traces are returned.',
    domain: "trips",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: tripsSchemas.list_trips,
    outputSchema: tripPageSchema,
    returns: "TripPage",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      driver: "all",
      start_date: "2026-09-01",
      limit: 25,
    },
    annotations: READ_ONLY,
  },
  search_trips: {
    name: "search_trips",
    title: "Sort and filter trips",
    description:
      'list_trips with sorting and filters: sort by start time, fare (total_minor) or distance, and filter by paid/unpaid/void state, payment_method, min/max_total_minor, currency, customer (rider_id), booking_id, has_tip and text search over places, fare name and note. Same people, scopes (driver="me", "all" or a member_id) and Trip fields as list_trips. Reads at most 1,000 trips of the start_date/end_date window, or of the booking or customer, and returns invalid_argument above that: narrow the dates. Page with cursor, repeating the same sort and filters. Use export_data dataset="trips" for a CSV of a whole window.',
    domain: "trips",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: tripsSchemas.search_trips,
    outputSchema: tripPageSchema,
    returns: "TripPage",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      driver: "all",
      start_date: "2026-09-01",
      end_date: "2026-09-30T23:59:59Z",
      sort: "fare_desc",
      status: ["unpaid"],
      limit: 25,
    },
    annotations: READ_ONLY,
  },
  get_trip: {
    name: "get_trip",
    title: "Get one trip",
    description:
      "Fetch one metered trip by id with the same fields as list_trips (times, distance, places, receipt total, tip, fee and discount counts, payment method, void status). Allowed for the driver who drove it and for owners/admins of the fleet it was driven for; anyone else gets a not-found error, so a missing trip and a forbidden trip look the same. Use list_trips to discover trip ids; never construct one.",
    domain: "trips",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "listed",
    inputSchema: tripsSchemas.get_trip,
    outputSchema: tripSchema,
    returns: "Trip",
    example: { trip_id: "22222222-2222-4222-8222-222222222222" },
    annotations: READ_ONLY,
  },
} as const;
