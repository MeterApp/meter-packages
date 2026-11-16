import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  minorAmountSchema,
  opaqueIdSchema,
  pageSchema,
} from "./common.ts";
import {
  accountingCurrencyRollupSchema,
  accountingDriverSummarySchema,
} from "./accounting.ts";

export const LEDGER_ENTRY_TYPES = [
  "charge",
  "booking_charge",
  "cash_payment",
  "meterpay_payment",
  "driver_payout",
  "fleet_payout",
  "processing_fee",
  "settlement",
  "void_adjustment",
  "payout_reversal",
] as const;

export const ACCOUNTING_EXCEPTION_CODES = [
  "missing_payment_method",
  "uncaptured_payment",
  "refunded_payment",
  "payout_not_delivered",
  "recovered_trip",
  "settled_void",
  "unavailable_settled_trip",
] as const;

export const ledgerEntrySchema = z
  .strictObject({
    entry_id: field(
      opaqueIdSchema,
      'Stable ledger entry id, e.g. "charge:<trip id>" or "settlement:<settlement id>".',
    ),
    occurred_at: field(isoTimestampSchema, "When the entry was posted."),
    type: field(
      z.enum(LEDGER_ENTRY_TYPES),
      "charge: trip fare; booking_charge: booking charge without a trip; cash_payment/meterpay_payment: money collected; driver_payout/fleet_payout: transfers; processing_fee: card fees; settlement: cash settled between driver and fleet; void_adjustment/payout_reversal: reversals after an approved void.",
    ),
    amount_minor: field(
      minorAmountSchema,
      "Signed amount. Negative values leave the fleet (payouts, fees, reversals, settlements paid to drivers).",
    ),
    currency: currencyCodeSchema,
    status: field(
      z.enum(["posted", "pending"]),
      "pending while a void request on the trip awaits review.",
    ),
    description: field(z.string().max(200), "Short English entry label."),
    member_id: field(
      z.string().nullable(),
      "Driver (member id) the entry belongs to, or null.",
    ),
    driver_name: field(z.string().nullable(), "Driver display name, or null."),
    trip_id: field(z.string().nullable(), "Trip behind the entry, or null."),
    booking_id: field(
      z.string().nullable(),
      "Booking behind the entry, or null.",
    ),
    settlement_id: field(
      z.string().nullable(),
      "Settlement behind the entry, or null.",
    ),
    void_request_id: field(
      z.string().nullable(),
      "Void request that produced or holds the entry, or null.",
    ),
    payment_method: field(
      z.string().nullable(),
      "Recorded payment method of the trip or booking, or null.",
    ),
  })
  .meta({
    description:
      "One accounting ledger row. Amounts are minor units of the row's currency; never sum across currencies.",
  });

export const ledgerEntryPageSchema = pageSchema(ledgerEntrySchema).meta({
  description:
    "Result of list_ledger_entries: ledger rows, newest first, in the requested window.",
});

export const driverBalancePageSchema = pageSchema(
  accountingDriverSummarySchema,
).meta({
  description:
    "Result of list_driver_balances: per-driver balances and collections per currency for the window.",
});

export const settlementSchema = z
  .strictObject({
    settlement_id: field(opaqueIdSchema, "Settlement id."),
    member_id: field(z.string(), "Driver (member id) who settled."),
    driver_name: field(z.string().nullable(), "Driver display name, or null."),
    direction: field(
      z.enum(["driver_to_fleet", "fleet_to_driver"]),
      "driver_to_fleet: the driver handed cash to the fleet; fleet_to_driver: the fleet paid the driver.",
    ),
    source: field(
      z.string().max(64),
      "How the settlement was recorded (manual, payout offset, ...).",
    ),
    amount_minor: field(minorAmountSchema, "Settled amount (positive)."),
    currency: currencyCodeSchema,
    settled_at: field(isoTimestampSchema, "When the money changed hands."),
    recorded_at: field(isoTimestampSchema, "When it was recorded in Meter."),
    trip_count: field(z.number().int(), "Trips this settlement covers."),
    trips: field(
      z
        .array(
          z.strictObject({
            trip_id: field(opaqueIdSchema, "Covered trip."),
            applied_amount_minor: field(
              minorAmountSchema,
              "Part of the settlement applied to this trip.",
            ),
          }),
        )
        .max(100),
      "Up to 100 covered trips; trip_count has the full count.",
    ),
  })
  .meta({
    description: "A recorded cash settlement between driver and fleet.",
  });

export const settlementPageSchema = pageSchema(settlementSchema).meta({
  description: "Result of list_settlements: newest first.",
});

export const accountingExceptionSchema = z
  .strictObject({
    exception_id: field(opaqueIdSchema, "Stable exception id."),
    code: field(
      z.enum(ACCOUNTING_EXCEPTION_CODES),
      "missing_payment_method: paid without a method; uncaptured_payment: card authorized but not captured; refunded_payment: refunded after collection; payout_not_delivered: a payout did not arrive; recovered_trip: rebuilt from settlement evidence; settled_void: a settled trip was later voided; unavailable_settled_trip: a settled trip is no longer readable.",
    ),
    trip_id: field(opaqueIdSchema, "Trip with the evidence mismatch."),
    member_id: field(z.string().nullable(), "Driver (member id), or null."),
    driver_name: field(z.string().nullable(), "Driver display name, or null."),
    amount_minor: field(minorAmountSchema, "Amount at stake."),
    currency: currencyCodeSchema,
    occurred_at: field(isoTimestampSchema, "When the trip happened."),
    settlement_ids: field(
      z.array(z.string()).max(100),
      "Settlements linked to the trip.",
    ),
  })
  .meta({
    description:
      "An accounting evidence mismatch to review. Exceptions explain mismatches; they are not extra money owed.",
  });

export const accountingExceptionPageSchema = pageSchema(
  accountingExceptionSchema,
).meta({ description: "Result of list_accounting_exceptions." });

export const accountingTripSchema = z
  .strictObject({
    trip_id: field(opaqueIdSchema, "Trip id (use get_trip for details)."),
    occurred_at: field(isoTimestampSchema, "When the trip happened."),
    currency: currencyCodeSchema,
    payment_method: field(z.string().nullable(), "Recorded payment method."),
    payment_status: field(
      z.string().max(40),
      "paid_digital, paid_cash, paid_other or not_marked_paid.",
    ),
    void_review_status: field(
      z.string().max(40),
      "none, pending, approved or rejected.",
    ),
    is_voided: field(z.boolean(), "Voided by an admin."),
    gross_amount_minor: field(minorAmountSchema, "Trip total incl. tip."),
    tip_amount_minor: field(minorAmountSchema, "Tip."),
    card_processing_fee_minor: field(minorAmountSchema, "Card fees."),
    driver_earnings_minor: field(minorAmountSchema, "Driver share."),
    fleet_cut_minor: field(minorAmountSchema, "Fleet share."),
    collected_amount_minor: field(minorAmountSchema, "Collected, any channel."),
    cash_collected_minor: field(minorAmountSchema, "Collected in cash."),
    not_marked_paid_amount_minor: field(
      minorAmountSchema,
      "Value not yet marked paid.",
    ),
    driver_balance_delta_minor: field(
      z.number().int(),
      "Change to the driver's balance with the fleet from this trip (positive: fleet owes driver).",
    ),
    distance_meters: field(z.number(), "Metered distance.", {
      unit: "meters",
    }),
    duration_seconds: field(z.number(), "Metered duration.", {
      unit: "seconds",
    }),
  })
  .meta({ description: "Accounting view of one trip." });

export const driverAccountingSchema = z
  .strictObject({
    fleet_id: field(
      z.string().nullable(),
      "The fleet, or null for a driver's own all-fleet view.",
    ),
    start_date: field(
      isoTimestampNullableSchema,
      "Inclusive period start, or null for all time.",
    ),
    end_date: field(isoTimestampNullableSchema, "Exclusive period end."),
    driver: field(accountingDriverSummarySchema, "Balance rollup."),
    by_currency: field(
      z.array(accountingCurrencyRollupSchema),
      "Totals per currency for this driver and period.",
    ),
    trips: field(
      pageSchema(accountingTripSchema),
      "Page of this driver's trips, newest first. Send trips.next_cursor as cursor.",
    ),
    settlements: field(
      z.array(settlementSchema).max(50).nullable(),
      "Most recent 50 settlements in the period (fleet view only), or null.",
    ),
  })
  .meta({
    description:
      "Result of get_driver_accounting: one driver's balance, trips and settlements.",
  });

export const DATA_EXPORT_DATASETS = [
  "trips",
  "bookings",
  "customers",
  "members",
  "vehicles",
  "ledger",
  "settlements",
  "trip_invoices",
  "quotes",
] as const;

const exportCell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const dataExportSchema = z
  .strictObject({
    dataset: field(z.enum(DATA_EXPORT_DATASETS), "Exported dataset."),
    filename: field(z.string().max(200), "Suggested file name."),
    format: field(z.enum(["csv", "json"]), "Format of data."),
    timezone: field(
      z.string().max(64),
      "IANA timezone the timestamp columns are rendered in.",
    ),
    row_count: field(z.number().int(), "Rows in this chunk."),
    columns: field(z.array(z.string().max(120)).max(200), "Column names."),
    data: field(
      z.union([z.string(), z.array(z.record(z.string(), exportCell))]),
      "CSV text (format csv, header row first) or row objects (format json).",
    ),
    truncated: field(
      z.boolean(),
      "More rows exist; call again with cursor=next_cursor and append.",
    ),
    next_cursor: field(
      z.string().nullable(),
      "Cursor for the next chunk, or null when complete.",
    ),
  })
  .meta({
    description:
      "Result of export_data: one chunk of a dataset rendered from the authorized list tools. Money columns have *_minor integers plus a decimal string column; timestamps are ISO 8601 in the fleet timezone.",
  });

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type Settlement = z.infer<typeof settlementSchema>;
export type AccountingException = z.infer<typeof accountingExceptionSchema>;
export type AccountingTrip = z.infer<typeof accountingTripSchema>;
export type DriverAccounting = z.infer<typeof driverAccountingSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;
