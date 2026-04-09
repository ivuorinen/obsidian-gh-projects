import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseRepoNode, filterRepos, fetchRepos, GitHubAuthError, GitHubRateLimitError } from "../src/github";
import { DEFAULT_SETTINGS } from "../src/types";
import type { RepoData } from "../src/types";
import type { GraphQLRepoNode } from "../src/schemas";
import { requestUrl } from "obsidian";

function makeRepoNode(overrides: Partial<GraphQLRepoNode> = {}): GraphQLRepoNode {
	return {
		name: "test-repo",
		description: "A test repository",
		url: "https://github.com/user/test-repo",
		isPrivate: false,
		isFork: false,
		isArchived: false,
		primaryLanguage: { name: "TypeScript" },
		languages: { nodes: [{ name: "TypeScript" }, { name: "JavaScript" }] },
		repositoryTopics: { nodes: [{ topic: { name: "cli" } }, { topic: { name: "tools" } }] },
		licenseInfo: { spdxId: "MIT", name: "MIT License" },
		stargazerCount: 42,
		forkCount: 5,
		watchers: { totalCount: 10 },
		openGraphImageUrl: "https://opengraph.github.com/test-repo",
		pushedAt: "2026-04-07T14:00:00Z",
		updatedAt: "2026-04-08T09:00:00Z",
		issues: {
			totalCount: 3,
			nodes: [
				{
					title: "Bug report",
					number: 1,
					url: "https://github.com/user/test-repo/issues/1",
					author: { login: "alice" },
					labels: { nodes: [{ name: "bug" }] },
					createdAt: "2026-04-01T00:00:00Z",
					updatedAt: "2026-04-02T00:00:00Z",
				},
			],
		},
		pullRequests: {
			totalCount: 1,
			nodes: [
				{
					title: "Fix bug",
					number: 2,
					url: "https://github.com/user/test-repo/pulls/2",
					author: { login: "bob" },
					labels: { nodes: [{ name: "bug" }, { name: "fix" }] },
					createdAt: "2026-04-03T00:00:00Z",
					updatedAt: "2026-04-04T00:00:00Z",
					reviewDecision: "APPROVED",
				},
			],
		},
		...overrides,
	};
}

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
	return {
		name: "test",
		description: null,
		url: "",
		isPrivate: false,
		isFork: false,
		isArchived: false,
		primaryLanguage: null,
		languages: [],
		topics: [],
		license: null,
		stars: 0,
		forks: 0,
		watchers: 0,
		openGraphImageUrl: "",
		pushedAt: null,
		updatedAt: "",
		issues: [],
		issuesCount: 0,
		pullRequests: [],
		pullRequestsCount: 0,
		...overrides,
	};
}

describe("parseRepoNode", () => {
	it("parses a full repo node into RepoData", () => {
		const result = parseRepoNode(makeRepoNode());
		expect(result.name).toBe("test-repo");
		expect(result.description).toBe("A test repository");
		expect(result.url).toBe("https://github.com/user/test-repo");
		expect(result.isPrivate).toBe(false);
		expect(result.primaryLanguage).toBe("TypeScript");
		expect(result.languages).toEqual(["TypeScript", "JavaScript"]);
		expect(result.topics).toEqual(["cli", "tools"]);
		expect(result.license).toBe("MIT");
		expect(result.stars).toBe(42);
		expect(result.forks).toBe(5);
		expect(result.watchers).toBe(10);
		expect(result.openGraphImageUrl).toBe("https://opengraph.github.com/test-repo");
		expect(result.issuesCount).toBe(3);
		expect(result.pullRequestsCount).toBe(1);
	});

	it("parses issues correctly", () => {
		const result = parseRepoNode(makeRepoNode());
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].title).toBe("Bug report");
		expect(result.issues[0].number).toBe(1);
		expect(result.issues[0].author).toBe("alice");
		expect(result.issues[0].labels).toEqual(["bug"]);
	});

	it("parses pull requests with review decision", () => {
		const result = parseRepoNode(makeRepoNode());
		expect(result.pullRequests).toHaveLength(1);
		expect(result.pullRequests[0].title).toBe("Fix bug");
		expect(result.pullRequests[0].reviewDecision).toBe("APPROVED");
		expect(result.pullRequests[0].labels).toEqual(["bug", "fix"]);
	});

	it("handles null primaryLanguage", () => {
		const result = parseRepoNode(makeRepoNode({ primaryLanguage: null }));
		expect(result.primaryLanguage).toBeNull();
	});

	it("handles null author on issue", () => {
		const node = makeRepoNode({
			issues: {
				totalCount: 1,
				nodes: [{
					title: "Ghost issue",
					number: 99,
					url: "https://github.com/user/test-repo/issues/99",
					author: null,
					labels: { nodes: [] },
					createdAt: "2026-04-01T00:00:00Z",
					updatedAt: "2026-04-01T00:00:00Z",
				}],
			},
		});
		const result = parseRepoNode(node);
		expect(result.issues[0].author).toBe("unknown");
	});

	it("handles null licenseInfo", () => {
		const result = parseRepoNode(makeRepoNode({ licenseInfo: null }));
		expect(result.license).toBeNull();
	});
});

describe("filterRepos", () => {
	it("excludes forks by default", () => {
		const repos = [makeRepo({ name: "original" }), makeRepo({ name: "fork", isFork: true })];
		const result = filterRepos(repos, DEFAULT_SETTINGS);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("original");
	});

	it("includes forks when setting is enabled", () => {
		const repos = [makeRepo({ name: "fork", isFork: true })];
		const result = filterRepos(repos, { ...DEFAULT_SETTINGS, includeForks: true });
		expect(result).toHaveLength(1);
	});

	it("excludes archived by default", () => {
		const repos = [makeRepo({ name: "archived", isArchived: true })];
		const result = filterRepos(repos, DEFAULT_SETTINGS);
		expect(result).toHaveLength(0);
	});

	it("includes archived when setting is enabled", () => {
		const repos = [makeRepo({ name: "archived", isArchived: true })];
		const result = filterRepos(repos, { ...DEFAULT_SETTINGS, includeArchived: true });
		expect(result).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe("GitHubAuthError", () => {
	it("has correct name and message", () => {
		const err = new GitHubAuthError();
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("GitHubAuthError");
		expect(err.message).toContain("invalid or expired");
	});
});

describe("GitHubRateLimitError", () => {
	it("has correct name and exposes resetAt as a Date", () => {
		const timestamp = 1700000000;
		const err = new GitHubRateLimitError(timestamp);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("GitHubRateLimitError");
		expect(err.resetAt).toBeInstanceOf(Date);
		expect(err.resetAt.getTime()).toBe(timestamp * 1000);
	});

	it("includes reset time in message", () => {
		const err = new GitHubRateLimitError(1700000000);
		expect(err.message).toContain("rate limit exceeded");
	});
});

// ---------------------------------------------------------------------------
// fetchRepos
// ---------------------------------------------------------------------------

function makeGraphQLPage(repoName: string, hasNextPage: boolean, endCursor: string | null = null) {
	return {
		json: {
			data: {
				user: {
					repositories: {
						nodes: [
							{
								name: repoName,
								description: null,
								url: `https://github.com/user/${repoName}`,
								isPrivate: false,
								isFork: false,
								isArchived: false,
								primaryLanguage: null,
								languages: { nodes: [] },
								repositoryTopics: { nodes: [] },
								licenseInfo: null,
								stargazerCount: 0,
								forkCount: 0,
								watchers: { totalCount: 0 },
								openGraphImageUrl: "https://opengraph.github.com/default",
								pushedAt: "2026-01-01T00:00:00Z",
								updatedAt: "2026-01-02T00:00:00Z",
								issues: { totalCount: 0, nodes: [] },
								pullRequests: { totalCount: 0, nodes: [] },
							},
						],
						pageInfo: { hasNextPage, endCursor },
					},
				},
			},
		},
		headers: {},
	};
}

describe("fetchRepos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns repos from a single page response", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce(makeGraphQLPage("my-repo", false));
		const repos = await fetchRepos("token123", { ...DEFAULT_SETTINGS, githubUsername: "user" });
		expect(repos).toHaveLength(1);
		expect(repos[0].name).toBe("my-repo");
	});

	it("paginates across two pages", async () => {
		vi.mocked(requestUrl)
			.mockResolvedValueOnce(makeGraphQLPage("repo-a", true, "cursor1"))
			.mockResolvedValueOnce(makeGraphQLPage("repo-b", false));
		const repos = await fetchRepos("token123", { ...DEFAULT_SETTINGS, githubUsername: "user" });
		expect(repos).toHaveLength(2);
		expect(repos.map((r) => r.name)).toEqual(["repo-a", "repo-b"]);
	});

	it("throws GitHubAuthError on 401", async () => {
		vi.mocked(requestUrl).mockRejectedValueOnce({ status: 401 });
		await expect(fetchRepos("bad-token", { ...DEFAULT_SETTINGS, githubUsername: "user" }))
			.rejects.toBeInstanceOf(GitHubAuthError);
	});

	it("throws GitHubRateLimitError on 403 with x-ratelimit-reset header", async () => {
		vi.mocked(requestUrl).mockRejectedValueOnce({
			status: 403,
			headers: { "x-ratelimit-reset": "1700000000" },
		});
		await expect(fetchRepos("token123", { ...DEFAULT_SETTINGS, githubUsername: "user" }))
			.rejects.toBeInstanceOf(GitHubRateLimitError);
	});

	it("throws GitHubRateLimitError on GraphQL rate limit error message", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			json: {
				errors: [{ message: "rate limit exceeded" }],
				data: null,
			},
			headers: {},
		});
		await expect(fetchRepos("token123", { ...DEFAULT_SETTINGS, githubUsername: "user" }))
			.rejects.toBeInstanceOf(GitHubRateLimitError);
	});

	it("throws generic Error on other GraphQL errors", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			json: {
				errors: [{ message: "something went wrong" }],
				data: null,
			},
			headers: {},
		});
		await expect(fetchRepos("token123", { ...DEFAULT_SETTINGS, githubUsername: "user" }))
			.rejects.toThrow("GitHub API error: something went wrong");
	});

	it("clears issues when issuesLimit=0", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			json: {
				data: {
					user: {
						repositories: {
							nodes: [
								{
									name: "repo-x",
									description: null,
									url: "https://github.com/user/repo-x",
									isPrivate: false,
									isFork: false,
									isArchived: false,
									primaryLanguage: null,
									languages: { nodes: [] },
									repositoryTopics: { nodes: [] },
									licenseInfo: null,
									stargazerCount: 0,
									forkCount: 0,
									watchers: { totalCount: 0 },
									openGraphImageUrl: "https://opengraph.github.com/repo-x",
									pushedAt: "2026-01-01T00:00:00Z",
									updatedAt: "2026-01-02T00:00:00Z",
									issues: {
										totalCount: 2,
										nodes: [
											{
												title: "Issue 1",
												number: 1,
												url: "https://github.com/user/repo-x/issues/1",
												author: { login: "alice" },
												labels: { nodes: [] },
												createdAt: "2026-01-01T00:00:00Z",
												updatedAt: "2026-01-01T00:00:00Z",
											},
										],
									},
									pullRequests: { totalCount: 0, nodes: [] },
								},
							],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				},
			},
			headers: {},
		});
		const repos = await fetchRepos("token123", {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			issuesLimit: 0,
		});
		expect(repos[0].issues).toHaveLength(0);
	});

	it("includes ORGANIZATION_MEMBER affiliation when includeOrgRepos=true", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce(makeGraphQLPage("org-repo", false));
		await fetchRepos("token123", {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			includeOrgRepos: true,
		});
		const body = JSON.parse(vi.mocked(requestUrl).mock.calls[0][0].body as string);
		expect(body.variables.affiliations).toContain("ORGANIZATION_MEMBER");
	});

	it("re-throws non-auth/rate-limit errors from requestUrl", async () => {
		vi.mocked(requestUrl).mockRejectedValueOnce({ status: 500, message: "Server Error" });
		await expect(fetchRepos("token", { ...DEFAULT_SETTINGS, githubUsername: "user" }))
			.rejects.toEqual({ status: 500, message: "Server Error" });
	});

	it("clears pullRequests when prsLimit is 0", async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			json: {
				data: {
					user: {
						repositories: {
							nodes: [makeRepoNode()],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				},
			},
			headers: {},
			status: 200,
			arrayBuffer: new ArrayBuffer(0),
			text: "",
		});
		const result = await fetchRepos("token", { ...DEFAULT_SETTINGS, githubUsername: "user", prsLimit: 0 });
		expect(result[0].pullRequests).toEqual([]);
	});
});
