import * as z from "zod";
import {
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  pageSchema,
} from "./common.ts";
import { fieldChangeSchema } from "./settings.ts";

export const changeRequestStatusSchema = z.enum([
  "proposed",
  "applying",
  "applied",
  "declined",
  "expired",
  "stale",
  "failed",
]);
export const changeRequestSchema = z
  .strictObject({
    id: field(
      z.string().uuid(),
      "Proposal id. Confirmation still requires the original actor and channel.",
    ),
    tool: field(z.string(), "Tool that proposed this change."),
    title: field(z.string(), "Human-readable tool title."),
    target_label: field(
      z.string().nullable(),
      "Display label of the affected object, or null after retention redaction.",
    ),
    risk: field(
      z.enum(["low", "standard", "sensitive"]),
      "Risk tier of the change.",
    ),
    status: field(
      changeRequestStatusSchema,
      "Current proposal or application outcome.",
    ),
    changes: field(
      z.array(fieldChangeSchema),
      "Field changes; empty after retention redaction.",
    ),
    created_at: isoTimestampSchema,
    expires_at: isoTimestampSchema,
    decided_at: isoTimestampNullableSchema,
    applied_at: isoTimestampNullableSchema,
    redacted_at: isoTimestampNullableSchema,
    error_code: field(
      z.string().nullable(),
      "Stable failure code, without internal error text.",
    ),
  })
  .meta({
    description:
      "An actor-owned change history entry. Never includes stored input, basis, result, or internal completion identifiers.",
  });
export type ChangeRequest = z.infer<typeof changeRequestSchema>;
export const changeRequestPageSchema = pageSchema(changeRequestSchema).meta({
  description:
    "A page of the signed-in actor’s assistant changes, with an opaque continuation cursor.",
});
export const listChangeRequestsInputSchema = z.strictObject({
  id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Exact proposal id for meter changes show; still restricted to the signed-in actor.",
    ),
  status: changeRequestStatusSchema
    .optional()
    .describe("Only include this proposal status."),
  tool: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe("Only include changes proposed by this exact tool name."),
  since: z.iso
    .datetime({ offset: true })
    .optional()
    .describe("Only include proposals created at or after this ISO timestamp."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(25)
    .describe("Maximum entries, 1–50; default 25."),
  cursor: z
    .string()
    .max(512)
    .optional()
    .describe("Opaque next_cursor returned by the previous page."),
});
export type ListChangeRequestsInput = z.infer<
  typeof listChangeRequestsInputSchema
>;
