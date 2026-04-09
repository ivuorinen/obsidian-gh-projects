import { normalizePath, requestUrl, Notice } from "obsidian";
import type { App } from "obsidian";
import type { GHProjectsSettings, RepoData } from "./types";
import { fetchRepos, GitHubAuthError, GitHubRateLimitError, isRequestUrlError } from "./github";
import { renderBody, renderFrontmatter } from "./markdown";
import { renderBodyWithTemplate } from "./templater";
import type { Logger } from "./logger";

export function shouldUpdateRepo(
	repoUpdatedAt: string,
	existingSyncedAt: string | null
): boolean {
	if (!existingSyncedAt) return true;
	return new Date(repoUpdatedAt) > new Date(existingSyncedAt);
}

export function buildCoverPath(assetsFolder: string, repoName: string): string {
	const folder = assetsFolder.replace(/\/+$/, "");
	return `${folder}/${repoName}.png`;
}

export function slugifyRepoName(
	name: string,
	owner: string,
	username: string,
	includeOrgRepos: boolean
): string {
	let slug = name
		.toLowerCase()
		.replace(/^\.+/, "")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-|-$/g, "");

	if (includeOrgRepos && owner.toLowerCase() !== username.toLowerCase()) {
		slug = `${owner.toLowerCase()}--${slug}`;
	}

	return slug;
}

function extractFrontmatterKeys(content: string): string[] {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch?.[1]) return [];
	return fmMatch[1]
		.split("\n")
		.filter((line) => /^[a-z_]+:/.test(line))
		.map((line) => line.split(":")[0] ?? "")
		.filter(Boolean);
}

function extractSyncedAt(content: string): string | null {
	const match = content.match(/^synced_at:\s*(.+)$/m);
	return match?.[1]?.trim() ?? null;
}

export class SyncManager {
	private syncing = false;

	constructor(
		private app: App,
		private getSettings: () => GHProjectsSettings,
		private getToken: () => string | null,
		private logger: Logger
	) {}

	get isSyncing(): boolean {
		return this.syncing;
	}

	async run(): Promise<{ synced: number; skipped: number; errors: number }> {
		if (this.syncing) {
			new Notice("GitHub sync is already running.");
			return { synced: 0, skipped: 0, errors: 0 };
		}

		this.syncing = true;
		try {
			return await this.doSync();
		} finally {
			this.syncing = false;
		}
	}

	async resetAndSync(): Promise<{ deleted: number; synced: number; skipped: number; errors: number }> {
		if (this.syncing) {
			new Notice("GitHub sync is already running.");
			return { deleted: 0, synced: 0, skipped: 0, errors: 0 };
		}

		this.syncing = true;
		try {
			// Preflight: validate credentials before deleting anything
			const token = this.getToken();
			if (!token) {
				new Notice("GitHub token not configured. Check plugin settings.");
				return { deleted: 0, synced: 0, skipped: 0, errors: 0 };
			}
			const settings = this.getSettings();
			if (!settings.githubUsername) {
				new Notice("GitHub username not configured. Check plugin settings.");
				return { deleted: 0, synced: 0, skipped: 0, errors: 0 };
			}

			// Delete root-level markdown files in output folder
			const outputFolder = normalizePath(settings.outputFolder);
			const filesToDelete = this.app.vault
				.getMarkdownFiles()
				.filter((f) => f.path.startsWith(outputFolder + "/") && !f.path.slice(outputFolder.length + 1).includes("/"));

			let deleted = 0;
			for (const file of filesToDelete) {
				await this.app.fileManager.trashFile(file);
				deleted++;
			}

			this.logger.info(`Reset: deleted ${deleted} file(s) from ${outputFolder}`);

			const result = await this.doSync();
			return { deleted, ...result };
		} finally {
			this.syncing = false;
		}
	}

	private async doSync(): Promise<{ synced: number; skipped: number; errors: number }> {
		const token = this.getToken();
		if (!token) {
			new Notice("GitHub token not configured. Check plugin settings.");
			return { synced: 0, skipped: 0, errors: 0 };
		}

		const settings = this.getSettings();
		if (!settings.githubUsername) {
			new Notice("GitHub username not configured. Check plugin settings.");
			return { synced: 0, skipped: 0, errors: 0 };
		}

		let synced = 0;
		let skipped = 0;
		let errors = 0;

		try {
			this.logger.debug(`Starting sync for user: ${settings.githubUsername}`);
			const repos = await fetchRepos(token, settings);
			this.logger.debug(`Fetched ${repos.length} repositories`);

			await this.ensureFolder(settings.outputFolder);
			if (repos.some((r) => r.openGraphImageUrl)) {
				await this.ensureFolder(settings.assetsFolder);
			}

			for (const repo of repos) {
				this.logger.debug(`Processing repo: ${repo.fullName}`);
				try {
					const updated = await this.syncRepo(repo, settings);
					if (updated) {
						synced++;
					} else {
						skipped++;
					}
				} catch (err: unknown) {
					this.logger.error(`Failed to sync repo ${repo.name}:`, err);
					errors++;
				}
			}

			this.logger.debug(`Sync results: ${synced} synced, ${skipped} skipped, ${errors} errors`);
			this.detectOrphans(repos, settings);

			new Notice(`GitHub sync complete: ${synced} updated, ${skipped} unchanged.`);
		} catch (err: unknown) {
			if (err instanceof GitHubAuthError) {
				new Notice("GitHub token is invalid or expired. Check plugin settings.");
			} else if (err instanceof GitHubRateLimitError) {
				new Notice(err.message);
			} else {
				const message = err instanceof Error ? err.message : "Unknown error";
				new Notice(`GitHub sync failed: ${message}`);
			}
			this.logger.error("GitHub sync failed:", err);
		}

		return { synced, skipped, errors };
	}

	private async syncRepo(repo: RepoData, settings: GHProjectsSettings): Promise<boolean> {
		const slug = slugifyRepoName(repo.name, repo.owner, settings.githubUsername, settings.includeOrgRepos);
		const filePath = normalizePath(`${settings.outputFolder}/${slug}.md`);
		const existingFile = this.app.vault.getFileByPath(filePath);
		const coverPath = repo.openGraphImageUrl ? buildCoverPath(settings.assetsFolder, slug) : null;

		if (existingFile) {
			const content = await this.app.vault.read(existingFile);
			const needsMigration = this.isMissingFrontmatterFields(content, repo, coverPath, settings);
			if (!needsMigration) {
				const syncedAt = extractSyncedAt(content);
				if (!shouldUpdateRepo(repo.updatedAt, syncedAt)) {
					this.logger.debug(`Skipping ${repo.name}: up-to-date (synced_at: ${syncedAt})`);
					return false;
				}
			} else {
				this.logger.debug(`Migrating ${repo.name}: missing frontmatter fields`);
			}
		}

		if (coverPath && repo.openGraphImageUrl) {
			await this.downloadCoverImage(repo.openGraphImageUrl, coverPath, repo.updatedAt);
		}

		let body: string;
		if (settings.templatePath) {
			body = await renderBodyWithTemplate(this.app, settings.templatePath, repo, this.logger);
		} else {
			body = renderBody(repo);
		}
		const frontmatter = renderFrontmatter(repo, coverPath, settings);
		const fileContent = `${frontmatter}\n\n${body}\n`;

		if (existingFile) {
			this.logger.debug(`Updating ${filePath}`);
			await this.app.vault.modify(existingFile, fileContent);
		} else {
			this.logger.debug(`Creating ${filePath}`);
			await this.app.vault.create(filePath, fileContent);
		}

		return true;
	}

	private async downloadCoverImage(imageUrl: string, vaultPath: string, repoUpdatedAt: string): Promise<void> {
		const normalizedPath = normalizePath(vaultPath);
		const existingFile = this.app.vault.getFileByPath(normalizedPath);

		if (existingFile) {
			const repoTime = new Date(repoUpdatedAt).getTime();
			if (existingFile.stat.mtime >= repoTime) {
				this.logger.debug(`Cover image cached: ${vaultPath}`);
				return;
			}
		}

		this.logger.debug(`Downloading cover image: ${vaultPath}`);
		const MAX_RETRIES = 3;
		for (let retry = 0; retry <= MAX_RETRIES; retry++) {
			try {
				const response = await requestUrl({ url: imageUrl });
				if (existingFile) {
					await this.app.vault.modifyBinary(existingFile, response.arrayBuffer);
				} else {
					await this.app.vault.createBinary(normalizedPath, response.arrayBuffer);
				}
				return;
			} catch (err: unknown) {
				if (isRequestUrlError(err) && err.status === 429 && retry < MAX_RETRIES) {
					const retryAfterHeader = err.headers?.["retry-after"];
					const retryAfter = Number(retryAfterHeader) || 0;
					const delay = Math.max(retryAfter * 1000, 1000 * Math.pow(2, retry));
					this.logger.debug(`Rate limited downloading ${vaultPath}, retrying in ${delay}ms (retry ${retry + 1}/${MAX_RETRIES})`);
					await this.sleep(delay);
					continue;
				}

				this.logger.warn(`Failed to download cover image for ${vaultPath}:`, err);
				return;
			}
		}
	}

	private isMissingFrontmatterFields(
		existingContent: string,
		repo: RepoData,
		coverPath: string | null,
		settings: GHProjectsSettings
	): boolean {
		const expectedFrontmatter = renderFrontmatter(repo, coverPath, settings);
		const expectedKeys = extractFrontmatterKeys(expectedFrontmatter);
		const existingKeys = extractFrontmatterKeys(existingContent);
		return expectedKeys.some((key) => !existingKeys.includes(key));
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private detectOrphans(repos: RepoData[], settings: GHProjectsSettings): void {
		const outputFolder = normalizePath(settings.outputFolder);
		const repoSlugs = new Set(
			repos.map((r) => slugifyRepoName(r.name, r.owner, settings.githubUsername, settings.includeOrgRepos))
		);
		const orphans: string[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(outputFolder + "/")) continue;
			const relativePath = file.path.slice(outputFolder.length + 1);
			if (relativePath.includes("/")) continue;
			const basename = file.basename;
			if (!repoSlugs.has(basename)) {
				orphans.push(basename);
			}
		}

		if (orphans.length > 0) {
			this.logger.debug(`Detected ${orphans.length} orphan(s): ${orphans.join(", ")}`);
			new Notice(
				`GitHub sync: ${orphans.length} file(s) no longer match filters: ${orphans.slice(0, 3).join(", ")}${orphans.length > 3 ? "..." : ""}`
			);
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const folder = this.app.vault.getFolderByPath(normalizedPath);
		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}
}
