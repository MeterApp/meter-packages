import * as z from 'zod';
import {
  field,
  isoTimestampSchema,
  opaqueIdSchema,
  personRefSchema
} from './common.ts';

export const vehicleSchema = z
  .strictObject({
    vehicle_id: field(opaqueIdSchema, 'Opaque fleet vehicle id.'),
    fleet_id: field(opaqueIdSchema, 'Fleet the vehicle belongs to.'),
    make: field(z.string().nullable(), 'Manufacturer, e.g. "Toyota".'),
    model: field(z.string().nullable(), 'Model, e.g. "Camry".'),
    year: field(z.string().nullable(), 'Model year as a string, e.g. "2021".'),
    license_plate: field(z.string().nullable(), 'License plate as entered.'),
    nickname: field(
      z.string().nullable(),
      'Optional nickname the fleet gave the vehicle.'
    ),
    color: field(z.string().nullable(), 'Exterior color as entered.'),
    created_at: field(isoTimestampSchema, 'When the vehicle was added.'),
    assigned_driver: field(
      personRefSchema.nullable(),
      'Driver currently assigned to this vehicle, or null. Only resolved for fleet owners/admins; always null for drivers.',
      { roles: ['owner', 'admin'] }
    )
  })
  .meta({ description: 'A fleet vehicle as listed by list_vehicles.' });
export type Vehicle = z.infer<typeof vehicleSchema>;
