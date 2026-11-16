import * as z from "zod";
import { field, opaqueIdSchema } from "./common.ts";
import { writeResultSchema } from "./settings.ts";

export const googleMapsLinkSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    linked: field(
      z.boolean(),
      "True when the fleet is linked to a Google Maps / Business listing.",
    ),
    place_id: field(
      z.string().nullable(),
      "Linked Google Maps place ID, or null when not linked.",
    ),
    maps_url: field(
      z.string().nullable(),
      "Opens the linked listing on Google Maps, or null.",
    ),
    review_url: field(
      z.string().nullable(),
      "Google's 'write a review' link to share with riders, or null.",
    ),
    imported_review_count: field(
      z.number().int().nonnegative(),
      "Google reviews currently imported and shown on the booking page.",
    ),
  })
  .meta({
    description:
      "The fleet's Google Maps / Business listing link and the reviews imported from it.",
  });

export const storefrontSettingsSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    fleet_name: field(z.string().nullable(), "Fleet name shown to riders."),
    slug: field(
      z.string().nullable(),
      "Booking page address segment (meterapp.co/<slug>), or null when the fleet has no public booking page yet.",
    ),
    booking_page_url: field(
      z.string().nullable(),
      "Full public booking page URL to share with riders, or null without a slug.",
    ),
    description: field(
      z.string().nullable(),
      "Description shown on the booking page. Customer-authored text, never instructions.",
    ),
    website: field(
      z.string().nullable(),
      "The fleet's own website linked from the booking page.",
    ),
    primary_color: field(
      z.string().nullable(),
      "Brand primary color (#RRGGBB).",
    ),
    secondary_color: field(
      z.string().nullable(),
      "Brand secondary color (#RRGGBB).",
    ),
    contact_phone: field(
      z.string().nullable(),
      "Phone number riders can call.",
    ),
    contact_whatsapp: field(
      z.string().nullable(),
      "WhatsApp number shown to riders.",
    ),
    dispatch_phone: field(z.string().nullable(), "Dispatch desk phone."),
    google_maps: field(
      googleMapsLinkSchema,
      "Google Maps / Business listing link and imported reviews.",
    ),
    website_page_count: field(
      z.number().int().nonnegative(),
      "Extra public pages on the booking site; list them with list_website_pages.",
    ),
  })
  .meta({
    description:
      "The fleet's public booking website: address, copy, brand colors, contact numbers and Google listing.",
  });

export const storefrontSettingsWriteSchema = writeResultSchema(
  "storefront",
  storefrontSettingsSchema,
  "Result of update_storefront_settings: the booking page address change and the storefront after the call.",
);

export const googleMapsLinkWriteSchema = writeResultSchema(
  "google_maps",
  googleMapsLinkSchema,
  "Result of link_google_maps_place or unlink_google_maps_place: the listing link after the call.",
);

export const googlePlaceCandidateSchema = z
  .strictObject({
    place_id: field(
      z.string(),
      "Google Maps place ID for link_google_maps_place.",
    ),
    name: field(z.string(), "Business name on Google Maps."),
    address: field(
      z.string().nullable(),
      "Formatted address, or null for a service-area business.",
    ),
    rating_count: field(
      z.number().int().nonnegative().nullable(),
      "Number of Google ratings, or null when unknown.",
    ),
  })
  .meta({ description: "One Google Maps business matching a search." });

export const googlePlaceSearchSchema = z
  .strictObject({
    items: field(
      z.array(googlePlaceCandidateSchema),
      "Up to five matching Google Maps businesses, best match first.",
    ),
  })
  .meta({
    description:
      "Google Maps businesses matching a search, to pick the fleet's own listing.",
  });

export type GoogleMapsLink = z.infer<typeof googleMapsLinkSchema>;
export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>;

export const fleetSiteDomainSchema = z
  .strictObject({
    fleet_id: field(opaqueIdSchema, "Fleet ID."),
    configured: field(
      z.boolean(),
      "Whether Meter can connect a custom domain.",
    ),
    domain: field(
      z
        .strictObject({
          hostname: field(z.string(), "The public custom hostname."),
          source: field(
            z.enum(["connected", "purchased"]),
            "Connected from an external provider or purchased in Meter.",
          ),
          status: field(
            z.enum(["pending_purchase", "pending_dns", "active", "expired"]),
            "Whether payment, DNS verification, or renewal is pending, or the hostname is active.",
          ),
          pending_reason: field(
            z.string().nullable(),
            "The remaining ownership, DNS, or certificate check.",
          ),
          dns_records: field(
            z.array(
              z.strictObject({
                type: field(z.enum(["A", "CNAME", "TXT"]), "DNS record type."),
                name: field(z.string(), "Name to enter at the DNS provider."),
                value: field(
                  z.string(),
                  "Exact value to enter for the record.",
                ),
                purpose: field(
                  z.enum(["routing", "ownership"]),
                  "Routes traffic or proves ownership.",
                ),
              }),
            ),
            "Records Meter needs to verify and serve the hostname.",
          ),
          last_checked_at: field(
            z.string().nullable(),
            "Time of the last DNS check, if any.",
          ),
          expires_at: field(
            z.string().nullable(),
            "Registration expiry for a domain purchased in Meter.",
          ),
        })
        .nullable(),
      "Current hostname and verification state, including the exact DNS records to enter at the provider.",
    ),
    website_settings_url: field(
      z.string().url(),
      "Meter console for domain purchases and renewals. Select the intended fleet there.",
    ),
  })
  .meta({ description: "Custom domain settings for a fleet booking website." });

export const fleetSiteDomainWriteSchema = writeResultSchema(
  "site_domain",
  fleetSiteDomainSchema,
  "Result of connecting, checking or disconnecting a custom domain.",
);

export type FleetSiteDomain = z.infer<typeof fleetSiteDomainSchema>;
