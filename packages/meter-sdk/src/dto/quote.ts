import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  minorAmountSchema,
  pageSchema,
} from "./common.ts";
import { writeResultSchema } from "./settings.ts";

export const quoteStatusSchema = z.enum([
  "draft",
  "open",
  "converted",
  "declined",
  "expired",
  "withdrawn",
]);

/** Stored lifecycle quote facts; no pricing acknowledgement or provider identifiers. */
export const quoteSummarySchema = z
  .strictObject({
    id: field(z.uuid(), "Meter quote identifier."),
    fleet_id: field(
      z.uuid().nullable(),
      "Owning fleet, or null for an individually owned quote.",
    ),
    status: field(
      quoteStatusSchema,
      "Stored quote status; converted means a booking was created.",
    ),
    revision: field(
      z.number().int().positive(),
      "Current price revision, used when confirming a proposed change.",
    ),
    currency: currencyCodeSchema,
    total_unit_amount: field(
      minorAmountSchema,
      "Current quoted total in this currency’s minor units, including the stored custom-price decision.",
    ),
    custom_price_unit_amount: field(
      minorAmountSchema.nullable(),
      "Custom total in currency minor units, or null when using the estimate.",
    ),
    pickup_at: field(
      z.iso.datetime({ offset: true }),
      "Scheduled pickup time.",
    ),
    expires_at: field(
      z.iso.datetime({ offset: true }),
      "Stored confirmation deadline; does not by itself reserve availability.",
    ),
    created_at: field(z.iso.datetime({ offset: true }), "Creation timestamp."),
    updated_at: field(
      z.iso.datetime({ offset: true }),
      "Last stored change timestamp.",
    ),
    sent_at: field(
      z.iso.datetime({ offset: true }).nullable(),
      "Most recent send timestamp, or null; not proof of notification delivery.",
    ),
    is_asap: field(
      z.boolean(),
      "Whether the quote requests pickup as soon as possible.",
    ),
    is_time_booking: field(
      z.boolean(),
      "Whether this quote is for a time-based booking.",
    ),
  })
  .meta({
    description:
      "An authorized stored quote summary, excluding contact details, notes, preview/receipt internals, private delivery links and conversion leases.",
  });
export type QuoteSummary = z.infer<typeof quoteSummarySchema>;

export const quotePageSchema = pageSchema(quoteSummarySchema).meta({
  id: "QuotePage",
  description: "A bounded page of currently authorized stored quotes.",
});
export type QuotePage = z.infer<typeof quotePageSchema>;

export const quoteWriteSchema = writeResultSchema(
  "quote",
  quoteSummarySchema,
  "Saved quote creation or pricing preview and immutable committed outcome; does not send or convert the quote.",
).meta({ id: "QuoteWrite" });
export type QuoteWrite = z.infer<typeof quoteWriteSchema>;

export const quoteActionResultSchema = z
  .strictObject({
    quote: field(quoteSummarySchema, "Frozen committed quote facts."),
    notification_state: field(
      z.enum([
        "not_required",
        "queued",
        "completed",
        "manual_handoff",
        "superseded",
      ]),
      "Processing state only; does not prove provider acceptance or rider delivery. Started or uncertain attempts are not automatically resent.",
    ),
  })
  .meta({
    id: "QuoteActionResult",
    description:
      "Committed quote action and truthful notification processing state without recipient or provider details.",
  });
export type QuoteActionResult = z.infer<typeof quoteActionResultSchema>;
export const quoteActionWriteSchema = writeResultSchema(
  "action",
  quoteActionResultSchema,
  "Saved quote lifecycle confirmation and immutable committed outcome; no booking or money movement.",
).meta({ id: "QuoteActionWrite" });
export type QuoteActionWrite = z.infer<typeof quoteActionWriteSchema>;

/** Current authorized processing facts; mutation history remains immutable. */
export const quoteDetailSchema = quoteSummarySchema
  .extend({
    notification: field(
      z
        .strictObject({
          revision: field(
            z.number().int().positive(),
            "Exact current quote revision.",
          ),
          state: field(
            z.enum([
              "queued",
              "processing",
              "completed",
              "manual_handoff",
              "superseded",
            ]),
            "Current processing state; completed does not prove recipient delivery. Unknown or started attempts are never automatically resent.",
          ),
          console_url: field(
            z.url().nullable(),
            "Existing operator quote detail page for manual handoff, or null for rider scope and other states. No automatic provider replay or money action.",
          ),
        })
        .nullable(),
      "Latest retained delivery marker for this exact revision, or null when none exists.",
    ),
    rider_followup_notification: field(
      z
        .strictObject({
          revision: field(
            z.number().int().positive(),
            "Exact current quote revision.",
          ),
          state: field(
            z.enum([
              "queued",
              "processing",
              "completed",
              "manual_handoff",
              "superseded",
            ]),
            "Current processing state; completed does not prove recipient delivery. Unknown or started attempts are never automatically resent.",
          ),
          console_url: field(
            z.url().nullable(),
            "Existing operator quote detail page for manual handoff, or null for rider scope and other states. No automatic provider replay or money action.",
          ),
        })
        .nullable(),
      "Distinct rider-to-operator request processing for this exact revision. Null for rider scope or when absent; queued/completed is not delivery proof.",
    ),
  })
  .meta({
    id: "QuoteDetail",
    description:
      "Authorized quote detail with minimal current notification processing; excludes job IDs, provider IDs, recipient data and private packets.",
  });
export type QuoteDetail = z.infer<typeof quoteDetailSchema>;
