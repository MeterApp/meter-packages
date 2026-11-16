import { z } from "zod";
import {
  FeedbackCategoriesSchema,
  FeedbackSubmissionWriteSchema,
  FeedbackVoteWriteSchema,
  FeedbackFollowWriteSchema,
  FeedbackCommentWriteSchema,
  FeedbackItemPageSchema,
  FeedbackSimilarIdeasSchema,
  FeedbackDetailSchema,
  FeedbackChangelogPageSchema,
} from "../../dto/feedback.ts";
import {
  READ_ONLY,
  SETTINGS_WRITE,
  dryRunSchema,
  proposalIdSchema,
} from "./shared.ts";
const limit = z
  .number()
  .int()
  .min(1)
  .max(5)
  .default(5)
  .describe("Record count, 1–5. Use cursors for more records.");
const cursor = z
  .string()
  .max(1500)
  .optional()
  .describe("Opaque continuation cursor from the preceding matching page.");
const itemId = z
  .uuid()
  .describe("Identifier from an authorized feedback result.");
const idempotencyKey = z
  .uuid()
  .describe(
    "Client-generated id for this payload. Preserve it on retries; use a new id for a different payload.",
  );
const controls = { dry_run: dryRunSchema, proposal_id: proposalIdSchema };
export const feedbackSchemas = {
  submit_feedback: z
    .strictObject({
      ...controls,
      type: z
        .enum(["idea", "issue"])
        .describe("A public idea or private report."),
      title: z
        .string()
        .trim()
        .min(3)
        .max(140)
        .optional()
        .describe(
          "Complete title; required for ideas. Reports derive a title when omitted.",
        ),
      body: z
        .string()
        .trim()
        .min(3)
        .max(5000)
        .describe("Complete text to submit, never silently truncated."),
      category: z
        .string()
        .min(1)
        .max(100)
        .describe("Exact category id from list_feedback_categories."),
      subject: z
        .strictObject({
          type: z
            .enum(["trip", "booking", "quote", "fare", "vehicle", "screen"])
            .describe(
              "Authorized private report context; ideas cannot carry a subject.",
            ),
          id: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("Record UUID, or screen name for a screen subject."),
        })
        .optional()
        .describe("Optional authorized context for a private report."),
      idempotency_key: idempotencyKey,
    })
    .superRefine((input, ctx) => {
      if (input.type === "idea" && (!input.title || input.subject))
        ctx.addIssue({
          code: "custom",
          message: "Ideas require a title and cannot carry private subjects",
          path: ["subject"],
        });
      if (
        input.subject &&
        input.subject.type !== "screen" &&
        !z.uuid().safeParse(input.subject.id).success
      )
        ctx.addIssue({
          code: "custom",
          message: "Subject ID must be a UUID",
          path: ["subject", "id"],
        });
    }),
  vote_on_idea: z.strictObject({
    ...controls,
    item_id: itemId,
    voted: z
      .boolean()
      .describe(
        "Desired vote state; voting also follows unless previously unfollowed.",
      ),
  }),
  follow_feedback_item: z.strictObject({
    ...controls,
    item_id: itemId,
    following: z.boolean().describe("Desired notification following state."),
  }),
  comment_on_feedback_item: z.strictObject({
    ...controls,
    item_id: itemId,
    body: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe("Complete customer-visible comment text."),
    idempotency_key: idempotencyKey,
  }),
  list_feedback_categories: z.strictObject({
    type: z
      .enum(["idea", "issue"])
      .optional()
      .describe(
        "Optional submission type; categories currently apply to both types.",
      ),
  }),
  list_ideas: z.strictObject({
    query: z
      .string()
      .trim()
      .max(200)
      .default("")
      .describe("Public idea search text; empty lists all public ideas."),
    status: z
      .string()
      .max(100)
      .optional()
      .describe("Exact customer status id."),
    category: z
      .string()
      .max(100)
      .optional()
      .describe("Category id from list_feedback_categories."),
    sort: z
      .enum(["top", "new", "trending"])
      .default("top")
      .describe("Vote, creation-time or recent-vote ordering."),
    cursor,
    limit,
  }),
  find_similar_ideas: z.strictObject({
    title: z
      .string()
      .trim()
      .min(1)
      .max(140)
      .describe("Proposed idea title to search for duplicates."),
    details: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe(
        "Optional additional search text; no private report content is returned.",
      ),
  }),
  list_my_feedback: z.strictObject({
    scope: z
      .enum(["authored", "following", "fleet"])
      .default("authored")
      .describe(
        "Authored or followed feedback; fleet requires current administrator or owner membership.",
      ),
    type: z
      .enum(["idea", "issue"])
      .optional()
      .describe("Optional feedback kind."),
    status: z
      .string()
      .max(100)
      .optional()
      .describe("Exact customer status id."),
    cursor,
    limit,
  }),
  get_feedback_item: z.strictObject({
    item_id: z
      .uuid()
      .optional()
      .describe("Feedback identifier; provide exactly one of item_id or slug."),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Public idea slug; provide exactly one of slug or item_id."),
  }),
  list_changelog: z.strictObject({
    cursor,
    limit: z
      .number()
      .int()
      .min(1)
      .max(1)
      .default(1)
      .describe(
        "Full release-note entries per page; one bounds complete 20,000-character bodies.",
      ),
  }),
};
const access = {
  personas: [
    "solo_driver",
    "fleet_driver",
    "fleet_admin",
    "fleet_owner",
    "rider",
  ],
  recordScoped: true,
  requiresOperationalFleet: false,
} as const;

export const feedbackTools = {
  submit_feedback: {
    name: "submit_feedback",
    title: "Submit feedback",
    description:
      "Use dry_run to preview the complete public idea or private report, then apply its saved proposal after human confirmation. Actor, surface and Rio provenance come from verified server context. An id reused for different text is rejected.",
    domain: "feedback",
    kind: "write",
    risk: "low",
    exposure: "on_demand",
    access,
    inputSchema: feedbackSchemas.submit_feedback,
    outputSchema: FeedbackSubmissionWriteSchema,
    returns: "FeedbackSubmissionWrite",
    annotations: { ...SETTINGS_WRITE, openWorldHint: true },
    example: {
      type: "issue",
      body: "The meter display stopped updating",
      category: "meter_fares",
      idempotency_key: "11111111-1111-4111-8111-111111111111",
      dry_run: true,
    },
  },
  vote_on_idea: {
    name: "vote_on_idea",
    title: "Vote on an idea",
    description:
      "Use dry_run to preview and confirm the caller's vote on a currently visible idea. Voting may automatically follow it; a previous explicit unfollow is preserved. Private reports cannot be voted on.",
    domain: "feedback",
    kind: "write",
    risk: "low",
    exposure: "on_demand",
    access,
    inputSchema: feedbackSchemas.vote_on_idea,
    outputSchema: FeedbackVoteWriteSchema,
    returns: "FeedbackVoteWrite",
    annotations: SETTINGS_WRITE,
    example: {
      item_id: "11111111-1111-4111-8111-111111111111",
      voted: true,
      dry_run: true,
    },
  },
  follow_feedback_item: {
    name: "follow_feedback_item",
    title: "Follow feedback",
    description:
      "Use dry_run to preview and confirm the caller's notification following state for an authorized idea or private report. Current visibility is required when confirming or recovering a saved result.",
    domain: "feedback",
    kind: "write",
    risk: "low",
    exposure: "on_demand",
    access,
    inputSchema: feedbackSchemas.follow_feedback_item,
    outputSchema: FeedbackFollowWriteSchema,
    returns: "FeedbackFollowWrite",
    annotations: SETTINGS_WRITE,
    example: {
      item_id: "11111111-1111-4111-8111-111111111111",
      following: true,
      dry_run: true,
    },
  },
  comment_on_feedback_item: {
    name: "comment_on_feedback_item",
    title: "Comment on feedback",
    description:
      "Use dry_run to preview the complete customer-visible comment, then apply its saved proposal after human confirmation. Locked or merged items reject new comments. Preserve the payload id when retrying an interrupted confirmation.",
    domain: "feedback",
    kind: "write",
    risk: "low",
    exposure: "on_demand",
    access,
    inputSchema: feedbackSchemas.comment_on_feedback_item,
    outputSchema: FeedbackCommentWriteSchema,
    returns: "FeedbackCommentWrite",
    annotations: { ...SETTINGS_WRITE, openWorldHint: true },
    example: {
      item_id: "11111111-1111-4111-8111-111111111111",
      body: "I also need an earlier reminder",
      idempotency_key: "22222222-2222-4222-8222-222222222222",
      dry_run: true,
    },
  },
  list_feedback_categories: {
    name: "list_feedback_categories",
    title: "List feedback categories",
    description:
      "Read localized category ids and labels accepted for reports and ideas. Use these exact ids when submitting feedback; reading categories does not create or modify any feedback.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.list_feedback_categories,
    outputSchema: FeedbackCategoriesSchema,
    returns: "FeedbackCategories",
    example: {},
    annotations: READ_ONLY,
  },
  list_ideas: {
    name: "list_ideas",
    title: "List public ideas",
    description:
      "Read published public ideas, including current votes and availability. Private reports and internal attribution are excluded.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.list_ideas,
    outputSchema: FeedbackItemPageSchema,
    returns: "FeedbackItemPage",
    example: {},
    annotations: READ_ONLY,
  },
  find_similar_ideas: {
    name: "find_similar_ideas",
    title: "Find similar public ideas",
    description:
      "Search for duplicate public ideas before suggesting a new idea. Returns up to five visible public items; private reports, hidden ideas and staff evidence are excluded.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.find_similar_ideas,
    outputSchema: FeedbackSimilarIdeasSchema,
    returns: "FeedbackSimilarIdeas",
    example: { title: "Improve booking reminders" },
    annotations: READ_ONLY,
  },
  list_my_feedback: {
    name: "list_my_feedback",
    title: "List my feedback",
    description:
      "Read authored or followed feedback. Fleet scope requires current administrator or owner access; no operational fleet subscription is required.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.list_my_feedback,
    outputSchema: FeedbackItemPageSchema,
    returns: "FeedbackItemPage",
    example: {},
    annotations: READ_ONLY,
  },
  get_feedback_item: {
    name: "get_feedback_item",
    title: "Get feedback detail",
    description:
      "Read a feedback item by identifier, or a published public idea by slug, including customer-visible comments and status history. Provide exactly one identifier. Current record authorization always applies.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.get_feedback_item,
    outputSchema: FeedbackDetailSchema,
    returns: "FeedbackDetail",
    example: { item_id: "11111111-1111-4111-8111-111111111111" },
    annotations: READ_ONLY,
  },
  list_changelog: {
    name: "list_changelog",
    title: "List published changelog",
    description:
      "Read actually published release notes, newest first. Draft and future-dated entries, staff identities and private feedback links are excluded.",
    domain: "feedback",
    kind: "read",
    risk: "none",
    exposure: "listed",
    access,
    inputSchema: feedbackSchemas.list_changelog,
    outputSchema: FeedbackChangelogPageSchema,
    returns: "FeedbackChangelogPage",
    example: {},
    annotations: READ_ONLY,
  },
} as const;
