import * as z from "zod";
import {
  serviceZoneWriteSchema,
  zoneBoundarySchema,
} from "../../dto/service-zones.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  SETTINGS_WRITE,
} from "./shared.ts";

export const serviceZoneSchemas = {
  delete_service_zone: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    zone_id: z
      .number()
      .int()
      .positive()
      .describe("Existing service zone ID from list_service_zones."),
  }),
  find_zone_boundary: z.strictObject({
    fleet_id: fleetIdSchema,
    description: z
      .string()
      .trim()
      .min(2)
      .max(500)
      .describe(
        'Plain description of the real area: a city, county, ZIP code, borough, neighborhood, airport or a combination, e.g. "Manhattan plus LaGuardia Airport" or "Miami-Dade County except Miami Beach".',
      ),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .describe("ISO 3166-1 alpha-2 country; defaults to the fleet's country."),
  }),
  save_service_zone: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    boundary_id: z
      .string()
      .uuid()
      .describe("Accepted boundary_id returned by find_zone_boundary."),
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe('Zone name shown in pricing, e.g. "Manhattan".'),
    zone_id: z
      .number()
      .int()
      .optional()
      .describe(
        "Existing zone from get_fleet to redraw; omit to add a new zone.",
      ),
  }),
} as const;

const access = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;

export const serviceZoneTools = {
  delete_service_zone: {
    name: "delete_service_zone",
    title: "Delete an unused service zone",
    description:
      "Remove a service zone from a fleet you administer. Zone pricing rules must be removed before deleting a zone that they reference. Preview with dry_run: true and confirm the saved proposal.",
    domain: "fleet",
    kind: "write",
    risk: "standard",
    access,
    exposure: "listed",
    inputSchema: serviceZoneSchemas.delete_service_zone,
    outputSchema: serviceZoneWriteSchema,
    returns: "ServiceZoneWrite",
    example: { zone_id: 12, dry_run: true },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  find_zone_boundary: {
    name: "find_zone_boundary",
    title: "Find a service zone boundary",
    description:
      "Map a plain-language area (city, county, state, ZIP code, borough, neighborhood, airport, or includes and exclusions of these) to its official land boundary. Takes up to two minutes. Returns a boundary_id for save_service_zone when accepted, or a reason when the description is ambiguous or not found. Saves nothing. Owners/admins only.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: serviceZoneSchemas.find_zone_boundary,
    outputSchema: zoneBoundarySchema,
    returns: "ZoneBoundary",
    example: { description: "Manhattan plus LaGuardia Airport", country: "US" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  save_service_zone: {
    name: "save_service_zone",
    title: "Save a service zone",
    description:
      "Add a fleet service zone, or redraw an existing one (zone_id), from an accepted find_zone_boundary result. Service zones limit where riders can book and select zone fares. Preview with dry_run: true and show the zone name and area, then confirm the saved proposal with identical arguments. Owners/admins only.",
    domain: "fleet",
    kind: "write",
    risk: "standard",
    access,
    exposure: "on_demand",
    inputSchema: serviceZoneSchemas.save_service_zone,
    outputSchema: serviceZoneWriteSchema,
    returns: "ServiceZoneWrite",
    example: {
      boundary_id: "44444444-4444-4444-8444-444444444444",
      name: "Manhattan",
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
} as const;
