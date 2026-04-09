import { requestUrl } from "obsidian";
import type {
	GraphQLRepoNode,
	GraphQLIssueNode,
	GraphQLPRNode,
	GraphQLResponse,
	RepoData,
	IssueData,
	PRData,
	GHProjectsSettings,
} from "./types";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

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

	const affiliations: string[] = ["OWNER"];
	if (settings.includeOrgRepos) {
		affiliations.push("ORGANIZATION_MEMBER");
	}

	while (hasNextPage) {
		const variables: Record<string, unknown> = {
			username: settings.githubUsername,
			first: 100,
			issuesFirst,
			prsFirst,
			after,
			affiliations,
		};

		const response = await requestUrl({
			url: GITHUB_GRAPHQL_URL,
			method: "POST",
			headers: {
				Authorization: `bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: REPOS_QUERY, variables }),
		});

		const json: GraphQLResponse = response.json;

		const firstError = json.errors?.[0];
		if (firstError) {
			throw new Error(`GitHub API error: ${firstError.message}`);
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
