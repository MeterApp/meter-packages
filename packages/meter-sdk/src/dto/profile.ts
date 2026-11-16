import * as z from 'zod';
import {
  field,
  fleetRoleSchema,
  isoTimestampNullableSchema,
  opaqueIdSchema
} from './common.ts';

export const callerProfileSchema = z
  .strictObject({
    id: field(
      opaqueIdSchema,
      'Your profile id. Other tools refer to you by this id.'
    ),
    display_name: field(
      z.string().nullable(),
      'Your display name, or null if not set.'
    ),
    email: field(
      z.string().nullable(),
      'Your own email address (never shown for other users).',
      {
        roles: ['self']
      }
    ),
    phone: field(
      z.string().nullable(),
      'Your own phone number in E.164 (never shown for other users).',
      {
        roles: ['self']
      }
    ),
    created_at: field(
      isoTimestampNullableSchema,
      'When your Meter profile was created.'
    )
  })
  .meta({ description: 'The authenticated caller.' });
export type CallerProfile = z.infer<typeof callerProfileSchema>;

export const callerFleetSchema = z
  .strictObject({
    fleet_id: field(
      opaqueIdSchema,
      'Opaque fleet id. Send as `fleet_id` to fleet-scoped tools.'
    ),
    name: field(z.string().nullable(), 'Fleet display name.'),
    role: fleetRoleSchema,
    is_operational: field(
      z.boolean(),
      'True when the fleet has finished onboarding and billing is active. Admin-only tools (members, accounting, fleet-wide trips) require an operational fleet.'
    )
  })
  .meta({
    description: 'One fleet the caller belongs to, with their role in it.'
  });
export type CallerFleet = z.infer<typeof callerFleetSchema>;

export const whoamiSchema = z
  .strictObject({
    profile: callerProfileSchema,
    fleets: field(
      z.array(callerFleetSchema),
      'Every fleet you belong to. Empty for riders and solo drivers.'
    ),
    is_rider: field(
      z.boolean(),
      'True when you have a rider account (you have booked rides). Rider-scoped tools return your own bookings.'
    ),
    is_fleet_admin: field(
      z.boolean(),
      'True when you are owner or admin of at least one fleet.'
    ),
    default_fleet_id: field(
      z.string().nullable(),
      'When you belong to exactly one fleet, its id; fleet-scoped tools use it when `fleet_id` is omitted. Null otherwise.'
    ),
    capabilities: field(
      z.array(z.string()),
      'Human-readable summary of what you can read through this server, derived from your roles.'
    ),
    connection: field(
      z
        .strictObject({
          app_name: field(
            z.string().nullable(),
            'Stored OAuth app name, never a client-supplied identity.'
          ),
          access: field(
            z.enum(['read', 'read_write']),
            'Current server-stored connection permission.'
          ),
          manage_url: field(
            z.literal('/app/account/connected-apps'),
            'Meter page for managing this connection.'
          )
        })
        .nullable()
        .optional(),
      'Verified OAuth app grant, or null for a first-party session. Manage or revoke the grant in Connected apps.'
    ),
    suggested_next_tools: field(
      z.array(z.string()),
      'Tool names that make sense to call next given your roles.'
    )
  })
  .meta({
    description: 'Result of `whoami`: who is calling and what they may read.'
  });
export type Whoami = z.infer<typeof whoamiSchema>;
