import * as z from "zod";
import { rideOptionWriteSchema } from "../../dto/index.ts";
import {
  fleetIdSchema,
  dryRunSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";

const rateSchema = z
  .number()
  .min(0)
  .max(10000)
  .describe("Major currency units (e.g. 2.75 = $2.75). 0 to 10000.");

export const faresSchemas = {
  update_ride_option: z.strictObject({
    ride_option_id: z
      .string()
      .uuid()
      .describe("Ride option id from get_fleet ride_options[].id."),
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe('Ride option name shown to riders, e.g. "Sedan".'),
    capacity: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("Passenger capacity, 1 to 60."),
    fare: z
      .strictObject({
        display_name: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional()
          .describe("Fare name shown to drivers and riders."),
        base: rateSchema.optional().describe("Flag-drop / base fare."),
        minimum_fare: rateSchema.optional().describe("Minimum total fare."),
        distance_rate: rateSchema
          .optional()
          .describe(
            "Rate per mile, or per kilometer when the fare is metric (see metric).",
          ),
        minute_rate: rateSchema
          .optional()
          .describe("Rate per minute of travel time."),
        wait_time_minute_rate: rateSchema
          .optional()
          .describe("Rate per minute of waiting."),
        tax_rate: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Tax as a fraction of the fare, 0 to 1 (0.08 = 8%)."),
        metric: z
          .boolean()
          .optional()
          .describe("True to price per kilometer, false per mile."),
      })
      .optional()
      .describe(
        "Fare (rate card) fields to change on the ride option's default fare. Only send the fields you intend to change.",
      ),
  }),
} as const;

export const faresTools = {
  update_ride_option: {
    name: "update_ride_option",
    title: "Update a ride option and its fare",
    description:
      "Edit an existing bookable ride option (vehicle class) of a fleet: its name and passenger capacity, and the rates of its default fare (base, minimum, per-mile/km distance rate, per-minute rate, waiting rate, tax rate, metric vs imperial, display name). Rates are in major currency units as shown in the console (2.75 = $2.75) and must be 0 to 10000. Owners and admins only, also while the fleet is still completing setup (a fleet whose billing has lapsed returns fleet_not_operational). Edits are audited like the console's and apply to every ride option sharing that fare; official tariffs are read-only. Create or delete options with create_ride_option / delete_ride_option. Preview with dry_run: true first.",
    domain: "fares",
    kind: "write",
    risk: "standard",
    escalate: { sensitive: ["fare.*"] },
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: faresSchemas.update_ride_option,
    outputSchema: rideOptionWriteSchema,
    returns: "RideOptionWrite",
    example: {
      ride_option_id: "44444444-4444-4444-8444-444444444444",
      fleet_id: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
      fare: { base: 3.5, distance_rate: 2.75, minute_rate: 0.5 },
    },
    annotations: SETTINGS_WRITE,
  },
} as const;
