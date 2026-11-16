import * as z from "zod";
import { fleetMemberSchema } from "../../dto/index.ts";
import {
  fleetJoinLinkSchema,
  fleetJoinLinkWriteSchema,
  fleetMemberNameWriteSchema,
  fleetMemberRemovalWriteSchema,
  MEMBER_DOCUMENT_TYPES,
  memberDocumentsPageSchema,
  memberDocumentsWriteSchema,
  memberOnlineRequestWriteSchema,
  MEMBERSHIP_EVENT_TYPES,
  membershipEventPageSchema,
} from "../../dto/fleet-members.ts";
import {
  fleetIdSchema,
  limitSchema,
  cursorSchema,
  dryRunSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const memberIdSchema = z
  .string()
  .uuid()
  .describe("member_id from list_fleet_members.");

const adminAccess = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: true,
} as const;

const setupAdminAccess = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: false,
} as const;

const exampleFleet = "11111111-1111-4111-8111-111111111111";
const exampleMember = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export const membersSchemas = {
  list_fleet_members: z.object({
    fleet_id: fleetIdSchema,
    limit: limitSchema.optional().describe("Page size, 1-100 (default 50)."),
    cursor: cursorSchema,
    role: z
      .enum(["owner", "admin", "driver"])
      .optional()
      .describe("Only members with this role."),
  }),
  get_join_link: z.strictObject({ fleet_id: fleetIdSchema }),
  rotate_join_code: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
  }),
  remove_fleet_member: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: memberIdSchema,
  }),
  update_member_name: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: memberIdSchema,
    first_name: z.string().trim().min(1).max(64),
    last_name: z.string().trim().min(1).max(64),
  }),
  get_membership_events: z.strictObject({
    fleet_id: fleetIdSchema,
    member_id: memberIdSchema
      .optional()
      .describe("Only events about this member (current or former)."),
    event_type: z
      .enum(MEMBERSHIP_EVENT_TYPES)
      .optional()
      .describe("Only this kind of event."),
    limit: limitSchema.optional().describe("Page size, 1-100 (default 50)."),
    cursor: cursorSchema,
  }),
  set_member_online_state: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: memberIdSchema,
    online: z
      .boolean()
      .describe(
        "true asks the driver's Meter app to go online; false takes them offline.",
      ),
  }),
  list_member_documents: z.strictObject({
    fleet_id: fleetIdSchema,
    member_id: memberIdSchema
      .optional()
      .describe("Only this member. Omit to page through every member."),
    limit: limitSchema.optional().describe("Page size, 1-100 (default 50)."),
    cursor: cursorSchema,
  }),
  review_member_document: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    member_id: memberIdSchema,
    document_type: z
      .enum(MEMBER_DOCUMENT_TYPES)
      .describe("Which document to approve or un-approve."),
    verified: z
      .boolean()
      .describe(
        "true approves (verifies) the document; false marks it not verified.",
      ),
  }),
} as const;

export const membersTools = {
  list_fleet_members: {
    name: "list_fleet_members",
    title: "List fleet members",
    description:
      "List every member of a fleet with member_id, display name, role (owner, admin, driver), join date, email and phone. Owners and admins of an operational fleet only; drivers receive a permission error. Use member_id as the `driver` argument of list_trips or to match drivers in bookings and accounting. Optional role filter. Page with cursor and limit (max 100). Do not use it to find riders; riders are not fleet members.",
    domain: "members",
    kind: "read",
    risk: "none",
    access: adminAccess,
    exposure: "listed",
    inputSchema: membersSchemas.list_fleet_members,
    outputSchema: z.object({
      items: z.array(fleetMemberSchema),
      next_cursor: z.string().nullable().optional(),
      has_more: z.boolean().optional(),
    }),
    returns: "FleetMember",
    example: {
      fleet_id: exampleFleet,
      role: "driver",
    },
    annotations: READ_ONLY,
  },
  get_join_link: {
    name: "get_join_link",
    title: "Invite drivers: join link and code",
    description:
      "Return the fleet's driver invite: the six-character join code and the invite link to share by text or email. A driver who opens the link (or enters the code in the Meter app) signs in or creates an account and joins the fleet as a driver; this is how people who already have a Meter account join. Owners and admins only, also while the fleet is still completing setup. Use rotate_join_code if the link was shared too widely; use add_fleet_driver to create an account for someone instead.",
    domain: "members",
    kind: "read",
    risk: "none",
    access: setupAdminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.get_join_link,
    outputSchema: fleetJoinLinkSchema,
    returns: "FleetJoinLink",
    example: { fleet_id: exampleFleet },
    annotations: READ_ONLY,
  },
  rotate_join_code: {
    name: "rotate_join_code",
    title: "Reset (rotate) the driver invite code",
    description:
      "Replace the fleet's driver join code with a new random one and return the new code and invite link. The old code, link and printed QR codes stop working immediately, so anyone you invited who has not joined yet needs the new link; current members are not affected. Owners and admins only, also while the fleet is still completing setup. Preview with dry_run: true, tell the human the old link will stop working, then confirm with the saved proposal_id.",
    domain: "members",
    kind: "write",
    risk: "sensitive",
    access: setupAdminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.rotate_join_code,
    outputSchema: fleetJoinLinkWriteSchema,
    returns: "FleetJoinLinkWrite",
    example: { fleet_id: exampleFleet, dry_run: true },
    annotations: {
      ...SETTINGS_WRITE,
      idempotentHint: false,
      destructiveHint: true,
    },
  },
  remove_fleet_member: {
    name: "remove_fleet_member",
    title: "Remove a driver or admin from the fleet",
    description:
      "Remove one driver or admin (member_id from list_fleet_members) from the fleet, as the console's Remove button does. They lose access to the fleet, its bookings and its messages at once; bookings assigned to them go back to unassigned; fleet-provided Meter Pro access ends and the fleet's seat billing is updated. Their past trips and the membership history are kept. The owner cannot be removed (deleting the fleet is the owner's exit). Owners and admins of an operational fleet only. Preview with dry_run: true, show who is removed and how many assigned bookings are released, then confirm with the saved proposal_id. They can rejoin later only through the invite link from get_join_link.",
    domain: "members",
    kind: "write",
    risk: "sensitive",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.remove_fleet_member,
    outputSchema: fleetMemberRemovalWriteSchema,
    returns: "FleetMemberRemovalWrite",
    example: { member_id: exampleMember, dry_run: true },
    annotations: {
      ...SETTINGS_WRITE,
      destructiveHint: true,
      idempotentHint: false,
    },
  },
  update_member_name: {
    name: "update_member_name",
    title: "Rename a driver or member",
    description:
      "Change a fleet member's first and last name as shown to the fleet, riders and on receipts, as the console's member editor does. Both names are required. Owners and admins of an operational fleet only; the member must belong to the fleet. Email and phone are changed by the member themselves. Preview with dry_run: true, show the change, then confirm with the saved proposal_id.",
    domain: "members",
    kind: "write",
    risk: "standard",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.update_member_name,
    outputSchema: fleetMemberNameWriteSchema,
    returns: "FleetMemberNameWrite",
    example: {
      member_id: exampleMember,
      first_name: "Maria",
      last_name: "Lopez",
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
  get_membership_events: {
    name: "get_membership_events",
    title: "Fleet membership history (joins, removals, role changes)",
    description:
      "List the fleet's membership history, newest first: who joined, left or was removed (reason), role changes and payout-share changes, with who made each change. Includes former members. Optional member_id and event_type filters; page with cursor and limit (max 100). Owners and admins of an operational fleet only.",
    domain: "members",
    kind: "read",
    risk: "none",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.get_membership_events,
    outputSchema: membershipEventPageSchema,
    returns: "MembershipEventPage",
    example: { fleet_id: exampleFleet, event_type: "left" },
    annotations: READ_ONLY,
  },
  set_member_online_state: {
    name: "set_member_online_state",
    title: "Force a driver online or kick offline",
    description:
      "Ask a fleet member's Meter app to go online (online: true; a silent push to their devices, which only works if the app can receive notifications) or take them offline (online: false; ends their current online session), as the console's Force online / Kick offline buttons do. The result says how many devices were asked; it does not confirm the app acted. Owners and admins of an operational fleet only; the member must belong to the fleet. Preview with dry_run: true, then confirm with the saved proposal_id.",
    domain: "members",
    kind: "write",
    risk: "standard",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.set_member_online_state,
    outputSchema: memberOnlineRequestWriteSchema,
    returns: "MemberOnlineRequestWrite",
    example: { member_id: exampleMember, online: false, dry_run: true },
    annotations: { ...SETTINGS_WRITE, idempotentHint: false },
  },
  list_member_documents: {
    name: "list_member_documents",
    title: "List driver documents",
    description:
      "Show each fleet member's driver documents (license, insurance, registration, vehicle photo): whether each was uploaded, how many photos, whether it is verified, and its expiry date and whether it has expired. Never returns document images, tax ids or license numbers; the photos are viewable only in the console. Give member_id for one member, or page through all members with cursor and limit (max 100). Owners and admins of an operational fleet only. Approve or un-approve with review_member_document; to upload a document for a member, give the human the edit_fleet_member link from get_action_link (target_id = member_id).",
    domain: "members",
    kind: "read",
    risk: "none",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.list_member_documents,
    outputSchema: memberDocumentsPageSchema,
    returns: "MemberDocumentsPage",
    example: { fleet_id: exampleFleet, member_id: exampleMember },
    annotations: READ_ONLY,
  },
  review_member_document: {
    name: "review_member_document",
    title: "Approve or reject a driver document",
    description:
      "Mark one of a fleet member's uploaded documents (license, insurance, registration or vehicle_photo) verified (verified: true) or not verified (false), as the console's document review does. Only documents that were uploaded can be reviewed; check list_member_documents first and have the human look at the photos in the console before approving. Owners and admins of an operational fleet only. Preview with dry_run: true, then confirm with the saved proposal_id.",
    domain: "members",
    kind: "write",
    risk: "standard",
    access: adminAccess,
    exposure: "on_demand",
    inputSchema: membersSchemas.review_member_document,
    outputSchema: memberDocumentsWriteSchema,
    returns: "MemberDocumentsWrite",
    example: {
      member_id: exampleMember,
      document_type: "license",
      verified: true,
      dry_run: true,
    },
    annotations: SETTINGS_WRITE,
  },
} as const;
