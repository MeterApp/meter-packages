import * as z from "zod";
import {
  rideOptionStateWriteSchema,
  zoneFarePageSchema,
  zoneFareWriteSchema,
} from "../../dto/fleet-pricing.ts";
import {
  fleetIdSchema,
  dryRunSchema,
  proposalIdSchema,
  limitSchema,
  SETTINGS_WRITE,
  READ_ONLY,
} from "./shared.ts";

const writeFields = {
  fleet_id: fleetIdSchema,
  dry_run: dryRunSchema,
  proposal_id: proposalIdSchema,
};
const id = z.string().uuid();
export const fleetPricingSchemas = {
  create_ride_option: z.strictObject({
    ...writeFields,
    name: z.string().trim().min(1).max(80).describe("Name shown to riders."),
    capacity: z
      .number()
      .int()
      .min(1)
      .max(60)
      .describe("Passenger capacity, from 1 to 60."),
    type: z
      .enum(["POINT_TO_POINT", "TIME", "METERED"])
      .describe("Point-to-point, hourly or metered booking type."),
    fare_id: id.describe(
      "Default fare from list_fares/get_fare. Existing pricing is preserved.",
    ),
  }),
  delete_ride_option: z.strictObject({
    ...writeFields,
    ride_option_id: id.describe(
      "Existing ride option identifier from get_fleet.",
    ),
  }),
  list_zone_fares: z.strictObject({
    fleet_id: fleetIdSchema,
    limit: limitSchema
      .optional()
      .describe("Maximum mappings on this page, from 1 to 100."),
    cursor: id
      .optional()
      .describe("Next cursor returned by the previous mapping page."),
  }),
  set_zone_fare: z.strictObject({
    ...writeFields,
    start_zone_id: z
      .number()
      .int()
      .describe("Pickup zone identifier from get_fleet."),
    end_zone_id: z
      .number()
      .int()
      .nullable()
      .describe("Destination zone identifier; null means any destination."),
    ride_option_id: id
      .nullable()
      .describe(
        "Existing ride option identifier, or null for the default mapping, which prices every ride option that has no mapping of its own for this pickup and destination. Use null to price all ride options alike; set a ride option only to override it.",
      ),
    fare_id: id
      .nullable()
      .describe(
        "Existing fare, or null to remove this exact mapping. Null destination means any destination; null ride option means the default mapping.",
      ),
  }),
} as const;
const access = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;
export const fleetPricingTools = {
  create_ride_option: {
    name: "create_ride_option",
    title: "Create a ride option",
    description:
      "Create one fleet ride option with an existing default fare. Owners/admins, including setup fleets. Preview with dry_run: true first; show fleet, name, capacity, booking type and complete selected fare pricing, then confirm the saved proposal with identical arguments. Does not edit or copy the fare. Advanced pricing that cannot be shown completely requires the Meter pricing editor.",
    domain: "fares",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: fleetPricingSchemas.create_ride_option,
    outputSchema: rideOptionStateWriteSchema,
    returns: "RideOptionStateWrite",
    example: {
      name: "Sedan",
      capacity: 4,
      type: "POINT_TO_POINT",
      fare_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  delete_ride_option: {
    name: "delete_ride_option",
    title: "Delete a ride option",
    description:
      "Permanently remove a fleet ride option. Preview with dry_run: true: the exact option, fleet, associated zone mappings and dynamic policies removed, and detached quote previews. Show these consequences and obtain explicit confirmation of the saved proposal with identical arguments. Existing trips are not repriced.",
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: fleetPricingSchemas.delete_ride_option,
    outputSchema: rideOptionStateWriteSchema,
    returns: "RideOptionStateWrite",
    example: {
      ride_option_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  list_zone_fares: {
    name: "list_zone_fares",
    title: "List zone fare mappings",
    description:
      "Read one page of fleet zone fare references. Null destination matches any destination; null ride option is the default mapping. Read fares separately for complete amounts, currency and units. Owners/admins only.",
    domain: "fares",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fleetPricingSchemas.list_zone_fares,
    outputSchema: zoneFarePageSchema,
    returns: "ZoneFarePage",
    example: {},
    annotations: READ_ONLY,
  },
  set_zone_fare: {
    name: "set_zone_fare",
    title: "Set a zone fare mapping",
    description:
      "Set or remove one exact fleet pickup/destination/ride-option fare mapping. One default mapping (ride_option_id null) covers every ride option without its own mapping, so do not create one mapping per ride option for the same price; each direction is a separate mapping. Preview with dry_run: true first and show the old/new selected fares with complete pricing, currency and units; confirm the saved proposal with identical arguments. Null fare removes the mapping. Concurrent mapping, fare or scope changes require a fresh preview.",
    domain: "fares",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: fleetPricingSchemas.set_zone_fare,
    outputSchema: zoneFareWriteSchema,
    returns: "ZoneFareWrite",
    example: {
      start_zone_id: 1,
      end_zone_id: null,
      ride_option_id: null,
      fare_id: "44444444-4444-4444-8444-444444444444",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
