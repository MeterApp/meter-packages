import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  minorAmountSchema,
  opaqueIdSchema,
} from "./common.ts";

export const accountingCurrencyRollupSchema = z
  .strictObject({
    currency: currencyCodeSchema,
    trip_count: field(
      z.number().int(),
      "Trips in this currency in the period.",
    ),
    paid_trip_count: field(
      z.number().int(),
      "Trips marked paid (any channel).",
    ),
    voided_trip_count: field(z.number().int(), "Trips voided by an admin."),
    gross_amount_minor: field(
      minorAmountSchema,
      "Sum of trip totals before fees, including tips.",
    ),
    tip_amount_minor: field(minorAmountSchema, "Tips included in gross."),
    card_processing_fee_minor: field(
      minorAmountSchema,
      "Card processing fees on Meter Pay payments.",
    ),
    net_after_fees_minor: field(
      minorAmountSchema,
      "Gross minus card processing fees.",
    ),
    driver_earnings_minor: field(
      minorAmountSchema,
      "Portion owed to drivers under the payout policy.",
    ),
    fleet_cut_minor: field(minorAmountSchema, "Portion retained by the fleet."),
    collected_amount_minor: field(
      minorAmountSchema,
      "Amount actually collected (any channel).",
    ),
    digital_collected_minor: field(
      minorAmountSchema,
      "Collected through Meter Pay (card).",
    ),
    cash_collected_minor: field(
      minorAmountSchema,
      "Collected in cash by drivers.",
    ),
    other_collected_minor: field(
      minorAmountSchema,
      "Collected through other means (invoice, external terminal).",
    ),
    not_marked_paid_amount_minor: field(
      minorAmountSchema,
      "Value of trips not yet marked paid.",
    ),
    fleet_owes_driver_minor: field(
      minorAmountSchema,
      "Outstanding balance the fleet owes its drivers.",
    ),
    driver_owes_fleet_minor: field(
      minorAmountSchema,
      "Outstanding cash drivers still owe the fleet.",
    ),
    distance_meters: field(z.number(), "Total metered distance.", {
      unit: "meters",
    }),
    duration_seconds: field(z.number(), "Total metered duration.", {
      unit: "seconds",
    }),
  })
  .meta({ description: "Ledger rollup for one currency." });

export const accountingDriverSummarySchema = z
  .strictObject({
    member_id: field(
      z.string(),
      'Opaque member id, or "unknown" for trips whose driver account was deleted.',
    ),
    display_name: field(z.string().nullable(), "Driver display name, or null."),
    pending_void_requests: field(
      z.number().int(),
      "Void requests from this driver awaiting review.",
    ),
    by_currency: field(
      z.array(accountingCurrencyRollupSchema),
      "Rollups per currency for this driver.",
    ),
  })
  .meta({ description: "Per-driver ledger rollup." });

export const accountingQueueCountsSchema = z
  .strictObject({
    unrecorded: field(z.number().int(), "Trips with no payment recorded."),
    cash: field(z.number().int(), "Cash trips awaiting settlement."),
    pending_void: field(z.number().int(), "Void requests awaiting review."),
    delete_eligible: field(z.number().int(), "Trips eligible for deletion."),
  })
  .meta({ description: "Reconciliation work-queue counts." });

export const accountingTrendBucketSchema = accountingCurrencyRollupSchema
  .pick({
    currency: true,
    trip_count: true,
    gross_amount_minor: true,
    driver_earnings_minor: true,
    fleet_cut_minor: true,
    collected_amount_minor: true,
    digital_collected_minor: true,
    cash_collected_minor: true,
    other_collected_minor: true,
    not_marked_paid_amount_minor: true,
    card_processing_fee_minor: true,
    distance_meters: true,
    duration_seconds: true,
  })
  .extend({
    bucket_start: field(
      z.string(),
      "Start of the accounting time bucket (ISO 8601).",
    ),
  })
  .meta({
    description:
      "Accounting trend bucket for one currency; never sum money across currencies.",
  });

export const accountingSummarySchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "The fleet."),
    start_date: field(
      z.string().nullable(),
      "Inclusive period start (ISO 8601), or null for all time.",
    ),
    end_date: field(
      z.string().nullable(),
      "Exclusive period end (ISO 8601), or null for now.",
    ),
    distance_unit: field(
      z.enum(["mile", "kilometer"]),
      "Unit used for per-distance rates (totals stay in meters).",
    ),
    trip_count: field(
      z.number().int(),
      "Trips in the period across currencies.",
    ),
    by_currency: field(
      z.array(accountingCurrencyRollupSchema),
      "Fleet-wide rollups per currency.",
    ),
    trend: field(
      z.array(accountingTrendBucketSchema).max(50),
      "Most recent 50 daily ledger currency buckets. Inspect trend_truncated; narrow the range or use query_metrics for complete aggregates.",
    ),
    trend_truncated: field(
      z.boolean(),
      "Older trend buckets were omitted. Summary totals and balances still cover the full requested range.",
    ),
    drivers: field(
      z.array(accountingDriverSummarySchema),
      "Per-driver rollups.",
    ),
    queue_counts: field(
      accountingQueueCountsSchema.nullable(),
      "Reconciliation queue counts, or null.",
    ),
  })
  .meta({
    description:
      "Result of get_accounting_summary (owners/admins). Full ledger view: cash, card, payouts and balances.",
  });
export type AccountingSummary = z.infer<typeof accountingSummarySchema>;
