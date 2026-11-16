/** Customer feedback contracts shared with REST and in-process tools. Private
 * attribution, diagnostics, automation evidence and staff notes are excluded. */
import { z } from "zod";
import { writeResultSchema } from "./settings.ts";
const authorSchema = z
  .object({
    display_name: z
      .string()
      .describe(
        "Privacy-filtered first name, or Meter team for staff; omitted when unavailable.",
      )
      .optional(),
    role: z.string().describe("Public role label, preserving future values."),
    is_viewer: z
      .boolean()
      .describe("Whether this author is the verified caller."),
  })
  .strict();
export const FeedbackAvailabilitySchema = z
  .object({
    platform: z.string().describe("Target platform, preserving future values."),
    state: z
      .string()
      .describe("Availability or attachment state, preserving future values."),
    fixed_in_version: z
      .string()
      .describe("Verified release version when supplied.")
      .optional(),
    available_at: z
      .string()
      .describe("Release availability timestamp when supplied.")
      .optional(),
  })
  .strict()
  .meta({ description: "Verified availability for one target platform." });
export const FeedbackAttachmentSchema = z
  .object({
    id: z.string().describe("Opaque identifier of this record."),
    status: z
      .string()
      .describe("Attachment processing status, preserving future values."),
    content_type: z.string().describe("Stored attachment media type."),
    width: z
      .number()
      .describe("Image width in pixels when available.")
      .optional(),
    height: z
      .number()
      .describe("Image height in pixels when available.")
      .optional(),
    download_url: z
      .string()
      .describe("Short-lived attachment URL authorized for this caller.")
      .optional(),
    download_url_expires_at: z
      .string()
      .describe("Expiry timestamp of the authorized attachment URL.")
      .optional(),
  })
  .strict()
  .meta({
    description:
      "Authorized attachment metadata and any short-lived download address.",
  });
export const FeedbackItemSchema = z
  .object({
    id: z.string().describe("Opaque identifier of this record."),
    reference: z.string().describe("Customer-facing feedback reference."),
    type: z.string().describe("Record kind, preserving future values."),
    slug: z
      .string()
      .describe("Public idea URL segment when supplied.")
      .optional(),
    url: z.string().describe("Public idea address when supplied.").optional(),
    title: z.string().describe("Complete customer-visible title."),
    body: z
      .string()
      .describe("Customer-visible text; null for a deleted comment."),
    visibility: z
      .object({
        scope: z
          .string()
          .describe(
            "Server-authorized text audience; public, fleet or reporter. Preserve future values. This never grants attachment or diagnostic access.",
          ),
        label: z
          .string()
          .describe("Localized explanation of who can read the text."),
      })
      .strict()
      .describe(
        "Text visibility only; private screenshots and diagnostics retain separate authorization.",
      )
      .optional(),
    language: z
      .string()
      .describe("Submitted language when supplied.")
      .optional(),
    moderation_state: z
      .string()
      .describe("Moderation state visible to this caller when supplied.")
      .optional(),
    category: z
      .object({
        key: z
          .string()
          .describe("Stable category or status id, preserving future values."),
        label: z.string().describe("Localized customer-facing label."),
      })
      .strict()
      .describe("Localized category of the feedback."),
    status: z
      .object({
        key: z
          .string()
          .describe("Stable category or status id, preserving future values."),
        label: z.string().describe("Localized customer-facing label."),
        changed_at: z
          .string()
          .describe("Timestamp when the current status was reached."),
      })
      .strict()
      .describe("Current customer-visible status and its change timestamp."),
    subject: z
      .object({
        type: z.string().describe("Record kind, preserving future values."),
        id: z.string().describe("Opaque identifier of this record.").optional(),
        label: z
          .string()
          .describe("Localized customer-facing label.")
          .optional(),
        occurred_at: z
          .string()
          .describe("Timestamp of the linked subject when supplied.")
          .optional(),
        deep_link: z
          .string()
          .describe("Authorized application link to the subject when supplied.")
          .optional(),
      })
      .strict()
      .describe("Private report subject, only when visible to the caller.")
      .optional(),
    author: authorSchema.describe("Privacy-filtered public author identity."),
    counts: z
      .object({
        votes: z.number().describe("Current vote count."),
        comments: z.number().describe("Current visible comment count."),
      })
      .strict()
      .describe("Current engagement counts."),
    viewer: z
      .object({
        has_voted: z
          .boolean()
          .describe("Whether the caller currently votes on this idea."),
        is_following: z
          .boolean()
          .describe("Whether the caller currently follows updates."),
        can_vote: z
          .boolean()
          .describe(
            "Whether the caller may vote under current access and moderation rules.",
          ),
        can_comment: z
          .boolean()
          .describe(
            "Whether the caller may comment under current access and moderation rules.",
          ),
        can_delete: z
          .boolean()
          .describe("Whether the caller may withdraw this item."),
      })
      .strict()
      .describe("Current caller interactions and permissions."),
    availability: z
      .array(FeedbackAvailabilitySchema)
      .describe("Verified per-platform availability."),
    merged_into: z
      .object({
        id: z.string().describe("Opaque identifier of this record."),
        slug: z
          .string()
          .describe("Public idea URL segment when supplied.")
          .optional(),
        title: z
          .string()
          .describe("Complete customer-visible title.")
          .optional(),
      })
      .strict()
      .describe("Visible canonical destination when this item was merged.")
      .optional(),
    device_details: z
      .object({
        platform: z
          .string()
          .describe("Target platform, preserving future values.")
          .optional(),
        app_version: z
          .string()
          .describe(
            "Submitted application version, visible only under feedback access rules.",
          )
          .optional(),
        os_version: z
          .string()
          .describe(
            "Submitted operating-system version, visible only under feedback access rules.",
          )
          .optional(),
        device_model: z
          .string()
          .describe(
            "Submitted device model, visible only under feedback access rules.",
          )
          .optional(),
      })
      .strict()
      .describe("Submitted device details, visible only to the report author.")
      .optional(),
    attachments: z
      .array(FeedbackAttachmentSchema)
      .describe("Attachments authorized for this caller."),
    created_at: z.string().describe("Creation timestamp."),
    updated_at: z.string().describe("Last update timestamp."),
  })
  .strict()
  .meta({
    description:
      "Customer-visible idea or private report, filtered by current access and moderation.",
  });
export const FeedbackCommentSchema = z
  .object({
    id: z.string().describe("Opaque identifier of this record."),
    body: z
      .string()
      .describe("Customer-visible text; null for a deleted comment.")
      .nullable(),
    author: authorSchema.describe("Privacy-filtered public author identity."),
    created_at: z.string().describe("Creation timestamp."),
    updated_at: z.string().describe("Last update timestamp."),
    edited_at: z
      .string()
      .describe("Comment edit timestamp when supplied.")
      .optional(),
    deleted_at: z
      .string()
      .describe("Comment deletion timestamp when supplied.")
      .optional(),
    attachments: z
      .array(FeedbackAttachmentSchema)
      .describe("Attachments authorized for this caller."),
  })
  .strict()
  .meta({
    description:
      "Customer-visible comment with privacy-filtered author and authorized attachments.",
  });
export const FeedbackStatusEventSchema = z
  .object({
    id: z.string().describe("Opaque identifier of this record."),
    type: z.string().describe("Record kind, preserving future values."),
    from_status: z
      .string()
      .describe("Previous status id when supplied.")
      .optional(),
    to_status: z.string().describe("New status id when supplied.").optional(),
    public_note: z
      .string()
      .describe("Customer-visible status note when supplied.")
      .optional(),
    platform: z
      .string()
      .describe("Target platform, preserving future values.")
      .optional(),
    created_at: z.string().describe("Creation timestamp."),
  })
  .strict()
  .meta({
    description:
      "Customer-visible feedback history event, without internal evidence or staff notes.",
  });
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;
export type FeedbackComment = z.infer<typeof FeedbackCommentSchema>;
export type FeedbackStatusEvent = z.infer<typeof FeedbackStatusEventSchema>;
export type FeedbackAvailability = z.infer<typeof FeedbackAvailabilitySchema>;
export type FeedbackAttachment = z.infer<typeof FeedbackAttachmentSchema>;

export const FeedbackCategoriesSchema = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          key: z.string().describe("Stable submission category id."),
          label: z.string().describe("Localized category label."),
        }),
      )
      .describe("Available report and idea categories."),
  })
  .describe("Categories accepted by the feedback service.");
export const FeedbackItemPageSchema = z
  .strictObject({
    items: z
      .array(FeedbackItemSchema)
      .describe("Feedback records visible to the caller."),
    next_cursor: z
      .string()
      .nullable()
      .describe("Opaque continuation cursor, or null at the end."),
  })
  .describe("A bounded page of customer-visible feedback.");
export const FeedbackSimilarIdeasSchema = z
  .strictObject({
    items: z
      .array(FeedbackItemSchema)
      .max(5)
      .describe("Up to five visible public ideas matching the supplied text."),
  })
  .describe("Public duplicate suggestions; private reports are excluded.");
export const FeedbackDetailSchema = z
  .strictObject({
    item: FeedbackItemSchema.describe(
      "Feedback record authorized for the caller.",
    ),
    comments: z
      .array(FeedbackCommentSchema)
      .describe(
        "Visible comments under the customer API's bounded history rules.",
      ),
    status_events: z
      .array(FeedbackStatusEventSchema)
      .describe("Customer-visible status history without staff evidence."),
  })
  .describe("Authorized feedback detail with comments and status history.");
export const FeedbackChangelogEntrySchema = z
  .strictObject({
    id: z.uuid().describe("Published changelog entry identifier."),
    slug: z.string().describe("Public changelog address segment."),
    title: z.string().describe("Complete public release title."),
    body: z.string().describe("Complete public release description."),
    platforms: z
      .array(z.string().describe("Target platform, preserving future values."))
      .describe("Platforms covered by this release."),
    published_at: z.iso
      .datetime({ offset: true })
      .describe("Actual publication timestamp."),
  })
  .describe(
    "Published release notes without author identities or private feedback links.",
  );
export const FeedbackChangelogPageSchema = z
  .strictObject({
    entries: z
      .array(FeedbackChangelogEntrySchema)
      .describe("Published release notes, newest first."),
    next_cursor: z
      .string()
      .nullable()
      .describe("Opaque public continuation cursor, or null at the end."),
  })
  .describe("A bounded page of actually published release notes.");

export const FeedbackVoteSchema = z
  .strictObject({
    item_id: z.uuid().describe("Public idea identifier."),
    voted: z.boolean().describe("The caller's committed vote state."),
    vote_count: z
      .number()
      .int()
      .nonnegative()
      .describe("Total votes at commit."),
    is_following: z
      .boolean()
      .describe("The caller's following state at commit."),
  })
  .describe(
    "Committed vote and following state for an authorized public idea.",
  );
export const FeedbackFollowSchema = z
  .strictObject({
    item_id: z.uuid().describe("Authorized feedback identifier."),
    following: z.boolean().describe("The caller's committed following state."),
  })
  .describe("Committed following state for an authorized feedback item.");
export const FeedbackSubmissionWriteSchema = writeResultSchema(
  "item",
  FeedbackItemSchema.nullable(),
  "FeedbackSubmissionWrite",
);
export const FeedbackVoteWriteSchema = writeResultSchema(
  "vote",
  FeedbackVoteSchema.nullable(),
  "FeedbackVoteWrite",
);
export const FeedbackFollowWriteSchema = writeResultSchema(
  "follow",
  FeedbackFollowSchema.nullable(),
  "FeedbackFollowWrite",
);
export const FeedbackCommentWriteSchema = writeResultSchema(
  "comment",
  FeedbackCommentSchema.nullable(),
  "FeedbackCommentWrite",
);
