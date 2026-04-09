import { requestUrl } from "obsidian";
import type { RepoData, IssueData, PRData, GHProjectsSettings } from "./types";
import type {
  GraphQLRepoNode,
  GraphQLIssueNode,
  GraphQLPRNode,
  GraphQLVariables,
  RepositoryAffiliation,
} from "./schemas";
import { graphQLResponseSchema } from "./schemas";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

export class GitHubAuthError extends Error {
  constructor() {
    super("GitHub token is invalid or expired. Check plugin settings.");
    this.name = "GitHubAuthError";
  }
}

export class GitHubRateLimitError extends Error {
  resetAt: Date;
  constructor(resetTimestamp: number) {
    const resetAt = new Date(resetTimestamp * 1000);
    super(`GitHub rate limit exceeded. Resets at ${resetAt.toLocaleTimeString()}.`);
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

interface RequestUrlError {
  status: number;
  headers: Record<string, string>;
}

function isRequestUrlError(err: unknown): err is RequestUrlError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as Record<string, unknown>).status === "number"
  );
}

const REPOS_QUERY = `
query($username: String!, $first: Int!, $issuesFirst: Int!, $prsFirst: Int!, $after: String, $affiliations: [RepositoryAffiliation!]!) {
  user(login: $username) {
    repositories(
      first: $first,
      after: $after,
      ownerAffiliations: $affiliations,
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      nodes {
        name
        description
        url
        isPrivate
        isFork
        isArchived
        primaryLanguage { name }
        languages(first: 5) { nodes { name } }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        licenseInfo { spdxId name }
        stargazerCount
        forkCount
        watchers { totalCount }
        openGraphImageUrl
        pushedAt
        updatedAt
        issues(first: $issuesFirst, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            title number url
            author { login }
            labels(first: 5) { nodes { name } }
            createdAt updatedAt
          }
        }
        pullRequests(first: $prsFirst, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            title number url
            author { login }
            labels(first: 5) { nodes { name } }
            createdAt updatedAt
            reviewDecision
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

export function parseIssueNode(node: GraphQLIssueNode): IssueData {
  return {
    title: node.title,
    number: node.number,
    url: node.url,
    author: node.author?.login ?? "unknown",
    labels: node.labels.nodes.map((l) => l.name),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

export function parsePRNode(node: GraphQLPRNode): PRData {
  return {
    ...parseIssueNode(node),
    reviewDecision: node.reviewDecision ?? null,
  };
}

export function parseRepoNode(node: GraphQLRepoNode): RepoData {
  return {
    name: node.name,
    description: node.description,
    url: node.url,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    isArchived: node.isArchived,
    primaryLanguage: node.primaryLanguage?.name ?? null,
    languages: node.languages.nodes.map((l) => l.name),
    topics: node.repositoryTopics.nodes.map((t) => t.topic.name),
    license: node.licenseInfo?.spdxId ?? null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    watchers: node.watchers.totalCount,
    openGraphImageUrl: node.openGraphImageUrl,
    pushedAt: node.pushedAt,
    updatedAt: node.updatedAt,
    issues: node.issues.nodes.map(parseIssueNode),
    issuesCount: node.issues.totalCount,
    pullRequests: node.pullRequests.nodes.map(parsePRNode),
    pullRequestsCount: node.pullRequests.totalCount,
  };
}

export function filterRepos(repos: RepoData[], settings: GHProjectsSettings): RepoData[] {
  return repos.filter((repo) => {
    if (!settings.includeForks && repo.isFork) return false;
    if (!settings.includeArchived && repo.isArchived) return false;
    return true;
  });
}

export async function fetchRepos(
  token: string,
  settings: GHProjectsSettings,
): Promise<RepoData[]> {
  const allRepos: RepoData[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  const issuesFirst = settings.issuesLimit || 1;
  const prsFirst = settings.prsLimit || 1;

  const affiliations: RepositoryAffiliation[] = ["OWNER"];
  if (settings.includeOrgRepos) {
    affiliations.push("ORGANIZATION_MEMBER");
  }

  while (hasNextPage) {
    const variables: GraphQLVariables = {
      username: settings.githubUsername,
      first: 100,
      issuesFirst,
      prsFirst,
      after,
      affiliations,
    };

    let response;
    try {
      response = await requestUrl({
        url: GITHUB_GRAPHQL_URL,
        method: "POST",
        headers: {
          Authorization: `bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: REPOS_QUERY, variables }),
      });
    } catch (err: unknown) {
      if (isRequestUrlError(err)) {
        if (err.status === 401) {
          throw new GitHubAuthError();
        }
        if (err.status === 403) {
          const resetHeader = err.headers["x-ratelimit-reset"];
          if (resetHeader) {
            throw new GitHubRateLimitError(Number(resetHeader));
          }
        }
        const hint = err.status >= 500
          ? "GitHub may be experiencing issues — try again later."
          : "Check plugin settings.";
        throw new Error(`GitHub API error (HTTP ${err.status}). ${hint}`);
      }
      throw err;
    }

    const json = graphQLResponseSchema.parse(response.json);

    const firstError = json.errors?.[0];
    if (firstError) {
      if (firstError.message.toLowerCase().includes("rate limit")) {
        const resetHeader = response.headers?.["x-ratelimit-reset"];
        const resetTime = resetHeader ? Number(resetHeader) : Math.floor(Date.now() / 1000) + 3600;
        throw new GitHubRateLimitError(resetTime);
      }
      throw new Error(`GitHub API error: ${firstError.message}`);
    }

    if (!json.data) {
      throw new Error("GitHub API returned empty response");
    }

    const { nodes, pageInfo } = json.data.user.repositories;
    allRepos.push(...nodes.map(parseRepoNode));
    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor;
  }

  if (settings.issuesLimit === 0) {
    for (const repo of allRepos) {
      repo.issues = [];
    }
  }
  if (settings.prsLimit === 0) {
    for (const repo of allRepos) {
      repo.pullRequests = [];
    }
  }

  return filterRepos(allRepos, settings);
}
