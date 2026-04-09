import { Plugin, Notice, SuggestModal, TFile, normalizePath } from "obsidian";
import type { App } from "obsidian";
import { GHProjectsSettingTab } from "./settings";
import { SyncManager } from "./sync";
import { DEFAULT_SETTINGS } from "./types";
import type { GHProjectsSettings } from "./types";

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
		this.app.workspace.openLinkText(file.path, "", false);
	}
}

export default class GHProjectsPlugin extends Plugin {
	settings: GHProjectsSettings = DEFAULT_SETTINGS;
	private syncManager!: SyncManager;
	private syncIntervalId: number | null = null;
	private statusBarEl: HTMLElement | null = null;
	private lastSyncTime: Date | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.syncManager = new SyncManager(
			this.app,
			() => this.settings,
			() => this.getToken()
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
		this.updateStatusBar();

		this.app.workspace.onLayoutReady(() => {
			this.runSync();
			this.startSyncInterval();
		});

		// Update status bar every 60 seconds
		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), 60 * 1000)
		);
	}

	onunload(): void {
		this.clearSyncInterval();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		this.updateStatusBar("syncing...");

		try {
			await this.syncManager.run();
			this.lastSyncTime = new Date();
		} finally {
			this.updateStatusBar();
		}
	}

	private updateStatusBar(override?: string): void {
		if (!this.statusBarEl) return;

		if (override) {
			this.statusBarEl.setText(`GH: ${override}`);
			return;
		}

		if (this.lastSyncTime) {
			const ago = this.timeSince(this.lastSyncTime);
			this.statusBarEl.setText(`GH: synced ${ago} ago`);
		} else {
			this.statusBarEl.setText("GH: not synced");
		}
	}

	private timeSince(date: Date): string {
		const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h`;
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
