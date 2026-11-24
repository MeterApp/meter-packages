import * as z from "zod";

/**
 * The eight ride option types. A type fixes the icon, what riders are told
 * and what a vehicle must have; the fleet sets the name, seats, bags and
 * price. `custom` requires only what the option's own requirements list.
 */
export const rideOptionServiceClassSchema = z.enum([
  "standard",
  "xl",
  "premium",
  "premium_suv",
  "van",
  "accessible",
  "pet_friendly",
  "custom",
]);
export type RideOptionServiceClass = z.infer<
  typeof rideOptionServiceClassSchema
>;

const minimum = (what: string) =>
  z.number().int().min(0).max(99).optional().describe(`Minimum ${what}.`);
const required = (what: string) =>
  z.boolean().optional().describe(`True when the vehicle must ${what}.`);

export const rideOptionRequirementsSchema = z
  .strictObject({
    passenger_capacity: minimum("passenger seats"),
    luggage_capacity: minimum("bags"),
    rear_facing_child_seat_count: minimum("rear-facing child seats"),
    forward_facing_child_seat_count: minimum("forward-facing child seats"),
    booster_seat_count: minimum("booster seats"),
    bike_capacity: minimum("bikes"),
    wheelchair_accessible: required("take a wheelchair"),
    pet_friendly: required("allow pets"),
    premium: required("be marked premium"),
  })
  .meta({
    description:
      "What a vehicle must have to serve a ride option, beyond what its type already requires.",
  });
export type RideOptionRequirementsDto = z.infer<
  typeof rideOptionRequirementsSchema
>;
