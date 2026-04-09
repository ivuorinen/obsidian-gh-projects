import { normalizePath, requestUrl, Notice } from "obsidian";
import type { App } from "obsidian";
import type { GHProjectsSettings, RepoData } from "./types";
import { fetchRepos } from "./github";
import { renderRepoFile } from "./markdown";

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

			new Notice(`GitHub sync complete: ${synced} updated, ${skipped} unchanged.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			new Notice(`GitHub sync failed: ${message}`);
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
			await this.downloadCoverImage(repo.openGraphImageUrl, coverPath);
		}

		const fileContent = renderRepoFile(repo, coverPath);

		if (existingFile) {
			await this.app.vault.modify(existingFile, fileContent);
		} else {
			await this.app.vault.create(filePath, fileContent);
		}

		return true;
	}

	private async downloadCoverImage(imageUrl: string, vaultPath: string): Promise<void> {
		const normalizedPath = normalizePath(vaultPath);
		const existingFile = this.app.vault.getFileByPath(normalizedPath);
		if (existingFile) return;

		try {
			const response = await requestUrl({ url: imageUrl });
			await this.app.vault.createBinary(normalizedPath, response.arrayBuffer);
		} catch (err) {
			console.warn(`Failed to download cover image for ${vaultPath}:`, err);
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
