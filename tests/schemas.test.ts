import { describe, it, expect } from "vitest";
import {
  graphQLRepoNodeSchema,
  graphQLIssueNodeSchema,
  graphQLPRNodeSchema,
  graphQLResponseSchema,
  settingsSchema,
  graphQLVariablesSchema,
} from "../src/schemas";

function makeValidRepoNode() {
  return {
    name: "test-repo",
    description: "A test repository",
    url: "https://github.com/user/test-repo",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    primaryLanguage: { name: "TypeScript" },
    languages: { nodes: [{ name: "TypeScript" }] },
    repositoryTopics: { nodes: [{ topic: { name: "cli" } }] },
    licenseInfo: { spdxId: "MIT", name: "MIT License" },
    stargazerCount: 42,
    forkCount: 5,
    watchers: { totalCount: 10 },
    openGraphImageUrl: "https://opengraph.github.com/test-repo",
    pushedAt: "2026-04-07T14:00:00Z",
    updatedAt: "2026-04-08T09:00:00Z",
    issues: {
      totalCount: 1,
      nodes: [{
        title: "Bug",
        number: 1,
        url: "https://github.com/user/test-repo/issues/1",
        author: { login: "alice" },
        labels: { nodes: [{ name: "bug" }] },
        createdAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-02T00:00:00Z",
      }],
    },
    pullRequests: {
      totalCount: 1,
      nodes: [{
        title: "Fix",
        number: 2,
        url: "https://github.com/user/test-repo/pulls/2",
        author: { login: "bob" },
        labels: { nodes: [] },
        createdAt: "2026-04-03T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
        reviewDecision: "APPROVED",
      }],
    },
  };
}

describe("graphQLIssueNodeSchema", () => {
  it("accepts a valid issue node", () => {
    const node = {
      title: "Bug",
      number: 1,
      url: "https://github.com/user/repo/issues/1",
      author: { login: "alice" },
      labels: { nodes: [{ name: "bug" }] },
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-02T00:00:00Z",
    };
    expect(graphQLIssueNodeSchema.parse(node)).toEqual(node);
  });

  it("accepts null author (ghost accounts)", () => {
    const node = {
      title: "Ghost",
      number: 99,
      url: "https://github.com/user/repo/issues/99",
      author: null,
      labels: { nodes: [] },
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    };
    expect(graphQLIssueNodeSchema.parse(node).author).toBeNull();
  });

  it("rejects missing required fields", () => {
    expect(() => graphQLIssueNodeSchema.parse({ title: "Bug" })).toThrow();
  });
});

describe("graphQLPRNodeSchema", () => {
  it("accepts valid review decisions", () => {
    const base = {
      title: "PR",
      number: 1,
      url: "https://github.com/user/repo/pulls/1",
      author: { login: "alice" },
      labels: { nodes: [] },
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-02T00:00:00Z",
    };
    expect(graphQLPRNodeSchema.parse({ ...base, reviewDecision: "APPROVED" }).reviewDecision).toBe("APPROVED");
    expect(graphQLPRNodeSchema.parse({ ...base, reviewDecision: "CHANGES_REQUESTED" }).reviewDecision).toBe("CHANGES_REQUESTED");
    expect(graphQLPRNodeSchema.parse({ ...base, reviewDecision: "REVIEW_REQUIRED" }).reviewDecision).toBe("REVIEW_REQUIRED");
    expect(graphQLPRNodeSchema.parse({ ...base, reviewDecision: null }).reviewDecision).toBeNull();
  });

  it("rejects invalid review decision", () => {
    const base = {
      title: "PR",
      number: 1,
      url: "https://github.com/user/repo/pulls/1",
      author: { login: "alice" },
      labels: { nodes: [] },
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-02T00:00:00Z",
      reviewDecision: "INVALID",
    };
    expect(() => graphQLPRNodeSchema.parse(base)).toThrow();
  });
});

describe("graphQLRepoNodeSchema", () => {
  it("accepts a valid repo node", () => {
    const node = makeValidRepoNode();
    const parsed = graphQLRepoNodeSchema.parse(node);
    expect(parsed.name).toBe("test-repo");
    expect(parsed.stargazerCount).toBe(42);
  });

  it("accepts null nullable fields", () => {
    const node = {
      ...makeValidRepoNode(),
      description: null,
      primaryLanguage: null,
      licenseInfo: null,
      pushedAt: null,
    };
    const parsed = graphQLRepoNodeSchema.parse(node);
    expect(parsed.description).toBeNull();
    expect(parsed.primaryLanguage).toBeNull();
    expect(parsed.licenseInfo).toBeNull();
    expect(parsed.pushedAt).toBeNull();
  });

  it("rejects null for non-null fields", () => {
    expect(() => graphQLRepoNodeSchema.parse({
      ...makeValidRepoNode(),
      name: null,
    })).toThrow();
  });
});

describe("graphQLResponseSchema", () => {
  it("accepts a success response", () => {
    const response = {
      data: {
        user: {
          repositories: {
            nodes: [makeValidRepoNode()],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    };
    const parsed = graphQLResponseSchema.parse(response);
    expect(parsed.data?.user.repositories.nodes).toHaveLength(1);
  });

  it("accepts an error response with null data", () => {
    const response = {
      data: null,
      errors: [{ message: "rate limit exceeded" }],
    };
    const parsed = graphQLResponseSchema.parse(response);
    expect(parsed.data).toBeNull();
    expect(parsed.errors?.[0]?.message).toBe("rate limit exceeded");
  });
});

describe("settingsSchema", () => {
  it("accepts a complete settings object", () => {
    const settings = {
      githubTokenName: "gh-token",
      githubUsername: "user",
      outputFolder: "GitHub",
      assetsFolder: "GitHub/assets",
      templatePath: "",
      syncInterval: 60,
      issuesLimit: 25,
      prsLimit: 25,
      includeForks: false,
      includeArchived: false,
      includeOrgRepos: false,
    };
    expect(settingsSchema.parse(settings)).toEqual(settings);
  });

  it("accepts a partial settings object", () => {
    const partial = { githubUsername: "user" };
    const parsed = settingsSchema.parse(partial);
    expect(parsed.githubUsername).toBe("user");
    expect(parsed.outputFolder).toBeUndefined();
  });

  it("accepts an empty object", () => {
    expect(() => settingsSchema.parse({})).not.toThrow();
  });
});

describe("graphQLVariablesSchema", () => {
  it("accepts valid variables", () => {
    const vars = {
      username: "user",
      first: 100,
      issuesFirst: 25,
      prsFirst: 25,
      after: null,
      affiliations: ["OWNER"],
    };
    expect(graphQLVariablesSchema.parse(vars)).toEqual(vars);
  });

  it("rejects invalid affiliation", () => {
    const vars = {
      username: "user",
      first: 100,
      issuesFirst: 25,
      prsFirst: 25,
      after: null,
      affiliations: ["INVALID"],
    };
    expect(() => graphQLVariablesSchema.parse(vars)).toThrow();
  });
});
