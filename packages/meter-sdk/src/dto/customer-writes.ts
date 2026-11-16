import * as z from "zod";
import { field } from "./common.ts";
import { customerSchema } from "./customer.ts";
import { writeResultSchema } from "./settings.ts";

/** Most rows one import_customers call accepts; split longer lists. */
export const CUSTOMER_IMPORT_MAX_ROWS = 200;

export const customerWriteSchema = writeResultSchema(
  "customer",
  customerSchema.nullable(),
  "Preview or result of create_customer / update_customer: the customer as the Customers page lists them (null in a preview of a customer Meter does not know yet).",
).meta({ id: "CustomerWrite" });
export type CustomerWrite = z.infer<typeof customerWriteSchema>;

export const CUSTOMER_IMPORT_ROW_STATUSES = [
  "create",
  "add_existing",
  "update_name",
  "unchanged",
  "duplicate",
  "invalid",
  "failed",
] as const;

export const customerImportRowSchema = z.strictObject({
  row: field(
    z.number().int().positive(),
    "1-based position of the row in the request (CSV rows count from the first line after the header).",
  ),
  status: field(
    z.enum(CUSTOMER_IMPORT_ROW_STATUSES),
    "create: a new Meter rider is created and added; add_existing: a rider Meter already knows is added to your customers; update_name: an existing customer gets the missing first/last name; unchanged: already a customer, nothing to do; duplicate: same phone or email as an earlier row, skipped; invalid: skipped, see reason; failed: the row could not be written, see reason.",
  ),
  reason: field(
    z.string().nullable(),
    "Why the row is invalid, a duplicate or failed; null otherwise.",
  ),
  rider_id: field(
    z.uuid().nullable(),
    "Customer id once known (existing riders in a preview, every written row after confirming); null otherwise.",
  ),
  first_name: field(z.string().nullable(), "First name from the row, or null."),
  last_name: field(z.string().nullable(), "Last name from the row, or null."),
  phone: field(z.string().nullable(), "Phone normalized to E.164, or null.", {
    roles: ["owner", "admin", "self"],
  }),
  email: field(
    z.string().nullable(),
    "Email from the row (lower-case), or null. Used only to find a rider Meter already knows.",
    { roles: ["owner", "admin", "self"] },
  ),
});

export const customerImportSchema = z
  .strictObject({
    fleet_id: field(
      z.uuid().nullable(),
      "Fleet the customers belong to, or null for a solo driver's own customers.",
    ),
    totals: field(
      z.strictObject({
        rows: field(z.number().int().nonnegative(), "Rows received."),
        create: field(z.number().int().nonnegative(), "New riders."),
        add_existing: field(
          z.number().int().nonnegative(),
          "Existing Meter riders added as customers.",
        ),
        update_name: field(
          z.number().int().nonnegative(),
          "Existing customers whose missing name is filled.",
        ),
        unchanged: field(
          z.number().int().nonnegative(),
          "Already customers with nothing to change.",
        ),
        duplicate: field(
          z.number().int().nonnegative(),
          "Rows repeating an earlier phone or email.",
        ),
        invalid: field(z.number().int().nonnegative(), "Rows skipped."),
        failed: field(
          z.number().int().nonnegative(),
          "Rows that could not be written (0 in a preview).",
        ),
      }),
      "Row counts by status.",
    ),
    rows: field(
      z.array(customerImportRowSchema),
      "Every row with its status, in request order.",
    ),
  })
  .meta({
    id: "CustomerImport",
    description:
      "A customer import: what each row would do (preview) or did (applied).",
  });
export type CustomerImport = z.infer<typeof customerImportSchema>;

export const customerImportWriteSchema = writeResultSchema(
  "import",
  customerImportSchema,
  "Preview or result of import_customers.",
).meta({ id: "CustomerImportWrite" });
export type CustomerImportWrite = z.infer<typeof customerImportWriteSchema>;
