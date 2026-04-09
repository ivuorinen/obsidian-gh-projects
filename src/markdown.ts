import type { RepoData, IssueData, PRData } from "./types";

function escapeYamlString(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatDate(isoDate: string): string {
	return isoDate.split("T")[0] ?? isoDate;
}

function renderYamlList(items: string[], indent = 2): string {
	return items.map((item) => `${" ".repeat(indent)}- ${item}`).join("\n");
}

export function renderFrontmatter(repo: RepoData, coverPath: string | null): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${repo.name}`);
	lines.push(`owner: ${repo.owner}`);
	lines.push(`full_name: ${repo.fullName}`);
	lines.push(`description: "${escapeYamlString(repo.description ?? "")}"`);
	lines.push(`url: ${repo.url}`);
	lines.push(`private: ${repo.isPrivate}`);
	lines.push(`is_fork: ${repo.isFork}`);
	lines.push(`is_archived: ${repo.isArchived}`);
	lines.push(`language: ${repo.primaryLanguage ?? ""}`);

	if (repo.languages.length > 0) {
		lines.push("languages:");
		lines.push(renderYamlList(repo.languages));
	}

	if (repo.topics.length > 0) {
		lines.push("topics:");
		lines.push(renderYamlList(repo.topics));
	}

	lines.push(`license: ${repo.license ?? ""}`);
	lines.push(`stars: ${repo.stars}`);
	lines.push(`forks: ${repo.forks}`);
	lines.push(`watchers: ${repo.watchers}`);
	lines.push(`open_issues: ${repo.issuesCount}`);
	lines.push(`open_prs: ${repo.pullRequestsCount}`);

	if (coverPath) {
		lines.push(`cover: ${coverPath}`);
	}

	lines.push(`pushed_at: ${repo.pushedAt ?? ""}`);
	lines.push(`updated_at: ${repo.updatedAt}`);
	lines.push(`synced_at: ${new Date().toISOString()}`);
	lines.push("---");

	return lines.join("\n");
}

function renderIssuesTable(issues: IssueData[]): string {
	const header = "| # | Title | Author | Labels | Created |";
	const separator = "|---|-------|--------|--------|---------|";
	const rows = issues.map((issue) => {
		const labels = issue.labels.map((l) => `\`${l}\``).join(", ") || "—";
		return `| ${issue.number} | [${issue.title}](${issue.url}) | @${issue.author} | ${labels} | ${formatDate(issue.createdAt)} |`;
	});
	return [header, separator, ...rows].join("\n");
}

function renderPRsTable(prs: PRData[]): string {
	const header = "| # | Title | Author | Labels | Status | Created |";
	const separator = "|---|-------|--------|--------|--------|---------|";
	const rows = prs.map((pr) => {
		const labels = pr.labels.map((l) => `\`${l}\``).join(", ") || "—";
		const status = pr.reviewDecision ?? "PENDING";
		return `| ${pr.number} | [${pr.title}](${pr.url}) | @${pr.author} | ${labels} | ${status} | ${formatDate(pr.createdAt)} |`;
	});
	return [header, separator, ...rows].join("\n");
}

export function renderBody(repo: RepoData): string {
	const sections: string[] = [];

	sections.push(`# ${repo.name}`);

	if (repo.description) {
		sections.push(repo.description);
	}

	if (repo.issuesCount > 0 && repo.issues.length > 0) {
		sections.push(`## Open Issues (${repo.issuesCount})`);
		sections.push(renderIssuesTable(repo.issues));
	}

	if (repo.pullRequestsCount > 0 && repo.pullRequests.length > 0) {
		sections.push(`## Open Pull Requests (${repo.pullRequestsCount})`);
		sections.push(renderPRsTable(repo.pullRequests));
	}

	return sections.join("\n\n");
}

export function renderRepoFile(repo: RepoData, coverPath: string | null): string {
	const frontmatter = renderFrontmatter(repo, coverPath);
	const body = renderBody(repo);
	return `${frontmatter}\n\n${body}\n`;
}
