import type { RepoData } from "./types";

const SPECIAL_NAMES: Record<string, string> = {
	"C++": "cpp",
	"C#": "csharp",
	"F#": "fsharp",
	"F*": "fstar",
	"Objective-C++": "objective-cpp",
};

export function slugifyTagValue(value: string): string {
	if (SPECIAL_NAMES[value]) return SPECIAL_NAMES[value];
	return value
		.toLowerCase()
		.replace(/[^a-z0-9/-]/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-|-$/g, "");
}

type TagField =
	| "owner"
	| "fullName"
	| "name"
	| "isPrivate"
	| "isFork"
	| "isArchived"
	| "primaryLanguage"
	| "languages"
	| "topics"
	| "license";

export const TAG_FIELDS: readonly TagField[] = [
	"owner",
	"fullName",
	"name",
	"isPrivate",
	"isFork",
	"isArchived",
	"primaryLanguage",
	"languages",
	"topics",
	"license",
] as const;

export function generateTags(
	repo: RepoData,
	prefix: string,
	enabledFields: string[],
): string[] {
	const tags = new Set<string>();
	const enabled = new Set(enabledFields);

	if (enabled.has("owner")) {
		tags.add(`${prefix}/repo/${slugifyTagValue(repo.owner)}`);
	}

	if (enabled.has("fullName")) {
		tags.add(`${prefix}/repo/${slugifyTagValue(repo.fullName)}`);
	}

	if (enabled.has("name")) {
		tags.add(`${prefix}/name/${slugifyTagValue(repo.name)}`);
	}

	if (enabled.has("isPrivate")) {
		tags.add(`${prefix}/visibility/${repo.isPrivate ? "private" : "public"}`);
	}

	if (enabled.has("isFork")) {
		tags.add(`${prefix}/origin/${repo.isFork ? "fork" : "original"}`);
	}

	if (enabled.has("isArchived")) {
		tags.add(`${prefix}/status/${repo.isArchived ? "archived" : "active"}`);
	}

	if (enabled.has("primaryLanguage") && repo.primaryLanguage) {
		tags.add(`${prefix}/language/${slugifyTagValue(repo.primaryLanguage)}`);
	}

	if (enabled.has("languages")) {
		for (const lang of repo.languages) {
			tags.add(`${prefix}/language/${slugifyTagValue(lang)}`);
		}
	}

	if (enabled.has("topics")) {
		for (const topic of repo.topics) {
			tags.add(`${prefix}/topic/${slugifyTagValue(topic)}`);
		}
	}

	if (enabled.has("license") && repo.license) {
		tags.add(`${prefix}/license/${slugifyTagValue(repo.license)}`);
	}

	return [...tags].sort();
}
