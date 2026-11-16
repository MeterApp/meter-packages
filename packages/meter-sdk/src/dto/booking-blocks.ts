import * as z from "zod";
import { field } from "./common.ts";
import { writeResultSchema } from "./settings.ts";

export const bookingBlockSchema = z
  .strictObject({
    id: field(z.string().uuid(), "Block ID for editing or removing the block."),
    starts_at: field(z.string(), "Start instant with timezone offset."),
    ends_at: field(
      z.string().nullable(),
      "Exclusive end instant, or null when bookings are paused indefinitely.",
    ),
    all_day: field(
      z.boolean(),
      "Whether the block spans full days in its timezone.",
    ),
    timezone: field(z.string(), "IANA timezone the block was entered in."),
    note: field(z.string().nullable(), "Private calendar note."),
  })
  .describe("One dated block or indefinite pause on a booking calendar.");
export const bookingBlockListSchema = z
  .strictObject({
    blocks: field(
      z.array(bookingBlockSchema),
      "Blocks intersecting the requested date range.",
    ),
    has_more: field(
      z.boolean(),
      "Whether a narrower date range is needed to see all results.",
    ),
  })
  .describe("Booking blocks on the selected calendar.");
export const bookingBlockWriteSchema = writeResultSchema(
  "block",
  bookingBlockSchema,
  "Result of saving or removing a booking block.",
);
export type BookingBlock = z.infer<typeof bookingBlockSchema>;
