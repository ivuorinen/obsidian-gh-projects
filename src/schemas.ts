import { z } from "zod";

// --- Enums (from GitHub GraphQL schema) ---

export const pullRequestReviewDecisionSchema = z.enum([
  "APPROVED",
  "CHANGES_REQUESTED",
  "REVIEW_REQUIRED",
]);

export const repositoryAffiliationSchema = z.enum([
  "OWNER",
  "ORGANIZATION_MEMBER",
  "COLLABORATOR",
]);

// --- Helpers ---

/**
 * GitHub GraphQL connection `nodes` fields are typed as `[[Type]]`,
 * meaning both the array itself and individual items can be null.
 * This helper accepts null arrays (→ []) and filters out null items.
 */
function connectionNodes<T extends z.ZodType>(schema: T) {
  return z
    .array(schema.nullable())
    .nullable()
    .transform((v) =>
      (v ?? []).filter((item): item is z.infer<T> => item !== null)
    );
}

// --- GraphQL node schemas ---

export const graphQLIssueNodeSchema = z.object({
  title: z.string(),                                        // String!
  number: z.number().int(),                                 // Int!
  url: z.string(),                                          // URI!
  author: z.object({ login: z.string() }).nullable(),       // Actor (nullable)
  labels: z.object({                                        // LabelConnection (nullable)
    nodes: connectionNodes(z.object({ name: z.string() })),
  }).nullable().transform((v) => v ?? { nodes: [] }),
  createdAt: z.string(),                                    // DateTime!
  updatedAt: z.string(),                                    // DateTime!
});

export const graphQLPRNodeSchema = graphQLIssueNodeSchema.extend({
  reviewDecision: pullRequestReviewDecisionSchema.nullable(), // PullRequestReviewDecision
});

export const graphQLRepoNodeSchema = z.object({
  name: z.string(),                                          // String!
  nameWithOwner: z.string(),                                 // String!
  owner: z.object({ login: z.string() }),                    // RepositoryOwner!
  description: z.string().nullable(),                        // String
  url: z.string(),                                           // URI!
  isPrivate: z.boolean(),                                    // Boolean!
  isFork: z.boolean(),                                       // Boolean!
  isArchived: z.boolean(),                                   // Boolean!
  primaryLanguage: z.object({ name: z.string() }).nullable(), // Language
  languages: z.object({                                      // LanguageConnection!
    nodes: connectionNodes(z.object({ name: z.string() })),
  }),
  repositoryTopics: z.object({                               // RepositoryTopicConnection!
    nodes: connectionNodes(
      z.object({ topic: z.object({ name: z.string() }) })
    ),
  }),
  licenseInfo: z.object({                                    // License
    spdxId: z.string().nullable(),                           // String (nullable)
    name: z.string(),                                        // String!
  }).nullable(),
  stargazerCount: z.number().int(),                          // Int!
  forkCount: z.number().int(),                               // Int!
  watchers: z.object({ totalCount: z.number().int() }),      // UserConnection!
  openGraphImageUrl: z.string(),                             // URI!
  pushedAt: z.string().nullable(),                           // DateTime
  updatedAt: z.string(),                                     // DateTime!
  issues: z.object({                                         // IssueConnection!
    totalCount: z.number().int(),
    nodes: connectionNodes(graphQLIssueNodeSchema),
  }),
  pullRequests: z.object({                                   // PullRequestConnection!
    totalCount: z.number().int(),
    nodes: connectionNodes(graphQLPRNodeSchema),
  }),
});

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),                                  // Boolean!
  endCursor: z.string().nullable(),                          // String
});

export const graphQLResponseSchema = z.object({
  data: z.object({
    user: z.object({
      repositories: z.object({
        nodes: connectionNodes(graphQLRepoNodeSchema),       // [[Repository]]
        pageInfo: pageInfoSchema,
      }),
    }),
  }).nullable(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

// --- Settings schema (partial — loadData may return incomplete) ---

export const settingsSchema = z.object({
  githubTokenName: z.string(),
  githubUsername: z.string(),
  outputFolder: z.string(),
  assetsFolder: z.string(),
  templatePath: z.string(),
  syncInterval: z.number(),
  issuesLimit: z.number(),
  prsLimit: z.number(),
  includeForks: z.boolean(),
  includeArchived: z.boolean(),
  includeOrgRepos: z.boolean(),
  debugMode: z.boolean(),
}).partial();

// --- GraphQL variables ---

export const graphQLVariablesSchema = z.object({
  username: z.string(),
  first: z.number().int(),
  issuesFirst: z.number().int(),
  prsFirst: z.number().int(),
  after: z.string().nullable(),
  affiliations: z.array(repositoryAffiliationSchema),
});

// --- Inferred types ---

export type GraphQLIssueNode = z.infer<typeof graphQLIssueNodeSchema>;
export type GraphQLPRNode = z.infer<typeof graphQLPRNodeSchema>;
export type GraphQLRepoNode = z.infer<typeof graphQLRepoNodeSchema>;
export type GraphQLResponse = z.infer<typeof graphQLResponseSchema>;
export type GraphQLVariables = z.infer<typeof graphQLVariablesSchema>;
export type RepositoryAffiliation = z.infer<typeof repositoryAffiliationSchema>;
export type PullRequestReviewDecision = z.infer<typeof pullRequestReviewDecisionSchema>;
