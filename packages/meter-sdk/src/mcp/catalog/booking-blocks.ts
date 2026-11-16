import * as z from "zod";
import {
  bookingBlockListSchema,
  bookingBlockWriteSchema,
} from "../../dto/booking-blocks.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const instant = z.iso.datetime({ offset: true });
const scope = {
  scope: z
    .enum(["individual", "fleet"])
    .describe(
      "Use individual for your own booking calendar or fleet for a fleet you administer.",
    ),
  fleet_id: fleetIdSchema,
};
const writeFields = {
  ...scope,
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
export const bookingBlockSchemas = {
  list_booking_blocks: z.strictObject({
    ...scope,
    from: instant
      .optional()
      .describe("Include blocks ending after this instant. Defaults to now."),
    to: instant
      .optional()
      .describe("Include blocks starting before this instant."),
  }),
  save_booking_block: z.strictObject({
    ...writeFields,
    block_id: z
      .string()
      .uuid()
      .optional()
      .describe("A block ID from list_booking_blocks. Omit to create."),
    all_day: z
      .boolean()
      .describe(
        "True to block local dates. False to specify instants or pause indefinitely.",
      ),
    date_start: z.iso
      .date()
      .optional()
      .describe("First local date to block, inclusive."),
    date_end: z.iso
      .date()
      .optional()
      .describe("Last local date to block, inclusive."),
    starts_at: instant
      .optional()
      .describe(
        "Start instant with offset for a timed block. Omit for an immediate pause.",
      ),
    ends_at: instant
      .nullable()
      .optional()
      .describe(
        "Exclusive end for a timed block. Null pauses bookings until resumed.",
      ),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe("IANA timezone. Defaults to the calendar's saved timezone."),
    note: z
      .string()
      .max(140)
      .nullable()
      .optional()
      .describe("Private note. Null clears the note; omission preserves it."),
  }),
  remove_booking_block: z.strictObject({
    ...writeFields,
    block_id: z
      .string()
      .uuid()
      .describe(
        "Block ID from list_booking_blocks. Removing the indefinite pause resumes bookings.",
      ),
  }),
} as const;
const catalog = {
  domain: "bookings",
  access: {
    personas: ["solo_driver", "fleet_admin", "fleet_owner"],
    requiresOperationalFleet: false,
  },
  exposure: "listed",
} as const;
const write = {
  ...catalog,
  kind: "write",
  risk: "standard",
  outputSchema: bookingBlockWriteSchema,
  returns: "BookingBlockWrite",
} as const;
export const bookingBlockTools = {
  list_booking_blocks: {
    ...catalog,
    name: "list_booking_blocks",
    title: "List booking blocks",
    description:
      "Read dated closures and active indefinite pauses on your personal booking calendar or a fleet calendar you administer. Use before editing or removing a block.",
    kind: "read",
    risk: "none",
    annotations: READ_ONLY,
    inputSchema: bookingBlockSchemas.list_booking_blocks,
    outputSchema: bookingBlockListSchema,
    returns: "BookingBlockList",
    example: { scope: "fleet" },
  },
  save_booking_block: {
    ...write,
    name: "save_booking_block",
    title: "Save a booking block or pause",
    description:
      "Add or edit a calendar block for a dated closure or pause new bookings until resumed. Use dry_run: true and confirm the saved proposal before applying. Existing bookings keep their reservations.",
    inputSchema: bookingBlockSchemas.save_booking_block,
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
    example: { scope: "fleet", all_day: false, ends_at: null, dry_run: true },
  },
  remove_booking_block: {
    ...write,
    name: "remove_booking_block",
    title: "Remove a booking block or pause",
    description:
      "Remove an upcoming closure or resume new bookings by removing the indefinite pause. Use dry_run: true and confirm the saved proposal before applying. Existing bookings keep their reservations.",
    inputSchema: bookingBlockSchemas.remove_booking_block,
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
    example: {
      scope: "fleet",
      block_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
  },
} as const;
