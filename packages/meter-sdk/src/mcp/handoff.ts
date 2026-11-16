import * as z from "zod";
import { HANDOFF_ACTION_NAMES } from "../dto/handoff.ts";
export * from "../dto/handoff.ts";

export const actionLinkInputSchema = z.strictObject({
  action: z.enum(HANDOFF_ACTION_NAMES),
  fleet_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Fleet for fleet actions or a rider's add_payment_method. Meter Pay and subscriptions default to your own account.",
    ),
  target_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Dispute case or trip ID (respond_to_dispute, request_refund), your booking ID (track_ride, finish_ride_payment, tip_ride), a quote ID sent to you (review_quote), or a member_id (edit_fleet_member). Never a payment-provider ID.",
    ),
});
export type ActionLinkInput = z.infer<typeof actionLinkInputSchema>;
