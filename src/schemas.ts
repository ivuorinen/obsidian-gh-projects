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

// --- GraphQL node schemas ---

export const graphQLIssueNodeSchema = z.object({
  title: z.string(),
  number: z.number().int(),
  url: z.string(),
  author: z.object({ login: z.string() }).nullable(),
  labels: z.object({
    nodes: z.array(z.object({ name: z.string() })),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const graphQLPRNodeSchema = graphQLIssueNodeSchema.extend({
  reviewDecision: pullRequestReviewDecisionSchema.nullable(),
});

export const graphQLRepoNodeSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  isPrivate: z.boolean(),
  isFork: z.boolean(),
  isArchived: z.boolean(),
  primaryLanguage: z.object({ name: z.string() }).nullable(),
  languages: z.object({
    nodes: z.array(z.object({ name: z.string() })),
  }),
  repositoryTopics: z.object({
    nodes: z.array(z.object({ topic: z.object({ name: z.string() }) })),
  }),
  licenseInfo: z.object({ spdxId: z.string(), name: z.string() }).nullable(),
  stargazerCount: z.number().int(),
  forkCount: z.number().int(),
  watchers: z.object({ totalCount: z.number().int() }),
  openGraphImageUrl: z.string(),
  pushedAt: z.string().nullable(),
  updatedAt: z.string(),
  issues: z.object({
    totalCount: z.number().int(),
    nodes: z.array(graphQLIssueNodeSchema),
  }),
  pullRequests: z.object({
    totalCount: z.number().int(),
    nodes: z.array(graphQLPRNodeSchema),
  }),
});

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

export const graphQLResponseSchema = z.object({
  data: z.object({
    user: z.object({
      repositories: z.object({
        nodes: z.array(graphQLRepoNodeSchema),
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
