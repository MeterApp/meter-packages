import * as z from "zod";
import {
  driverAvailabilityWriteSchema,
  myProfileWriteSchema,
  NAVIGATION_PROVIDERS,
} from "../../dto/index.ts";
import { dryRunSchema, proposalIdSchema, SETTINGS_WRITE } from "./shared.ts";

const scheduleTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM in 24-hour time.");

export const accountSchemas = {
  update_my_profile: z.strictObject({
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    first_name: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("Your first name. An empty string clears it."),
    last_name: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("Your last name. An empty string clears it."),
    company_name: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .describe("Business name printed on your receipts. Null to clear."),
    preferred_navigation_provider: z
      .enum(NAVIGATION_PROVIDERS)
      .optional()
      .describe("Navigation app the meter opens for directions."),
    hide_contact_on_receipt: z
      .boolean()
      .optional()
      .describe(
        "Hide your phone and email on rider receipts. Requires Meter Pro or a Fleet plan.",
      ),
    pass_credit_card_fees_to_customer: z
      .boolean()
      .optional()
      .describe(
        "Add the Meter Pay card fee to the rider total instead of absorbing it. Requires Meter Pro or a Fleet plan.",
      ),
  }),
  update_my_availability: z.strictObject({
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe(
        'IANA timezone the shift times are in, e.g. "America/Chicago". Defaults to your current schedule timezone.',
      ),
    days: z
      .array(
        z.strictObject({
          day_of_week: z
            .number()
            .int()
            .min(1)
            .max(7)
            .describe("ISO weekday: 1 = Monday ... 7 = Sunday."),
          shifts: z
            .array(
              z.strictObject({
                start_time: scheduleTimeSchema.describe(
                  "Shift start, HH:MM 24-hour.",
                ),
                end_time: scheduleTimeSchema.describe(
                  "Shift end, HH:MM 24-hour, after start_time.",
                ),
              }),
            )
            .max(8)
            .describe(
              "Availability windows on that day. Empty means unavailable that day.",
            ),
        }),
      )
      .min(1)
      .max(7)
      .describe(
        "The full weekly schedule. Every listed day is replaced; days not listed become unavailable. Each day_of_week at most once.",
      ),
  }),
} as const;

export const accountTools = {
  update_my_profile: {
    name: "update_my_profile",
    title: "Update my profile",
    description:
      "Change the signed-in person's OWN profile: first and last name, business name printed on receipts, preferred navigation app, and (with Meter Pro or a Fleet plan) hiding contact details on receipts and passing card fees to riders. Any signed-in user may call it; it can never change another person's profile. Email or phone changes need verification: use get_action_link with change_email or change_phone. Never changes role, fleet membership, payouts, subscription or verification data. Send only the fields to change and preview with dry_run: true before confirming the saved proposal_id with identical arguments.",
    domain: "account",
    kind: "write",
    risk: "low",
    escalate: { sensitive: ["pass_credit_card_fees_to_customer"] },
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: accountSchemas.update_my_profile,
    outputSchema: myProfileWriteSchema,
    returns: "MyProfileWrite",
    example: {
      dry_run: true,
      first_name: "Ada",
      preferred_navigation_provider: "google_maps",
    },
    annotations: SETTINGS_WRITE,
  },
  update_my_availability: {
    name: "update_my_availability",
    title: "Update my weekly availability",
    description:
      "Replace the signed-in driver's OWN weekly availability (the hours riders may book them for, per ISO weekday 1 = Monday to 7 = Sunday, as HH:MM shifts in an IANA timezone). The whole week is replaced: days omitted or given an empty shifts list become unavailable, so include every day the driver works. Shifts must end after they start and may not overlap. Any signed-in user may call it; it never changes another driver's schedule and does not affect fleet booking hours (use update_booking_settings for fleet policy). Preview with dry_run: true to see which days change.",
    domain: "account",
    kind: "write",
    risk: "low",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: accountSchemas.update_my_availability,
    outputSchema: driverAvailabilityWriteSchema,
    returns: "DriverAvailabilityWrite",
    example: {
      dry_run: true,
      timezone: "America/Chicago",
      days: [
        {
          day_of_week: 1,
          shifts: [{ start_time: "08:00", end_time: "18:00" }],
        },
        {
          day_of_week: 6,
          shifts: [
            { start_time: "10:00", end_time: "14:00" },
            { start_time: "20:00", end_time: "23:30" },
          ],
        },
      ],
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
