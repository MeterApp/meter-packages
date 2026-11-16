import * as z from "zod";
import { field, fleetRoleSchema, opaqueIdSchema } from "./common.ts";
import { writeResultSchema } from "./settings.ts";
import { fleetMemberSchema } from "./member.ts";
import { vehicleSchema } from "./vehicle.ts";

export const fleetIconCandidatesSchema = z
  .strictObject({
    icons: z
      .array(
        z.strictObject({
          option: z
            .number()
            .int()
            .min(1)
            .describe("Option number the user sees under the image."),
          icon_id: z
            .string()
            .describe(
              "Send as icon_id to update_fleet_settings to use this icon.",
            ),
        }),
      )
      .describe("Generated icon candidates, shown to the user as images."),
  })
  .meta({
    description:
      "AI-generated app icon candidates for a fleet. Nothing changes until one is saved with update_fleet_settings.",
  });
export type FleetIconCandidates = z.infer<typeof fleetIconCandidatesSchema>;

export const vehicleWriteSchema = writeResultSchema(
  "vehicle",
  vehicleSchema,
  "Result of create_vehicle: what changed and the vehicle after the call.",
);

export const fleetMemberSettingsSchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, "Opaque member id (profile id)."),
    display_name: field(
      z.string().nullable(),
      "Display name, or null if not set.",
    ),
    role: fleetRoleSchema,
    driver_payout_fraction: field(
      z.number().min(0).max(1).nullable(),
      "Share of each fare paid to this driver as a fraction (0.7 = 70%), or null to use the fleet default.",
    ),
  })
  .meta({
    description:
      "A fleet member's role and payout share, as changed by update_fleet_member.",
  });
export type FleetMemberSettings = z.infer<typeof fleetMemberSettingsSchema>;

export const fleetMemberSettingsWriteSchema = writeResultSchema(
  "member",
  fleetMemberSettingsSchema,
  "Result of update_fleet_member: what changed and the member after the call.",
);

export const fleetMemberWriteSchema = writeResultSchema(
  "member",
  fleetMemberSchema,
  "Result of add_fleet_driver: what changed and the new member.",
);
