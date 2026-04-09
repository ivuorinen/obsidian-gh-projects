import { describe, it, expect } from "vitest";
import { parseRepoNode, filterRepos } from "../src/github";
import { DEFAULT_SETTINGS } from "../src/types";
import type { GraphQLRepoNode, RepoData } from "../src/types";

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
		openGraphImageUrl: null,
		pushedAt: "",
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
