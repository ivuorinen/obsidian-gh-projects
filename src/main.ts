import { Plugin, Notice, SuggestModal, TFile, normalizePath } from "obsidian";
import type { App } from "obsidian";
import { GHProjectsSettingTab } from "./settings";
import { SyncManager } from "./sync";
import { DEFAULT_SETTINGS } from "./types";
import type { GHProjectsSettings } from "./types";
import { settingsSchema } from "./schemas";
import { createLogger } from "./logger";
import type { Logger } from "./logger";

class RepoSuggestModal extends SuggestModal<TFile> {
	private files: TFile[];

	constructor(app: App, files: TFile[]) {
		super(app);
		this.files = files;
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.files.filter((f) =>
			f.basename.toLowerCase().includes(lower)
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createEl("div", { text: file.basename });
		el.createEl("small", { text: file.path, cls: "suggestion-note" });
	}

	onChooseSuggestion(file: TFile): void {
		void this.app.workspace.openLinkText(file.path, "", false);
	}
}

export default class GHProjectsPlugin extends Plugin {
	settings: GHProjectsSettings = DEFAULT_SETTINGS;
	private syncManager!: SyncManager;
	private syncIntervalId: number | null = null;
	private statusBarEl: HTMLElement | null = null;
	private logger!: Logger;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.logger = createLogger({
			getDebugMode: () => this.settings.debugMode,
			getToken: () => this.getToken(),
		});

		this.syncManager = new SyncManager(
			this.app,
			() => this.settings,
			() => this.getToken(),
			this.logger
		);

		this.addSettingTab(new GHProjectsSettingTab(this.app, this));

		this.addCommand({
			id: "sync-github-repos",
			name: "Sync GitHub repos now",
			callback: () => this.runSync(),
		});

		this.addCommand({
			id: "open-github-repo",
			name: "Open GitHub repo",
			callback: () => this.openRepoSwitcher(),
		});

		this.addRibbonIcon("github", "Sync GitHub repos", () => this.runSync());

		this.statusBarEl = this.addStatusBarItem();

		this.app.workspace.onLayoutReady(() => {
			void this.runSync();
			this.startSyncInterval();
		});
	}

	onunload(): void {
		this.clearSyncInterval();
	}

	async loadSettings(): Promise<void> {
		const raw: unknown = await this.loadData();
		const parsed = settingsSchema.parse(raw ?? {});
		this.settings = { ...DEFAULT_SETTINGS, ...parsed };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	restartSyncInterval(): void {
		this.clearSyncInterval();
		this.startSyncInterval();
	}

	private startSyncInterval(): void {
		const intervalMs = this.settings.syncInterval * 60 * 1000;
		this.syncIntervalId = window.setInterval(() => this.runSync(), intervalMs);
		this.registerInterval(this.syncIntervalId);
	}

	private clearSyncInterval(): void {
		if (this.syncIntervalId !== null) {
			window.clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}

	private getToken(): string | null {
		const secretName = this.settings.githubTokenName;
		if (!secretName) return null;
		return this.app.secretStorage.getSecret(secretName);
	}

	private async runSync(): Promise<void> {
		this.updateStatusBar(true);
		try {
			await this.syncManager.run();
		} finally {
			this.updateStatusBar(false);
		}
	}

	private updateStatusBar(syncing = false): void {
		if (!this.statusBarEl) return;
		this.statusBarEl.setText(syncing ? "GH: syncing..." : "");
	}

	private openRepoSwitcher(): void {
		const outputFolder = normalizePath(this.settings.outputFolder);
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.startsWith(outputFolder + "/"));

		if (files.length === 0) {
			new Notice("No synced repos found. Run a sync first.");
			return;
		}

		new RepoSuggestModal(this.app, files).open();
	}
}
