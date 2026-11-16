import * as z from "zod";
import {
  reconciliationPoliciesSchema,
  reconciliationStatementsSchema,
  reconciliationWriteSchema,
} from "../../dto/reconciliation.ts";
import {
  fleetIdSchema,
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";
const id = z.string().uuid();
const amount = z.number().int().positive().safe();
const timestamp = z.string().datetime({ offset: true });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const participant = z.strictObject({
  profile_id: id,
  monthly_target_minor: amount.optional(),
  notice_acknowledged_at: timestamp.optional(),
  notice_source: z.string().trim().min(1).max(80).optional(),
});
const write = {
  fleet_id: fleetIdSchema,
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
export const reconciliationSchemas = {
  get_reconciliation_policies: z.strictObject({ fleet_id: fleetIdSchema }),
  get_reconciliation_statements: z
    .strictObject({
      fleet_id: fleetIdSchema,
      all_time: z
        .boolean()
        .default(false)
        .describe(
          "Read contribution history since the beginning. Mutually exclusive with month or explicit bounds.",
        ),
      member: z
        .string()
        .min(1)
        .default("me")
        .describe(
          '"me", "all" (owner/admin), or a member profile UUID from list_fleet_members.',
        ),
      period: month
        .optional()
        .describe(
          "Fleet-local month. Default: current month. Omit when using explicit period bounds.",
        ),
      period_start: timestamp.optional(),
      period_end: timestamp.optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().nonnegative().default(0),
      entry_limit: z.number().int().min(1).max(100).default(50),
      entry_offset: z.number().int().nonnegative().default(0),
    })
    .refine(
      (v) => !v.all_time || (!v.period && !v.period_start && !v.period_end),
      { message: "Choose all_time, a month, or explicit bounds." },
    )
    .refine((v) => Boolean(v.period_start) === Boolean(v.period_end), {
      message: "Provide both period bounds.",
    })
    .refine((v) => !v.period || !v.period_start, {
      message: "Use a month or explicit bounds, not both.",
    })
    .refine(
      (v) =>
        !v.period_start ||
        Date.parse(v.period_start) < Date.parse(v.period_end!),
      { message: "Period end must follow start." },
    ),
  manage_reconciliation_policy: z
    .strictObject({
      ...write,
      action: z.enum([
        "draft",
        "activate",
        "pause",
        "add_participants",
        "change_participant",
        "end_participant",
      ]),
      policy_id: id.optional(),
      participant_id: id.optional(),
      payout_floor_minor: z
        .number()
        .int()
        .nonnegative()
        .safe()
        .optional()
        .describe(
          "Draft only. Minimum driver payout protected from recurring expense collection, in minor currency units (USD cents). Defaults to 0, allowing collection from small payouts. Cash debt recovery runs first.",
        ),
      monthly_target_minor: amount.optional(),
      effective_start_at: timestamp.optional(),
      effective_end_at: timestamp.optional(),
      participants: z.array(participant).min(1).max(100).optional(),
      notice_acknowledged_at: timestamp.optional(),
      notice_source: z.string().trim().min(1).max(80).optional(),
    })
    .superRefine((v, ctx) => {
      const required =
        v.action === "draft"
          ? ["monthly_target_minor", "effective_start_at", "participants"]
          : v.action === "change_participant"
            ? ["policy_id", "participant_id", "monthly_target_minor"]
            : v.action === "end_participant"
              ? ["policy_id", "participant_id"]
              : v.action === "add_participants"
                ? ["policy_id", "participants"]
                : ["policy_id"];
      const allowed = new Set([
        ...required,
        ...Object.keys(write),
        "action",
        ...(v.action === "pause" ? ["effective_end_at"] : []),
        ...(v.action === "draft" ? ["payout_floor_minor"] : []),
        ...(v.action === "change_participant"
          ? ["notice_acknowledged_at", "notice_source"]
          : []),
      ]);
      for (const key of required)
        if (v[key as keyof typeof v] === undefined)
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required for this action.",
          });
      for (const key of Object.keys(v))
        if (!allowed.has(key))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Not used by this action.",
          });
      if (
        v.participants &&
        new Set(v.participants.map((p) => p.profile_id)).size !==
          v.participants.length
      )
        ctx.addIssue({
          code: "custom",
          path: ["participants"],
          message: "Members must be unique.",
        });
    }),
  create_reconciliation_assessments: z.strictObject({
    ...write,
    service_month: month.describe(
      "Generate the month's prorated assessments from existing active policies; never invent or duplicate an arbitrary charge.",
    ),
  }),
  manage_reconciliation_assessment: z
    .strictObject({
      ...write,
      action: z.enum(["record_payment", "adjust", "close"]),
      assessment_id: id,
      amount_minor: z.number().int().safe().optional(),
      adjustment_type: z
        .enum(["supplemental", "waiver", "correction", "reversal"])
        .optional(),
      reason_code: z
        .string()
        .regex(/^[a-z][a-z0-9_]{0,63}$/)
        .optional(),
      payment_method: z.enum(["bank_transfer", "cash", "other"]).optional(),
      settled_at: timestamp.optional(),
      note: z.string().trim().max(500).optional(),
    })
    .superRefine((v, ctx) => {
      const required =
        v.action === "record_payment"
          ? ["amount_minor", "payment_method", "settled_at"]
          : v.action === "adjust"
            ? ["amount_minor", "adjustment_type", "reason_code"]
            : ["reason_code"];
      const allowed = new Set([
        ...Object.keys(write),
        "action",
        "assessment_id",
        "note",
        ...required,
      ]);
      for (const key of required)
        if (v[key as keyof typeof v] === undefined)
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required for this action.",
          });
      for (const key of Object.keys(v))
        if (!allowed.has(key))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Not used by this action.",
          });
      if (
        (v.action === "record_payment" && (v.amount_minor ?? 0) <= 0) ||
        (v.action === "adjust" && v.amount_minor === 0)
      )
        ctx.addIssue({
          code: "custom",
          path: ["amount_minor"],
          message: "Payment must be positive; adjustment must be nonzero.",
        });
    }),
} as const;
const admin = {
  personas: ["fleet_owner", "fleet_admin"],
  requiresOperationalFleet: true,
} as const;
const changes =
  " Preview with dry_run=true, show every change, obtain human approval, then confirm the same arguments with proposal_id. Amounts are minor currency units. This never sends a bank transfer.";
export const reconciliationTools = {
  get_reconciliation_policies: {
    name: "get_reconciliation_policies",
    title: "Get monthly reconciliation settings",
    description:
      "Read monthly contribution targets, policy versions, enrolled members and their target overrides, collection rates, payout floor, effective dates and automatic reconciliation execution state. Owners/admins only.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: admin,
    exposure: "on_demand",
    inputSchema: reconciliationSchemas.get_reconciliation_policies,
    outputSchema: reconciliationPoliciesSchema,
    returns: "ReconciliationPolicies",
    example: {},
    annotations: READ_ONLY,
  },
  get_reconciliation_statements: {
    name: "get_reconciliation_statements",
    title: "Get assessments and member contributions",
    description:
      'Read assessments, lifetime collected/remaining amounts, payment and reversal history, and net contributions during a month or explicit date range. Use member="all" for per-person fleet contributions or member="me" for your own. Fleet drivers can read only their own statement. Default current month in fleet timezone. Use all_time=true for since-the-beginning history. Lifetime assessment balances are distinct from contributed_in_period_minor, which is complete before entry pagination. Page members with offset and history with entry_offset.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["fleet_owner", "fleet_admin", "fleet_driver"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: reconciliationSchemas.get_reconciliation_statements,
    outputSchema: reconciliationStatementsSchema,
    returns: "ReconciliationStatements",
    example: { member: "me", period: "2026-10" },
    annotations: READ_ONLY,
  },
  manage_reconciliation_policy: {
    name: "manage_reconciliation_policy",
    title: "Manage monthly contribution policy",
    description:
      "Create a draft monthly policy, activate or pause it, add members, change a member's target, or end enrollment. Use get_reconciliation_policies and list_fleet_members for IDs. Draft requires target, start timestamp and participants; other actions require policy_id. Change/end require participant_id. Acknowledgment fields record actual member notice only; never invent consent. Participant changes take effect under the dashboard's prospective enrollment rules." +
      changes,
    domain: "accounting",
    kind: "write",
    risk: "sensitive",
    access: admin,
    exposure: "on_demand",
    inputSchema: reconciliationSchemas.manage_reconciliation_policy,
    outputSchema: reconciliationWriteSchema,
    returns: "ReconciliationWrite",
    example: {
      action: "draft",
      monthly_target_minor: 69300,
      effective_start_at: "2026-11-01T04:00:00Z",
      participants: [{ profile_id: "11111111-1111-4111-8111-111111111111" }],
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
  create_reconciliation_assessments: {
    name: "create_reconciliation_assessments",
    title: "Create monthly assessments",
    description:
      "Generate completed-month assessments for enrolled members using saved policies and native proration. Existing assessments are not duplicated. Configure and activate a monthly policy first. This creates accounting obligations, not payments." +
      changes,
    domain: "accounting",
    kind: "write",
    risk: "sensitive",
    access: admin,
    exposure: "on_demand",
    inputSchema: reconciliationSchemas.create_reconciliation_assessments,
    outputSchema: reconciliationWriteSchema,
    returns: "ReconciliationWrite",
    example: { service_month: "2026-09", dry_run: true },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  manage_reconciliation_assessment: {
    name: "manage_reconciliation_assessment",
    title: "Record payment, adjust or close assessment",
    description:
      "Record an already received manual assessment payment, add a signed supplemental/waiver/correction/reversal adjustment, or close an assessment with a reason. Read assessment IDs and balances with get_reconciliation_statements. Payment requires positive amount_minor, payment_method and settled_at. Adjust requires signed nonzero amount_minor, adjustment_type and reason_code; a waiver normally uses a negative amount. Close requires reason_code. Preserve the original history; closed assessments follow native correction rules." +
      changes,
    domain: "accounting",
    kind: "write",
    risk: "sensitive",
    access: admin,
    exposure: "on_demand",
    inputSchema: reconciliationSchemas.manage_reconciliation_assessment,
    outputSchema: reconciliationWriteSchema,
    returns: "ReconciliationWrite",
    example: {
      action: "record_payment",
      assessment_id: "11111111-1111-4111-8111-111111111111",
      amount_minor: 10000,
      payment_method: "cash",
      settled_at: "2026-10-19T16:00:00Z",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
} as const;
