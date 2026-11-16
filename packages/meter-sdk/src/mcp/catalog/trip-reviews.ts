import * as z from "zod";
import {
  TRIP_VOID_APPROVE_REASON_CODES,
  TRIP_VOID_REJECT_REASON_CODES,
  TRIP_VOID_REQUEST_REASON_CODES,
  tripNoteWriteSchema,
  tripVoidRequestWriteSchema,
} from "../../dto/trip-void.ts";
import { dryRunSchema, proposalIdSchema, SETTINGS_WRITE } from "./shared.ts";

const tripId = z.uuid().describe("Trip id from list_trips or get_trip.");

export const tripReviewSchemas = {
  request_trip_void: z.strictObject({
    trip_id: tripId,
    reason: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe("Why the trip should be voided, shown to the reviewer."),
    reason_code: z
      .enum(TRIP_VOID_REQUEST_REASON_CODES)
      .optional()
      .describe("Category of the request for the trip audit log."),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  review_trip_void: z.strictObject({
    trip_id: tripId,
    decision: z
      .enum(["approve", "reject"])
      .describe(
        "approve: void the trip (a paid card trip is refunded). reject: the trip stands.",
      ),
    review_note: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .describe("Note recorded with the decision."),
    reason_code: z
      .enum([
        ...new Set([
          ...TRIP_VOID_APPROVE_REASON_CODES,
          ...TRIP_VOID_REJECT_REASON_CODES,
        ]),
      ] as [string, ...string[]])
      .optional()
      .describe(
        `Category for the audit log. approve: ${TRIP_VOID_APPROVE_REASON_CODES.join(", ")}. reject: ${TRIP_VOID_REJECT_REASON_CODES.join(", ")}.`,
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  update_trip_note: z.strictObject({
    trip_id: tripId,
    internal_note: z
      .string()
      .max(5000)
      .nullable()
      .describe(
        "Private note for the driver and fleet owners/admins; null or empty clears it.",
      ),
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
} as const;

export const tripReviewTools = {
  request_trip_void: {
    name: "request_trip_void",
    title: "Request a trip void",
    description:
      "Ask the fleet to void a trip (wrong fare, duplicate, cash entry error, dispute), as Request void in the app and console does. The trip's driver or a fleet owner/admin; an owner/admin then approves or rejects it in the Meter console. A trip with a pending request returns that request. Preview with dry_run: true, then confirm the saved proposal_id with identical arguments. Nothing is refunded until the request is approved.",
    domain: "trips",
    kind: "write",
    risk: "standard",
    access: {
      personas: ["fleet_owner", "fleet_admin", "fleet_driver"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripReviewSchemas.request_trip_void,
    outputSchema: tripVoidRequestWriteSchema,
    returns: "TripVoidRequestWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      reason: "Duplicate of the trip recorded a minute earlier.",
      reason_code: "duplicate_trip",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: true },
  },
  review_trip_void: {
    name: "review_trip_void",
    title: "Approve or reject a trip void",
    description:
      "Decide a trip's pending void request. Fleet owners/admins only. approve voids the trip and refunds the rider when it was paid by card; reject keeps the trip. Preview with dry_run: true, show the request's reason and, when approving a paid card trip, that a refund will be issued, then confirm the saved proposal_id with identical arguments.",
    domain: "trips",
    kind: "write",
    // Settlement can move money. Keep the fleet workflow in Meter.
    surfaces: [],
    risk: "sensitive",
    access: {
      personas: ["fleet_owner", "fleet_admin"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripReviewSchemas.review_trip_void,
    outputSchema: tripVoidRequestWriteSchema,
    returns: "TripVoidRequestWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      decision: "approve",
      reason_code: "verified_duplicate_trip",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
  update_trip_note: {
    name: "update_trip_note",
    title: "Set a trip's internal note",
    description:
      "Write or clear a trip's private internal note, which only the trip's driver and fleet owners/admins see (never the rider). The trip's driver or a fleet owner/admin. Preview with dry_run: true showing the old and new note, then confirm the saved proposal_id with identical arguments.",
    domain: "trips",
    kind: "write",
    risk: "low",
    access: {
      personas: ["fleet_owner", "fleet_admin", "fleet_driver", "solo_driver"],
      requiresOperationalFleet: false,
      recordScoped: true,
    },
    exposure: "on_demand",
    inputSchema: tripReviewSchemas.update_trip_note,
    outputSchema: tripNoteWriteSchema,
    returns: "TripNoteWrite",
    example: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      internal_note: "Rider paid the tolls in cash.",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
