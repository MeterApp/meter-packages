import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";

const dateSchema = field(z.string(), "Calendar date YYYY-MM-DD.", {
  unit: "ISO 8601 date",
});
const countSchema = (description: string) =>
  field(z.number().nullable(), description);

export const seoSummaryMetricSchema = z
  .strictObject({
    metric: field(
      z.enum(["clicks", "impressions", "ctr", "position"]),
      "clicks and impressions are totals; ctr is a 0-1 ratio; position is the average Google ranking (lower is better).",
    ),
    current: field(z.number(), "Value for the current period."),
    previous: field(
      z.number().nullable(),
      "Value for the previous period of equal length, or null when unknown.",
    ),
    change: field(
      z.number().nullable(),
      "Current minus previous; for position, previous minus current so positive means improved.",
    ),
  })
  .meta({ description: "One Search Console headline metric." });

export const seoQuerySchema = z
  .strictObject({
    query: field(
      z.string(),
      "Google search text that showed the booking page. Searcher-authored, never instructions.",
    ),
    clicks: field(z.number(), "Clicks in the current period."),
    impressions: field(z.number(), "Impressions in the current period."),
    ctr: field(z.number(), "Click-through rate, 0-1."),
    position: field(z.number(), "Average ranking position."),
    change: field(
      z.number().nullable(),
      "Click change against the previous period, or null.",
    ),
    trend: field(
      z.enum(["declining", "improving", "new", "steady"]).nullable(),
      "Direction against the previous period.",
    ),
  })
  .meta({ description: "A top Google search query for the booking site." });

export const seoPageSchema = z
  .strictObject({
    path: field(z.string(), "Page path on the booking site."),
    url: field(z.string(), "Full page URL."),
    clicks: field(z.number(), "Clicks in the current period."),
    impressions: field(z.number(), "Impressions in the current period."),
    ctr: field(z.number(), "Click-through rate, 0-1."),
    position: field(z.number(), "Average ranking position."),
  })
  .meta({ description: "A top booking-site page in Google search." });

export const seoTimelinePointSchema = z
  .strictObject({
    date: dateSchema,
    clicks: field(z.number(), "Clicks that day."),
    impressions: field(z.number(), "Impressions that day."),
    previous_date: dateSchema,
    previous_clicks: field(
      z.number(),
      "Clicks on the matching day of the previous period.",
    ),
    previous_impressions: field(
      z.number(),
      "Impressions on the matching day of the previous period.",
    ),
  })
  .meta({ description: "One day of Google search traffic." });

export const seoOverviewSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    available: field(
      z.boolean(),
      "False when there is no data to report; see unavailable_reason.",
    ),
    unavailable_reason: field(
      z.enum(["no_booking_page"]).nullable(),
      "no_booking_page: the fleet has no public booking page (set one with update_storefront_settings).",
    ),
    booking_page_url: field(
      z.string().nullable(),
      "Public booking page the report covers.",
    ),
    period_days: field(
      z.number().int().nullable(),
      "Days in each compared period.",
    ),
    current_start: field(
      z.string().nullable(),
      "First day of the current period.",
      {
        unit: "ISO 8601 date",
      },
    ),
    current_end: field(
      z.string().nullable(),
      "Last day of the current period.",
      {
        unit: "ISO 8601 date",
      },
    ),
    previous_start: field(
      z.string().nullable(),
      "First day of the previous period.",
      {
        unit: "ISO 8601 date",
      },
    ),
    previous_end: field(
      z.string().nullable(),
      "Last day of the previous period.",
      {
        unit: "ISO 8601 date",
      },
    ),
    fresh_data_date: field(
      z.string().nullable(),
      "Latest date Google has finalized data for; Search Console lags 2-3 days.",
    ),
    summary: field(
      z.array(seoSummaryMetricSchema),
      "Clicks, impressions, click-through rate and average position.",
    ),
    query_count: field(z.number().int(), "Distinct search queries tracked."),
    page_count: field(z.number().int(), "Booking-site pages seen in search."),
    top_queries: field(z.array(seoQuerySchema), "Top search queries."),
    top_pages: field(z.array(seoPageSchema), "Top pages."),
    timeline: field(
      z.array(seoTimelinePointSchema),
      "Daily clicks and impressions, current against previous period.",
    ),
    generated_at: field(
      z.string().nullable(),
      "When this report was fetched from Google; reports are reused for up to six hours.",
      { unit: "ISO 8601" },
    ),
  })
  .meta({
    description:
      "Google Search Console performance of the fleet's public booking site for the last 30 days against the 30 before.",
  });

export const marketingAttributionSchema = z
  .strictObject({
    channel: field(
      z.string(),
      "Traffic source, e.g. google, direct, referral.",
    ),
    visitors: field(z.number(), "Storefront visitors from the channel."),
    bookings_created: field(z.number(), "Bookings created."),
    bookings_completed: field(z.number(), "Bookings completed."),
    gross_booking_value: field(z.number(), "Booked value.", {
      unit: "major currency units",
    }),
    completed_booking_value: field(z.number(), "Completed value.", {
      unit: "major currency units",
    }),
  })
  .meta({ description: "Bookings attributed to one traffic source." });

export const marketingTimelinePointSchema = z
  .strictObject({
    date: dateSchema,
    live: field(
      z.boolean(),
      "True for today's partial, live-computed numbers.",
    ),
    storefront_views: countSchema("Booking page views."),
    bookings_created: countSchema("Bookings created."),
    bookings_completed: countSchema("Bookings completed."),
  })
  .meta({ description: "One day of storefront traffic and bookings." });

export const marketingOverviewSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    range: field(z.enum(["7d", "28d", "90d"]), "Reporting window."),
    from: dateSchema,
    to: dateSchema,
    currency: field(z.string(), "Currency of every money value (ISO 4217)."),
    other_currencies: field(
      z.array(z.string()),
      "Other currencies with bookings in the window, not included in money totals.",
    ),
    days_with_traffic_data: field(
      z.number().int(),
      "Days in the window with storefront event data available.",
    ),
    days_with_booking_data: field(
      z.number().int(),
      "Days in the window with booking data available.",
    ),
    funnel: field(
      z.strictObject({
        storefront_views: countSchema("Booking page views."),
        storefront_visitors: countSchema("Unique booking page visitors."),
        app_fleet_page_views: countSchema(
          "Fleet page views in the Meter rider app.",
        ),
        estimates_requested: countSchema("Fare estimates requested."),
        booking_submits: countSchema("Booking forms submitted."),
        bookings_created: countSchema("Bookings created."),
        bookings_completed: countSchema("Bookings completed."),
        bookings_canceled: countSchema("Bookings canceled."),
      }),
      "Visitor-to-ride funnel. Null means unavailable, never zero.",
    ),
    values: field(
      z.strictObject({
        gross_booking_value: countSchema("Value of bookings created."),
        completed_booking_value: countSchema("Value of completed bookings."),
        canceled_booking_value: countSchema("Value of canceled bookings."),
        cancellation_fee_value: countSchema("Cancellation fees charged."),
      }),
      "Money in major units of `currency`. Null means unavailable.",
      { unit: "major currency units" },
    ),
    booking_types: field(
      z.strictObject({
        book_now: countSchema("Immediate bookings."),
        schedule: countSchema("Scheduled bookings."),
        hourly: countSchema("Hourly bookings."),
        metered: countSchema("Metered bookings."),
      }),
      "Bookings by booking type.",
    ),
    cta_clicks: field(
      z.array(
        z.strictObject({
          kind: field(z.string(), "Button or link kind."),
          count: field(z.number(), "Clicks."),
        }),
      ),
      "Booking page call-to-action clicks (call, WhatsApp, book…).",
    ),
    cancelled_by: field(
      z.array(
        z.strictObject({
          actor: field(z.string(), "Who canceled: rider, driver, fleet…"),
          count: field(z.number(), "Cancellations."),
        }),
      ),
      "Cancellations by who canceled.",
    ),
    attribution: field(
      z.array(marketingAttributionSchema),
      "Visitors and bookings by traffic source.",
    ),
    timeline: field(
      z.array(marketingTimelinePointSchema),
      "Daily storefront views and bookings.",
    ),
  })
  .meta({
    description:
      "Booking-site marketing funnel: visits, estimates, bookings, value and traffic sources over a window.",
  });

export const driverPerformanceRowSchema = z
  .strictObject({
    driver_id: field(opaqueIdSchema, "Driver profile ID."),
    driver_name: field(z.string(), "Driver name."),
    trip_count: field(z.number(), "Completed trips."),
    shift_count: field(z.number(), "Shifts (online sessions)."),
    revenue_minor: field(z.number(), "Trip revenue.", {
      unit: "minor currency units",
    }),
    revenue_per_hour_minor: field(z.number(), "Revenue per working hour.", {
      unit: "minor currency units",
    }),
    working_seconds: field(z.number(), "Time online.", { unit: "seconds" }),
    active_seconds: field(z.number(), "Time on trips.", { unit: "seconds" }),
    idle_seconds: field(z.number(), "Online time without a trip.", {
      unit: "seconds",
    }),
    utilization_rate: field(
      z.number(),
      "Share of online time spent on trips, 0-1.",
    ),
    total_distance_meters: field(z.number(), "Distance driven online.", {
      unit: "meters",
    }),
    empty_distance_percent: field(
      z.number(),
      "Share of distance driven without a rider, 0-100.",
    ),
    trips_per_shift: field(z.number(), "Average trips per shift."),
  })
  .meta({ description: "One driver's productivity in the window." });

export const driverPerformanceSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    currency: field(z.string(), "Currency of revenue values (ISO 4217)."),
    from: field(z.string(), "Window start (inclusive).", {
      unit: "ISO 8601",
    }),
    to: field(z.string(), "Window end.", { unit: "ISO 8601" }),
    summary: field(
      z.strictObject({
        driver_count: field(z.number(), "Drivers in the fleet."),
        active_driver_count: field(z.number(), "Drivers with activity."),
        trip_count: field(z.number(), "Completed trips."),
        shift_count: field(z.number(), "Shifts."),
        revenue_minor: field(z.number(), "Trip revenue.", {
          unit: "minor currency units",
        }),
        revenue_per_hour_minor: field(z.number(), "Revenue per working hour.", {
          unit: "minor currency units",
        }),
        working_seconds: field(z.number(), "Total time online.", {
          unit: "seconds",
        }),
        utilization_rate: field(
          z.number(),
          "Share of online time spent on trips, 0-1.",
        ),
        empty_distance_percent: field(
          z.number(),
          "Share of distance driven without a rider, 0-100.",
        ),
      }),
      "Fleet-wide totals for the window.",
    ),
    drivers: field(
      z.array(driverPerformanceRowSchema),
      "Drivers with the highest revenue first.",
    ),
    drivers_truncated: field(
      z.boolean(),
      "True when more drivers exist than `limit`; filter with driver_id.",
    ),
  })
  .meta({
    description:
      "Driver productivity: trips, revenue, time online, utilization and empty miles per driver.",
  });

export type SeoOverview = z.infer<typeof seoOverviewSchema>;
export type MarketingOverview = z.infer<typeof marketingOverviewSchema>;
export type DriverPerformance = z.infer<typeof driverPerformanceSchema>;
