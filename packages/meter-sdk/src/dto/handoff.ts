import * as z from "zod";
import { field } from "./common.ts";

export const HANDOFF_ACTION_NAMES = [
  "subscribe_pro",
  "subscribe_fleet",
  "manage_subscription",
  "manage_store_subscription",
  "change_plan",
  "cancel_subscription",
  "update_payment_method",
  "meter_pay_setup",
  "meter_pay_manage",
  "respond_to_dispute",
  "request_refund",
  "upload_documents",
  "edit_fleet_member",
  "change_email",
  "change_phone",
  "delete_account",
  "delete_fleet",
  "upload_fleet_icon",
  "draw_service_area",
  "download_pay_stub",
  "download_export",
  "add_payment_method",
  "finish_ride_payment",
  "track_ride",
  "review_quote",
  "tip_ride",
] as const;
export type HandoffAction = (typeof HANDOFF_ACTION_NAMES)[number];
export const actionLinkSchema = z
  .strictObject({
    action: field(z.enum(HANDOFF_ACTION_NAMES), "The human action requested."),
    label: field(
      z.string(),
      "Localized action label; payment setup is called Meter Pay.",
    ),
    url: field(
      z.string().url(),
      "Meter page URL to present unchanged. Never a provider session or signed download URL.",
    ),
    where_in_console: field(
      z.string(),
      "Where the human can find the action in Meter.",
    ),
    where_in_app: field(
      z.string(),
      "Native app guidance, or instructions to open the web console.",
    ),
    why_handoff: field(
      z.string(),
      "Why the human must finish this action and whether it needs the store or Meter support.",
    ),
  })
  .meta({
    description:
      "Human continuation in Meter. Issuing a link never purchases, pays, refunds, or deletes anything.",
  });
export type ActionLink = z.infer<typeof actionLinkSchema>;
