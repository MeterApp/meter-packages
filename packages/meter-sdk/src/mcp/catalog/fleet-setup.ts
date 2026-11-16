import * as z from "zod";
import {
  fleetIconCandidatesSchema,
  fleetMemberSettingsWriteSchema,
  fleetMemberWriteSchema,
  vehicleWriteSchema,
} from "../../dto/fleet-setup.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color such as #1E90FF.");

const countSchema = z.number().int().min(0).max(99);

/** Tools a new fleet needs while it is being set up (and any time after). */
export const fleetSetupSchemas = {
  generate_fleet_icons: z.strictObject({
    fleet_id: fleetIdSchema,
    descriptors: z
      .array(z.string().trim().min(1).max(40))
      .max(6)
      .optional()
      .describe(
        'Services or vehicle types that inspire the icon, e.g. ["airport shuttle", "SUV"].',
      ),
    primary_color: hexColorSchema
      .optional()
      .describe("Background color as #RRGGBB; defaults to the brand color."),
  }),
  create_vehicle: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    year: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Use a 4-digit model year.")
      .describe('Model year, e.g. "2022".'),
    make: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .describe('Manufacturer, e.g. "Toyota".'),
    model: z.string().trim().min(1).max(64).describe('Model, e.g. "Sienna".'),
    license_plate: z.string().trim().min(1).max(64).optional(),
    nickname: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe('Short name drivers know the vehicle by, e.g. "Van 2".'),
    color: z.string().trim().min(1).max(32).optional(),
    passenger_capacity: countSchema
      .optional()
      .describe("Seats available to riders."),
    luggage_capacity: countSchema.optional().describe("Large bags it fits."),
    wheelchair_accessible: z.boolean().optional(),
    pet_friendly: z.boolean().optional(),
  }),
  add_fleet_driver: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    first_name: z.string().trim().min(1).max(64),
    last_name: z.string().trim().max(64).default(""),
    email: z.string().trim().email().max(254),
    phone: z
      .string()
      .trim()
      .regex(
        /^\+[0-9()\-.\s]{6,30}$/,
        "Use international format, e.g. +14155552671.",
      )
      .describe("Mobile number in international format with country code."),
  }),
  update_fleet_member: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: z.string().uuid().describe("member_id from list_fleet_members."),
    role: z
      .enum(["admin", "driver"])
      .optional()
      .describe(
        "admin manages members, vehicles, bookings and money; driver sees only their own work. The owner's role cannot change.",
      ),
    driver_payout_fraction: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .optional()
      .describe(
        "This driver's share of each fare as a fraction (0.7 = 70%); null returns them to the fleet default.",
      ),
  }),
} as const;

const setupAccess = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;

export const fleetSetupTools = {
  generate_fleet_icons: {
    name: "generate_fleet_icons",
    title: "Generate fleet icon options",
    description:
      "Draw one clean AI fleet icon for the fleet from its name, brand color and the services or vehicle types it offers. Takes about half a minute; the image appears below your reply with its option number. Saves nothing: use update_fleet_settings with the chosen icon_id. Owners/admins only, a few times a day per fleet.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access: setupAccess,
    exposure: "on_demand",
    inputSchema: fleetSetupSchemas.generate_fleet_icons,
    outputSchema: fleetIconCandidatesSchema,
    returns: "FleetIconCandidates",
    example: { descriptors: ["airport shuttle"], primary_color: "#0B5FFF" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  create_vehicle: {
    name: "create_vehicle",
    title: "Add a fleet vehicle",
    description:
      "Add a vehicle to the fleet: model year, make and model (checked against the vehicle catalog), plus optional plate, nickname, color, passenger and luggage capacity, wheelchair access and pet friendliness. Owners and admins only, also while the fleet is still completing setup. Assign it to a driver afterwards with assign_vehicle. Preview with dry_run: true, show the vehicle, then confirm with the saved proposal_id and identical arguments.",
    domain: "vehicles",
    kind: "write",
    risk: "standard",
    access: setupAccess,
    exposure: "on_demand",
    inputSchema: fleetSetupSchemas.create_vehicle,
    outputSchema: vehicleWriteSchema,
    returns: "VehicleWrite",
    example: {
      year: "2022",
      make: "Toyota",
      model: "Sienna",
      nickname: "Van 1",
      passenger_capacity: 6,
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  add_fleet_driver: {
    name: "add_fleet_driver",
    title: "Add a driver",
    description:
      "Create a driver account (name, email and international mobile number) and add it to the fleet, as the console's Add driver dialog does. No message is sent; the driver signs in to the Meter app with that email or phone. Someone who already has a Meter account joins with the invite link from get_join_link instead. Owners and admins only, also while the fleet is still completing setup. Preview with dry_run: true, show the driver, then confirm with the saved proposal_id and identical arguments.",
    domain: "members",
    kind: "write",
    risk: "standard",
    access: setupAccess,
    exposure: "on_demand",
    inputSchema: fleetSetupSchemas.add_fleet_driver,
    outputSchema: fleetMemberWriteSchema,
    returns: "FleetMemberWrite",
    example: {
      first_name: "Alex",
      last_name: "Rivera",
      email: "alex@example.com",
      phone: "+14155552671",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  update_fleet_member: {
    name: "update_fleet_member",
    title: "Change a member's role or payout",
    description:
      "Change one fleet member's role (admin or driver) or their personal payout share (driver_payout_fraction; null uses the fleet default). The owner's role cannot change and nobody can be made owner. Owners and admins of an operational fleet only. Does not add, rename or remove members: use add_fleet_driver or the invite link from get_join_link, update_member_name, and remove_fleet_member. Preview with dry_run: true, show the change, then confirm with the saved proposal_id.",
    domain: "members",
    kind: "write",
    risk: "sensitive",
    access: {
      personas: ["fleet_admin", "fleet_owner"],
      requiresOperationalFleet: true,
    },
    exposure: "on_demand",
    inputSchema: fleetSetupSchemas.update_fleet_member,
    outputSchema: fleetMemberSettingsWriteSchema,
    returns: "FleetMemberSettingsWrite",
    example: {
      member_id: "22222222-2222-4222-8222-222222222222",
      role: "admin",
      dry_run: true,
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
} as const;
