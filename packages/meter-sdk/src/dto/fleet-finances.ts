import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";
import { writeResultSchema } from "./settings.ts";

export const fleetFeeSettingsSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet whose fare permissions are shown."),
    allow_fleet_custom_fares: field(
      z.boolean().nullable(),
      "Whether fleet members may use custom fares; null preserves an unset stored value.",
    ),
  })
  .describe("Fleet custom-fare permission without private account metadata.");
export const fleetFinanceFieldsSchema = z
  .strictObject({
    auto_cash_offset_enabled: field(
      z.boolean(),
      "Whether eligible cash-trip balances offset driver payouts automatically.",
    ),
    pass_credit_card_fees_to_customer: field(
      z.boolean(),
      "Whether configured card processing fees are passed to customers.",
    ),
    tip_split_behavior: field(
      z.enum(["TIP_GOES_TO_DRIVER", "MATCH_DRIVER_PAYOUT"]),
      "Whether drivers keep all tips or tips follow the driver's payout fraction.",
    ),
  })
  .describe("Stored fleet finance configuration.");
export const fleetFinanceSettingsSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet whose finance settings are shown."),
    country_iso_code: field(
      z.string().nullable(),
      "Saved fleet country used to evaluate payout and cash-offset eligibility; null remains unknown.",
    ),
    default_driver_payout_fraction: field(
      z.number().min(0).max(1).nullable(),
      "Default fraction captured when a driver joins: 0.9 means 90%. Existing member fractions are unchanged. Null means no stored default.",
    ),
    finances: field(
      fleetFinanceFieldsSchema.nullable(),
      "Stored finance settings, or null before configuration. A preview shows every field created on the first save.",
    ),
  })
  .describe(
    "Exact stored fleet payout and fee settings; no provider account identifiers or inferred defaults.",
  );
export const fleetFeeSettingsWriteSchema = writeResultSchema(
  "fee_settings",
  fleetFeeSettingsSchema,
  "Fleet custom-fare permission after confirmation.",
);
export const fleetFinanceSettingsWriteSchema = writeResultSchema(
  "finance_settings",
  fleetFinanceSettingsSchema,
  "Exact fleet finance settings after confirmation.",
);
