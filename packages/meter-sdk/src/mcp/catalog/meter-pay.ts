import * as z from "zod";
import { meterPayStatusSchema } from "../../dto/index.ts";
import { READ_ONLY } from "./shared.ts";
export const meterPaySchemas = {
  get_meter_pay_status: z.strictObject({
    scope: z
      .enum(["me", "fleet"])
      .default("me")
      .describe(
        "Own account by default, even for a fleet admin. Fleet scope requires owner/admin access.",
      ),
    fleet_id: z
      .uuid()
      .optional()
      .describe(
        "Fleet to inspect with fleet scope. May be omitted only for a sole fleet membership.",
      ),
  }),
} as const;
export const meterPayTools = {
  get_meter_pay_status: {
    name: "get_meter_pay_status",
    title: "Get Meter Pay status",
    description:
      "Read Meter Pay payment and payout readiness, missing information and account/fleet Tap to Pay eligibility. Defaults to your own account; explicit fleet scope requires owner/admin access. Never creates or changes a payment account. Status may be cached for 60 seconds; uncached provider reads are limited to 10/minute. Use get_action_link with management_action (and the returned fleet_id for fleet scope) to continue setup or management in Meter.",
    domain: "meter_pay",
    kind: "read",
    risk: "none",
    exposure: "listed",
    external: "meter_pay",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      recordScoped: true,
      requiresOperationalFleet: false,
    },
    inputSchema: meterPaySchemas.get_meter_pay_status,
    outputSchema: meterPayStatusSchema,
    returns: "MeterPayStatus",
    example: { scope: "me" },
    annotations: READ_ONLY,
  },
} as const;
