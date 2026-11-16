import * as z from "zod";
import {
  fleetFeeSettingsWriteSchema,
  fleetFinanceSettingsWriteSchema,
} from "../../dto/fleet-finances.ts";
import {
  fleetIdSchema,
  dryRunSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";
const financeFields = {
  default_driver_payout_fraction: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Default fraction for newly joined drivers; 0.9 means 90%. Existing member fractions stay unchanged.",
    ),
  auto_cash_offset_enabled: z
    .boolean()
    .optional()
    .describe(
      "Enable or disable automatic cash offsets where the fleet settlement model supports them.",
    ),
  pass_credit_card_fees_to_customer: z
    .boolean()
    .optional()
    .describe(
      "Charge configured card processing fees to customers, or have the fleet absorb them.",
    ),
  tip_split_behavior: z
    .enum(["TIP_GOES_TO_DRIVER", "MATCH_DRIVER_PAYOUT"])
    .optional()
    .describe(
      "Give all tips to the driver or split tips using the driver's payout fraction.",
    ),
};
export const fleetFinanceSchemas = {
  update_fee_settings: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    allow_fleet_custom_fares: z
      .boolean()
      .describe("Whether fleet members may use custom fares."),
  }),
  update_fleet_finances: z
    .strictObject({
      fleet_id: fleetIdSchema,
      dry_run: dryRunSchema,
      proposal_id: proposalIdSchema,
      ...financeFields,
    })
    .refine(
      (input) =>
        Object.keys(financeFields).some(
          (key) => input[key as keyof typeof financeFields] !== undefined,
        ),
      { message: "Provide at least one finance setting." },
    ),
} as const;
const access = {
  personas: ["fleet_owner", "fleet_admin"],
  requiresOperationalFleet: true,
} as const;
export const fleetFinanceTools = {
  update_fee_settings: {
    name: "update_fee_settings",
    title: "Change fleet custom-fare permission",
    description:
      "Change whether members of an operational fleet may use custom fares. Call with dry_run: true, show the full preview, obtain human approval, and confirm the saved proposal_id. This does not edit fare amounts or override driver membership permissions.",
    domain: "fleet",
    kind: "write",
    risk: "sensitive",
    exposure: "on_demand",
    access,
    inputSchema: fleetFinanceSchemas.update_fee_settings,
    outputSchema: fleetFeeSettingsWriteSchema,
    returns: "FleetFeeSettingsWrite",
    example: { allow_fleet_custom_fares: false, dry_run: true },
    annotations: SETTINGS_WRITE,
  },
  update_fleet_finances: {
    name: "update_fleet_finances",
    title: "Change fleet payout and fee settings",
    description:
      "Change fleet default payout fraction, tip split, card-fee pass-through or eligible cash offsets. Call with dry_run: true, show every change, obtain human approval, and confirm the saved proposal_id. Omitted existing settings are preserved. First configuration previews every created default. The default payout fraction affects newly joined drivers, not existing member fractions. No payout or transfer is sent by this tool.",
    domain: "fleet",
    kind: "write",
    risk: "sensitive",
    exposure: "on_demand",
    access,
    inputSchema: fleetFinanceSchemas.update_fleet_finances,
    outputSchema: fleetFinanceSettingsWriteSchema,
    returns: "FleetFinanceSettingsWrite",
    example: { default_driver_payout_fraction: 0.9, dry_run: true },
    annotations: SETTINGS_WRITE,
  },
} as const;
