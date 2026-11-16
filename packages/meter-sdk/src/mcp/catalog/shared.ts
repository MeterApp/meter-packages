import * as z from "zod";
import type { McpToolAnnotations } from "../tools.ts";

export const fleetIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe(
    "Fleet id from whoami or list_fleets. Optional when the caller belongs to exactly one fleet.",
  );

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(50)
  .describe("Page size, 1-100 (default 50).");

export const cursorSchema = z
  .string()
  .min(1)
  .max(512)
  .optional()
  .describe(
    "Opaque cursor from the previous page's next_cursor. Omit for the first page.",
  );

export const isoDateSchema = z
  .string()
  .min(4)
  .max(40)
  .describe(
    'ISO 8601 date or timestamp, e.g. "2026-09-01" or "2026-09-01T00:00:00Z".',
  );

export const dryRunSchema = z
  .boolean()
  .default(false)
  .describe(
    "When true, validate and authorize the request and return the would-be changes without writing anything. Always preview before confirming; calls without a saved preview write nothing.",
  );

export const READ_ONLY: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const SETTINGS_WRITE: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const proposalIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe(
    "Saved proposal to confirm. Repeat the original intended arguments unchanged after showing the human all changes.",
  );
