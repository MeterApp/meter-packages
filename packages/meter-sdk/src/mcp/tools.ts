import {
  bookingBlockSchemas,
  bookingBlockTools,
} from "./catalog/booking-blocks.ts";
import {
  personalSettingsSchemas,
  personalSettingsTools,
} from "./catalog/personal-settings.ts";
import {
  reconciliationSchemas,
  reconciliationTools,
} from "./catalog/reconciliation.ts";
import {
  tripInvoiceSchemas,
  tripInvoiceTools,
} from "./catalog/trip-invoices.ts";
import {
  fleetFinanceSchemas,
  fleetFinanceTools,
} from "./catalog/fleet-finances.ts";
import { fareWriteSchemas, fareWriteTools } from "./catalog/fare-writes.ts";
import {
  pricingManagementSchemas,
  pricingManagementTools,
} from "./catalog/pricing-management.ts";
import { feedbackSchemas, feedbackTools } from "./catalog/feedback.ts";
import {
  websitePagesSchemas,
  websitePagesTools,
} from "./catalog/website-pages.ts";
import { meterPaySchemas, meterPayTools } from "./catalog/meter-pay.ts";
import { billingSchemas, billingTools } from "./catalog/billing.ts";
import {
  serviceZoneSchemas,
  serviceZoneTools,
} from "./catalog/service-zones.ts";
import { fleetSetupSchemas, fleetSetupTools } from "./catalog/fleet-setup.ts";
import {
  bookingLifecycleSchemas,
  bookingLifecycleTools,
} from "./catalog/booking-lifecycle.ts";
import { customersSchemas, customersTools } from "./catalog/customers.ts";
import { tripReviewSchemas, tripReviewTools } from "./catalog/trip-reviews.ts";
import { storefrontSchemas, storefrontTools } from "./catalog/storefront.ts";
import { insightsSchemas, insightsTools } from "./catalog/insights.ts";
import {
  fleetFeatureSchemas,
  fleetFeatureTools,
} from "./catalog/fleet-features.ts";
/** Composes the domain catalogs while retaining each tool's exact input type. */
import * as z from "zod";
import { metricsSchemas, metricsTools } from "./catalog/metrics.ts";
import { reviewsSchemas, reviewsTools } from "./catalog/reviews.ts";
import type {
  McpDomain,
  McpToolKind,
  McpRisk,
  McpToolAccess,
} from "./catalog/types.ts";
export type * from "./catalog/types.ts";
export { MCP_DOMAINS } from "./catalog/types.ts";
import { metaSchemas, metaTools } from "./catalog/meta.ts";
import { accountSchemas, accountTools } from "./catalog/account.ts";
import { fleetSchemas, fleetTools } from "./catalog/fleet.ts";
import { membersSchemas, membersTools } from "./catalog/members.ts";
import { vehiclesSchemas, vehiclesTools } from "./catalog/vehicles.ts";
import { fareReadSchemas, fareReadTools } from "./catalog/fare-reads.ts";
import {
  fleetPricingSchemas,
  fleetPricingTools,
} from "./catalog/fleet-pricing.ts";
import { faresSchemas, faresTools } from "./catalog/fares.ts";
import { bookingsSchemas, bookingsTools } from "./catalog/bookings.ts";
import { quoteSchemas, quoteTools } from "./catalog/quotes.ts";
import { tripsSchemas, tripsTools } from "./catalog/trips.ts";
import { accountingSchemas, accountingTools } from "./catalog/accounting.ts";
import { handoffSchemas, handoffTools } from "./catalog/handoff.ts";
import { riderRideSchemas, riderRideTools } from "./catalog/rider-rides.ts";
import {
  riderBookingSchemas,
  riderBookingTools,
} from "./catalog/rider-bookings.ts";
import {
  customerBookingSchemas,
  customerBookingTools,
} from "./catalog/customer-bookings.ts";
export {
  MCP_SERVER_INFO,
  MCP_SCOPES_SUPPORTED,
  MCP_INSTRUCTIONS,
} from "./catalog/meta.ts";

export const MCP_TOOL_SCHEMAS = {
  ...reconciliationSchemas,
  ...metricsSchemas,
  ...reviewsSchemas,
  ...tripInvoiceSchemas,
  ...fleetFinanceSchemas,
  ...feedbackSchemas,
  ...metaSchemas,
  ...accountSchemas,
  ...personalSettingsSchemas,
  ...fleetSchemas,
  ...membersSchemas,
  ...vehiclesSchemas,
  ...faresSchemas,
  ...fleetPricingSchemas,
  ...serviceZoneSchemas,
  ...pricingManagementSchemas,
  ...fleetSetupSchemas,
  ...fareReadSchemas,
  ...fareWriteSchemas,
  ...bookingsSchemas,
  ...bookingBlockSchemas,
  ...bookingLifecycleSchemas,
  ...customersSchemas,
  ...customerBookingSchemas,
  ...tripReviewSchemas,
  ...riderRideSchemas,
  ...riderBookingSchemas,
  ...quoteSchemas,
  ...tripsSchemas,
  ...accountingSchemas,
  ...handoffSchemas,
  ...meterPaySchemas,
  ...billingSchemas,
  ...websitePagesSchemas,
  ...storefrontSchemas,
  ...insightsSchemas,
  ...fleetFeatureSchemas,
} as const;

export type McpToolName = keyof typeof MCP_TOOL_SCHEMAS;
export type McpToolInput<N extends McpToolName> = z.infer<
  (typeof MCP_TOOL_SCHEMAS)[N]
>;

export interface McpToolAnnotations {
  title?: string;
  /** True only when the tool cannot mutate application data. */
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface McpToolDefinition<N extends McpToolName = McpToolName> {
  name: N;
  title: string;
  description: string;
  domain: McpDomain;
  kind: McpToolKind;
  risk: McpRisk;
  escalate?: { sensitive: readonly string[] };
  access: McpToolAccess;
  exposure: "listed" | "on_demand";
  /**
   * MCP servers that serve the tool, when not the ones its personas imply.
   * An empty list keeps a tool first-party: Meter's own assistant offers it,
   * no MCP server lists or runs it.
   */
  surfaces?: readonly ("rider" | "fleet")[];
  external?: "meter_pay" | "billing" | "search_console";
  inputSchema: (typeof MCP_TOOL_SCHEMAS)[N];
  outputSchema?: z.ZodType;
  /** Name of the DTO the tool returns, for explain_data. */
  returns?: string;
  example: Record<string, unknown>;
  annotations: McpToolAnnotations;
}

/** Declared schema fields match runtime classification, including empty read inputs. */
export type McpWriteToolName = {
  [
    N in McpToolName
  ]: "dry_run" extends keyof (typeof MCP_TOOL_SCHEMAS)[N]["shape"] ? N : never;
}[McpToolName];

export const MCP_TOOLS: { [N in McpToolName]: McpToolDefinition<N> } = {
  ...reconciliationTools,
  ...metricsTools,
  ...reviewsTools,
  ...tripInvoiceTools,
  ...fleetFinanceTools,
  ...feedbackTools,
  ...metaTools,
  ...accountTools,
  ...personalSettingsTools,
  ...fleetTools,
  ...membersTools,
  ...vehiclesTools,
  ...faresTools,
  ...fleetPricingTools,
  ...serviceZoneTools,
  ...pricingManagementTools,
  ...fleetSetupTools,
  ...fareReadTools,
  ...fareWriteTools,
  ...bookingsTools,
  ...bookingBlockTools,
  ...bookingLifecycleTools,
  ...customersTools,
  ...customerBookingTools,
  ...tripReviewTools,
  ...riderRideTools,
  ...riderBookingTools,
  ...quoteTools,
  ...tripsTools,
  ...accountingTools,
  ...handoffTools,
  ...meterPayTools,
  ...billingTools,
  ...websitePagesTools,
  ...storefrontTools,
  ...insightsTools,
  ...fleetFeatureTools,
} as const;

export const MCP_TOOL_LIST: McpToolDefinition[] = Object.values(
  MCP_TOOLS,
) as McpToolDefinition[];
export const MCP_TOOL_NAMES = Object.keys(MCP_TOOLS) as McpToolName[];

export function isMcpToolName(value: string): value is McpToolName {
  return Object.prototype.hasOwnProperty.call(MCP_TOOLS, value);
}

/** Concrete proposal tools have write intent schemas; dispatch delegates to one of them. */
export const MCP_WRITE_TOOL_NAMES = MCP_TOOL_LIST.filter(
  (tool) => "dry_run" in tool.inputSchema.shape,
).map((tool) => tool.name) as McpWriteToolName[];

export function isMcpWriteToolName(value: string): value is McpWriteToolName {
  return (MCP_WRITE_TOOL_NAMES as readonly string[]).includes(value);
}
