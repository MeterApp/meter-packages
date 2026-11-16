import * as z from "zod";
import { writeResultSchema } from "./settings.ts";
export const websitePageSummarySchema = z
  .strictObject({
    id: z.string().uuid().describe("Website page ID."),
    fleet_id: z.string().uuid().describe("Owning fleet ID."),
    name: z.string().describe("Complete public page title."),
    slug: z
      .string()
      .describe("Exact public URL segment below the fleet page path."),
    external_url: z
      .string()
      .nullable()
      .describe("External destination URL, or null for a Markdown page."),
    content_bytes: z
      .number()
      .int()
      .nonnegative()
      .describe("UTF-8 size of stored Markdown. List results omit its body."),
    created_at: z
      .string()
      .nullable()
      .describe("Creation timestamp, or null for legacy data."),
  })
  .meta({
    description:
      "Public website page metadata; no Markdown body or internal audit fields.",
  });
export const websitePagesSchema = z
  .strictObject({
    pages: z
      .array(websitePageSummarySchema)
      .describe("Page metadata ordered by immutable page ID."),
    next_cursor: z
      .string()
      .nullable()
      .describe(
        "Opaque fleet-bound cursor, or null when no more pages remain.",
      ),
  })
  .meta({
    description:
      "Current administrator website-page listing; Markdown bodies are intentionally omitted.",
  });
export const websitePageSchema = z
  .strictObject({
    id: z.string().uuid().describe("Website page ID."),
    fleet_id: z.string().uuid().describe("Owning fleet ID."),
    name: z.string().describe("Complete public title."),
    slug: z.string().describe("Exact public URL segment."),
    content: z
      .string()
      .nullable()
      .describe(
        "Complete public Markdown content, or null; never silently truncated.",
      ),
    external_url: z
      .string()
      .nullable()
      .describe("External destination, or null for a Markdown page."),
    created_at: z
      .string()
      .nullable()
      .describe("Creation timestamp, or null for legacy data."),
    deleted: z
      .boolean()
      .describe(
        "True only for the committed deletion result; the other fields describe the removed page.",
      ),
  })
  .meta({
    description:
      "Complete stored page returned by a scoped read or confirmed write, including an explicit committed deletion state.",
  });
export const websitePageWriteSchema = writeResultSchema(
  "page",
  websitePageSchema.nullable(),
  "WebsitePageWrite",
);
