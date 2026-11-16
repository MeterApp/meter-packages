import * as z from "zod";
import {
  tripInvoicePageSchema,
  tripInvoiceDetailSchema,
  tripInvoiceStatusSchema,
  tripInvoicePreviewIntentSchema,
  tripInvoiceCreatedWriteSchema,
  tripInvoiceVoidIntentSchema,
  tripInvoiceVoidedWriteSchema,
} from "../../dto/trip-invoice.ts";
import {
  READ_ONLY,
  SETTINGS_WRITE,
  dryRunSchema,
  proposalIdSchema,
  cursorSchema,
  isoDateSchema,
} from "./shared.ts";

const fleet = z
  .string()
  .uuid()
  .optional()
  .describe(
    "Explicit operational fleet id for an owner/admin report. Omit to read only your personal invoices; no implicit fleet is selected.",
  );
export const tripInvoiceSchemas = {
  void_invoice: tripInvoiceVoidIntentSchema.extend({
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  create_invoice: tripInvoicePreviewIntentSchema.extend({
    fleet_id: fleet,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  list_trip_invoices: z.object({
    fleet_id: fleet,
    status: z
      .array(tripInvoiceStatusSchema)
      .max(8)
      .optional()
      .describe("Optional native invoice statuses to include."),
    created_from: isoDateSchema
      .optional()
      .describe("Inclusive invoice creation time filter."),
    created_to: isoDateSchema
      .optional()
      .describe("Inclusive invoice creation time filter."),
    cursor: cursorSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(25)
      .describe("Page size, 1–50; default 25."),
  }),
  get_trip_invoice: z.object({
    fleet_id: fleet,
    invoice_id: z
      .string()
      .uuid()
      .describe("Invoice id from list_trip_invoices."),
  }),
} as const;
export const tripInvoiceTools = {
  void_invoice: {
    name: "void_invoice",
    title: "Void trip invoice",
    description:
      "Void an invoice you own personally, or in an explicitly selected operational fleet you own/administer. Preview with dry_run:true, show the invoice, every affected trip, status, amount, currency and reason, obtain human approval, then confirm the saved proposal_id. Invoices with payment-provider coordination require the native Meter invoice screen. This sends no message, charges no payment and refunds nothing.",
    domain: "accounting",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_owner", "fleet_admin"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: tripInvoiceSchemas.void_invoice,
    outputSchema: tripInvoiceVoidedWriteSchema,
    returns: "TripInvoiceVoidedWrite",
    example: {
      invoice_id: "00000000-0000-4000-8000-000000000001",
      reason: "Duplicate invoice",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  create_invoice: {
    name: "create_invoice",
    title: "Create draft trip invoice",
    description:
      "Create one native draft invoice for explicitly selected completed, unpaid trips you own personally, or trips in an explicitly selected fleet you own/administer. Preview with dry_run:true, show every selected trip, amount, currency, due date and payer field, obtain human approval, then confirm the saved proposal_id. Existing payment coordination requires the Meter trip screen. This does not send a message, create a payment link or charge anyone.",
    domain: "accounting",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["solo_driver", "fleet_owner", "fleet_admin"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: tripInvoiceSchemas.create_invoice,
    outputSchema: tripInvoiceCreatedWriteSchema,
    returns: "TripInvoiceCreatedWrite",
    example: {
      trip_ids: ["00000000-0000-4000-8000-000000000001"],
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  list_trip_invoices: {
    name: "list_trip_invoices",
    title: "List trip invoices",
    description:
      "List your personal trip invoices, or an explicitly selected operational fleet's invoices as its owner/admin. Native cursor pagination and saved statuses; no stored payment details, provider identifiers or payer contact details. This does not create, send or pay an invoice.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_owner", "fleet_admin"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: tripInvoiceSchemas.list_trip_invoices,
    outputSchema: tripInvoicePageSchema,
    returns: "TripInvoicePage",
    example: { limit: 25 },
    annotations: READ_ONLY,
  },
  get_trip_invoice: {
    name: "get_trip_invoice",
    title: "Get trip invoice",
    description:
      "Read an invoice you own personally, or one belonging to an explicitly selected operational fleet you own/administer. Returns saved amounts and up to 50 lines; lines_complete=false requires the Meter invoice screen for all lines. No location routes, payer contacts, stored payment details, provider identifiers, raw events or delivery errors. Saved status does not prove a new payment or delivery.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_owner", "fleet_admin"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: tripInvoiceSchemas.get_trip_invoice,
    outputSchema: tripInvoiceDetailSchema,
    returns: "TripInvoiceDetail",
    example: { invoice_id: "00000000-0000-4000-8000-000000000001" },
    annotations: READ_ONLY,
  },
} as const;
