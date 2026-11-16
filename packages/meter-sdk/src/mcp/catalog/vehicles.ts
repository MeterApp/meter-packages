import * as z from "zod";
import {
  vehicleAssignmentWriteSchema,
  vehicleSchema,
} from "../../dto/index.ts";
import {
  vehicleRemovalWriteSchema,
  vehicleUpdateWriteSchema,
} from "../../dto/fleet-members.ts";
import {
  fleetIdSchema,
  limitSchema,
  cursorSchema,
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const vehicleIdSchema = z
  .string()
  .uuid()
  .describe("Vehicle id from list_vehicles.");
const countSchema = z.number().int().min(0).max(99);
const clearableText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const memberIdSchema = z
  .string()
  .uuid()
  .describe("member_id from list_fleet_members.");

export const vehiclesSchemas = {
  list_vehicles: z.object({
    fleet_id: fleetIdSchema,
    limit: limitSchema.optional().describe("Page size, 1-100 (default 50)."),
    cursor: cursorSchema,
  }),
  assign_vehicle: z.strictObject({
    vehicle_id: z.string().uuid().describe("Vehicle id from list_vehicles."),
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: memberIdSchema
      .nullable()
      .describe(
        "The driver to assign (member_id from list_fleet_members), or null to unassign whoever currently drives the vehicle.",
      ),
  }),
  update_vehicle: z.strictObject({
    vehicle_id: vehicleIdSchema,
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    year: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Use a 4-digit model year.")
      .optional()
      .describe('Model year, e.g. "2022".'),
    make: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe('Manufacturer, e.g. "Toyota".'),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .describe('Model, e.g. "Sienna".'),
    license_plate: clearableText(64).describe("New plate, or null to clear."),
    nickname: clearableText(80).describe(
      'Short name drivers know the vehicle by, e.g. "Van 2"; null clears it.',
    ),
    color: clearableText(32).describe("Exterior color, or null to clear."),
    passenger_capacity: countSchema
      .optional()
      .describe("Seats available to riders."),
    luggage_capacity: countSchema.optional().describe("Large bags it fits."),
    wheelchair_accessible: z.boolean().optional(),
    pet_friendly: z.boolean().optional(),
  }),
  remove_vehicle: z.strictObject({
    vehicle_id: vehicleIdSchema,
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
} as const;

export const vehiclesTools = {
  list_vehicles: {
    name: "list_vehicles",
    title: "List fleet vehicles",
    description:
      "List the active vehicles of a fleet: make, model, year, license plate, nickname and color. Owners and admins also see assigned_driver (who currently drives each vehicle); for drivers that field is always null. Requires membership in the fleet. Vehicles that were removed from the fleet are not returned. Page with cursor and limit (max 100). Use get_fleet for the vehicle count only.",
    domain: "vehicles",
    kind: "read",
    risk: "none",
    access: {
      personas: ["fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: vehiclesSchemas.list_vehicles,
    outputSchema: z.object({
      items: z.array(vehicleSchema),
      next_cursor: z.string().nullable().optional(),
      has_more: z.boolean().optional(),
    }),
    returns: "Vehicle",
    example: { fleet_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  assign_vehicle: {
    name: "assign_vehicle",
    title: "Assign or unassign a fleet vehicle",
    description:
      "Assign a fleet vehicle (vehicle_id from list_vehicles) to a fleet member (member_id from list_fleet_members), replacing whoever drives it today and releasing any other vehicle that member was assigned; or send member_id: null to unassign the current driver. Owners and admins only, also while the fleet is still completing setup (a fleet whose billing has lapsed returns fleet_not_operational). The member must belong to the same fleet. Returns the vehicle with its assigned_driver after the change. Edit or remove vehicles with update_vehicle or remove_vehicle. Preview with dry_run: true, show all assignment changes, then confirm with the saved proposal_id.",
    domain: "vehicles",
    kind: "write",
    risk: "standard",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: vehiclesSchemas.assign_vehicle,
    outputSchema: vehicleAssignmentWriteSchema,
    returns: "VehicleAssignmentWrite",
    example: {
      vehicle_id: "55555555-5555-4555-8555-555555555555",
      fleet_id: "11111111-1111-4111-8111-111111111111",
      member_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  update_vehicle: {
    name: "update_vehicle",
    title: "Edit a fleet vehicle",
    description:
      "Change a fleet vehicle's details (vehicle_id from list_vehicles): model year, make and model (checked against the vehicle catalog), plate, nickname, color, passenger and luggage capacity, wheelchair access and pet friendliness. Send only the fields to change; null clears plate, nickname or color. Owners and admins only, also while the fleet is still completing setup. Does not change who drives it (use assign_vehicle). Preview with dry_run: true, show the changes, then confirm with the saved proposal_id and identical arguments.",
    domain: "vehicles",
    kind: "write",
    risk: "standard",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: vehiclesSchemas.update_vehicle,
    outputSchema: vehicleUpdateWriteSchema,
    returns: "VehicleUpdateWrite",
    example: {
      vehicle_id: "55555555-5555-4555-8555-555555555555",
      nickname: "Van 2",
      passenger_capacity: 7,
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  remove_vehicle: {
    name: "remove_vehicle",
    title: "Remove a fleet vehicle",
    description:
      "Remove a vehicle from the fleet (vehicle_id from list_vehicles), as the console's Delete vehicle does: it disappears from list_vehicles and the driver assigned to it is unassigned. Past trips keep their vehicle details. Owners and admins only, also while the fleet is still completing setup. Preview with dry_run: true, show the vehicle and its current driver, then confirm with the saved proposal_id. To re-add it later use create_vehicle.",
    domain: "vehicles",
    kind: "write",
    risk: "standard",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    exposure: "on_demand",
    inputSchema: vehiclesSchemas.remove_vehicle,
    outputSchema: vehicleRemovalWriteSchema,
    returns: "VehicleRemovalWrite",
    example: {
      vehicle_id: "55555555-5555-4555-8555-555555555555",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      idempotentHint: false,
    },
  },
} as const;
