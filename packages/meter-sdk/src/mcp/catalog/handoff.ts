import { actionLinkInputSchema, actionLinkSchema } from "../handoff.ts";

export const handoffSchemas = {
  get_action_link: actionLinkInputSchema,
} as const;

export const handoffTools = {
  get_action_link: {
    name: "get_action_link",
    title: "Open a human action in Meter",
    description:
      "Return a Meter link for the human to finish purchases, subscription management, Meter Pay setup, dispute evidence, refund requests, document uploads (a member's: edit_fleet_member), contact changes, deletion, map drawing or downloads. Present the link unchanged with its instructions. This tool never purchases, pays, refunds, deletes, uploads or creates a provider session. Fleet billing and deletion require the owner; other fleet management actions require an owner or admin.",
    domain: "meta",
    kind: "handoff",
    risk: "none",
    access: {
      personas: [
        "solo_driver",
        "fleet_driver",
        "fleet_admin",
        "fleet_owner",
        "rider",
      ],
      requiresOperationalFleet: false,
    },
    exposure: "listed",
    inputSchema: actionLinkInputSchema,
    outputSchema: actionLinkSchema,
    returns: "ActionLink",
    example: { action: "meter_pay_setup" },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
} as const;
