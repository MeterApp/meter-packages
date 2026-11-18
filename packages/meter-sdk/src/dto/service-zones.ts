import * as z from "zod";
import { writeResultSchema } from "./settings.ts";

export const zoneBoundarySchema = z
  .strictObject({
    boundary_id: z
      .string()
      .uuid()
      .nullable()
      .describe(
        "Send to save_service_zone to save this boundary; null when rejected.",
      ),
    status: z
      .enum(["accepted", "rejected"])
      .describe(
        "accepted: the boundary was mapped and validated. rejected: it could not be mapped safely; reason says why.",
      ),
    name: z.string().describe("Short name of the area that was mapped."),
    area_km2: z
      .number()
      .nonnegative()
      .describe("Land area of the boundary in square kilometres."),
    reason: z.string().describe("Why the boundary was accepted or rejected."),
    parts: z
      .array(
        z.strictObject({
          name: z.string().describe("Place this part of the area comes from."),
          role: z
            .enum(["include", "exclude"])
            .describe("Whether the place is added to or cut out of the area."),
        }),
      )
      .describe("Official places the boundary was built from."),
    unresolved: z
      .array(z.string())
      .describe("Parts of the description that could not be mapped."),
  })
  .meta({
    description:
      "A service zone boundary found from a plain-language description, ready to save as a zone.",
  });
export type ZoneBoundary = z.infer<typeof zoneBoundarySchema>;

export const serviceZoneSchema = z
  .strictObject({
    zone_id: z.number().int().describe("Zone id, unique within Meter."),
    fleet_id: z.string().uuid().describe("Fleet that owns this zone."),
    name: z.string().describe('Zone name, e.g. "Manhattan" or "Airport".'),
    area_km2: z
      .number()
      .nonnegative()
      .describe("Land area of the zone in square kilometres."),
  })
  .meta({
    description: "A saved fleet service zone. Geometry is not exposed.",
  });
export type ServiceZone = z.infer<typeof serviceZoneSchema>;
export const serviceZoneWriteSchema = writeResultSchema(
  "zone",
  // A new zone's preview has no saved zone yet.
  serviceZoneSchema
    .nullable()
    .describe("The saved zone; null on a preview that adds a new zone."),
  "Result of save_service_zone: what changed and the saved zone.",
);
