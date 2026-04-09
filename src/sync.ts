import { normalizePath, requestUrl, Notice } from "obsidian";
import type { App } from "obsidian";
import type { GHProjectsSettings, RepoData } from "./types";
import { fetchRepos, GitHubAuthError, GitHubRateLimitError } from "./github";
import { renderBody, renderFrontmatter } from "./markdown";
import { renderBodyWithTemplate } from "./templater";

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

function extractSyncedAt(content: string): string | null {
	const match = content.match(/^synced_at:\s*(.+)$/m);
	if (!match) return null;
	const value = match[1];
	return value ? value.trim() : null;
}

export class SyncManager {
	private syncing = false;

	constructor(
		private app: App,
		private getSettings: () => GHProjectsSettings,
		private getToken: () => string | null
	) {}

	get isSyncing(): boolean {
		return this.syncing;
	}

	async run(): Promise<{ synced: number; skipped: number; errors: number }> {
		if (this.syncing) {
			new Notice("GitHub sync is already running.");
			return { synced: 0, skipped: 0, errors: 0 };
		}

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

		this.syncing = true;
		let synced = 0;
		let skipped = 0;
		let errors = 0;

		try {
			const repos = await fetchRepos(token, settings);

			await this.ensureFolder(settings.outputFolder);
			if (repos.some((r) => r.openGraphImageUrl)) {
				await this.ensureFolder(settings.assetsFolder);
			}

			for (const repo of repos) {
				try {
					const updated = await this.syncRepo(repo, settings);
					if (updated) {
						synced++;
					} else {
						skipped++;
					}
				} catch (err) {
					console.error(`Failed to sync repo ${repo.name}:`, err);
					errors++;
				}
			}

			this.detectOrphans(repos, settings);

			new Notice(`GitHub sync complete: ${synced} updated, ${skipped} unchanged.`);
		} catch (err) {
			if (err instanceof GitHubAuthError) {
				new Notice("GitHub token is invalid or expired. Check plugin settings.");
			} else if (err instanceof GitHubRateLimitError) {
				new Notice(err.message);
			} else {
				const message = err instanceof Error ? err.message : "Unknown error";
				new Notice(`GitHub sync failed: ${message}`);
			}
			console.error("GitHub sync failed:", err);
		} finally {
			this.syncing = false;
		}

		return { synced, skipped, errors };
	}

	private async syncRepo(repo: RepoData, settings: GHProjectsSettings): Promise<boolean> {
		const filePath = normalizePath(`${settings.outputFolder}/${repo.name}.md`);
		const existingFile = this.app.vault.getFileByPath(filePath);

		if (existingFile) {
			const content = await this.app.vault.read(existingFile);
			const syncedAt = extractSyncedAt(content);
			if (!shouldUpdateRepo(repo.updatedAt, syncedAt)) {
				return false;
			}
		}

		let coverPath: string | null = null;
		if (repo.openGraphImageUrl) {
			coverPath = buildCoverPath(settings.assetsFolder, repo.name);
			await this.downloadCoverImage(repo.openGraphImageUrl, coverPath, repo.updatedAt);
		}

		let body: string;
		if (settings.templatePath) {
			body = await renderBodyWithTemplate(this.app, settings.templatePath, repo);
		} else {
			body = renderBody(repo);
		}
		const frontmatter = renderFrontmatter(repo, coverPath);
		const fileContent = `${frontmatter}\n\n${body}\n`;

		if (existingFile) {
			await this.app.vault.modify(existingFile, fileContent);
		} else {
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
				return;
			}
		}

		try {
			const response = await requestUrl({ url: imageUrl });
			if (existingFile) {
				await this.app.vault.modifyBinary(existingFile, response.arrayBuffer);
			} else {
				await this.app.vault.createBinary(normalizedPath, response.arrayBuffer);
			}
		} catch (err) {
			console.warn(`Failed to download cover image for ${vaultPath}:`, err);
		}
	}

	private detectOrphans(repos: RepoData[], settings: GHProjectsSettings): void {
		const outputFolder = normalizePath(settings.outputFolder);
		const repoNames = new Set(repos.map((r) => r.name));
		const orphans: string[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(outputFolder + "/")) continue;
			const basename = file.basename;
			if (!repoNames.has(basename)) {
				orphans.push(basename);
			}
		}

		if (orphans.length > 0) {
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
