/**
 * Contract tests for `@meterapp/meter-sdk`: the tool catalog is agent-ready
 * and the generated field docs cover every DTO field.
 */
import { describe, expect, it } from 'vitest';

import {
  describeSchema,
  DTO_DOCS,
  DTO_SCHEMAS,
  explainToolData,
  formatApiReference,
  isMcpWriteToolName,
  MCP_INSTRUCTIONS,
  MCP_SERVER_INFO,
  MCP_TOOL_LIST,
  MCP_TOOL_NAMES,
  MCP_TOOL_SCHEMAS,
  MCP_WRITE_TOOL_NAMES,
  SDK_VERSION,
  toolSurfaces,
  type McpWriteToolName
} from './index.ts';

describe('MCP tool catalog', () => {
  it('keeps empty read inputs outside the static proposal write union', () => {
    const readExcluded: 'whoami' extends McpWriteToolName ? never : true = true;
    const profileIncluded: 'update_my_profile' extends McpWriteToolName
      ? true
      : never = true;
    expect(readExcluded && profileIncluded).toBe(true);
    expect(isMcpWriteToolName('whoami')).toBe(false);
  });

  it('has a unique name, agent-facing description and honest annotations for every tool', () => {
    expect(MCP_SERVER_INFO.name).toBe('meter');
    expect(MCP_SERVER_INFO.version).toBe(SDK_VERSION);
    expect(MCP_INSTRUCTIONS).toContain('whoami');
    expect(MCP_INSTRUCTIONS).toContain('dry_run');
    expect(MCP_INSTRUCTIONS).toContain('get_onboarding_checklist');
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_LIST.length);
    expect(MCP_WRITE_TOOL_NAMES).toEqual(
      MCP_TOOL_LIST.filter((tool) => isMcpWriteToolName(tool.name)).map(
        (tool) => tool.name
      )
    );
    for (const tool of MCP_TOOL_LIST) {
      expect(isMcpWriteToolName(tool.name), tool.name).toBe(
        'dry_run' in tool.inputSchema.shape
      );
      expect(isMcpWriteToolName(tool.name), tool.name).toBe(
        'proposal_id' in tool.inputSchema.shape
      );
      expect(tool.kind === 'write', tool.name).toBe(tool.risk !== 'none');
      expect(tool.access.personas.length, tool.name).toBeGreaterThan(0);
      expect(tool.title.trim(), tool.name).not.toBe('');
      expect(tool.description.length, tool.name).toBeGreaterThanOrEqual(120);
      expect(tool.annotations.readOnlyHint, tool.name).toBe(
        tool.kind !== 'write'
      );
      if (/^(delete|remove|cancel|revoke)_/.test(tool.name)) {
        expect(tool.annotations.destructiveHint, tool.name).toBe(true);
      }
      if (/^(create|add)_/.test(tool.name)) {
        expect(tool.annotations.idempotentHint, tool.name).toBe(false);
      }
      expect(typeof tool.annotations.openWorldHint, tool.name).toBe('boolean');
      if (isMcpWriteToolName(tool.name)) {
        // Every write tool previews with dry_run, names its Write DTO, and
        // refuses fields outside its allowlist.
        expect(
          tool.inputSchema.safeParse({ ...tool.example, dry_run: true })
            .success,
          `${tool.name} dry_run`
        ).toBe(true);
        expect(
          tool.inputSchema.safeParse({ ...tool.example, unknown_field: 1 })
            .success,
          `${tool.name} strict`
        ).toBe(false);
        expect(tool.returns, tool.name).toMatch(/Write$/);
        expect(tool.description, tool.name).toContain('dry_run');
      }
      expect(tool.inputSchema).toBe(MCP_TOOL_SCHEMAS[tool.name]);
      expect(
        tool.inputSchema.safeParse(tool.example).success,
        `${tool.name} example`
      ).toBe(true);
      if (tool.returns) {
        expect(
          tool.returns in DTO_SCHEMAS,
          `${tool.name} returns ${tool.returns}`
        ).toBe(true);
      }
    }
  });

  it('records the financial fields that require sensitive confirmation', () => {
    expect(
      Object.fromEntries(
        MCP_TOOL_LIST.filter((tool) => tool.kind === 'write').map((tool) => [
          tool.name,
          { risk: tool.risk, escalate: tool.escalate?.sensitive ?? [] }
        ])
      )
    ).toMatchInlineSnapshot(`
      {
        "accept_booking": {
          "escalate": [],
          "risk": "standard",
        },
        "add_fleet_driver": {
          "escalate": [],
          "risk": "standard",
        },
        "add_trip_discount": {
          "escalate": [],
          "risk": "sensitive",
        },
        "add_trip_fee": {
          "escalate": [],
          "risk": "sensitive",
        },
        "assign_booking": {
          "escalate": [],
          "risk": "standard",
        },
        "assign_vehicle": {
          "escalate": [],
          "risk": "standard",
        },
        "book_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "cancel_booking": {
          "escalate": [],
          "risk": "sensitive",
        },
        "change_booking_pickup_time": {
          "escalate": [],
          "risk": "standard",
        },
        "change_ride": {
          "escalate": [],
          "risk": "sensitive",
        },
        "check_fleet_site_domain": {
          "escalate": [],
          "risk": "sensitive",
        },
        "comment_on_feedback_item": {
          "escalate": [],
          "risk": "low",
        },
        "complete_booking": {
          "escalate": [],
          "risk": "sensitive",
        },
        "connect_fleet_site_domain": {
          "escalate": [],
          "risk": "sensitive",
        },
        "create_booking": {
          "escalate": [],
          "risk": "standard",
        },
        "create_customer": {
          "escalate": [],
          "risk": "standard",
        },
        "create_fare": {
          "escalate": [],
          "risk": "sensitive",
        },
        "create_invoice": {
          "escalate": [],
          "risk": "sensitive",
        },
        "create_known_location": {
          "escalate": [],
          "risk": "standard",
        },
        "create_promo_code": {
          "escalate": [],
          "risk": "sensitive",
        },
        "create_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "create_reconciliation_assessments": {
          "escalate": [],
          "risk": "sensitive",
        },
        "create_ride_option": {
          "escalate": [],
          "risk": "standard",
        },
        "create_vehicle": {
          "escalate": [],
          "risk": "standard",
        },
        "create_website_page": {
          "escalate": [],
          "risk": "standard",
        },
        "delete_fare": {
          "escalate": [],
          "risk": "sensitive",
        },
        "delete_known_location": {
          "escalate": [],
          "risk": "standard",
        },
        "delete_ride_option": {
          "escalate": [],
          "risk": "sensitive",
        },
        "delete_service_zone": {
          "escalate": [],
          "risk": "standard",
        },
        "delete_website_page": {
          "escalate": [],
          "risk": "standard",
        },
        "disable_promo_code": {
          "escalate": [],
          "risk": "sensitive",
        },
        "disconnect_fleet_site_domain": {
          "escalate": [],
          "risk": "sensitive",
        },
        "email_promo_code": {
          "escalate": [],
          "risk": "sensitive",
        },
        "extend_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "follow_feedback_item": {
          "escalate": [],
          "risk": "low",
        },
        "follow_up_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "import_customers": {
          "escalate": [],
          "risk": "standard",
        },
        "import_official_rate": {
          "escalate": [],
          "risk": "standard",
        },
        "link_google_maps_place": {
          "escalate": [],
          "risk": "standard",
        },
        "manage_reconciliation_assessment": {
          "escalate": [],
          "risk": "sensitive",
        },
        "manage_reconciliation_policy": {
          "escalate": [],
          "risk": "sensitive",
        },
        "mark_trip_cash_paid": {
          "escalate": [],
          "risk": "sensitive",
        },
        "price_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "rate_ride": {
          "escalate": [],
          "risk": "low",
        },
        "record_booking_progress": {
          "escalate": [],
          "risk": "standard",
        },
        "remove_booking_block": {
          "escalate": [],
          "risk": "standard",
        },
        "remove_fleet_member": {
          "escalate": [],
          "risk": "sensitive",
        },
        "remove_trip_discount": {
          "escalate": [],
          "risk": "sensitive",
        },
        "remove_trip_fee": {
          "escalate": [],
          "risk": "sensitive",
        },
        "remove_vehicle": {
          "escalate": [],
          "risk": "standard",
        },
        "report_booking_no_show": {
          "escalate": [],
          "risk": "sensitive",
        },
        "report_ride_issue": {
          "escalate": [],
          "risk": "low",
        },
        "request_quote": {
          "escalate": [],
          "risk": "low",
        },
        "request_ride": {
          "escalate": [],
          "risk": "sensitive",
        },
        "request_trip_void": {
          "escalate": [],
          "risk": "standard",
        },
        "respond_to_dispatch_offer": {
          "escalate": [],
          "risk": "standard",
        },
        "respond_to_quote": {
          "escalate": [],
          "risk": "sensitive",
        },
        "review_member_document": {
          "escalate": [],
          "risk": "standard",
        },
        "review_trip_void": {
          "escalate": [],
          "risk": "sensitive",
        },
        "rotate_join_code": {
          "escalate": [],
          "risk": "sensitive",
        },
        "run_write_tool": {
          "escalate": [],
          "risk": "sensitive",
        },
        "save_booking_block": {
          "escalate": [],
          "risk": "standard",
        },
        "save_service_zone": {
          "escalate": [],
          "risk": "standard",
        },
        "send_payment_reminder": {
          "escalate": [],
          "risk": "standard",
        },
        "send_quote": {
          "escalate": [],
          "risk": "standard",
        },
        "set_member_online_state": {
          "escalate": [],
          "risk": "standard",
        },
        "set_zone_fare": {
          "escalate": [],
          "risk": "sensitive",
        },
        "set_zone_fares": {
          "escalate": [],
          "risk": "sensitive",
        },
        "submit_feedback": {
          "escalate": [],
          "risk": "low",
        },
        "unassign_booking": {
          "escalate": [],
          "risk": "standard",
        },
        "unlink_google_maps_place": {
          "escalate": [],
          "risk": "standard",
        },
        "update_booking": {
          "escalate": [],
          "risk": "standard",
        },
        "update_booking_settings": {
          "escalate": [
            "payment_mode",
            "cancellation_fee_fraction",
            "cancellation_fee_minimum_unit_amount",
            "driver_cancellation_fee_mode",
          ],
          "risk": "standard",
        },
        "update_customer": {
          "escalate": [],
          "risk": "standard",
        },
        "update_dynamic_pricing": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_fare": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_fee_settings": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_fleet_finances": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_fleet_member": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_fleet_settings": {
          "escalate": [
            "currency_iso_code",
            "allow_fleet_custom_fares",
          ],
          "risk": "standard",
        },
        "update_known_location": {
          "escalate": [],
          "risk": "standard",
        },
        "update_member_name": {
          "escalate": [],
          "risk": "standard",
        },
        "update_my_availability": {
          "escalate": [],
          "risk": "low",
        },
        "update_my_booking_settings": {
          "escalate": [
            "payment_mode",
            "booking_fare_id",
            "time_booking_fare_id",
            "cancellation_fee_fraction",
            "cancellation_fee_minimum_unit_amount",
          ],
          "risk": "standard",
        },
        "update_my_driver_site": {
          "escalate": [
            "slug",
            "show_phone",
          ],
          "risk": "standard",
        },
        "update_my_notification_preference": {
          "escalate": [],
          "risk": "standard",
        },
        "update_my_profile": {
          "escalate": [
            "pass_credit_card_fees_to_customer",
          ],
          "risk": "low",
        },
        "update_notification_webhook": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_privacy_settings": {
          "escalate": [
            "driver_requests_visibility",
          ],
          "risk": "standard",
        },
        "update_promo_code": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_ride_details": {
          "escalate": [],
          "risk": "low",
        },
        "update_ride_option": {
          "escalate": [
            "fare.*",
          ],
          "risk": "standard",
        },
        "update_storefront_settings": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_trip_note": {
          "escalate": [],
          "risk": "low",
        },
        "update_vehicle": {
          "escalate": [],
          "risk": "standard",
        },
        "update_voice_agent_settings": {
          "escalate": [],
          "risk": "sensitive",
        },
        "update_website_page": {
          "escalate": [],
          "risk": "standard",
        },
        "void_invoice": {
          "escalate": [],
          "risk": "sensitive",
        },
        "vote_on_idea": {
          "escalate": [],
          "risk": "low",
        },
        "withdraw_quote": {
          "escalate": [],
          "risk": "standard",
        },
      }
    `);
  });

  it('never accepts credential or card data in input fields', () => {
    for (const tool of MCP_TOOL_LIST) {
      for (const field of describeSchema(tool.inputSchema)) {
        if (/password|secret|token|card|cvv|ssn|tax_id/i.test(field.path)) {
          // Boolean policy switches cannot carry credential or card values.
          // The card-fee pass-through setting is a supported billing policy.
          expect(field.type, `${tool.name}.${field.path}`).toBe('boolean');
        }
      }
    }
  });

  it('describe_api renders the whole catalog and one tool', () => {
    const all = formatApiReference();
    // The full reference lists what a server serves; first-party tools are
    // described by name only.
    for (const tool of MCP_TOOL_LIST.filter(
      (tool) => tool.surfaces?.length !== 0
    ))
      expect(all).toContain(`${tool.name} — ${tool.title}`);
    const one = formatApiReference('get_trip');
    expect(one).toContain(
      'personas: solo_driver, fleet_driver, fleet_admin, fleet_owner'
    );
    expect(one).toContain('Trip: A metered trip');
    expect(formatApiReference('nope')).toContain('Unknown tool "nope"');
  });
});

describe('rider and fleet MCP servers', () => {
  it('serves every tool on at least one server, and rider-only tools only to riders', () => {
    // First-party tools are a deliberate, named exception: Meter's own
    // assistant offers them and no MCP server lists them.
    expect(
      MCP_TOOL_LIST.filter((tool) => tool.surfaces?.length === 0)
        .map((tool) => tool.name)
        .sort()
    ).toEqual([
      'complete_booking',
      'report_booking_no_show',
      'request_quote',
      'review_trip_void'
    ]);
    for (const tool of MCP_TOOL_LIST) {
      const surfaces = toolSurfaces(tool);
      if (tool.surfaces?.length === 0) continue;
      expect(surfaces.length, tool.name).toBeGreaterThan(0);
      if (tool.access.personas.every((persona) => persona === 'rider'))
        expect(surfaces, tool.name).toEqual(['rider']);
      if (!tool.access.personas.includes('rider'))
        expect(surfaces, tool.name).toEqual(['fleet']);
    }
    const riderTools = MCP_TOOL_LIST.filter((tool) =>
      toolSurfaces(tool).includes('rider')
    ).map((tool) => tool.name);
    expect(riderTools).toEqual(
      expect.arrayContaining(['find_fleets', 'request_ride', 'whoami'])
    );
    expect(riderTools).not.toContain('update_fleet_settings');
  });

});

describe('DTO field docs', () => {
  it('cover every field of every DTO with a description', () => {
    for (const [name, schema] of Object.entries(DTO_SCHEMAS)) {
      const fields = describeSchema(schema);
      expect(fields.length, name).toBeGreaterThan(0);
      for (const fieldDoc of fields) {
        expect(
          fieldDoc.description.trim().length,
          `${name}.${fieldDoc.path}`
        ).toBeGreaterThan(0);
      }
      expect(DTO_DOCS[name as keyof typeof DTO_DOCS].fields).toEqual(fields);
    }
  });

  it('explain_data resolves a field by name inside a paginated result', () => {
    const explained = explainToolData('list_trips', 'total_minor');
    expect(explained?.dto).toBe('TripPage');
    expect(explained?.fields.map((fieldDoc) => fieldDoc.path)).toEqual([
      'items[].total_minor'
    ]);
    expect(explained?.fields[0]?.unit).toBe('minor currency units');

    const status = explainToolData('list_bookings', 'status');
    expect(status?.fields[0]?.enum).toEqual([
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'canceled',
      'pending_payment'
    ]);

    const role = explainToolData('list_fleet_members', 'email');
    expect(role?.fields[0]?.roles).toEqual(['owner', 'admin']);

    const change = explainToolData('update_fleet_settings', 'changes');
    expect(change?.dto).toBe('FleetSettingsWrite');
    expect(change?.fields.map((fieldDoc) => fieldDoc.path)).toEqual([
      'changes'
    ]);
    const nested = explainToolData('update_ride_option', 'fare.base');
    expect(nested?.fields.map((fieldDoc) => fieldDoc.path)).toEqual([
      'ride_option.fare.base'
    ]);
    const item = explainToolData('get_onboarding_checklist', 'key');
    expect(item?.fields[0]?.enum).toContain('payouts_connected');

    expect(explainToolData('describe_api')?.dto).toBeNull();
    expect(explainToolData('nope')).toBeNull();
  });
});
