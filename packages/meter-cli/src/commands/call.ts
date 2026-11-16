import type { McpToolDescriptor } from '@meterapp/meter-sdk/client';
import { MCP_TOOL_NAMES, type McpSurface } from '@meterapp/meter-sdk/mcp';
import { flagString } from '../args.ts';
import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { paint, printJson } from '../output.ts';
import { parseToolResult, renderToolResult } from '../render.ts';
import {
  buildToolArgs,
  catalogToolSpecs,
  describeField,
  findCatalogTool,
  remoteToolSpec,
  type ToolSpec
} from '../tools.ts';

/** Resolves a tool from the SDK catalog, else from the remote server's tools/list. */
export async function resolveTool(
  ctx: CommandContext,
  name: string
): Promise<ToolSpec> {
  const local = findCatalogTool(name);
  if (local) return local;
  let remoteTools: McpToolDescriptor[] = [];
  try {
    const client = await ctx.clientContext.client();
    remoteTools = await client.listTools();
  } catch {
    remoteTools = [];
  }
  const remote = remoteTools.find((tool) => tool.name === name);
  if (remote) return remoteToolSpec(remote);
  const names = [
    ...new Set([...MCP_TOOL_NAMES, ...remoteTools.map((tool) => tool.name)])
  ];
  throw new CliError(
    `Unknown tool "${name}".`,
    2,
    `Available tools: ${names.join(', ')}. Run \`meter describe\` for details.`
  );
}

/** Calls one tool and prints the result; returns the exit code. */
export async function runTool(
  ctx: CommandContext,
  tool: ToolSpec,
  positionalFields: Record<string, string> = {}
): Promise<number> {
  const { io } = ctx;
  const args = buildToolArgs(tool, ctx.args.flags, {
    jsonArgs: flagString(ctx.args.flags, 'args'),
    dryRun: ctx.args.flags['dry-run'] === true,
    positionalFields
  });
  const client = await ctx.clientContext.client();
  const result = await client.callTool(tool.name, args);
  const parsed = parseToolResult(result);
  if (io.json) {
    printJson(
      io,
      parsed.data ?? { content: result.content, isError: parsed.isError }
    );
    return parsed.isError ? 1 : 0;
  }
  if (parsed.isError) {
    const message =
      typeof parsed.data?.['error'] === 'string'
        ? parsed.data['error']
        : parsed.text || 'The tool returned an error.';
    const code =
      typeof parsed.data?.['code'] === 'string'
        ? ` [${parsed.data['code']}]`
        : '';
    io.stderr(`${paint(io, 'red', '✗')} ${tool.name}${code}: ${message}\n`);
    if (parsed.nextSteps)
      io.stderr(`  ${paint(io, 'yellow', '→')} ${parsed.nextSteps}\n`);
    return 1;
  }
  io.stdout(`${renderToolResult(parsed, io)}\n`);
  return 0;
}

export const callCommand: CommandDefinition = {
  name: 'call',
  summary:
    'Call any MCP tool by name: meter call <tool> --<field> <value> … (every current and future tool)',
  usage:
    "meter call <tool> [--<field> <value> …] [--args '<json>'] [--dry-run] [--json]\n  Flags map to the tool's arguments (snake_case or kebab-case) and are coerced from its schema.\n  --args merges a JSON object first; --dry-run sets dry_run: true when the tool supports it.\n  e.g. meter call list_trips --driver all --start-date 2026-09-01 --limit 25",
  async run(ctx: CommandContext): Promise<number> {
    const name = ctx.args.positionals[0];
    if (!name) {
      const lines = catalogToolSpecs().map(
        (tool) => `  ${tool.name.padEnd(24)} ${tool.title}`
      );
      ctx.io.stdout(
        `Usage: meter call <tool> [--<field> <value> …]\n\nTools:\n${lines.join('\n')}\n\nRun \`meter describe <tool>\` for arguments.\n`
      );
      return 2;
    }
    const tool = await resolveTool(ctx, name);
    if (ctx.args.flags['help'] === true) {
      ctx.io.stdout(`${toolUsage(tool)}\n`);
      return 0;
    }
    return runTool(ctx, tool);
  }
};

export function toolUsage(tool: ToolSpec): string {
  const fields = tool.fields.length
    ? tool.fields.map((field) => `  ${describeField(field)}`).join('\n')
    : '  (no arguments)';
  return `meter call ${tool.name} — ${tool.title}\n\n${tool.description}\n\nOptions:\n${fields}`;
}

interface AliasSpec {
  tool: string;
  /** Field filled by the first positional argument, e.g. `meter trips get <trip_id>`. */
  positional?: string;
}

interface AliasGroup {
  summary: string;
  subcommands: Record<string, AliasSpec>;
  /** Tool used when no subcommand is given. */
  defaultSubcommand?: string;
  /** The MCP server the group talks to unless `--app` or `METER_APP` says otherwise. */
  app?: McpSurface;
}

/** Ergonomic aliases over the generic tool surface. Every alias is just `meter call <tool>`. */
export const ALIASES: Record<string, AliasGroup> = {
  ideas: {
    summary:
      'ideas list · ideas search --title <text> · ideas get <id> · ideas vote <id> --voted true|false --dry-run',
    subcommands: {
      list: { tool: 'list_ideas' },
      search: { tool: 'find_similar_ideas' },
      get: { tool: 'get_feedback_item', positional: 'item_id' },
      vote: { tool: 'vote_on_idea', positional: 'item_id' }
    },
    defaultSubcommand: 'list'
  },
  feedback: {
    summary:
      'feedback submit · feedback list · feedback get <id> · feedback follow <id> · feedback comment <id> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      submit: { tool: 'submit_feedback' },
      list: { tool: 'list_my_feedback' },
      get: { tool: 'get_feedback_item', positional: 'item_id' },
      follow: { tool: 'follow_feedback_item', positional: 'item_id' },
      comment: { tool: 'comment_on_feedback_item', positional: 'item_id' }
    },
    defaultSubcommand: 'list'
  },
  changelog: {
    summary: 'changelog [--cursor <cursor>] [--limit <count>] · changelog list',
    subcommands: { list: { tool: 'list_changelog' } },
    defaultSubcommand: 'list'
  },
  fleets: {
    summary: 'fleets list · fleets get [<fleet_id>]',
    subcommands: {
      list: { tool: 'list_fleets' },
      get: { tool: 'get_fleet', positional: 'fleet_id' }
    },
    defaultSubcommand: 'list'
  },
  members: {
    summary:
      'members list [--role] · members add --first-name --email --phone · members invite-link · members rotate-code · members update <member_id> [--role] [--driver-payout-fraction] · members rename <member_id> --first-name · members remove <member_id> · members online <member_id> --online true|false · members events [<member_id>] · members docs [<member_id>] · members review-doc <member_id> --document-type --verified true|false (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_fleet_members' },
      add: { tool: 'add_fleet_driver' },
      'invite-link': { tool: 'get_join_link' },
      'rotate-code': { tool: 'rotate_join_code' },
      update: { tool: 'update_fleet_member', positional: 'member_id' },
      rename: { tool: 'update_member_name', positional: 'member_id' },
      remove: { tool: 'remove_fleet_member', positional: 'member_id' },
      online: { tool: 'set_member_online_state', positional: 'member_id' },
      events: { tool: 'get_membership_events', positional: 'member_id' },
      docs: { tool: 'list_member_documents', positional: 'member_id' },
      'review-doc': { tool: 'review_member_document', positional: 'member_id' }
    },
    defaultSubcommand: 'list'
  },
  vehicles: {
    summary:
      'vehicles list · vehicles add --year --make --model · vehicles update <vehicle_id> · vehicles remove <vehicle_id> · vehicles assign <vehicle_id> --member-id <id|none> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_vehicles' },
      add: { tool: 'create_vehicle' },
      update: { tool: 'update_vehicle', positional: 'vehicle_id' },
      remove: { tool: 'remove_vehicle', positional: 'vehicle_id' },
      assign: { tool: 'assign_vehicle', positional: 'vehicle_id' }
    },
    defaultSubcommand: 'list'
  },
  trips: {
    summary:
      'trips list [--driver me|all|<member_id>] [--start-date] [--end-date] · trips search [--sort] [--status] [--payment-method] [--min-total-minor] [--search …] · trips get <trip_id> · trips request-void <trip_id> --reason · trips review-void <trip_id> --decision approve|reject · trips note <trip_id> --internal-note · trips add-fee|remove-fee|add-discount|remove-discount|cash-paid <trip_id> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_trips' },
      search: { tool: 'search_trips' },
      get: { tool: 'get_trip', positional: 'trip_id' },
      'request-void': { tool: 'request_trip_void', positional: 'trip_id' },
      'review-void': { tool: 'review_trip_void', positional: 'trip_id' },
      note: { tool: 'update_trip_note', positional: 'trip_id' },
      'add-fee': { tool: 'add_trip_fee', positional: 'trip_id' },
      'remove-fee': { tool: 'remove_trip_fee', positional: 'trip_id' },
      'add-discount': { tool: 'add_trip_discount', positional: 'trip_id' },
      'remove-discount': { tool: 'remove_trip_discount', positional: 'trip_id' },
      'cash-paid': { tool: 'mark_trip_cash_paid', positional: 'trip_id' }
    },
    defaultSubcommand: 'list'
  },
  bookings: {
    summary:
      'bookings list [--status …] [--after] [--before] · bookings get <id> · bookings audit <id> · bookings create --pickup --dropoff --pickup-time [--rider-id|--customer] · bookings estimate --origin --destination · bookings assign <id> --driver-id · bookings unassign <id> · bookings cancel <id> · bookings remind <id> · bookings calendar · bookings settings [--dispatch-mode …] · bookings accept <id> · bookings progress <id> --step enroute_to_pickup|arrived_at_pickup|picked_up · bookings complete <id> · bookings no-show <id> · bookings reschedule <id> --scheduled-time (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_bookings' },
      get: { tool: 'get_booking', positional: 'booking_id' },
      audit: { tool: 'get_booking_audit_log', positional: 'booking_id' },
      create: { tool: 'create_booking' },
      estimate: { tool: 'quote_booking' },
      assign: { tool: 'assign_booking', positional: 'booking_id' },
      unassign: { tool: 'unassign_booking', positional: 'booking_id' },
      update: { tool: 'update_booking', positional: 'booking_id' },
      cancel: { tool: 'cancel_booking', positional: 'booking_id' },
      remind: { tool: 'send_payment_reminder', positional: 'booking_id' },
      calendar: { tool: 'get_booking_calendar' },
      settings: { tool: 'update_booking_settings' },
      accept: { tool: 'accept_booking', positional: 'booking_id' },
      progress: { tool: 'record_booking_progress', positional: 'booking_id' },
      complete: { tool: 'complete_booking', positional: 'booking_id' },
      'no-show': { tool: 'report_booking_no_show', positional: 'booking_id' },
      reschedule: {
        tool: 'change_booking_pickup_time',
        positional: 'booking_id'
      }
    },
    defaultSubcommand: 'list'
  },
  quotes: {
    summary:
      'quotes list · quotes get <quote_id> · quotes create --origin --destination --start-timestamp · quotes price <quote_id> --total-unit-amount · quotes send <quote_id> · quotes extend <quote_id> --expires-at · quotes withdraw <quote_id> · quotes follow-up <quote_id> · quotes book <quote_id> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_quotes' },
      get: { tool: 'get_quote', positional: 'quote_id' },
      create: { tool: 'create_quote' },
      price: { tool: 'price_quote', positional: 'quote_id' },
      send: { tool: 'send_quote', positional: 'quote_id' },
      extend: { tool: 'extend_quote', positional: 'quote_id' },
      withdraw: { tool: 'withdraw_quote', positional: 'quote_id' },
      'follow-up': { tool: 'follow_up_quote', positional: 'quote_id' },
      book: { tool: 'book_quote', positional: 'quote_id' }
    },
    defaultSubcommand: 'list'
  },
  dispatch: {
    summary:
      'dispatch offers · dispatch respond <dispatch_id> --response accept|decline (preview with --dry-run, confirm with --proposal-id)',
    subcommands: {
      offers: { tool: 'list_dispatch_offers' },
      respond: { tool: 'respond_to_dispatch_offer', positional: 'dispatch_id' }
    },
    defaultSubcommand: 'offers'
  },
  customers: {
    summary:
      "customers list [--query] · customers get <rider_id> · customers add --phone [--first-name] · customers update <rider_id> --first-name · customers import --csv \"$(cat customers.csv)\" (preview writes with --dry-run, confirm with --proposal-id)",
    subcommands: {
      list: { tool: 'list_customers' },
      get: { tool: 'get_customer', positional: 'rider_id' },
      add: { tool: 'create_customer' },
      update: { tool: 'update_customer', positional: 'rider_id' },
      import: { tool: 'import_customers' }
    },
    defaultSubcommand: 'list'
  },
  rides: {
    summary:
      'rides fleets [--query] · rides places <query> · rides estimate --fleet-id --pickup --dropoff · rides request … [--dry-run] · rides status <booking_id> · rides list · rides cancel <booking_id> · rides change <booking_id> [--pickup-time] [--pickup] [--dropoff] · rides details <booking_id> [--notes] [--flight-number] · rides quote <quote_id> --decision accept|decline · rides rating-prompt · rides rate <booking_id> --rating 1-5 · rides report <booking_id> --category --description',
    subcommands: {
      list: { tool: 'list_bookings' },
      fleets: { tool: 'find_fleets' },
      places: { tool: 'search_places', positional: 'query' },
      estimate: { tool: 'estimate_ride' },
      request: { tool: 'request_ride' },
      status: { tool: 'get_ride_status', positional: 'booking_id' },
      cancel: { tool: 'cancel_booking', positional: 'booking_id' },
      change: { tool: 'change_ride', positional: 'booking_id' },
      details: { tool: 'update_ride_details', positional: 'booking_id' },
      quote: { tool: 'respond_to_quote', positional: 'quote_id' },
      'rating-prompt': { tool: 'get_rating_prompt' },
      rate: { tool: 'rate_ride', positional: 'booking_id' },
      report: { tool: 'report_ride_issue', positional: 'booking_id' }
    },
    defaultSubcommand: 'list',
    app: 'rider'
  },
  earnings: {
    summary:
      'earnings [--scope me|fleet] [--start-date] [--end-date] [--granularity day|week] [--include-members]',
    subcommands: { summary: { tool: 'get_earnings' } },
    defaultSubcommand: 'summary'
  },
  accounting: {
    summary:
      'accounting summary [--start-date] [--end-date] · accounting ledger [--driver] [--entry-type] · accounting balances · accounting driver [--driver me|<member_id>] · accounting settlements · accounting exceptions · accounting statements · accounting invoices · accounting taxes · accounting mileage (raw rows for audits; `meter export ledger` for a file)',
    subcommands: {
      summary: { tool: 'get_accounting_summary' },
      ledger: { tool: 'list_ledger_entries' },
      balances: { tool: 'list_driver_balances' },
      driver: { tool: 'get_driver_accounting' },
      settlements: { tool: 'list_settlements' },
      exceptions: { tool: 'list_accounting_exceptions' },
      statements: { tool: 'get_reconciliation_statements' },
      invoices: { tool: 'list_trip_invoices' },
      taxes: { tool: 'get_tax_summary' },
      mileage: { tool: 'get_mileage_report' }
    },
    defaultSubcommand: 'summary'
  },
  billing: {
    summary:
      'billing status · billing plans [--currency] · billing link <action> (subscribe_fleet, change_plan, cancel_subscription, update_payment_method, manage_subscription, meter_pay_setup …) · billing payments (Meter Pay / Stripe status)',
    subcommands: {
      status: { tool: 'get_subscription' },
      plans: { tool: 'list_plans' },
      link: { tool: 'get_action_link', positional: 'action' },
      payments: { tool: 'get_meter_pay_status' }
    },
    defaultSubcommand: 'status'
  },
  links: {
    summary:
      'links <action> [--target-id] — a Meter page for steps a person finishes in the browser (payments, subscriptions, uploads, email changes)',
    subcommands: { get: { tool: 'get_action_link', positional: 'action' } },
    defaultSubcommand: 'get'
  },
  fares: {
    summary:
      'fares list · fares get <fare_id> · fares create · fares update <fare_id> · fares delete <fare_id> · fares audit <fare_id> · fares ride-option <ride_option_id> · fares add-ride-option · fares remove-ride-option <ride_option_id> · fares official-rates [--city] · fares import-official <official_rate_id> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_fares' },
      get: { tool: 'get_fare', positional: 'fare_id' },
      create: { tool: 'create_fare' },
      update: { tool: 'update_fare', positional: 'fare_id' },
      delete: { tool: 'delete_fare', positional: 'fare_id' },
      audit: { tool: 'get_fare_audit_log', positional: 'fare_id' },
      'ride-option': { tool: 'update_ride_option', positional: 'ride_option_id' },
      'add-ride-option': { tool: 'create_ride_option' },
      'remove-ride-option': {
        tool: 'delete_ride_option',
        positional: 'ride_option_id'
      },
      'official-rates': { tool: 'list_official_rates' },
      'import-official': {
        tool: 'import_official_rate',
        positional: 'official_rate_id'
      }
    },
    defaultSubcommand: 'list'
  },
  zones: {
    summary:
      "zones list · zones fares · zones set-fares --args '{\"pairs\":[…]}' · zones set-fare --start-zone-id --end-zone-id · zones find <description> · zones save --boundary-id --name (preview writes with --dry-run, confirm with --proposal-id)",
    subcommands: {
      list: { tool: 'list_service_zones' },
      fares: { tool: 'list_zone_fares' },
      'set-fares': { tool: 'set_zone_fares' },
      'set-fare': { tool: 'set_zone_fare' },
      find: { tool: 'find_zone_boundary', positional: 'description' },
      save: { tool: 'save_service_zone' }
    },
    defaultSubcommand: 'list'
  },
  promos: {
    summary:
      'promos list · promos create --code --discount-type · promos update <promo_code_id> · promos disable <promo_code_id> · promos email <promo_code_id> (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      list: { tool: 'list_promo_codes' },
      create: { tool: 'create_promo_code' },
      update: { tool: 'update_promo_code', positional: 'promo_code_id' },
      disable: { tool: 'disable_promo_code', positional: 'promo_code_id' },
      email: { tool: 'email_promo_code', positional: 'promo_code_id' }
    },
    defaultSubcommand: 'list'
  },
  pricing: {
    summary:
      "pricing dynamic · pricing set-dynamic --args '{\"policies\":[…]}' · pricing fees --allow-fleet-custom-fares · pricing finances [--default-driver-payout-fraction] [--tip-split-behavior] (preview writes with --dry-run, confirm with --proposal-id)",
    subcommands: {
      dynamic: { tool: 'get_dynamic_pricing' },
      'set-dynamic': { tool: 'update_dynamic_pricing' },
      fees: { tool: 'update_fee_settings' },
      finances: { tool: 'update_fleet_finances' }
    },
    defaultSubcommand: 'dynamic'
  },
  locations: {
    summary:
      'locations list · locations add --name --abbreviation --location · locations update <known_location_id> · locations remove <known_location_id> (airports, hotels and landmarks for flat fares)',
    subcommands: {
      list: { tool: 'list_known_locations' },
      add: { tool: 'create_known_location' },
      update: { tool: 'update_known_location', positional: 'known_location_id' },
      remove: { tool: 'delete_known_location', positional: 'known_location_id' }
    },
    defaultSubcommand: 'list'
  },
  storefront: {
    summary:
      'storefront get · storefront set --slug · storefront google-search <query> · storefront google-link <place_id> · storefront google-unlink · storefront pages · storefront privacy · storefront set-privacy · storefront voice-agent · storefront set-voice-agent --custom-instructions (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      get: { tool: 'get_storefront_settings' },
      set: { tool: 'update_storefront_settings' },
      'google-search': { tool: 'search_google_places', positional: 'query' },
      'google-link': { tool: 'link_google_maps_place', positional: 'place_id' },
      'google-unlink': { tool: 'unlink_google_maps_place' },
      pages: { tool: 'list_website_pages' },
      privacy: { tool: 'get_privacy_settings' },
      'set-privacy': { tool: 'update_privacy_settings' },
      'voice-agent': { tool: 'get_voice_agent_settings' },
      'set-voice-agent': { tool: 'update_voice_agent_settings' }
    },
    defaultSubcommand: 'get'
  },
  insights: {
    summary:
      'insights seo · insights marketing [--range] · insights drivers [--from] [--to] · insights reviews · insights metrics --metrics … (search, booking-site funnel, driver performance, reviews)',
    subcommands: {
      seo: { tool: 'get_seo_overview' },
      marketing: { tool: 'get_marketing_overview' },
      drivers: { tool: 'get_driver_performance' },
      reviews: { tool: 'list_reviews' },
      metrics: { tool: 'query_metrics' }
    },
    defaultSubcommand: 'seo'
  },
  settings: {
    summary:
      'settings fleet [--name] [--contact-phone] [--website] … · settings profile [--first-name] … · settings availability --args \'{…}\' · settings checklist · settings webhooks (preview writes with --dry-run, confirm with --proposal-id)',
    subcommands: {
      fleet: { tool: 'update_fleet_settings' },
      profile: { tool: 'update_my_profile' },
      availability: { tool: 'update_my_availability' },
      checklist: { tool: 'get_onboarding_checklist' },
      webhooks: { tool: 'list_notification_webhooks' }
    },
    defaultSubcommand: 'checklist'
  }
};

export function aliasCommands(): CommandDefinition[] {
  return Object.entries(ALIASES).map(([name, group]) => ({
    name,
    summary: group.summary,
    usage: Object.entries(group.subcommands)
      .map(
        ([sub, spec]) =>
          `meter ${name} ${sub}${spec.positional ? ` <${spec.positional}>` : ''} [--<field> <value> …]  (= meter call ${spec.tool})`
      )
      .join('\n'),
    async run(ctx: CommandContext): Promise<number> {
      const [first, ...rest] = ctx.args.positionals;
      let spec = first ? group.subcommands[first] : undefined;
      let positionals = rest;
      if (!spec) {
        const fallback = group.defaultSubcommand
          ? group.subcommands[group.defaultSubcommand]
          : undefined;
        if (first && (!fallback || !fallback.positional)) {
          throw new CliError(
            `Unknown subcommand "${first}" for meter ${name}.`,
            2,
            `Choose one of: ${Object.keys(group.subcommands).join(', ')}`
          );
        }
        spec = fallback;
        positionals = ctx.args.positionals;
      }
      if (!spec)
        throw new CliError(
          `meter ${name} needs a subcommand: ${Object.keys(group.subcommands).join(', ')}`,
          2
        );
      const tool = await resolveTool(ctx, spec.tool);
      if (ctx.args.flags['help'] === true) {
        ctx.io.stdout(`${toolUsage(tool)}\n`);
        return 0;
      }
      const positionalFields: Record<string, string> = {};
      if (positionals.length > (spec.positional ? 1 : 0))
        throw new CliError(
          `Unexpected argument "${positionals[spec.positional ? 1 : 0]}".`,
          2,
          `Run \`meter ${name} --help\`.`
        );
      if (spec.positional && positionals[0])
        positionalFields[spec.positional] = positionals[0];
      return runTool(ctx, tool, positionalFields);
    }
  }));
}
