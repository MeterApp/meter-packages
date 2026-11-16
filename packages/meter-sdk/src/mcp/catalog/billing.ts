import * as z from "zod";
import {
  planCatalogSchema,
  subscriptionOverviewSchema,
} from "../../dto/index.ts";
import { READ_ONLY } from "./shared.ts";

export const billingSchemas = {
  get_subscription: z.strictObject({}),
  list_plans: z.strictObject({
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .optional()
      .describe(
        'ISO 4217 currency to show prices in, e.g. "EUR". Plans not offered in it show the base currency. Omit for the base currency.',
      ),
  }),
} as const;

export const billingTools = {
  get_subscription: {
    name: "get_subscription",
    title: "Get my plan and subscription",
    description:
      "Read the caller's Meter plan (free, Meter Pro, Meter Fleet) and subscriptions: status (active, trialing, past_due, canceled), who billed it (Meter web checkout, App Store, Google Play or a Meter promotion), renewal or end date, scheduled cancellation, seats, and for every fleet the caller owns or administers, the fleet's billing status. Each subscription lists the get_action_link actions to change plan, cancel or update the card; store purchases can only be changed in the App Store or Google Play (manage_store_subscription). Only the fleet owner manages fleet billing. Never shows provider IDs, invoices or card details, and never purchases, cancels or charges. Use list_plans to compare plans and get_meter_pay_status for payouts.",
    domain: "billing",
    kind: "read",
    risk: "none",
    exposure: "on_demand",
    external: "billing",
    access: {
      personas: ["solo_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    inputSchema: billingSchemas.get_subscription,
    outputSchema: subscriptionOverviewSchema,
    returns: "SubscriptionOverview",
    example: {},
    annotations: READ_ONLY,
  },
  list_plans: {
    name: "list_plans",
    title: "Compare Meter plans",
    description:
      "List every Meter plan (free, Meter Pro, Meter Fleet) with current prices in the requested currency where offered, billing intervals, trial length, where each plan can be bought, and the capabilities each plan unlocks, derived from Meter's entitlement policy. Meter Pro is bought in the Meter app, so its price comes from the App Store or Google Play and is not listed. Any driver or fleet member may call it. To start a plan, send its subscribe_action to get_action_link; get_subscription shows the caller's current plan.",
    domain: "billing",
    kind: "read",
    risk: "none",
    exposure: "on_demand",
    access: {
      personas: ["solo_driver", "fleet_driver", "fleet_admin", "fleet_owner"],
      requiresOperationalFleet: false,
    },
    inputSchema: billingSchemas.list_plans,
    outputSchema: planCatalogSchema,
    returns: "PlanCatalog",
    example: { currency: "EUR" },
    annotations: READ_ONLY,
  },
} as const;
