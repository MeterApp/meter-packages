import * as z from "zod";
import {
  accountingSummarySchema,
  earningsSummarySchema,
  taxSummarySchema,
  mileageReportSchema,
  ledgerEntryPageSchema,
  driverBalancePageSchema,
  settlementPageSchema,
  accountingExceptionPageSchema,
  driverAccountingSchema,
  dataExportSchema,
  LEDGER_ENTRY_TYPES,
  ACCOUNTING_EXCEPTION_CODES,
  DATA_EXPORT_DATASETS,
} from "../../dto/index.ts";
import {
  cursorSchema,
  fleetIdSchema,
  isoDateSchema,
  limitSchema,
  READ_ONLY,
} from "./shared.ts";

const ledgerWindow = {
  fleet_id: fleetIdSchema,
  start_date: isoDateSchema
    .optional()
    .describe("Inclusive window start. Default: 90 days before end_date."),
  end_date: isoDateSchema
    .optional()
    .describe("Exclusive window end. Default: now. Maximum window: 366 days."),
};
const memberFilter = z
  .string()
  .uuid()
  .optional()
  .describe("Only this driver (member_id from list_fleet_members).");
const fleetAdmin = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: true,
} as const;

const reportInput = z.object({
  fleet_id: fleetIdSchema,
  driver: z
    .string()
    .min(1)
    .max(100)
    .default("me")
    .describe('"me", a driver id, or "all" (fleet owners/admins only).'),
  start_date: isoDateSchema
    .optional()
    .describe("Inclusive period start. Default: 30 days ago."),
  end_date: isoDateSchema
    .optional()
    .describe("Exclusive period end. Default: now. Maximum period: 366 days."),
});

export const accountingSchemas = {
  list_ledger_entries: z.strictObject({
    ...ledgerWindow,
    driver: memberFilter,
    entry_type: z
      .array(z.enum(LEDGER_ENTRY_TYPES))
      .min(1)
      .max(LEDGER_ENTRY_TYPES.length)
      .optional()
      .describe("Only these entry types."),
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  list_driver_balances: z.strictObject({
    ...ledgerWindow,
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  get_driver_accounting: z.strictObject({
    ...ledgerWindow,
    driver: z
      .string()
      .min(1)
      .max(100)
      .default("me")
      .describe(
        '"me" (default) for your own accounting across fleets, or a member_id (fleet owners/admins).',
      ),
    cursor: cursorSchema.describe(
      "Cursor from trips.next_cursor of a previous call.",
    ),
    limit: limitSchema.describe("Trips per page, 1-100 (default 50)."),
  }),
  list_settlements: z.strictObject({
    ...ledgerWindow,
    driver: memberFilter,
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  list_accounting_exceptions: z.strictObject({
    ...ledgerWindow,
    code: z
      .array(z.enum(ACCOUNTING_EXCEPTION_CODES))
      .min(1)
      .max(ACCOUNTING_EXCEPTION_CODES.length)
      .optional()
      .describe("Only these exception codes."),
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  export_data: z.strictObject({
    dataset: z
      .enum(DATA_EXPORT_DATASETS)
      .describe("What to export; each dataset is read through its list tool."),
    fleet_id: fleetIdSchema,
    driver: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'trips only: "me", "all" or a member_id. Default: "all" for fleet owners/admins, otherwise "me".',
      ),
    from: isoDateSchema
      .optional()
      .describe(
        "Inclusive start for trips, bookings, ledger, settlements and trip_invoices.",
      ),
    to: isoDateSchema
      .optional()
      .describe(
        "End for trips, bookings and trip_invoices (inclusive) and ledger and settlements (exclusive).",
      ),
    format: z
      .enum(["csv", "json"])
      .default("csv")
      .describe("csv (default): one CSV string; json: an array of rows."),
    cursor: cursorSchema.describe(
      "next_cursor from the previous export_data chunk; repeat the other arguments unchanged.",
    ),
  }),
  get_tax_summary: reportInput,
  get_mileage_report: reportInput,
  get_earnings: z.object({
    scope: z
      .enum(["me", "fleet"])
      .default("me")
      .describe(
        '"me": the caller\'s own Meter Pay payouts. "fleet": all payouts to the fleet and its members (owners/admins only).',
      ),
    fleet_id: fleetIdSchema,
    start_date: isoDateSchema
      .optional()
      .describe("Inclusive period start. Default: 30 days ago."),
    end_date: isoDateSchema
      .optional()
      .describe("Exclusive period end. Default: now."),
    granularity: z
      .enum(["day", "week"])
      .default("day")
      .describe("Bucket size for the time series."),
    include_members: z
      .boolean()
      .default(false)
      .describe(
        'With scope "fleet": also return a per-member breakdown (owners/admins only).',
      ),
  }),
  get_accounting_summary: z.object({
    fleet_id: fleetIdSchema,
    start_date: isoDateSchema
      .optional()
      .describe("Inclusive period start. Default: all time."),
    end_date: isoDateSchema
      .optional()
      .describe("Exclusive period end. Default: now."),
    distance_unit: z
      .enum(["mile", "kilometer"])
      .default("mile")
      .describe("Unit for per-distance figures."),
  }),
} as const;

export const accountingTools = {
  list_ledger_entries: {
    name: "list_ledger_entries",
    title: "List accounting ledger entries",
    description:
      'Every fleet ledger row the Finance ledger shows (trip charges, cash and Meter Pay collections, payouts, card fees, settlements, void reversals), newest first, with signed amount_minor, currency, type, status, driver, trip, booking and settlement references. Owners/admins of an operational fleet. Filter by start_date/end_date (default 90 days, max 366), driver (member_id) and entry_type; page with cursor. Never sum amounts across currencies. Chain get_trip for a trip_id, list_settlements for settlements, or export_data dataset="ledger" for a CSV.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: fleetAdmin,
    exposure: "on_demand",
    inputSchema: accountingSchemas.list_ledger_entries,
    outputSchema: ledgerEntryPageSchema,
    returns: "LedgerEntryPage",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      start_date: "2026-09-01",
      end_date: "2026-10-01",
      entry_type: ["cash_payment", "settlement"],
    },
    annotations: READ_ONLY,
  },
  list_driver_balances: {
    name: "list_driver_balances",
    title: "List driver balances",
    description:
      'Per-driver accounting balances for the window, per currency: trips, gross, tips, card fees, driver earnings vs fleet cut, collected by channel, not yet marked paid, fleet_owes_driver_minor and driver_owes_fleet_minor. Owners/admins of an operational fleet; drivers use get_driver_accounting driver="me". Default 90 days (max 366). Chain get_driver_accounting with a member_id for one driver\'s trips and settlements.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: fleetAdmin,
    exposure: "on_demand",
    inputSchema: accountingSchemas.list_driver_balances,
    outputSchema: driverBalancePageSchema,
    returns: "DriverBalancePage",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  get_driver_accounting: {
    name: "get_driver_accounting",
    title: "Get one driver's accounting",
    description:
      'One driver\'s accounting for the window: balance rollup per currency, a page of trips with gross, tip, fees, driver/fleet split, collection and balance change, and (fleet view) the latest settlements. driver="me" (default) is your own accounting across fleets, for any driver; a member_id needs fleet owner/admin of an operational fleet. Default 90 days (max 366). Page trips with cursor.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: accountingSchemas.get_driver_accounting,
    outputSchema: driverAccountingSchema,
    returns: "DriverAccounting",
    example: { driver: "me", start_date: "2026-09-01" },
    annotations: READ_ONLY,
  },
  list_settlements: {
    name: "list_settlements",
    title: "List cash settlements",
    description:
      "Recorded cash settlements between drivers and the fleet, newest first: direction, amount_minor, currency, settled_at, source and the trips each covers. Owners/admins of an operational fleet. Filter by window (default 90 days, max 366) and driver. Read only: settlements are recorded in the Finance console.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: fleetAdmin,
    exposure: "on_demand",
    inputSchema: accountingSchemas.list_settlements,
    outputSchema: settlementPageSchema,
    returns: "SettlementPage",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  list_accounting_exceptions: {
    name: "list_accounting_exceptions",
    title: "List accounting exceptions",
    description:
      "Trips whose payment evidence does not reconcile (paid without a method, uncaptured or refunded card payments, payouts not delivered, voids after settlement, recovered trips), newest first. Owners/admins of an operational fleet. Window default 90 days (max 366); filter by code. Exceptions explain mismatches, not extra money owed. Chain get_trip for details.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: fleetAdmin,
    exposure: "on_demand",
    inputSchema: accountingSchemas.list_accounting_exceptions,
    outputSchema: accountingExceptionPageSchema,
    returns: "AccountingExceptionPage",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  export_data: {
    name: "export_data",
    title: "Export data as CSV or JSON",
    description:
      "Export trips, bookings, customers, members, vehicles, ledger, settlements, trip_invoices or quotes as CSV text or JSON rows. Rows are read through the same authorized list tools (list_trips, list_bookings, list_customers, list_fleet_members, list_vehicles, list_ledger_entries, list_settlements, list_trip_invoices, list_quotes), so whoever may list a dataset may export it: owners/admins for fleet data; drivers for their own trips, bookings and quotes, and solo drivers for their customers. Money columns keep *_minor integers and add a *_decimal string; timestamps are ISO 8601 in the fleet timezone. One call returns a chunk of at most 1,000 rows or about 96 KB; when truncated is true, call again with cursor=next_cursor and the same arguments and append the rows (only the first CSV chunk has the header row).",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: accountingSchemas.export_data,
    outputSchema: dataExportSchema,
    returns: "DataExport",
    example: {
      dataset: "trips",
      fleet_id: "11111111-1111-4111-8111-111111111111",
      from: "2026-09-01",
      to: "2026-09-30T23:59:59Z",
      format: "csv",
    },
    annotations: READ_ONLY,
  },
  get_tax_summary: {
    name: "get_tax_summary",
    title: "Get trip tax summary",
    description:
      "Summarize saved trip fares, collected tax and non-taxable income separately by currency using native trip pricing. Own trips or an authorized operational fleet. At most 500 trips; Advanced fare models are omitted. complete=false marks omitted trips, unusable pricing or currencies. Narrow the period before relying on incomplete totals. This does not prepare or submit a tax filing.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: accountingSchemas.get_tax_summary,
    outputSchema: taxSummarySchema,
    returns: "TaxSummary",
    example: { driver: "me", start_date: "2026-09-01", end_date: "2026-10-01" },
    annotations: READ_ONLY,
  },
  get_mileage_report: {
    name: "get_mileage_report",
    title: "Get mileage report",
    description:
      "Summarize Mileage tracker records and their business, commute, personal and other classifications in meters. Own records or an authorized operational fleet. At most 500 records; complete=false requires a narrower period. Does not expose location traces or assume a tax deduction rate.",
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: accountingSchemas.get_mileage_report,
    outputSchema: mileageReportSchema,
    returns: "MileageReport",
    example: { driver: "me", start_date: "2026-09-01", end_date: "2026-10-01" },
    annotations: READ_ONLY,
  },

  get_earnings: {
    name: "get_earnings",
    title: "Get Meter Pay earnings",
    description:
      'Summarize Meter Pay bank payouts per currency and day/week. scope "me" reads your own payouts; "fleet" requires an owner/admin and can include member totals. Default: 30 days. Cash and unpaid fares are excluded; use get_accounting_summary for ledger balances, get_tax_summary for trip tax amounts, and get_mileage_report for tracked distance. Use get_action_link action="download_pay_stub" for a pay stub.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: accountingSchemas.get_earnings,
    outputSchema: earningsSummarySchema,
    returns: "EarningsSummary",
    example: {
      scope: "fleet",
      fleet_id: "11111111-1111-4111-8111-111111111111",
      start_date: "2026-08-01",
      end_date: "2026-09-01",
      granularity: "week",
      include_members: true,
    },
    annotations: READ_ONLY,
  },
  get_accounting_summary: {
    name: "get_accounting_summary",
    title: "Get fleet accounting summary",
    description:
      'Fleet ledger rollup for owners and admins of an operational fleet: per currency, trip counts, gross, tips, card fees, driver earnings vs fleet cut, what was collected by card, cash or other means, what is not yet marked paid, and outstanding balances between fleet and drivers; plus the same per driver and reconciliation queue counts. Optional start_date/end_date (default all time) and distance_unit. For monthly contributions and automatic reconciliation assessments, use get_reconciliation_statements instead; this tool reads trip accounting. Drivers get a permission error; use get_earnings scope "me" for a driver\'s own payouts.',
    domain: "accounting",
    kind: "read",
    risk: "none",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: true,
    },
    exposure: "listed",
    inputSchema: accountingSchemas.get_accounting_summary,
    outputSchema: accountingSummarySchema,
    returns: "AccountingSummary",
    example: {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      start_date: "2026-09-01",
      distance_unit: "mile",
    },
    annotations: READ_ONLY,
  },
} as const;
