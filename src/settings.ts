import {
	App,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	TFolder,
	TFile,
	SecretComponent,
} from "obsidian";
import type GHProjectsPlugin from "./main";

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	getSuggestions(inputStr: string): TFolder[] {
		const folders: TFolder[] = [];
		const lowerInput = inputStr.toLowerCase();

		this.app.vault.getAllFolders().forEach((folder: TFolder) => {
			if (folder.path.toLowerCase().includes(lowerInput)) {
				folders.push(folder);
			}
		});

		return folders.slice(0, 20);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.close();
	}
}

class FileSuggest extends AbstractInputSuggest<TFile> {
	getSuggestions(inputStr: string): TFile[] {
		const files: TFile[] = [];
		const lowerInput = inputStr.toLowerCase();

		this.app.vault.getMarkdownFiles().forEach((file: TFile) => {
			if (file.path.toLowerCase().includes(lowerInput)) {
				files.push(file);
			}
		});

		return files.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.close();
	}
}

export class GHProjectsSettingTab extends PluginSettingTab {
	plugin: GHProjectsPlugin;

	constructor(app: App, plugin: GHProjectsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Authentication").setHeading();

		new Setting(containerEl)
			.setName("GitHub token")
			.setDesc("Select or create a secret for your GitHub personal access token.")
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.plugin.settings.githubTokenName)
					.onChange(async (value: string) => {
						this.plugin.settings.githubTokenName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("GitHub username")
			.setDesc("Your GitHub username to fetch repositories for.")
			.addText((text) =>
				text
					.setPlaceholder("Octocat")
					.setValue(this.plugin.settings.githubUsername)
					.onChange(async (value) => {
						this.plugin.settings.githubUsername = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("File locations").setHeading();

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Folder where repository Markdown files are saved.")
			.addSearch((search) => {
				search
					.setPlaceholder("GitHub")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Assets folder")
			.setDesc("Folder where cover images are downloaded.")
			.addSearch((search) => {
				search
					.setPlaceholder("GitHub/assets")
					.setValue(this.plugin.settings.assetsFolder)
					.onChange(async (value) => {
						this.plugin.settings.assetsFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Template file")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Templater" is a plugin name
			.setDesc("Optional Templater template for customizing the Markdown body. Leave empty for default.")
			.addSearch((search) => {
				search
					.setPlaceholder("Templates/github-repo.md")
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value;
						await this.plugin.saveSettings();
					});
				new FileSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl).setName("Sync").setHeading();

		new Setting(containerEl)
			.setName("Sync interval")
			.setDesc("How often to automatically sync repositories (in minutes).")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("15", "15 minutes")
					.addOption("30", "30 minutes")
					.addOption("60", "1 hour")
					.addOption("360", "6 hours")
					.setValue(String(this.plugin.settings.syncInterval))
					.onChange(async (value) => {
						this.plugin.settings.syncInterval = Number(value);
						await this.plugin.saveSettings();
						this.plugin.restartSyncInterval();
					})
			);

		new Setting(containerEl)
			.setName("Issues limit")
			.setDesc("Maximum number of open issues to fetch per repository.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("0", "None")
					.addOption("10", "10")
					.addOption("25", "25")
					.addOption("50", "50")
					.setValue(String(this.plugin.settings.issuesLimit))
					.onChange(async (value) => {
						this.plugin.settings.issuesLimit = Number(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Pull requests limit")
			.setDesc("Maximum number of open pull requests to fetch per repository.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("0", "None")
					.addOption("10", "10")
					.addOption("25", "25")
					.addOption("50", "50")
					.setValue(String(this.plugin.settings.prsLimit))
					.onChange(async (value) => {
						this.plugin.settings.prsLimit = Number(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Repository filters").setHeading();

		new Setting(containerEl)
			.setName("Include forks")
			.setDesc("Include forked repositories in sync.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeForks)
					.onChange(async (value) => {
						this.plugin.settings.includeForks = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include archived")
			.setDesc("Include archived repositories in sync.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeArchived)
					.onChange(async (value) => {
						this.plugin.settings.includeArchived = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include organization repos")
			.setDesc("Include repositories from organizations you belong to.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeOrgRepos)
					.onChange(async (value) => {
						this.plugin.settings.includeOrgRepos = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
