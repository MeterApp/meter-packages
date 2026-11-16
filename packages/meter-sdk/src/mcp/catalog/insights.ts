import * as z from "zod";
import {
  driverPerformanceSchema,
  marketingOverviewSchema,
  seoOverviewSchema,
} from "../../dto/index.ts";
import { fleetIdSchema, READ_ONLY } from "./shared.ts";

export const insightsSchemas = {
  get_seo_overview: z.strictObject({ fleet_id: fleetIdSchema }),
  get_marketing_overview: z.strictObject({
    fleet_id: fleetIdSchema,
    range: z
      .enum(["7d", "28d", "90d"])
      .default("28d")
      .describe("Reporting window ending today (default 28d)."),
  }),
  get_driver_performance: z.strictObject({
    fleet_id: fleetIdSchema,
    from: z.iso
      .date()
      .optional()
      .describe("First day (inclusive). Defaults to 30 days ago."),
    to: z.iso
      .date()
      .optional()
      .describe("Last day (inclusive). Defaults to today. At most 186 days."),
    driver_id: z
      .string()
      .uuid()
      .optional()
      .describe("Only this driver, from list_fleet_members."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Most drivers returned, highest revenue first (1-200)."),
  }),
} as const;

const access = {
  personas: ["fleet_admin", "fleet_owner"],
  requiresOperationalFleet: true,
} as const;

export const insightsTools = {
  get_seo_overview: {
    name: "get_seo_overview",
    title: "Get booking site SEO / Google search performance",
    description:
      "Google Search Console performance of the fleet's public booking website: clicks, impressions, click-through rate and average ranking for the last 30 days against the 30 before, top search queries, top pages and a daily timeline. Owners and admins of an operational fleet. Results are cached up to six hours and calls are rate limited. Returns available: false when the fleet has no booking page yet. Pair with get_storefront_settings to check the Google Maps listing link.",
    domain: "insights",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    external: "search_console",
    inputSchema: insightsSchemas.get_seo_overview,
    outputSchema: seoOverviewSchema,
    returns: "SeoOverview",
    example: {},
    annotations: READ_ONLY,
  },
  get_marketing_overview: {
    name: "get_marketing_overview",
    title: "Get booking site marketing funnel",
    description:
      "Marketing performance of the fleet's booking website over 7, 28 or 90 days: page views and visitors, fare estimates, booking submits, bookings created/completed/canceled, booked value, booking types, call-to-action clicks, cancellations by actor, traffic sources (attribution) and a daily timeline. Owners and admins of an operational fleet. Null means unavailable, never zero. For Google search rankings use get_seo_overview.",
    domain: "insights",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: insightsSchemas.get_marketing_overview,
    outputSchema: marketingOverviewSchema,
    returns: "MarketingOverview",
    example: { range: "28d" },
    annotations: READ_ONLY,
  },
  get_driver_performance: {
    name: "get_driver_performance",
    title: "Get driver performance / productivity",
    description:
      "Driver productivity for a date range (default last 30 days): per driver trips, shifts, revenue, revenue per hour, time online, time on trips, idle time, utilization and empty-mile share, plus fleet totals. Owners and admins of an operational fleet. Drivers are ordered by revenue; filter with driver_id. Revenue is in minor currency units. For trip lists use list_trips; for earnings payouts use get_earnings.",
    domain: "insights",
    kind: "read",
    risk: "none",
    access,
    exposure: "on_demand",
    inputSchema: insightsSchemas.get_driver_performance,
    outputSchema: driverPerformanceSchema,
    returns: "DriverPerformance",
    example: { from: "2026-09-01", to: "2026-09-30", limit: 50 },
    annotations: READ_ONLY,
  },
} as const;
