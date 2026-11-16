import * as z from "zod";
import { field, isoTimestampSchema } from "./common.ts";
const readiness = z.enum([
  "not_started",
  "unsupported",
  "requirements_due",
  "pending_verification",
  "restricted",
  "ready",
]);
export const meterPayStatusSchema = z
  .strictObject({
    scope: field(
      z.enum(["me", "fleet"]),
      "Own account or explicitly selected fleet payment recipient.",
    ),
    fleet_id: field(
      z.uuid().nullable(),
      "Selected Meter fleet ID, or null for your own account.",
    ),
    account_connected: field(
      z.boolean(),
      "Whether an existing payment account is connected.",
    ),
    country: field(
      z.string().nullable(),
      "Payment account or detected country code, when known.",
    ),
    status: field(readiness, "Current Meter Pay readiness stage."),
    payments_ready: field(
      z.boolean(),
      "Whether this account can accept payments.",
    ),
    payouts_ready: field(
      z.boolean(),
      "Whether this account can receive payouts.",
    ),
    tap_to_pay_ready: field(
      z.boolean(),
      "Account and selected fleet support Tap to Pay. Device, OS and location eligibility must still be checked in the app.",
    ),
    blockers: field(
      z.array(z.string()),
      "Plain-language setup or readiness blockers, without provider identifiers.",
    ),
    missing: field(
      z.array(
        z.strictObject({
          category: z
            .enum([
              "address",
              "bank_account",
              "business_profile",
              "company",
              "contact",
              "director",
              "document",
              "executive",
              "identity",
              "individual",
              "owner",
              "representative",
              "tax",
              "terms_of_service",
              "other",
              "risk",
            ])
            .describe("Safe category of required account information."),
          description: field(
            z.string(),
            "Safe explanation of the missing information.",
          ),
          status: z
            .enum([
              "currently_due",
              "past_due",
              "eventually_due",
              "pending_verification",
            ])
            .describe(
              "When the information is required or whether verification is pending.",
            ),
        }),
      ),
      "Required information categories and safe explanations; no raw provider field paths or personal values.",
    ),
    management_action: field(
      z.enum(["meter_pay_setup", "meter_pay_manage"]),
      "Send this action to get_action_link; include fleet_id for fleet scope.",
    ),
    checked_at: isoTimestampSchema,
  })
  .meta({
    description:
      "Read-only Meter Pay readiness with safe setup guidance and no provider IDs, URLs or KYC values.",
  });
export type MeterPayStatus = z.infer<typeof meterPayStatusSchema>;
