import * as z from "zod";
import {
  field,
  fleetRoleSchema,
  isoTimestampSchema,
  opaqueIdSchema,
  pageSchema,
  personRefSchema,
} from "./common.ts";
import { fleetMemberSchema } from "./member.ts";
import { writeResultSchema } from "./settings.ts";
import { vehicleSchema } from "./vehicle.ts";

export const fleetJoinLinkSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet the invite adds drivers to."),
    code: field(
      z.string(),
      "Six-character join code a driver types in the Meter app (Fleet → Join).",
    ),
    url: field(
      z.string().url(),
      "Invite link to share; opening it signs the driver in (or up) and joins the fleet.",
    ),
  })
  .meta({
    description:
      "The fleet's driver invite: the join code and the link built from it. Owners/admins only.",
  });
export type FleetJoinLink = z.infer<typeof fleetJoinLinkSchema>;

export const fleetJoinLinkWriteSchema = writeResultSchema(
  "invite",
  fleetJoinLinkSchema,
  "Result of rotate_join_code: the new join code and invite link. The previous code and link no longer work.",
);

export const MEMBERSHIP_EVENT_TYPES = [
  "joined",
  "left",
  "role_changed",
  "payout_fraction_changed",
] as const;

export const membershipEventSchema = z
  .strictObject({
    event_id: field(z.string(), "Opaque event id."),
    event_type: field(
      z.enum(MEMBERSHIP_EVENT_TYPES),
      "joined, left (removed or left on their own; see reason), role_changed or payout_fraction_changed.",
    ),
    occurred_at: field(isoTimestampSchema, "When it happened."),
    member: field(
      personRefSchema,
      "The member the event is about (may no longer be in the fleet).",
    ),
    actor: field(
      personRefSchema.nullable(),
      "Who made the change, or null when it was automatic or unknown.",
    ),
    previous_role: field(
      fleetRoleSchema.nullable(),
      "Role before the event, or null.",
    ),
    new_role: field(
      fleetRoleSchema.nullable(),
      "Role after the event, or null.",
    ),
    reason: field(
      z.enum(["voluntary_leave", "removed_by_admin"]).nullable(),
      "For left events: whether the member left or an owner/admin removed them.",
    ),
    previous_payout_fraction: field(
      z.number().nullable(),
      "For payout_fraction_changed: the share before (0.7 = 70%), or null for the fleet default.",
      { unit: "fraction" },
    ),
    new_payout_fraction: field(
      z.number().nullable(),
      "For payout_fraction_changed: the share after (0.7 = 70%), or null for the fleet default.",
      { unit: "fraction" },
    ),
  })
  .meta({
    description:
      "One entry of a fleet's membership history (joins, departures, role and payout changes).",
  });
export type MembershipEvent = z.infer<typeof membershipEventSchema>;

export const membershipEventPageSchema = pageSchema(membershipEventSchema).meta(
  { description: "A page of membership history, newest first." },
);
export type MembershipEventPage = z.infer<typeof membershipEventPageSchema>;

export const MEMBER_DOCUMENT_TYPES = [
  "license",
  "insurance",
  "registration",
  "vehicle_photo",
] as const;

export const memberDocumentSchema = z
  .strictObject({
    type: field(
      z.enum(MEMBER_DOCUMENT_TYPES),
      "license (driver's license), insurance, registration or vehicle_photo.",
    ),
    uploaded: field(
      z.boolean(),
      "True when at least one photo of the document was uploaded.",
    ),
    photo_count: field(
      z.number().int().min(0),
      "How many photos were uploaded. The photos themselves are only viewable in the console.",
    ),
    verified: field(
      z.boolean(),
      "True when an owner or admin approved the document.",
    ),
    expires_on: field(
      z.string().nullable(),
      "Expiry date (YYYY-MM-DD) as entered, or null (vehicle photos have none).",
    ),
    expired: field(z.boolean(), "True when expires_on is before today (UTC)."),
  })
  .meta({ description: "Review status of one driver document." });

export const memberDocumentsSchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, "Opaque member id (profile id)."),
    display_name: field(
      z.string().nullable(),
      "Display name, or null if not set.",
    ),
    role: fleetRoleSchema,
    submitted: field(
      z.boolean(),
      "False when the member has never submitted any documents.",
    ),
    documents: field(
      z.array(memberDocumentSchema),
      "One entry per document type, in license, insurance, registration, vehicle_photo order.",
    ),
  })
  .meta({
    description:
      "A fleet member's document review status. Never includes document images, tax ids or license numbers.",
  });
export type MemberDocuments = z.infer<typeof memberDocumentsSchema>;

export const memberDocumentsPageSchema = pageSchema(memberDocumentsSchema).meta(
  { description: "Document review status for a page of fleet members." },
);

export const memberDocumentsWriteSchema = writeResultSchema(
  "member",
  memberDocumentsSchema,
  "Result of review_member_document: what changed and the member's documents after the call.",
);

export const fleetMemberRemovalSchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, "Opaque member id (profile id)."),
    display_name: field(
      z.string().nullable(),
      "Display name, or null if not set.",
    ),
    previous_role: fleetRoleSchema,
    removed: field(z.boolean(), "True once the member is out of the fleet."),
  })
  .meta({
    description:
      "A member removed by remove_fleet_member. Their past trips and the membership history are kept.",
  });
export type FleetMemberRemoval = z.infer<typeof fleetMemberRemovalSchema>;

export const fleetMemberRemovalWriteSchema = writeResultSchema(
  "member",
  fleetMemberRemovalSchema,
  "Result of remove_fleet_member: what changed and the removed member.",
);

export const fleetMemberNameWriteSchema = writeResultSchema(
  "member",
  fleetMemberSchema,
  "Result of update_member_name: what changed and the member after the call.",
);

export const memberOnlineRequestSchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, "Opaque member id (profile id)."),
    display_name: field(
      z.string().nullable(),
      "Display name, or null if not set.",
    ),
    requested_state: field(
      z.enum(["online", "offline"]),
      "What the driver's Meter app was asked to do.",
    ),
    devices_notified: field(
      z.number().int().min(0).nullable(),
      "For online: how many of the driver's devices were asked (0 means none can receive it). Null for offline.",
    ),
  })
  .meta({
    description:
      "A request sent to a driver's Meter app to go online or offline. The app acts on it when it is reachable.",
  });
export type MemberOnlineRequest = z.infer<typeof memberOnlineRequestSchema>;

export const memberOnlineRequestWriteSchema = writeResultSchema(
  "request",
  memberOnlineRequestSchema,
  "Result of set_member_online_state: what was requested and from how many devices.",
);

export const vehicleUpdateWriteSchema = writeResultSchema(
  "vehicle",
  vehicleSchema,
  "Result of update_vehicle: what changed and the vehicle after the call.",
);

export const vehicleRemovalWriteSchema = writeResultSchema(
  "vehicle",
  vehicleSchema,
  "Result of remove_vehicle: what changed and the vehicle as it was removed (its driver unassigned).",
);
