import * as z from 'zod';
import {
  currencyCodeSchema,
  field,
  minorAmountSchema,
  opaqueIdSchema
} from './common.ts';

export const earningsTotalSchema = z
  .strictObject({
    currency: currencyCodeSchema,
    net_amount_minor: field(
      minorAmountSchema,
      'Net amount paid out (after platform fees) in this currency.'
    ),
    transfer_count: field(
      z.number().int(),
      'Number of payouts making up the amount.'
    )
  })
  .meta({ description: 'Earnings total for one currency.' });

export const earningsBucketSchema = earningsTotalSchema
  .extend({
    period: field(
      z.string(),
      'Bucket start as an ISO date (day granularity) or ISO week start (week granularity).'
    )
  })
  .meta({ description: 'Earnings in one time bucket for one currency.' });

export const earningsMemberSchema = z
  .strictObject({
    member_id: field(opaqueIdSchema, 'Opaque member id (profile id).'),
    display_name: field(z.string().nullable(), 'Member display name, or null.'),
    currency: currencyCodeSchema,
    net_amount_minor: field(
      minorAmountSchema,
      'Net amount paid out to this member in the period.'
    ),
    transfer_count: field(
      z.number().int(),
      'Number of payouts to this member in the period.'
    )
  })
  .meta({ description: 'Per-member breakdown. Fleet owners/admins only.' });

export const earningsSummarySchema = z
  .strictObject({
    scope: field(
      z.enum(['me', 'fleet']),
      '"me": your own payouts; "fleet": every payout to the fleet and its members.'
    ),
    fleet_id: field(
      z.string().nullable(),
      'Fleet id when scope is "fleet"; otherwise null.'
    ),
    start_date: field(z.string(), 'Inclusive period start (ISO 8601).'),
    end_date: field(z.string(), 'Exclusive period end (ISO 8601).'),
    granularity: field(z.enum(['day', 'week']), 'Bucket size of time_series.'),
    fallback_currency: field(
      z.string(),
      'Currency assumed for payouts without an explicit currency.'
    ),
    totals: field(
      z.array(earningsTotalSchema),
      'Totals per currency over the whole period.'
    ),
    time_series: field(
      z.array(earningsBucketSchema),
      'Per-bucket amounts, oldest first.'
    ),
    members: field(
      z.array(earningsMemberSchema).nullable(),
      'Per-member breakdown when scope is "fleet" and the caller is owner/admin; otherwise null.',
      { roles: ['owner', 'admin'] }
    )
  })
  .meta({
    description:
      'Result of get_earnings: Meter Pay payouts, not cash collected. Use get_accounting_summary for the full ledger.'
  });
export type EarningsSummary = z.infer<typeof earningsSummarySchema>;
