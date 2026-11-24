import * as z from "zod";
import { writeResultSchema } from "./settings.ts";
import {
  rideOptionRequirementsSchema,
  rideOptionServiceClassSchema,
} from "./ride-option-classes.ts";

export const rideOptionStateSchema = z
  .strictObject({
    id: z.string().uuid().describe("Meter record identifier."),
    fleet_id: z.string().uuid().describe("Fleet that owns this record."),
    name: z.string().describe("Ride option name shown to riders."),
    capacity: z.number().int().positive().describe("Passenger capacity."),
    type: z
      .enum(["POINT_TO_POINT", "TIME", "METERED"])
      .describe("Point-to-point, hourly or metered booking type."),
    default_fare_id: z
      .string()
      .uuid()
      .describe("Existing default fare; read get_fare for complete pricing."),
    service_class: rideOptionServiceClassSchema.describe(
      "Ride option type: fixes the icon, rider copy and what a vehicle must have. custom requires only what requirements lists.",
    ),
    luggage_capacity: z
      .number()
      .int()
      .nullable()
      .describe("Bags the option is sold with, or null when not set."),
    requirements: rideOptionRequirementsSchema.describe(
      "Vehicle requirements the fleet added to the type's own.",
    ),
    is_active: z.boolean().describe("False when the fleet switched it off."),
  })
  .meta({
    description:
      "Saved ride option identity, type, booking mode, capacity and default fare reference.",
  });
export type RideOptionState = z.infer<typeof rideOptionStateSchema>;
export const rideOptionStateWriteSchema = writeResultSchema(
  "ride_option",
  rideOptionStateSchema
    .nullable()
    .describe("Saved ride option, or null after deletion."),
  "Saved ride option, or null after deletion. Pricing detail is read separately.",
);
export const zoneFareReferenceSchema = z
  .strictObject({
    id: z.string().uuid().describe("Meter record identifier."),
    fleet_id: z.string().uuid().describe("Fleet that owns this record."),
    start_zone_id: z.number().int().describe("Pickup zone identifier."),
    end_zone_id: z
      .number()
      .int()
      .nullable()
      .describe("Destination zone identifier; null matches any destination."),
    ride_option_id: z
      .string()
      .uuid()
      .nullable()
      .describe("Ride option identifier; null is the default mapping."),
    fare_id: z
      .string()
      .uuid()
      .describe(
        "Selected existing fare; read get_fare for pricing and currency.",
      ),
  })
  .meta({
    description:
      "One exact pickup/destination/ride-option mapping to an existing fare.",
  });
export type ZoneFareReference = z.infer<typeof zoneFareReferenceSchema>;
export const zoneFarePageSchema = z
  .strictObject({
    items: z
      .array(zoneFareReferenceSchema)
      .describe("Complete zone mappings on this page."),
    next_cursor: z
      .string()
      .uuid()
      .nullable()
      .describe("Send as cursor for the next page, or null when complete."),
  })
  .meta({
    description:
      "Bounded page of exact zone fare mappings and its continuation cursor.",
  });
export const zoneFareWriteSchema = writeResultSchema(
  "zone_fare",
  zoneFareReferenceSchema
    .nullable()
    .describe("Saved mapping, or null after removal."),
  "Saved zone fare mapping, or null after removing the mapping.",
);
