import * as z from "zod";
import { field, currencyCodeSchema, minorAmountSchema } from "./common.ts";
import { writeResultSchema } from "./settings.ts";

// Shared with the native API. Intent limits and normalization remain native;
// draft creation never implicitly queues delivery or payment collection.
export const tripInvoicePreviewIntentSchema = z.strictObject({
  due_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe("Optional invoice due timestamp with timezone offset."),
  memo: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .describe(
      "Invoice memo shown in the confirmation; at most 1,000 characters.",
    ),
  payer: z
    .strictObject({
      company: z.string().max(200).nullable().optional(),
      email: z.string().email().max(254).nullable().optional(),
      name: z.string().max(200).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
    })
    .optional()
    .describe(
      "Optional payer fields shown in full before confirmation; no delivery is requested.",
    ),
  trip_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .describe(
      "Every completed, unpaid trip selected for this draft; 1–100 explicit trip ids.",
    ),
});

/** Delivery never accepts a recipient or token supplied by the agent. */
export const tripInvoiceDeliveryIntentSchema = z.strictObject({
  invoice_id: z.string().uuid(),
  fleet_id: z.string().uuid().optional(),
  delivery_method: z
    .enum(["all_available", "email", "sms", "whatsapp"])
    .default("all_available"),
  message: z.string().trim().max(1000).nullable().default(null),
});
export type TripInvoiceDeliveryIntent = z.infer<
  typeof tripInvoiceDeliveryIntentSchema
>;

export const tripInvoiceStatusSchema = z.enum([
  "draft",
  "open",
  "payment_pending",
  "paid",
  "payment_failed",
  "overdue",
  "voided",
  "uncollectible",
]);

export const tripInvoiceSummarySchema = z
  .strictObject({
    id: field(z.string().uuid(), "Invoice id."),
    account_context: field(
      z.enum(["personal", "fleet"]),
      "Personal or fleet billing context.",
    ),
    fleet_id: field(
      z.string().uuid().nullable(),
      "Fleet id for fleet billing, otherwise null.",
    ),
    owner_profile_id: field(z.string().uuid(), "Invoice owner profile id."),
    display_number: field(z.string(), "Human-readable invoice number."),
    status: field(
      tripInvoiceStatusSchema,
      "Saved invoice payment lifecycle status; not proof of provider settlement.",
    ),
    currency: currencyCodeSchema,
    total_amount_minor: field(
      minorAmountSchema,
      "Invoice total in minor currency units.",
    ),
    created_at: field(z.string(), "Invoice creation timestamp."),
    due_at: field(z.string().nullable(), "Due timestamp, when set."),
    sent_at: field(
      z.string().nullable(),
      "Saved sent timestamp, not proof of delivery.",
    ),
    paid_at: field(
      z.string().nullable(),
      "Saved paid timestamp, not proof of a new payment.",
    ),
    voided_at: field(
      z.string().nullable(),
      "Saved void timestamp, when voided.",
    ),
  })
  .meta({
    description:
      "Authorized invoice summary without provider identifiers, payment links or payer contact details.",
  });

export const tripInvoicePageSchema = z
  .strictObject({
    items: field(
      z.array(tripInvoiceSummarySchema).max(50),
      "Invoices in native newest-first order.",
    ),
    next_cursor: field(
      z.string().nullable(),
      "Native opaque cursor for the next page, otherwise null.",
    ),
    has_more: field(z.boolean(), "Whether another native page is available."),
  })
  .meta({
    description: "One authorized page of personal or fleet trip invoices.",
  });

export const tripInvoiceCreatedSchema = tripInvoiceSummarySchema
  .extend({
    status: field(
      z.literal("draft"),
      "Created draft status; no delivery or payment occurred.",
    ),
    subtotal_amount_minor: field(
      minorAmountSchema,
      "Invoice subtotal in minor currency units.",
    ),
    tax_amount_minor: field(
      minorAmountSchema,
      "Invoice tax in minor currency units.",
    ),
    fee_amount_minor: field(
      minorAmountSchema,
      "Invoice fees in minor currency units.",
    ),
    line_count: field(
      z.number().int().min(1).max(100),
      "Exact number of approved trip lines created.",
    ),
  })
  .meta({
    description:
      "Finite native draft invoice creation receipt after confirmation; no delivery or payment.",
  });
export const tripInvoiceCreatedWriteSchema = writeResultSchema(
  "invoice",
  field(
    tripInvoiceCreatedSchema.nullable(),
    "Created draft invoice, or null before confirmation.",
  ),
  "Native draft invoice created after confirmation. No message or payment was sent.",
);

export const tripInvoiceDetailSchema = z
  .strictObject({
    invoice: field(
      tripInvoiceSummarySchema,
      "Authorized saved invoice summary.",
    ),
    subtotal_amount_minor: field(
      minorAmountSchema,
      "Saved invoice subtotal in minor currency units.",
    ),
    tax_amount_minor: field(
      minorAmountSchema,
      "Saved invoice tax in minor currency units.",
    ),
    fee_amount_minor: field(
      minorAmountSchema,
      "Saved invoice fees in minor currency units.",
    ),
    lines_complete: field(
      z.boolean(),
      "False when the invoice has more than 50 lines; use the Meter invoice screen for the full list.",
    ),
    lines: field(
      z
        .array(
          z.strictObject({
            id: field(z.string().uuid(), "Invoice line id."),
            trip_id: field(z.string().uuid(), "Saved trip id."),
            line_number: field(
              z.number().int().positive(),
              "Native invoice line position.",
            ),
            currency: currencyCodeSchema,
            gross_amount_minor: field(
              minorAmountSchema,
              "Line total in minor currency units.",
            ),
            tax_amount_minor: field(
              minorAmountSchema,
              "Line tax in minor currency units.",
            ),
            tip_amount_minor: field(
              minorAmountSchema,
              "Line tip in minor currency units.",
            ),
            fee_amount_minor: field(
              minorAmountSchema,
              "Line fees in minor currency units.",
            ),
            allocated_amount_minor: field(
              minorAmountSchema,
              "Saved payment allocation for the line in minor currency units.",
            ),
            status: field(
              z.enum(["open", "payment_pending", "paid", "voided", "removed"]),
              "Native saved invoice line lifecycle status.",
            ),
          }),
        )
        .max(50),
      "Up to 50 invoice lines, in native line-number order. Location routes and payment-provider data are omitted.",
    ),
  })
  .meta({
    description:
      "Authorized invoice amounts and bounded lines without stored payment details, provider identifiers, contacts, raw events or notification errors.",
  });

export type TripInvoiceSummary = z.infer<typeof tripInvoiceSummarySchema>;
export type TripInvoicePage = z.infer<typeof tripInvoicePageSchema>;
export type TripInvoiceDetail = z.infer<typeof tripInvoiceDetailSchema>;
export type TripInvoiceCreated = z.infer<typeof tripInvoiceCreatedSchema>;

export const tripInvoiceVoidIntentSchema = z.strictObject({
  invoice_id: field(z.string().uuid(), "Explicit invoice to void."),
  fleet_id: field(
    z.string().uuid().optional(),
    "Explicit operational fleet; omit for your personal invoice.",
  ),
  reason: field(
    z.string().trim().min(1).max(1000),
    "Reason shown in full before confirmation, 1–1,000 characters.",
  ),
});
export const tripInvoiceVoidedSchema = tripInvoiceCreatedSchema
  .extend({
    status: field(z.literal("voided"), "Confirmed native void status."),
    void_reason: field(
      z.string().min(1).max(1000),
      "Approved native void reason.",
    ),
    trip_ids: field(
      z.array(z.string().uuid()).min(1).max(100),
      "Every affected invoice trip.",
    ),
  })
  .meta({
    description:
      "Finite native void receipt without provider identifiers or payer contacts.",
  });
export const tripInvoiceVoidedWriteSchema = writeResultSchema(
  "invoice",
  field(
    tripInvoiceVoidedSchema.nullable(),
    "Voided invoice, or null before confirmation.",
  ),
  "Invoice voided after confirmation; no message or payment is sent.",
);
export type TripInvoiceVoided = z.infer<typeof tripInvoiceVoidedSchema>;
