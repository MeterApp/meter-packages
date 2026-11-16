import * as z from "zod";
import { writeResultSchema } from "./settings.ts";
const id = z.string().uuid();
const money = z.number().int().safe();
export const reconciliationParticipantSchema = z.strictObject({
  id: id.describe("Record identifier."),
  profile_id: id.describe("Enrolled member profile ID."),
  enrollment_version: z
    .number()
    .int()
    .describe("Enrollment version; changes create a new enrollment."),
  status: z.string().describe("Native lifecycle or collection status."),
  monthly_target_minor: money
    .nullable()
    .describe(
      "Monthly target in minor currency units; a null participant value inherits the policy target.",
    ),
  effective_start_at: z
    .string()
    .describe("Inclusive effective start timestamp."),
  effective_end_at: z
    .string()
    .nullable()
    .describe("Exclusive effective end, or null while open."),
  notice_acknowledged_at: z
    .string()
    .nullable()
    .describe("Actual member notice acknowledgment timestamp, or null."),
  notice_source: z
    .string()
    .nullable()
    .describe("Recorded notice acknowledgment source, or null."),
});
export const reconciliationPolicySchema = z
  .strictObject({
    id: id.describe("Record identifier."),
    fleet_id: id.describe("Fleet that owns this record."),
    version: z.number().int().describe("Immutable policy version."),
    status: z
      .enum(["draft", "active", "paused", "ended"])
      .describe("Native lifecycle or collection status."),
    currency: z
      .string()
      .describe("ISO currency code; never combine amounts across currencies."),
    timezone: z
      .string()
      .describe("Policy IANA timezone used for monthly proration."),
    monthly_target_minor: money.describe(
      "Monthly target in minor currency units; a null participant value inherits the policy target.",
    ),
    base_collection_rate: z
      .number()
      .describe("Base contribution withholding fraction."),
    catch_up_collection_rate: z
      .number()
      .describe("Catch-up withholding fraction."),
    payout_floor_minor: money.describe(
      "Protected payout floor in minor currency units.",
    ),
    effective_start_at: z
      .string()
      .nullable()
      .describe("Inclusive effective start timestamp."),
    effective_end_at: z
      .string()
      .nullable()
      .describe("Exclusive effective end, or null while open."),
    participants: z
      .array(reconciliationParticipantSchema)
      .describe("Versioned member enrollments and target overrides."),
  })
  .meta({
    description:
      "Monthly contribution policy. Amounts are minor currency units; rates are fractions. Participant targets override the policy target. No internal metadata is exposed.",
  });
export const reconciliationPoliciesSchema = z.strictObject({
  fleet_id: id.describe("Fleet that owns this record."),
  policies: z
    .array(reconciliationPolicySchema)
    .describe(
      "Policy history including drafts, active, paused and ended versions.",
    ),
  next_allowed_effective_start_at: z
    .string()
    .describe("Earliest effective start accepted for a new policy."),
  execution: z
    .strictObject({
      cash_offset: z
        .enum(["off", "live", "unsupported"])
        .describe("Automatic cash offset execution state."),
      member_expense: z
        .enum(["not_configured", "draft", "live", "paused", "unsupported"])
        .describe("Monthly contribution execution state."),
    })
    .describe("Whether configured automatic reconciliation can execute."),
});
export const reconciliationAssessmentSchema = z.strictObject({
  id: id.describe("Record identifier."),
  fleet_id: id.describe("Fleet that owns this record."),
  member_profile_id: id.describe(
    "Member profile ID; resolve the name with list_fleet_members.",
  ),
  policy_id: id.describe("Policy that generated this obligation."),
  policy_version: z
    .number()
    .int()
    .describe("Policy version at assessment creation."),
  currency: z
    .string()
    .describe("ISO currency code; never combine amounts across currencies."),
  period_start: z
    .string()
    .describe("Inclusive activity or service-period start."),
  period_end: z.string().describe("Exclusive activity or service-period end."),
  active_start: z
    .string()
    .describe("Start used for prorating this member obligation."),
  active_end: z
    .string()
    .describe("End used for prorating this member obligation."),
  target_amount_minor: money.describe(
    "Unprorated monthly target in minor currency units.",
  ),
  assessed_amount_minor: money.describe(
    "Original prorated obligation in minor currency units.",
  ),
  adjustment_total_minor: money.describe(
    "Signed total adjustments in minor currency units.",
  ),
  carryforward_minor: money.describe(
    "Prior-period carryforward in minor currency units; not a payment.",
  ),
  collected_minor: money.describe(
    "Lifetime net collections against this assessment, including payments outside the requested activity period.",
  ),
  remaining_minor: money.describe(
    "Remaining obligation in minor currency units.",
  ),
  status: z
    .enum([
      "open",
      "partially_collected",
      "fully_collected",
      "closed_uncollected",
    ])
    .describe("Native lifecycle or collection status."),
  proration_numerator: z
    .number()
    .int()
    .describe("Eligible days used in proration."),
  proration_denominator: z
    .number()
    .int()
    .describe("Calendar days in the service month."),
  source: z.string().describe("Source category for the assessment or payment."),
  formula: z
    .strictObject({
      base_collection_rate: z
        .number()
        .nullable()
        .describe("Base contribution withholding fraction."),
      catch_up_collection_rate: z
        .number()
        .nullable()
        .describe("Catch-up withholding fraction."),
      monthly_target_minor: money
        .nullable()
        .describe(
          "Monthly target in minor currency units; a null participant value inherits the policy target.",
        ),
      payout_floor_minor: money
        .nullable()
        .describe("Protected payout floor in minor currency units."),
      timezone: z
        .string()
        .nullable()
        .describe("Policy IANA timezone used for monthly proration."),
    })
    .describe(
      "Historical policy formula; nullable fields indicate unavailable history.",
    ),
});
export const reconciliationEntrySchema = z.strictObject({
  id: z.string().describe("Record identifier."),
  type: z
    .enum([
      "cash_obligation",
      "cash_settlement",
      "expense_adjustment",
      "expense_assessment",
      "expense_settlement",
      "trip_earning",
    ])
    .describe("Native statement entry category."),
  amount_minor: money.describe(
    "Signed or direction-qualified amount in minor currency units.",
  ),
  currency: z
    .string()
    .describe("ISO currency code; never combine amounts across currencies."),
  direction: z
    .enum(["credit", "debit"])
    .describe(
      "Credit reduces an obligation; debit increases it or reverses a credit.",
    ),
  occurred_at: z
    .string()
    .describe("Activity timestamp; payments use settlement time."),
  assessment_id: id
    .nullable()
    .describe("Assessment receiving this contribution."),
  settlement_id: id.nullable().describe("Linked settlement ID when present."),
  trip_id: z.string().nullable().describe("Linked trip ID when present."),
  source: z
    .string()
    .nullable()
    .describe("Source category for the assessment or payment."),
});
const pagination = z.strictObject({
  limit: z.number().int().describe("Requested page size."),
  offset: z
    .number()
    .int()
    .describe("Zero-based offset within this collection."),
  total: z.number().int().describe("Total records before pagination."),
});
export const reconciliationStatementsSchema = z
  .strictObject({
    fleet_id: id.describe("Fleet that owns this record."),
    period_start: z
      .string()
      .describe("Inclusive activity or service-period start."),
    period_end: z
      .string()
      .describe("Exclusive activity or service-period end."),
    pagination: pagination.describe(
      "Member pagination; currencies remain separate within each member.",
    ),
    statements: z
      .array(
        z.strictObject({
          member_profile_id: id.describe(
            "Member profile ID; resolve the name with list_fleet_members.",
          ),
          currency: z
            .string()
            .describe(
              "ISO currency code; never combine amounts across currencies.",
            ),
          contributed_in_period_minor: money.describe(
            "Net assessment payments by settlement timestamp within the inclusive start / exclusive end, after reversals. Computed before entry pagination; excludes cash offsets, waivers and carryforwards.",
          ),
          contributions_by_assessment: z
            .array(
              z.strictObject({
                assessment_id: id.describe(
                  "Assessment receiving this contribution.",
                ),
                amount_minor: money.describe(
                  "Signed or direction-qualified amount in minor currency units.",
                ),
              }),
            )
            .describe(
              "Complete net payment activity by assessment within the requested period.",
            ),
          assessments: z
            .array(reconciliationAssessmentSchema)
            .describe("Assessment snapshots with lifetime balances."),
          entries: z
            .array(reconciliationEntrySchema)
            .describe(
              "Paged native statement history; this page is not the contribution total.",
            ),
          entries_pagination: pagination.describe(
            "Independent history pagination for this member and currency.",
          ),
        }),
      )
      .describe("Per-member, per-currency contribution statements."),
  })
  .meta({
    description:
      "Per-member contribution statements. Activity-period collections and lifetime assessment balances are separate. Currencies are never combined. Defaults to the current month in the fleet timezone; supply explicit timestamps for all-time history. Page members and entries independently.",
  });
export const reconciliationCommandSchema = z.strictObject({
  fleet_id: id.describe("Fleet that owns this record."),
  action: z.string().describe("Confirmed reconciliation action."),
  policy: reconciliationPolicySchema
    .nullable()
    .describe("Policy after the action, or null for assessment actions."),
  assessment_ids: z
    .array(id)
    .describe("Assessment IDs affected by this command."),
  record_id: z
    .string()
    .nullable()
    .describe(
      "Persisted payment, adjustment or close identifier, when applicable.",
    ),
});
export const reconciliationWriteSchema = writeResultSchema(
  "reconciliation",
  reconciliationCommandSchema
    .nullable()
    .describe("Confirmed result, or null until a preview has been applied."),
  "ReconciliationWrite",
);
