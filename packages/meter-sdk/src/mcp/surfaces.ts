/**
 * Meter serves two MCP servers from one catalog: Meter Rides for riders and
 * Meter for Drivers & Fleets for drivers and fleet staff. A tool belongs to a
 * surface through its personas, so the catalog stays the single source of
 * truth; tools every persona may use (whoami, feedback, booking reads) are on
 * both.
 */
import type { McpPersona } from "./catalog/types.ts";
import {
  MCP_FLEET_INSTRUCTIONS,
  MCP_RIDER_INSTRUCTIONS,
  MCP_SERVER_INFO,
} from "./catalog/meta.ts";
import { MCP_TOOL_LIST, type McpToolDefinition } from "./tools.ts";

export const MCP_SURFACE_NAMES = ["rider", "fleet"] as const;
export type McpSurface = (typeof MCP_SURFACE_NAMES)[number];

export interface McpSurfaceConfig {
  endpoint: McpSurface;
  path: `/api/${string}`;
  serverInfo: {
    name: string;
    title: string;
    version: string;
    websiteUrl: string;
  };
  description: string;
  instructions: string;
}

export const MCP_SURFACES: Record<McpSurface, McpSurfaceConfig> = {
  rider: {
    endpoint: "rider",
    path: "/api/mcp/rider",
    serverInfo: {
      ...MCP_SERVER_INFO,
      name: "meter-rides",
      title: "Meter Rides",
    },
    description:
      "Book taxi rides with Meter fleets: find fleets, price and request rides, track them, and manage your own bookings and quotes.",
    instructions: MCP_RIDER_INSTRUCTIONS,
  },
  fleet: {
    endpoint: "fleet",
    path: "/api/mcp/fleet",
    serverInfo: {
      ...MCP_SERVER_INFO,
      name: "meter-fleet",
      title: "Meter for Drivers & Fleets",
    },
    description:
      "Drive with Meter or run a Meter taxi fleet: trips, bookings, quotes, fares, drivers, vehicles, earnings, invoices and website.",
    instructions: MCP_FLEET_INSTRUCTIONS,
  },
};

export function isMcpSurface(value: unknown): value is McpSurface {
  return (MCP_SURFACE_NAMES as readonly unknown[]).includes(value);
}

/**
 * The personas a caller acts as on one endpoint. Anyone may book a ride, so
 * the rider server always acts as a rider; anyone may drive, so the fleet
 * server acts as a solo driver when the person has no fleet role.
 */
export function personasForEndpoint(
  personas: readonly McpPersona[],
  endpoint: McpSurface,
): McpPersona[] {
  if (endpoint === "rider") return ["rider"];
  const fleet = personas.filter((persona) => persona !== "rider");
  return fleet.length > 0 ? fleet : ["solo_driver"];
}

/** The surfaces a tool is served on: its own list, else from its personas. */
export function toolSurfaces(tool: McpToolDefinition): McpSurface[] {
  if (tool.surfaces) return [...tool.surfaces];
  const { personas } = tool.access;
  return MCP_SURFACE_NAMES.filter((surface) =>
    surface === "rider"
      ? personas.includes("rider")
      : personas.some((persona) => persona !== "rider"),
  );
}

export function isToolOnEndpoint(
  tool: McpToolDefinition,
  endpoint: McpSurface,
): boolean {
  return toolSurfaces(tool).includes(endpoint);
}

export function endpointToolList(endpoint: McpSurface): McpToolDefinition[] {
  return MCP_TOOL_LIST.filter((tool) => isToolOnEndpoint(tool, endpoint));
}
