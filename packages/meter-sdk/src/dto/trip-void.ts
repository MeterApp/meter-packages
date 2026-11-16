import * as z from "zod";
import {
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
} from "./common.ts";
import { writeResultSchema } from "./settings.ts";

/** Mirrors the backend trip audit reason codes for void requests and reviews. */
export const TRIP_VOID_REQUEST_REASON_CODES = [
  "driver_request",
  "fleet_admin_request",
  "cash_entry_error",
  "fare_error",
  "duplicate_trip",
  "rider_dispute",
  "other",
] as const;
export const TRIP_VOID_APPROVE_REASON_CODES = [
  "verified_driver_request",
  "verified_cash_entry_error",
  "verified_fare_error",
  "verified_duplicate_trip",
  "customer_service_recovery",
  "other",
] as const;
export const TRIP_VOID_REJECT_REASON_CODES = [
  "valid_trip",
  "insufficient_evidence",
  "already_settled",
  "policy_not_met",
  "other",
] as const;

export const tripVoidRequestSchema = z
  .strictObject({
    void_request_id: z.uuid().describe("Void request id."),
    trip_id: z.uuid().describe("Trip the request is for, for get_trip."),
    status: field(
      z.enum(["pending", "approved", "rejected"]),
      "pending: waiting for a fleet owner/admin; approved: the trip is voided (a paid card trip was refunded); rejected: the trip stands.",
    ),
    reason: field(z.string(), "Why the void was requested."),
    requested_by: z.uuid().describe("Member who asked for the void."),
    requested_at: isoTimestampSchema,
    reviewed_by: z
      .uuid()
      .nullable()
      .describe("Owner/admin who approved or rejected it, or null."),
    reviewed_at: isoTimestampNullableSchema,
    review_note: field(z.string().nullable(), "Reviewer's note, or null."),
  })
  .meta({
    id: "TripVoidRequest",
    description:
      "A request to void a fleet trip and its review. Approving refunds a paid card trip.",
  });
export type TripVoidRequest = z.infer<typeof tripVoidRequestSchema>;

export const tripVoidRequestWriteSchema = writeResultSchema(
  "void_request",
  tripVoidRequestSchema,
  "Preview or confirmed trip void request or review.",
).meta({ id: "TripVoidRequestWrite" });
export type TripVoidRequestWrite = z.infer<typeof tripVoidRequestWriteSchema>;

export const tripNoteSchema = z
  .strictObject({
    trip_id: z.uuid().describe("Trip id, for get_trip."),
    internal_note: field(
      z.string().nullable(),
      "Private note seen only by the trip's driver and fleet owners/admins; null when cleared.",
      { roles: ["owner", "admin", "self"] },
    ),
  })
  .meta({ id: "TripNote", description: "A trip's private internal note." });
export type TripNote = z.infer<typeof tripNoteSchema>;

export const tripNoteWriteSchema = writeResultSchema(
  "trip_note",
  tripNoteSchema,
  "Preview or confirmed trip note change.",
).meta({ id: "TripNoteWrite" });
export type TripNoteWrite = z.infer<typeof tripNoteWriteSchema>;
