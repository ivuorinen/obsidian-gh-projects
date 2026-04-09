import { describe, it, expect } from "vitest";
import { generateTags, slugifyTagValue } from "../src/tags";
import type { RepoData } from "../src/types";

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
	return {
		name: "my-repo",
		owner: "ivuorinen",
		fullName: "ivuorinen/my-repo",
		description: null,
		url: "https://github.com/ivuorinen/my-repo",
		isPrivate: false,
		isFork: false,
		isArchived: false,
		primaryLanguage: "TypeScript",
		languages: ["TypeScript", "JavaScript"],
		topics: ["cli", "tools"],
		license: "MIT",
		stars: 10,
		forks: 2,
		watchers: 5,
		openGraphImageUrl: "https://opengraph.github.com/my-repo",
		pushedAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-02T00:00:00Z",
		issues: [],
		issuesCount: 0,
		pullRequests: [],
		pullRequestsCount: 0,
		...overrides,
	};
}

describe("slugifyTagValue", () => {
	it("lowercases and replaces spaces", () => {
		expect(slugifyTagValue("Hello World")).toBe("hello-world");
	});

	it("preserves forward slashes", () => {
		expect(slugifyTagValue("ivuorinen/my-repo")).toBe("ivuorinen/my-repo");
	});

	it("replaces special chars with dashes", () => {
		expect(slugifyTagValue("C++")).toBe("cpp");
	});

	it("handles C#", () => {
		expect(slugifyTagValue("C#")).toBe("csharp");
	});

	it("handles F#", () => {
		expect(slugifyTagValue("F#")).toBe("fsharp");
	});

	it("collapses consecutive dashes", () => {
		expect(slugifyTagValue("a--b")).toBe("a-b");
	});

	it("trims dashes", () => {
		expect(slugifyTagValue("-hello-")).toBe("hello");
	});

	it("handles dots", () => {
		expect(slugifyTagValue("vue.js")).toBe("vue-js");
	});
});

describe("generateTags", () => {
	const prefix = "projects/github";
	const allFields = [
		"owner", "fullName", "name",
		"isPrivate", "isFork", "isArchived",
		"primaryLanguage", "languages", "topics", "license",
	];

	it("generates tags for all fields", () => {
		const tags = generateTags(makeRepo(), prefix, allFields);
		expect(tags).toContain("projects/github/repo/ivuorinen");
		expect(tags).toContain("projects/github/repo/ivuorinen/my-repo");
		expect(tags).toContain("projects/github/name/my-repo");
		expect(tags).toContain("projects/github/visibility/public");
		expect(tags).toContain("projects/github/origin/original");
		expect(tags).toContain("projects/github/status/active");
		expect(tags).toContain("projects/github/language/typescript");
		expect(tags).toContain("projects/github/language/javascript");
		expect(tags).toContain("projects/github/topic/cli");
		expect(tags).toContain("projects/github/topic/tools");
		expect(tags).toContain("projects/github/license/mit");
	});

	it("handles boolean true values", () => {
		const tags = generateTags(makeRepo({ isPrivate: true, isFork: true, isArchived: true }), prefix, allFields);
		expect(tags).toContain("projects/github/visibility/private");
		expect(tags).toContain("projects/github/origin/fork");
		expect(tags).toContain("projects/github/status/archived");
	});

	it("skips null primaryLanguage", () => {
		const tags = generateTags(makeRepo({ primaryLanguage: null, languages: [] }), prefix, ["primaryLanguage"]);
		expect(tags).toHaveLength(0);
	});

	it("skips null license", () => {
		const tags = generateTags(makeRepo({ license: null }), prefix, ["license"]);
		expect(tags).toHaveLength(0);
	});

	it("deduplicates language tags", () => {
		const tags = generateTags(
			makeRepo({ primaryLanguage: "TypeScript", languages: ["TypeScript", "JavaScript"] }),
			prefix,
			["primaryLanguage", "languages"]
		);
		const tsCount = tags.filter((t) => t === "projects/github/language/typescript").length;
		expect(tsCount).toBe(1);
	});

	it("respects enabledFields filter", () => {
		const tags = generateTags(makeRepo(), prefix, ["owner", "name"]);
		expect(tags).toContain("projects/github/repo/ivuorinen");
		expect(tags).toContain("projects/github/name/my-repo");
		expect(tags).not.toContain("projects/github/language/typescript");
	});

	it("returns sorted tags", () => {
		const tags = generateTags(makeRepo(), prefix, allFields);
		const sorted = [...tags].sort();
		expect(tags).toEqual(sorted);
	});

	it("returns empty array when no fields enabled", () => {
		expect(generateTags(makeRepo(), prefix, [])).toEqual([]);
	});
});
