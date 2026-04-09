import { App, Notice } from "obsidian";
import type { RepoData } from "./types";
import { renderBody } from "./markdown";
import type { Logger } from "./logger";

interface ObsidianAppWithPlugins extends App {
  plugins?: {
    getPlugin?(id: string): unknown;
  };
}

let templateWarningShown = false;

export function getTemplaterPlugin(app: App): unknown {
  const appWithPlugins = app as ObsidianAppWithPlugins;
  return appWithPlugins.plugins?.getPlugin?.("templater-obsidian") ?? null;
}

export async function renderWithTemplater(
	app: App,
	templatePath: string,
	repo: RepoData,
	logger: Logger
): Promise<string | null> {
	const templater = getTemplaterPlugin(app);
	if (!templater) {
		if (!templateWarningShown) {
			new Notice(
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Templater" is a plugin name
				"Templater plugin not found. Using default renderer. Install Templater for custom templates."
			);
			templateWarningShown = true;
		}
		return null;
	}

	const templateFile = app.vault.getFileByPath(templatePath);
	if (!templateFile) {
		if (!templateWarningShown) {
			new Notice(`Template file not found: ${templatePath}. Using default renderer.`);
			templateWarningShown = true;
		}
		return null;
	}

	try {
		let template = await app.vault.read(templateFile);
		template = substituteTemplateVars(template, repo);
		return template;
	} catch (err: unknown) {
		logger.error(`Templater rendering failed for ${repo.name}:`, err);
		return null;
	}
}

export function substituteTemplateVars(template: string, repo: RepoData): string {
	const replacements: Record<string, string> = {
		"{{repo.name}}": repo.name,
		"{{repo.owner}}": repo.owner,
		"{{repo.fullName}}": repo.fullName,
		"{{repo.description}}": repo.description ?? "",
		"{{repo.url}}": repo.url,
		"{{repo.language}}": repo.primaryLanguage ?? "",
		"{{repo.languages}}": repo.languages.join(", "),
		"{{repo.topics}}": repo.topics.join(", "),
		"{{repo.stars}}": String(repo.stars),
		"{{repo.forks}}": String(repo.forks),
		"{{repo.watchers}}": String(repo.watchers),
		"{{repo.openIssues}}": String(repo.issuesCount),
		"{{repo.openPRs}}": String(repo.pullRequestsCount),
		"{{repo.license}}": repo.license ?? "",
		"{{repo.pushedAt}}": repo.pushedAt ?? "",
		"{{repo.updatedAt}}": repo.updatedAt,
		"{{repo.private}}": String(repo.isPrivate),
	};

	let result = template;
	for (const [key, value] of Object.entries(replacements)) {
		result = result.replaceAll(key, value);
	}

	const issueBlockRegex = /\{\{#issues\}\}([\s\S]*?)\{\{\/issues\}\}/g;
	result = result.replace(issueBlockRegex, (_match, block: string) => {
		return repo.issues
			.map((issue) =>
				block
					.replace(/\{\{issue\.title\}\}/g, issue.title)
					.replace(/\{\{issue\.number\}\}/g, String(issue.number))
					.replace(/\{\{issue\.url\}\}/g, issue.url)
					.replace(/\{\{issue\.author\}\}/g, issue.author)
					.replace(/\{\{issue\.labels\}\}/g, issue.labels.map((l) => `\`${l}\``).join(", "))
					.replace(/\{\{issue\.createdAt\}\}/g, issue.createdAt.split("T")[0] ?? issue.createdAt)
			)
			.join("\n");
	});

	const prBlockRegex = /\{\{#pullRequests\}\}([\s\S]*?)\{\{\/pullRequests\}\}/g;
	result = result.replace(prBlockRegex, (_match, block: string) => {
		return repo.pullRequests
			.map((pr) =>
				block
					.replace(/\{\{pr\.title\}\}/g, pr.title)
					.replace(/\{\{pr\.number\}\}/g, String(pr.number))
					.replace(/\{\{pr\.url\}\}/g, pr.url)
					.replace(/\{\{pr\.author\}\}/g, pr.author)
					.replace(/\{\{pr\.labels\}\}/g, pr.labels.map((l) => `\`${l}\``).join(", "))
					.replace(/\{\{pr\.status\}\}/g, pr.reviewDecision ?? "PENDING")
					.replace(/\{\{pr\.createdAt\}\}/g, pr.createdAt.split("T")[0] ?? pr.createdAt)
			)
			.join("\n");
	});

	return result;
}

export function renderBodyWithTemplate(
	app: App,
	templatePath: string,
	repo: RepoData,
	logger: Logger
): Promise<string> {
	return renderWithTemplater(app, templatePath, repo, logger).then(
		(result) => result ?? renderBody(repo)
	);
}
