import * as z from "zod";
import {
  notificationWebhookWriteSchema,
  notificationWebhooksSchema,
  privacySettingsSchema,
  privacySettingsWriteSchema,
  voiceAgentSettingsSchema,
  voiceAgentSettingsWriteSchema,
} from "../../dto/index.ts";
import {
  dryRunSchema,
  fleetIdSchema,
  proposalIdSchema,
  READ_ONLY,
  SETTINGS_WRITE,
} from "./shared.ts";

const webhookFilter = z
  .array(z.string().trim().min(1).max(120))
  .max(100)
  .optional();
export const fleetFeatureSchemas = {
  update_notification_webhook: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    webhook_id: z
      .string()
      .uuid()
      .describe("Webhook ID from list_notification_webhooks."),
    is_active: z
      .boolean()
      .optional()
      .describe("Enable or pause delivery to the existing destination."),
    event_types: webhookFilter.describe(
      "Event types to deliver. An empty list delivers all types.",
    ),
    categories: webhookFilter.describe(
      "Notification categories to deliver. An empty list delivers all categories.",
    ),
    channels: z
      .array(z.enum(["email", "sms", "whatsapp", "push"]))
      .max(4)
      .optional()
      .describe(
        "Delivery channels to include. An empty list includes all channels.",
      ),
  }),
  get_privacy_settings: z.strictObject({ fleet_id: fleetIdSchema }),
  update_privacy_settings: z
    .strictObject({
      fleet_id: fleetIdSchema,
      dry_run: dryRunSchema,
      proposal_id: proposalIdSchema,
      driver_requests_enabled: z
        .boolean()
        .optional()
        .describe(
          "Let riders request a specific driver when booking. Enabling needs an active Fleet plan and at least one driver.",
        ),
      driver_requests_visibility: z
        .enum(["signed_in_only", "public_and_signed_in"])
        .optional()
        .describe(
          "Who sees requestable drivers: signed-in riders only, or also anyone on the public booking page.",
        ),
      requestable_drivers: z
        .array(
          z.strictObject({
            driver_id: z
              .string()
              .uuid()
              .describe("Driver from get_privacy_settings."),
            display_name: z
              .string()
              .trim()
              .min(1)
              .max(120)
              .describe(
                "Name riders see. No email addresses or phone numbers.",
              ),
            show_profile_photo: z
              .boolean()
              .default(false)
              .describe("Show the driver's profile photo to riders."),
          }),
        )
        .max(50)
        .optional()
        .describe(
          "The complete list of drivers riders may request, in display order. Replaces the current list; omit to keep it.",
        ),
    })
    .refine(
      (input) =>
        input.driver_requests_enabled !== undefined ||
        input.driver_requests_visibility !== undefined ||
        input.requestable_drivers !== undefined,
      "Pass at least one setting to change.",
    ),
  get_voice_agent_settings: z.strictObject({ fleet_id: fleetIdSchema }),
  update_voice_agent_settings: z.strictObject({
    fleet_id: fleetIdSchema,
    dry_run: dryRunSchema,
    proposal_id: proposalIdSchema,
    custom_instructions: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .describe(
        "Complete extra instructions for the AI phone booking agent (greeting, service details, policies), up to 4000 characters. Null or empty restores the default behavior.",
      ),
  }),
  list_notification_webhooks: z.strictObject({ fleet_id: fleetIdSchema }),
} as const;

const access = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: true,
} as const;

export const fleetFeatureTools = {
  get_privacy_settings: {
    name: "get_privacy_settings",
    title: "Get fleet privacy / driver request settings",
    description:
      "Read the fleet's privacy settings: whether riders see driver locations, whether riders may request a specific driver by name, who sees requestable drivers, and every driver with the name and photo riders would see. Owners and admins of an operational fleet. Change driver requests with update_privacy_settings; change driver location sharing with update_fleet_settings (show_driver_locations).",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fleetFeatureSchemas.get_privacy_settings,
    outputSchema: privacySettingsSchema,
    returns: "PrivacySettings",
    example: {},
    annotations: READ_ONLY,
  },
  update_privacy_settings: {
    name: "update_privacy_settings",
    title: "Update driver request privacy settings",
    description:
      "Turn rider driver requests on or off, choose whether requestable drivers are visible on the public booking page or to signed-in riders only, and replace the list of requestable drivers with the display name and photo riders see. Omitted settings keep their current values. Owners and admins of an operational fleet; enabling needs an active Fleet plan. Preview with dry_run: true, then confirm with the saved proposal_id and identical arguments.",
    domain: "fleet",
    kind: "write",
    risk: "standard",
    escalate: { sensitive: ["driver_requests_visibility"] },
    access,
    exposure: "on_demand",
    inputSchema: fleetFeatureSchemas.update_privacy_settings,
    outputSchema: privacySettingsWriteSchema,
    returns: "PrivacySettingsWrite",
    example: {
      dry_run: true,
      driver_requests_enabled: true,
      requestable_drivers: [
        {
          driver_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          display_name: "Sam",
          show_profile_photo: true,
        },
      ],
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  get_voice_agent_settings: {
    name: "get_voice_agent_settings",
    title: "Get AI phone booking agent settings",
    description:
      "Read the fleet's AI phone booking agent (voice agent) settings: the custom instructions it follows on calls and whether a phone number is attached. Owners and admins of an operational fleet. No call transcripts. Change the instructions with update_voice_agent_settings; phone numbers are bought and released in the web console.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fleetFeatureSchemas.get_voice_agent_settings,
    outputSchema: voiceAgentSettingsSchema,
    returns: "VoiceAgentSettings",
    example: {},
    annotations: READ_ONLY,
  },
  update_voice_agent_settings: {
    name: "update_voice_agent_settings",
    title: "Update AI phone booking agent instructions",
    description:
      "Replace the custom instructions the fleet's AI phone booking agent follows on every call (greeting, services, prices to quote, policies). Callers hear the result, so show the human the complete text before confirming. Owners and admins of an operational fleet. Preview with dry_run: true, then confirm with the saved proposal_id and identical arguments. Null restores the default behavior.",
    domain: "fleet",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "on_demand",
    inputSchema: fleetFeatureSchemas.update_voice_agent_settings,
    outputSchema: voiceAgentSettingsWriteSchema,
    returns: "VoiceAgentSettingsWrite",
    example: {
      dry_run: true,
      custom_instructions: "Greet callers as Austin Airport Cabs.",
    },
    annotations: { ...SETTINGS_WRITE, destructiveHint: true },
  },
  update_notification_webhook: {
    name: "update_notification_webhook",
    title: "Update a fleet notification webhook",
    description:
      "Pause or enable delivery and change event, category or channel filters for an existing fleet webhook. Preview with dry_run: true and show its destination host and filter changes before confirming. Use the console to change the URL or manage signing.",
    domain: "fleet",
    kind: "write",
    risk: "sensitive",
    access,
    exposure: "listed",
    inputSchema: fleetFeatureSchemas.update_notification_webhook,
    outputSchema: notificationWebhookWriteSchema,
    returns: "NotificationWebhookWrite",
    example: {
      webhook_id: "44444444-4444-4444-8444-444444444444",
      is_active: false,
      dry_run: true,
    },
    annotations: {
      ...SETTINGS_WRITE,
      openWorldHint: true,
      destructiveHint: true,
    },
  },
  list_notification_webhooks: {
    name: "list_notification_webhooks",
    title: "List notification webhooks",
    description:
      "List the fleet's notification webhook subscriptions: receiving host, active state, event filters and signing rotation time. Signing values and full URLs are never returned. Owners and admins of an operational fleet. Use update_notification_webhook for delivery settings and the console link to add, test or rotate a webhook.",
    domain: "fleet",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: fleetFeatureSchemas.list_notification_webhooks,
    outputSchema: notificationWebhooksSchema,
    returns: "NotificationWebhooks",
    example: {},
    annotations: READ_ONLY,
  },
} as const;
