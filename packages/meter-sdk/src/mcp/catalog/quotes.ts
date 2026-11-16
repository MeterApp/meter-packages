import * as z from "zod";
import {
  quoteActionWriteSchema,
  quotePageSchema,
  quoteWriteSchema,
  quoteStatusSchema,
  quoteDetailSchema,
} from "../../dto/quote.ts";
import { bookingEstimateInputSchema } from "../../dto/booking-estimate.ts";
import {
  READ_ONLY,
  SETTINGS_WRITE,
  dryRunSchema,
  proposalIdSchema,
  cursorSchema,
  fleetIdSchema,
  limitSchema,
} from "./shared.ts";

const scope = {
  scope: z
    .enum(["me", "fleet", "rider"])
    .default("me")
    .describe(
      "Individually owned quotes, selected fleet quotes, or quotes attached to the caller as rider. Fleet drivers see only their authored or preferred-driver quotes.",
    ),
  fleet_id: fleetIdSchema,
};

export const quoteSchemas = {
  send_quote: z.strictObject({
    quote_id: z.uuid().describe("Current owned quote identifier."),
    expires_at: z.iso
      .datetime({ offset: true })
      .describe(
        "Exact confirmation deadline approved in the preview; a changed pickup window refuses instead of shortening it silently.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  extend_quote: z.strictObject({
    quote_id: z.uuid().describe("Current owned quote identifier."),
    expires_at: z.iso
      .datetime({ offset: true })
      .describe(
        "Exact desired confirmation deadline, within the current native pickup/cutoff window.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  withdraw_quote: z.strictObject({
    quote_id: z.uuid().describe("Current owned open quote identifier."),
    reason: z
      .string()
      .max(1000)
      .nullable()
      .default(null)
      .describe("Optional withdrawal reason retained in native audit."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  follow_up_quote: z.strictObject({
    quote_id: z.uuid().describe("Current owned open quote identifier."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  create_quote: bookingEstimateInputSchema.safeExtend({
    rider_id: z
      .uuid()
      .describe(
        "Existing rider in your customers or the current admin-managed fleet. No contact import.",
      ),
    validity_minutes: z
      .number()
      .int()
      .min(5)
      .max(43200)
      .nullable()
      .default(null)
      .describe(
        "Requested validity in minutes; native ASAP, scheduled pickup and cancellation deadlines may shorten it. Null uses the native default.",
      ),
    notes: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .default(null)
      .describe("Optional internal quote notes."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  price_quote: z.strictObject({
    quote_id: z.uuid().describe("Current draft or open quote to price."),
    currency_code: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .describe("Exact supported currency of the stored quote."),
    total_unit_amount: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .describe(
        "Exact total in currency minor units, or null to remove the custom override and restore the captured estimate.",
      ),
    reason: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .default(null)
      .describe(
        "Optional pricing reason; clearing the override also clears its reason.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  list_quotes: z.strictObject({
    ...scope,
    status: z
      .array(quoteStatusSchema)
      .min(1)
      .max(6)
      .optional()
      .describe(
        "Stored lifecycle statuses to include; omitted includes all statuses.",
      ),
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  get_quote: z.strictObject({
    ...scope,
    quote_id: z.uuid().describe("Quote identifier from list_quotes."),
  }),
};

const access = {
  personas: [
    "solo_driver",
    "fleet_driver",
    "fleet_admin",
    "fleet_owner",
    "rider",
  ],
  recordScoped: true,
  requiresOperationalFleet: false,
} as const;

export const quoteTools = {
  send_quote: {
    name: "send_quote",
    title: "Send a quote",
    description:
      "Use dry_run for the exact revision and expiry, then confirm with proposal_id for one rider notification decision. Queued or completed processing does not prove delivery; unknown attempts require manual handoff. One send or reminder per quote per hour.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.send_quote,
    outputSchema: quoteActionWriteSchema,
    returns: "QuoteActionWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2026-10-05T12:00:00.000Z",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  extend_quote: {
    name: "extend_quote",
    title: "Extend quote expiry",
    description:
      "Use dry_run then proposal_id to confirm the exact absolute expiry within the current native pickup/cutoff window. Does not notify, charge, book or alter its priced revision.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.extend_quote,
    outputSchema: quoteActionWriteSchema,
    returns: "QuoteActionWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2026-10-05T12:00:00.000Z",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  withdraw_quote: {
    name: "withdraw_quote",
    title: "Withdraw a quote",
    description:
      "Use dry_run to preview withdrawal of an open quote and a queued rider notification, then confirm with proposal_id. Does not cancel a booking, charge or refund. Unknown notification attempts require manual handoff.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.withdraw_quote,
    outputSchema: quoteActionWriteSchema,
    returns: "QuoteActionWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  follow_up_quote: {
    name: "follow_up_quote",
    title: "Remind a quote rider",
    description:
      "Use dry_run then proposal_id to confirm one reminder to the current quote rider. Does not request its owner to follow up. One send or reminder per quote per hour; unknown attempts are not automatically resent.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.follow_up_quote,
    outputSchema: quoteActionWriteSchema,
    returns: "QuoteActionWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  create_quote: {
    name: "create_quote",
    title: "Create a draft quote",
    description:
      "Use dry_run: true to preview a priced route for an existing authorized rider, then confirm the identical saved proposal. Stores a draft quote and canonical estimate only. Does not send it, reserve availability, create a booking or charge. Fleet requests must select one priced ride option; changed route or pricing sources require a fresh preview.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.create_quote,
    outputSchema: quoteWriteSchema,
    returns: "QuoteWrite",
    example: {
      fare_id: "11111111-1111-4111-8111-111111111111",
      rider_id: "22222222-2222-4222-8222-222222222222",
      origin: { latitude: 40.7, longitude: -74 },
      destination: { latitude: 40.8, longitude: -74 },
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  price_quote: {
    name: "price_quote",
    title: "Set a quote price",
    description:
      "Use dry_run: true to preview the exact custom total and reason on a current draft or open quote, then confirm its saved proposal. Null removes the override and restores the stored estimate. Fleet drivers require current override permission and their own authored or preferred-driver quote. Does not send, charge, refund or book.",
    domain: "quotes",
    kind: "write",
    risk: "standard",
    access: {
      ...access,
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
    },
    exposure: "on_demand",
    inputSchema: quoteSchemas.price_quote,
    outputSchema: quoteWriteSchema,
    returns: "QuoteWrite",
    example: {
      quote_id: "11111111-1111-4111-8111-111111111111",
      currency_code: "KWD",
      total_unit_amount: 1234,
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  list_quotes: {
    name: "list_quotes",
    title: "List quotes",
    description:
      "Read bounded currently authorized stored quote facts. Does not create estimates, contact riders, reserve bookings, or query payment providers.",
    domain: "quotes",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: quoteSchemas.list_quotes,
    outputSchema: quotePageSchema,
    returns: "QuotePage",
    example: { scope: "me", limit: 50 },
    annotations: READ_ONLY,
  },
  get_quote: {
    name: "get_quote",
    title: "Get quote",
    description:
      "Read one currently authorized stored quote summary. Stored prices and lifecycle timestamps are facts; they do not prove delivery or payment acceptance.",
    domain: "quotes",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: quoteSchemas.get_quote,
    outputSchema: quoteDetailSchema,
    returns: "QuoteDetail",
    example: { scope: "me", quote_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
} as const;
