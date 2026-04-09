import { describe, it, expect } from "vitest";
import { substituteTemplateVars } from "../src/templater";
import type { RepoData } from "../src/types";

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
	return {
		name: "my-project",
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
		openGraphImageUrl: null,
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

describe("substituteTemplateVars", () => {
	it("substitutes simple repo variables", () => {
		const template = "# {{repo.name}}\n{{repo.description}}\nStars: {{repo.stars}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toContain("# my-project");
		expect(result).toContain("A cool project");
		expect(result).toContain("Stars: 42");
	});

	it("substitutes all scalar variables", () => {
		const template = [
			"{{repo.name}}",
			"{{repo.description}}",
			"{{repo.url}}",
			"{{repo.language}}",
			"{{repo.stars}}",
			"{{repo.forks}}",
			"{{repo.watchers}}",
			"{{repo.openIssues}}",
			"{{repo.openPRs}}",
			"{{repo.license}}",
			"{{repo.pushedAt}}",
			"{{repo.updatedAt}}",
			"{{repo.private}}",
		].join("|");
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toBe(
			"my-project|A cool project|https://github.com/user/my-project|TypeScript|42|5|10|3|1|MIT|2026-04-07T14:00:00Z|2026-04-08T09:00:00Z|false"
		);
	});

	it("substitutes languages and topics as comma-separated", () => {
		const template = "Languages: {{repo.languages}}, Topics: {{repo.topics}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toBe("Languages: TypeScript, JavaScript, Topics: cli, tools");
	});

	it("handles null description gracefully", () => {
		const template = "Desc: {{repo.description}}";
		const result = substituteTemplateVars(template, makeRepo({ description: null }));
		expect(result).toBe("Desc: ");
	});

	it("handles null language gracefully", () => {
		const template = "Lang: {{repo.language}}";
		const result = substituteTemplateVars(template, makeRepo({ primaryLanguage: null }));
		expect(result).toBe("Lang: ");
	});

	it("iterates over issues block", () => {
		const template = "{{#issues}}- [#{{issue.number}}]({{issue.url}}) {{issue.title}} by @{{issue.author}}{{/issues}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toContain("- [#1](https://github.com/user/my-project/issues/1) Bug report by @alice");
	});

	it("iterates over pullRequests block", () => {
		const template = "{{#pullRequests}}- {{pr.title}} ({{pr.status}}){{/pullRequests}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toContain("- Fix bug (APPROVED)");
	});

	it("renders PENDING for null reviewDecision", () => {
		const template = "{{#pullRequests}}{{pr.status}}{{/pullRequests}}";
		const result = substituteTemplateVars(template, makeRepo({
			pullRequests: [{
				title: "WIP",
				number: 3,
				url: "https://github.com/user/my-project/pulls/3",
				author: "charlie",
				labels: [],
				createdAt: "2026-04-05T00:00:00Z",
				updatedAt: "2026-04-05T00:00:00Z",
				reviewDecision: null,
			}],
			pullRequestsCount: 1,
		}));
		expect(result).toBe("PENDING");
	});

	it("renders empty when no issues", () => {
		const template = "before{{#issues}}- {{issue.title}}{{/issues}}after";
		const result = substituteTemplateVars(template, makeRepo({ issues: [], issuesCount: 0 }));
		expect(result).toBe("beforeafter");
	});

	it("renders issue labels as backtick-wrapped", () => {
		const template = "{{#issues}}{{issue.labels}}{{/issues}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toContain("`bug`");
	});

	it("formats issue createdAt as date only", () => {
		const template = "{{#issues}}{{issue.createdAt}}{{/issues}}";
		const result = substituteTemplateVars(template, makeRepo());
		expect(result).toBe("2026-04-01");
	});
});
