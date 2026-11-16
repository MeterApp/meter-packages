/**
 * Building blocks shared by every public DTO.
 *
 * Every DTO is an ALLOWLIST: mappers on the server construct these objects
 * field by field and then run `schema.parse(...)`. Objects are strict, so an
 * accidental extra key (an internal id, a Stripe reference, a note meant for
 * another user) fails loudly instead of leaking.
 */
import * as z from 'zod';

/** Fleet membership roles as stored in `fleet_membership.role`. */
export const FLEET_ROLES = ['owner', 'admin', 'driver'] as const;
export type FleetRole = (typeof FLEET_ROLES)[number];

/** Who can see a field. `self` = the caller's own record; `rider` = a rider viewing their own booking. */
export const FIELD_VIEWER_ROLES = [
  'owner',
  'admin',
  'driver',
  'rider',
  'self'
] as const;
export type FieldViewerRole = (typeof FIELD_VIEWER_ROLES)[number];

export interface FieldMeta {
  description: string;
  /** Omitted means: every caller who can see the parent object sees this field. */
  roles?: readonly FieldViewerRole[];
  /** Unit hint, e.g. "minor currency units", "seconds", "meters", "ISO 8601". */
  unit?: string;
}

/** Attach agent-facing documentation to a schema. Read back by `@meterapp/meter-sdk/docs`. */
export function field<T extends z.ZodType>(
  schema: T,
  description: string,
  meta: Omit<FieldMeta, 'description'> = {}
): T {
  return schema.meta({ description, ...meta }) as T;
}

export const fleetRoleSchema = field(
  z.enum(FLEET_ROLES),
  'Role in the fleet. owner: created the fleet and controls billing; admin: manages members, vehicles, bookings and money; driver: drives and sees only their own trips, bookings and earnings.'
);

export const opaqueIdSchema = z.string().min(1).max(128);

export const isoTimestampSchema = field(
  z.string(),
  'ISO 8601 timestamp with offset (UTC unless noted).',
  { unit: 'ISO 8601' }
);

export const isoTimestampNullableSchema = field(
  z.string().nullable(),
  'ISO 8601 timestamp with offset, or null when not (yet) known.',
  { unit: 'ISO 8601' }
);

export const currencyCodeSchema = field(
  z.string().min(3).max(3),
  'ISO 4217 currency code, lower- or upper-case as stored (e.g. "usd", "EUR").'
);

export const minorAmountSchema = field(
  z.number().int(),
  "Amount in the currency's minor unit (cents for USD/EUR, yen for JPY). Divide by 100 for most currencies.",
  { unit: 'minor currency units' }
);

export const personRefSchema = z
  .strictObject({
    id: field(
      opaqueIdSchema,
      'Opaque member id (a profile id). Use it as `driver` in list_trips or to match list_fleet_members.'
    ),
    display_name: field(
      z.string().nullable(),
      'Display name (first and last name). Null when the person has not set a name.'
    )
  })
  .meta({
    description: 'A reference to a fleet member without contact details.'
  });
export type PersonRef = z.infer<typeof personRefSchema>;

export const placeSchema = z
  .strictObject({
    name: field(
      z.string().nullable(),
      'Short place name (e.g. business or airport name), or null.'
    ),
    address: field(z.string().nullable(), 'Formatted street address, or null.')
  })
  .meta({
    description:
      'A pickup or drop-off place. Coordinates and raw GPS are never exposed here.'
  });
export type Place = z.infer<typeof placeSchema>;

/** Wrap a list DTO in the standard pagination envelope. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: field(
      z.array(item),
      'The page of results, newest first unless the tool says otherwise.'
    ),
    next_cursor: field(
      z.string().nullable(),
      'Send this back as `cursor` to fetch the next page. Null when there are no more results.'
    ),
    has_more: field(z.boolean(), 'True when another page exists.')
  });
}
