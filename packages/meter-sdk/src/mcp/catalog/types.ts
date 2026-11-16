/** Shared metadata for MCP, CLI and in-process agent consumers. */
export const MCP_DOMAINS = [
  'meta',
  'account',
  'billing',
  'meter_pay',
  'fleet',
  'members',
  'vehicles',
  'fares',
  'bookings',
  'quotes',
  'trips',
  'customers',
  'accounting',
  'insights',
  'storefront',
  'help',
  'feedback',
] as const;
export type McpDomain = (typeof MCP_DOMAINS)[number];
export type McpToolKind = 'read' | 'write' | 'handoff';
export type McpRisk = 'none' | 'low' | 'standard' | 'sensitive';
export type McpPersona =
  'solo_driver' | 'fleet_driver' | 'fleet_admin' | 'fleet_owner' | 'rider';
export interface McpToolAccess {
  personas: readonly McpPersona[];
  /** The requested record determines access; persona visibility never replaces authorization. */
  recordScoped?: boolean;
  requiresOperationalFleet: boolean;
  /** Discovery hint only. Domain functions enforce subscriptions. */
  plan?: 'pro' | 'fleet';
}
