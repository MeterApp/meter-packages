import * as z from "zod";
import {
  currencyCodeSchema,
  field,
  fleetRoleSchema,
  isoTimestampNullableSchema,
  isoTimestampSchema,
  minorAmountSchema,
} from "./common.ts";
import { HANDOFF_ACTION_NAMES } from "./handoff.ts";

export const METER_PLAN_CODES = [
  "free",
  "meter_pro",
  "meter_fleet",
  "meter_pro_and_fleet",
] as const;
export type MeterPlanCode = (typeof METER_PLAN_CODES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "canceled",
] as const;

export const PURCHASE_SOURCES = [
  "stripe_web",
  "app_store",
  "play_store",
  "promotional",
  "other",
] as const;
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

const handoffActionSchema = z.enum(HANDOFF_ACTION_NAMES);
const planFamilySchema = field(
  z.enum(["pro", "fleet"]),
  "pro: Meter Pro (driver features). fleet: Meter Fleet (a fleet's team, booking and dispatch features; also unlocks Pro features for the subscriber).",
);
const billingModelSchema = field(
  z.enum(["flat", "per_active_driver", "store"]),
  "flat: one fixed price per interval. per_active_driver: billed for each active driver in the period. store: priced and billed by the App Store or Google Play.",
);

const manageSchema = z
  .strictObject({
    where: field(
      z.enum(["meter_console", "app_store", "play_store", "none"]),
      "Where the human changes, cancels or updates payment for this purchase. Store purchases can only be changed in that store; none means nothing to manage (granted access).",
    ),
    actions: field(
      z.array(handoffActionSchema),
      "get_action_link actions that open the right place, in order of usefulness. Include fleet_id for a fleet subscription when the caller owns it.",
    ),
  })
  .describe("How the human manages this purchase.");

export const subscriptionSummarySchema = z.strictObject({
  family: field(
    z.enum(["pro", "fleet", "other"]),
    "Product family of the subscription. other: a legacy add-on such as ad-free.",
  ),
  product_name: field(
    z.string().nullable(),
    "Product name as billed, when known.",
  ),
  status: field(
    z.enum(SUBSCRIPTION_STATUSES),
    "Billing status. past_due: a renewal payment failed and is being retried; access continues while retrying.",
  ),
  gives_access: field(
    z.boolean(),
    "Whether this subscription unlocks its plan right now (active, trialing or past_due within its period).",
  ),
  purchase_source: field(
    z.enum(PURCHASE_SOURCES),
    "Who billed it: stripe_web (Meter web checkout), app_store, play_store, promotional (granted by Meter) or other.",
  ),
  billing_model: billingModelSchema,
  price: field(
    z
      .strictObject({
        amount_minor: minorAmountSchema,
        currency: currencyCodeSchema,
        interval: field(
          z.enum(["day", "week", "month", "year"]),
          "Billing interval.",
        ),
        interval_count: field(
          z.number().int().min(1),
          "Number of intervals per billing period.",
        ),
      })
      .nullable(),
    "List price per period for web (Stripe) subscriptions; null for store purchases, whose price is set by the store.",
  ),
  seats: field(
    z.number().int().nullable(),
    "Billed quantity reported by the provider (for per-driver fleet billing, drivers in the current period), or null.",
  ),
  trial_ends_at: isoTimestampNullableSchema,
  current_period_end: field(
    z.string().nullable(),
    "End of the current paid period: the renewal date, or the access end date when cancel_at_period_end is true.",
    { unit: "ISO 8601" },
  ),
  cancel_at_period_end: field(
    z.boolean(),
    "True when cancellation is scheduled: access continues until current_period_end and the subscription does not renew.",
  ),
  manage: manageSchema,
});
export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;

export const subscriptionOverviewSchema = z
  .strictObject({
    plan: field(
      z.enum(METER_PLAN_CODES),
      "Plan the account is entitled to right now. meter_fleet includes Pro features.",
    ),
    plan_check: field(
      z.enum(["live", "stored"]),
      "live: read from the entitlement service. stored: that service was unavailable, so plan is derived from stored subscriptions and may miss granted access.",
    ),
    pro_features_unlocked: field(
      z.boolean(),
      "Whether Pro driver features (unlimited trips and premium tools) are unlocked, by Pro or by Fleet.",
    ),
    subscriptions: field(
      z.array(subscriptionSummarySchema),
      "The current (or most recent) subscription per product family, newest first. Empty when the account never subscribed.",
    ),
    granted_access: field(
      z.array(
        z.strictObject({
          family: planFamilySchema,
          expires_at: isoTimestampNullableSchema,
        }),
      ),
      "Plans unlocked without a paid subscription on this account, such as a Meter promotion or membership of a paid fleet. Nothing to cancel or pay.",
    ),
    store_notice: field(
      z
        .strictObject({
          type: field(
            z.enum(["cancellation_scheduled", "refund_processed"]),
            "What the App Store or Google Play reported.",
          ),
          platform: field(
            z.enum(["android", "ios"]).nullable(),
            "Store platform of the purchase, when known.",
          ),
          occurred_at: isoTimestampSchema,
          effective_at: isoTimestampNullableSchema,
        })
        .nullable(),
      "Latest store cancellation or refund that still applies, the same notice the Meter app shows, or null.",
    ),
    fleets: field(
      z.array(
        z.strictObject({
          fleet_id: field(z.uuid(), "Meter fleet ID."),
          fleet_name: field(z.string().nullable(), "Fleet name."),
          role: fleetRoleSchema,
          billing_status: field(
            z.enum([...SUBSCRIPTION_STATUSES, "none"]),
            "Status of the fleet owner's Meter Fleet subscription; none when the fleet has never subscribed.",
          ),
          billing_active: field(
            z.boolean(),
            "Whether fleet billing counts as active (active, trialing or past_due). Fleet features lock when false.",
          ),
          operational: field(
            z.boolean(),
            "Whether the fleet is onboarded and paid, so fleet tools and driver features work.",
          ),
          manage_actions: field(
            z.array(handoffActionSchema),
            "get_action_link actions for this fleet's billing (include fleet_id). Empty for admins: only the owner manages fleet billing.",
          ),
        }),
      ),
      "Fleets the caller owns or administers, with their subscription state. Drivers' fleets are not listed.",
    ),
    upgrade_actions: field(
      z.array(handoffActionSchema),
      "get_action_link actions that start a plan this account does not have yet. Call list_plans to compare plans first.",
    ),
    checked_at: isoTimestampSchema,
  })
  .meta({
    description:
      "Read-only plan and subscription state with the hand-off actions to upgrade, change, cancel or update payment. No provider IDs, invoices or card details.",
  });
export type SubscriptionOverview = z.infer<typeof subscriptionOverviewSchema>;

export const planCatalogSchema = z
  .strictObject({
    currency: field(
      z.string().nullable(),
      "Requested display currency (ISO 4217, upper-case), or null for the catalog's base currency.",
    ),
    plans: field(
      z.array(
        z.strictObject({
          plan: field(
            z.enum(["free", "meter_pro", "meter_fleet"]),
            "Plan code, as reported by get_subscription.",
          ),
          name: field(z.string(), "Plan name."),
          includes: field(
            z.array(z.enum(["free", "meter_pro"])),
            "Lower plans whose capabilities this plan also unlocks.",
          ),
          purchase_channels: field(
            z.array(z.enum(["meter_web", "app_store", "play_store"])),
            "Where the plan can be bought. Empty for the free plan.",
          ),
          subscribe_action: field(
            handoffActionSchema.nullable(),
            "get_action_link action that starts this plan, or null for the free plan.",
          ),
          price_source: field(
            z.enum(["free", "meter_catalog", "store"]),
            "meter_catalog: prices below are Meter's web prices. store: the App Store or Google Play sets the price for the buyer's region; it is shown in the Meter app before purchase.",
          ),
          prices: field(
            z.array(
              z.strictObject({
                interval: field(
                  z.enum(["day", "week", "month", "year"]),
                  "Billing interval.",
                ),
                interval_count: field(
                  z.number().int().min(1),
                  "Number of intervals per billing period.",
                ),
                amount_minor: minorAmountSchema,
                currency: currencyCodeSchema,
                formatted: field(
                  z.string(),
                  "The amount formatted for display in the caller's language.",
                ),
                requested_currency_available: field(
                  z.boolean(),
                  "False when the requested currency is not offered and the base currency is shown instead.",
                ),
                trial_days: field(
                  z.number().int().nullable(),
                  "Free trial length offered with this price, or null.",
                ),
                billing_model: billingModelSchema,
              }),
            ),
            "Current prices. Empty for free and store-priced plans.",
          ),
          capabilities: field(
            z.array(
              z.strictObject({
                id: field(
                  z.string(),
                  "Stable Meter capability ID, as used in entitlement decisions.",
                ),
                scope: field(
                  z.enum(["account", "fleet"]),
                  "account: unlocked for the subscriber's own driving. fleet: unlocked for an active fleet's members, subject to each member's role.",
                ),
                description: field(
                  z.string(),
                  "What the capability allows, from Meter's entitlement policy.",
                ),
              }),
            ),
            "Capabilities this plan unlocks beyond the lower plans it includes, derived from Meter's entitlement policy.",
          ),
          unlimited_trips: field(
            z.boolean(),
            "Whether the free trip allowance limit is lifted.",
          ),
        }),
      ),
      "Every Meter plan, from free to Fleet.",
    ),
    checked_at: isoTimestampSchema,
  })
  .meta({
    description:
      "Meter plans with current prices, purchase channels and the capabilities each unlocks. Read-only; subscribing happens in Meter through get_action_link.",
  });
export type PlanCatalog = z.infer<typeof planCatalogSchema>;
