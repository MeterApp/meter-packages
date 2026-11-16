import * as z from 'zod';
import {
  field,
  fleetRoleSchema,
  isoTimestampNullableSchema,
  opaqueIdSchema
} from './common.ts';

export const fleetMemberSchema = z
  .strictObject({
    member_id: field(
      opaqueIdSchema,
      'Opaque member id (profile id). Use as `driver` in list_trips.'
    ),
    display_name: field(
      z.string().nullable(),
      'Display name, or null if not set.'
    ),
    role: fleetRoleSchema,
    joined_at: field(
      isoTimestampNullableSchema,
      'When the member joined the fleet.'
    ),
    email: field(
      z.string().nullable(),
      'Member email. Visible to fleet owners/admins only.',
      {
        roles: ['owner', 'admin']
      }
    ),
    phone: field(
      z.string().nullable(),
      'Member phone (E.164). Visible to fleet owners/admins only.',
      {
        roles: ['owner', 'admin']
      }
    )
  })
  .meta({
    description:
      'A fleet member as listed by list_fleet_members (owners/admins only).'
  });
export type FleetMember = z.infer<typeof fleetMemberSchema>;
