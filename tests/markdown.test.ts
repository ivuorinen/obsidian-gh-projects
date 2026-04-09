import { describe, it, expect } from "vitest";
import { renderFrontmatter, renderBody, renderRepoFile } from "../src/markdown";
import type { RepoData } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/types";

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
	return {
		name: "my-project",
		owner: "user",
		fullName: "user/my-project",
		description: "A cool project",
		url: "https://github.com/user/my-project",
		isPrivate: false,
		isFork: false,
		isArchived: false,
		primaryLanguage: "TypeScript",
		languages: ["TypeScript", "JavaScript"],
		topics: ["cli", "tools"],
		license: "MIT",
		stars: 42,
		forks: 5,
		watchers: 10,
		openGraphImageUrl: "https://opengraph.github.com/my-project",
		pushedAt: "2026-04-07T14:00:00Z",
		updatedAt: "2026-04-08T09:00:00Z",
		issues: [
			{
				title: "Bug report",
				number: 1,
				url: "https://github.com/user/my-project/issues/1",
				author: "alice",
				labels: ["bug"],
				createdAt: "2026-04-01T00:00:00Z",
				updatedAt: "2026-04-02T00:00:00Z",
			},
		],
		issuesCount: 3,
		pullRequests: [
			{
				title: "Fix bug",
				number: 2,
				url: "https://github.com/user/my-project/pulls/2",
				author: "bob",
				labels: ["bug", "fix"],
				createdAt: "2026-04-03T00:00:00Z",
				updatedAt: "2026-04-04T00:00:00Z",
				reviewDecision: "APPROVED",
			},
		],
		pullRequestsCount: 1,
		...overrides,
	};
}

describe("renderFrontmatter", () => {
	it("renders all fields in YAML frontmatter", () => {
		const result = renderFrontmatter(makeRepo(), "GitHub/assets/my-project.png", DEFAULT_SETTINGS);

		expect(result).toContain("---");
		expect(result).toContain('name: "my-project"');
		expect(result).toContain('description: "A cool project"');
		expect(result).toContain("url: https://github.com/user/my-project");
		expect(result).toContain("private: false");
		expect(result).toContain('language: "TypeScript"');
		expect(result).toContain("  - TypeScript");
		expect(result).toContain("  - cli");
		expect(result).toContain('license: "MIT"');
		expect(result).toContain("stars: 42");
		expect(result).toContain("forks: 5");
		expect(result).toContain("watchers: 10");
		expect(result).toContain("open_issues: 3");
		expect(result).toContain("open_prs: 1");
		expect(result).toContain("cover: GitHub/assets/my-project.png");
		expect(result).toContain("synced_at:");
	});

	it("omits cover when no image path", () => {
		const result = renderFrontmatter(makeRepo({ openGraphImageUrl: null }), null, DEFAULT_SETTINGS);
		expect(result).not.toContain("cover:");
	});

	it("handles null description", () => {
		const result = renderFrontmatter(makeRepo({ description: null }), null, DEFAULT_SETTINGS);
		expect(result).toContain('description: ""');
	});

	it("escapes quotes in description", () => {
		const result = renderFrontmatter(makeRepo({ description: 'A "quoted" project' }), null, DEFAULT_SETTINGS);
		expect(result).toContain('description: "A \\"quoted\\" project"');
	});
});

describe("renderFrontmatter tags integration", () => {
	it("does not render tags when enableTags is false", () => {
		const result = renderFrontmatter(makeRepo(), null, { ...DEFAULT_SETTINGS, enableTags: false });
		expect(result).not.toContain("tags:");
	});

	it("renders tags in frontmatter when enableTags is true", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			enableTags: true,
			tagPrefix: "projects/github",
			tagFields: ["owner", "fullName", "name", "isPrivate", "primaryLanguage", "languages", "topics", "license"],
		};
		const result = renderFrontmatter(makeRepo(), null, settings);

		expect(result).toContain("tags:");
		expect(result).toContain("  - projects/github/repo/user");
		expect(result).toContain("  - projects/github/repo/user/my-project");
		expect(result).toContain("  - projects/github/name/my-project");
		expect(result).toContain("  - projects/github/visibility/public");
		expect(result).toContain("  - projects/github/language/typescript");
		expect(result).toContain("  - projects/github/language/javascript");
		expect(result).toContain("  - projects/github/topic/cli");
		expect(result).toContain("  - projects/github/topic/tools");
		expect(result).toContain("  - projects/github/license/mit");
	});

	it("renders tags inside the frontmatter delimiters", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			enableTags: true,
			tagPrefix: "gh",
			tagFields: ["name"],
		};
		const result = renderFrontmatter(makeRepo(), null, settings);
		const lines = result.split("\n");
		const firstDelimiter = lines.indexOf("---");
		const lastDelimiter = lines.lastIndexOf("---");
		const tagsLine = lines.findIndex((l) => l.startsWith("tags:"));

		expect(tagsLine).toBeGreaterThan(firstDelimiter);
		expect(tagsLine).toBeLessThan(lastDelimiter);
	});

	it("renders no tags block when tagFields is empty", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			enableTags: true,
			tagPrefix: "projects/github",
			tagFields: [],
		};
		const result = renderFrontmatter(makeRepo(), null, settings);
		expect(result).not.toContain("tags:");
	});
});

describe("renderFrontmatter null pushedAt (line 45)", () => {
	it("renders empty string for pushed_at when pushedAt is null", () => {
		const result = renderFrontmatter(makeRepo({ pushedAt: null }), null, DEFAULT_SETTINGS);
		expect(result).toContain("pushed_at: ");
		// Should not contain a date value
		expect(result).toMatch(/pushed_at: \n/);
	});
});

describe("renderBody", () => {
	it("renders heading and description", () => {
		const result = renderBody(makeRepo());
		expect(result).toContain("# my-project");
		expect(result).toContain("A cool project");
	});

	it("renders issues table", () => {
		const result = renderBody(makeRepo());
		expect(result).toContain("## Open Issues (3)");
		expect(result).toContain("| # | Title | Author | Labels | Created |");
		expect(result).toContain("[Bug report](https://github.com/user/my-project/issues/1)");
		expect(result).toContain("@alice");
		expect(result).toContain("`bug`");
	});

	it("renders PRs table with status", () => {
		const result = renderBody(makeRepo());
		expect(result).toContain("## Open Pull Requests (1)");
		expect(result).toContain("| # | Title | Author | Labels | Status | Created |");
		expect(result).toContain("[Fix bug](https://github.com/user/my-project/pulls/2)");
		expect(result).toContain("APPROVED");
	});

	it("omits issues section when count is 0", () => {
		const result = renderBody(makeRepo({ issues: [], issuesCount: 0 }));
		expect(result).not.toContain("## Open Issues");
	});

	it("omits PRs section when count is 0", () => {
		const result = renderBody(makeRepo({ pullRequests: [], pullRequestsCount: 0 }));
		expect(result).not.toContain("## Open Pull Requests");
	});
});

describe("renderBody table branch coverage (lines 53-68)", () => {
	it("renders '—' in issues table when issue has no labels", () => {
		const repo = makeRepo({
			issues: [{
				title: "No-label issue",
				number: 5,
				url: "https://github.com/user/my-project/issues/5",
				author: "dave",
				labels: [],
				createdAt: "2026-04-01T00:00:00Z",
				updatedAt: "2026-04-01T00:00:00Z",
			}],
			issuesCount: 1,
		});
		const result = renderBody(repo);
		expect(result).toContain("| 5 |");
		expect(result).toContain("—");
	});

	it("renders PENDING in PRs table when reviewDecision is null", () => {
		const repo = makeRepo({
			pullRequests: [{
				title: "Draft PR",
				number: 10,
				url: "https://github.com/user/my-project/pulls/10",
				author: "eve",
				labels: [],
				createdAt: "2026-04-05T00:00:00Z",
				updatedAt: "2026-04-05T00:00:00Z",
				reviewDecision: null,
			}],
			pullRequestsCount: 1,
		});
		const result = renderBody(repo);
		expect(result).toContain("PENDING");
		expect(result).toContain("—");
	});

	it("renderBody with no description omits description section", () => {
		const result = renderBody(makeRepo({ description: null }));
		expect(result).not.toContain("undefined");
		expect(result).toContain("# my-project");
	});
});

describe("formatDate fallback branch (line 8)", () => {
	it("formatDate returns date portion of ISO string", () => {
		// Exercised via renderIssuesTable — createdAt "2026-04-01T00:00:00Z" → "2026-04-01"
		const repo = makeRepo({
			issues: [{
				title: "Test",
				number: 1,
				url: "https://github.com/user/my-project/issues/1",
				author: "alice",
				labels: ["bug"],
				createdAt: "2026-04-01T00:00:00Z",
				updatedAt: "2026-04-01T00:00:00Z",
			}],
			issuesCount: 1,
		});
		const result = renderBody(repo);
		expect(result).toContain("2026-04-01");
		expect(result).not.toContain("T00:00:00Z");
	});
});

describe("renderRepoFile", () => {
	it("combines frontmatter and body", () => {
		const result = renderRepoFile(makeRepo(), "GitHub/assets/my-project.png", DEFAULT_SETTINGS);
		expect(result).toMatch(/^---\n/);
		expect(result).toContain("---\n\n# my-project");
	});
});
