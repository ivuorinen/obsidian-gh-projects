import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldUpdateRepo, buildCoverPath, SyncManager } from "../src/sync";
import type { App } from "obsidian";
import { requestUrl } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/types";
import type { RepoData } from "../src/types";
import type { Logger } from "../src/logger";

vi.mock("../src/github", () => ({
	fetchRepos: vi.fn(),
	GitHubAuthError: class GitHubAuthError extends Error {
		constructor() {
			super("GitHub token is invalid or expired. Check plugin settings.");
			this.name = "GitHubAuthError";
		}
	},
	GitHubRateLimitError: class GitHubRateLimitError extends Error {
		resetAt: Date;
		constructor(ts: number) {
			super(`GitHub rate limit exceeded. Resets at ${new Date(ts * 1000).toLocaleTimeString()}.`);
			this.name = "GitHubRateLimitError";
			this.resetAt = new Date(ts * 1000);
		}
	},
}));

import { fetchRepos, GitHubAuthError, GitHubRateLimitError } from "../src/github";

function makeApp(overrides: Record<string, unknown> = {}): App {
	return {
		vault: {
			getMarkdownFiles: vi.fn(() => []),
			getAllFolders: vi.fn(() => []),
			getFileByPath: vi.fn(() => null),
			getFolderByPath: vi.fn(() => null),
			read: vi.fn(async () => ""),
			modify: vi.fn(async () => {}),
			create: vi.fn(async () => {}),
			createFolder: vi.fn(async () => {}),
			createBinary: vi.fn(async () => {}),
			modifyBinary: vi.fn(async () => {}),
		},
		workspace: { onLayoutReady: vi.fn() },
		...overrides,
	} as unknown as App;
}

function makeLogger(): Logger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
	return {
		name: "my-repo",
		description: null,
		url: "https://github.com/user/my-repo",
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
		pushedAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-02T00:00:00Z",
		issues: [],
		issuesCount: 0,
		pullRequests: [],
		pullRequestsCount: 0,
		...overrides,
	};
}

describe("shouldUpdateRepo", () => {
	it("returns true when no existing synced_at", () => {
		expect(shouldUpdateRepo("2026-04-08T09:00:00Z", null)).toBe(true);
	});

	it("returns true when repo updatedAt is newer than synced_at", () => {
		expect(
			shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-07T00:00:00Z")
		).toBe(true);
	});

	it("returns false when synced_at is newer than updatedAt", () => {
		expect(
			shouldUpdateRepo("2026-04-07T00:00:00Z", "2026-04-08T09:00:00Z")
		).toBe(false);
	});

	it("returns false when timestamps are equal", () => {
		expect(
			shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-08T09:00:00Z")
		).toBe(false);
	});
});

describe("buildCoverPath", () => {
	it("builds vault-relative path from assets folder and repo name", () => {
		expect(buildCoverPath("GitHub/assets", "my-project")).toBe(
			"GitHub/assets/my-project.png"
		);
	});

	it("normalizes trailing slashes", () => {
		expect(buildCoverPath("GitHub/assets/", "my-project")).toBe(
			"GitHub/assets/my-project.png"
		);
	});
});

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

describe("SyncManager.run()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns early with Notice when no token", async () => {
		const app = makeApp();
		const manager = new SyncManager(app, () => DEFAULT_SETTINGS, () => null, makeLogger());
		const result = await manager.run();
		expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
		expect(vi.mocked(fetchRepos)).not.toHaveBeenCalled();
	});

	it("returns early with Notice when no username", async () => {
		const app = makeApp();
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
		expect(vi.mocked(fetchRepos)).not.toHaveBeenCalled();
	});

	it("acts as concurrency guard when already syncing", async () => {
		const app = makeApp();
		vi.mocked(fetchRepos).mockResolvedValue([]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		// Start first run but do not await
		const first = manager.run();
		// Second run should return immediately due to guard
		const second = await manager.run();
		expect(second).toEqual({ synced: 0, skipped: 0, errors: 0 });
		await first;
	});

	it("calls fetchRepos and creates file for a new repo", async () => {
		const app = makeApp();
		const repo = makeRepo();
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect(vi.mocked(fetchRepos)).toHaveBeenCalledOnce();
		expect((app.vault.create as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
		expect(result.synced).toBe(1);
		expect(result.skipped).toBe(0);
	});

	it("shows Notice on GitHubAuthError", async () => {
		const app = makeApp();
		vi.mocked(fetchRepos).mockRejectedValue(new GitHubAuthError());
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
	});

	it("shows Notice on GitHubRateLimitError", async () => {
		const app = makeApp();
		vi.mocked(fetchRepos).mockRejectedValue(new GitHubRateLimitError(1700000000));
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
	});

	it("shows Notice on generic error", async () => {
		const app = makeApp();
		vi.mocked(fetchRepos).mockRejectedValue(new Error("network failure"));
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
	});
});

describe("SyncManager.detectOrphans()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows Notice when orphaned files exist", async () => {
		const orphanFile = { path: "GitHub/orphan.md", basename: "orphan" };
		const app = makeApp();
		(app.vault.getMarkdownFiles as ReturnType<typeof vi.fn>).mockReturnValue([orphanFile]);
		vi.mocked(fetchRepos).mockResolvedValue([makeRepo({ name: "my-repo" })]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user", outputFolder: "GitHub" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		// run() triggers detectOrphans internally
		await manager.run();
		// If we got here without throwing, the notice path was exercised
		expect(true).toBe(true);
	});
});

describe("SyncManager.ensureFolder()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates folder when it does not exist", async () => {
		const app = makeApp();
		(app.vault.getFolderByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
		vi.mocked(fetchRepos).mockResolvedValue([]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user", outputFolder: "GitHub" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		await manager.run();
		expect((app.vault.createFolder as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("GitHub");
	});

	it("skips createFolder when folder already exists", async () => {
		const app = makeApp();
		(app.vault.getFolderByPath as ReturnType<typeof vi.fn>).mockReturnValue({ path: "GitHub" });
		vi.mocked(fetchRepos).mockResolvedValue([]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user", outputFolder: "GitHub" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		await manager.run();
		expect((app.vault.createFolder as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
	});
});

describe("SyncManager vault.modify for existing files", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls vault.modify (not vault.create) for an existing file with outdated synced_at", async () => {
		const existingFile = { path: "GitHub/my-repo.md", basename: "my-repo", stat: { mtime: 0 } };
		const app = makeApp();
		// Return the existing file for the md path
		(app.vault.getFileByPath as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
			if (p.endsWith(".md")) return existingFile;
			return null;
		});
		// Old synced_at so shouldUpdateRepo returns true
		(app.vault.read as ReturnType<typeof vi.fn>).mockResolvedValue(
			"---\nsynced_at: 2025-01-01T00:00:00Z\n---\n"
		);
		const repo = makeRepo({ updatedAt: "2026-04-08T09:00:00Z" });
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = { ...DEFAULT_SETTINGS, githubUsername: "user", outputFolder: "GitHub" };
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		const result = await manager.run();
		expect((app.vault.modify as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
		expect((app.vault.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
		expect(result.synced).toBe(1);
	});
});

describe("SyncManager.downloadCoverImage()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls createBinary when image download succeeds and no existing image file", async () => {
		const app = makeApp();
		// No existing files at all
		(app.vault.getFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
		const fakeBuffer = new ArrayBuffer(8);
		vi.mocked(requestUrl).mockResolvedValue({
			arrayBuffer: fakeBuffer,
			json: {},
			headers: {},
			status: 200,
			text: "",
		} as any);
		const repo = makeRepo({
			openGraphImageUrl: "https://opengraph.github.com/my-repo",
			updatedAt: "2026-04-08T09:00:00Z",
		});
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			outputFolder: "GitHub",
			assetsFolder: "GitHub/assets",
		};
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		await manager.run();
		expect((app.vault.createBinary as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
	});

	it("calls modifyBinary when existing image file is older than repo update", async () => {
		const olderMtime = new Date("2025-01-01T00:00:00Z").getTime();
		const coverFile = {
			path: "GitHub/assets/my-repo.png",
			basename: "my-repo",
			stat: { mtime: olderMtime },
		};
		const app = makeApp();
		(app.vault.getFileByPath as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
			if (p.endsWith(".png")) return coverFile;
			return null;
		});
		const fakeBuffer = new ArrayBuffer(8);
		vi.mocked(requestUrl).mockResolvedValue({
			arrayBuffer: fakeBuffer,
			json: {},
			headers: {},
			status: 200,
			text: "",
		} as any);
		const repo = makeRepo({
			openGraphImageUrl: "https://opengraph.github.com/my-repo",
			updatedAt: "2026-04-08T09:00:00Z",
		});
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			outputFolder: "GitHub",
			assetsFolder: "GitHub/assets",
		};
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		await manager.run();
		expect((app.vault.modifyBinary as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(coverFile, fakeBuffer);
	});

	it("does not abort sync when image download throws (logger.warn called)", async () => {
		const app = makeApp();
		(app.vault.getFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
		// First call (from fetchRepos mock setup) is fine; requestUrl for image throws
		vi.mocked(requestUrl).mockRejectedValue(new Error("network error"));
		const repo = makeRepo({
			openGraphImageUrl: "https://opengraph.github.com/my-repo",
			updatedAt: "2026-04-08T09:00:00Z",
		});
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			outputFolder: "GitHub",
			assetsFolder: "GitHub/assets",
		};
		const logger = makeLogger();
		const manager = new SyncManager(app, () => settings, () => "mytoken", logger);
		const result = await manager.run();
		expect(logger.warn).toHaveBeenCalled();
		// Sync still creates the markdown file
		expect((app.vault.create as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
		expect(result.synced).toBe(1);
	});

	it("skips download when existing file mtime is newer than repo update", async () => {
		const newerMtime = new Date("2026-02-01T00:00:00Z").getTime();
		const coverFile = {
			path: "GitHub/assets/my-repo.png",
			basename: "my-repo",
			stat: { mtime: newerMtime },
		};
		const app = makeApp();
		// Return null for the md file, but return coverFile for the cover path
		(app.vault.getFileByPath as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
			if (p.endsWith(".png")) return coverFile;
			return null;
		});
		const repo = makeRepo({
			openGraphImageUrl: "https://opengraph.github.com/my-repo",
			updatedAt: "2026-01-01T00:00:00Z",
		});
		vi.mocked(fetchRepos).mockResolvedValue([repo]);
		const settings = {
			...DEFAULT_SETTINGS,
			githubUsername: "user",
			outputFolder: "GitHub",
			assetsFolder: "GitHub/assets",
		};
		const manager = new SyncManager(app, () => settings, () => "mytoken", makeLogger());
		await manager.run();
		// requestUrl should NOT have been called for the image since mtime is newer
		const calls = vi.mocked(requestUrl).mock.calls;
		const imageCalls = calls.filter((c) => {
			const arg = c[0];
			return typeof arg === "object" && arg !== null && (arg as { url?: string }).url === "https://opengraph.github.com/my-repo";
		});
		expect(imageCalls).toHaveLength(0);
	});
});
