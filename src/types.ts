// --- Plugin Settings ---

export interface GHProjectsSettings {
	githubTokenName: string;
	githubUsername: string;
	outputFolder: string;
	assetsFolder: string;
	templatePath: string;
	syncInterval: number;
	issuesLimit: number;
	prsLimit: number;
	includeForks: boolean;
	includeArchived: boolean;
	includeOrgRepos: boolean;
}

export const DEFAULT_SETTINGS: GHProjectsSettings = {
	githubTokenName: "",
	githubUsername: "",
	outputFolder: "GitHub",
	assetsFolder: "GitHub/assets",
	templatePath: "",
	syncInterval: 60,
	issuesLimit: 25,
	prsLimit: 25,
	includeForks: false,
	includeArchived: false,
	includeOrgRepos: false,
};

// --- GitHub Data ---

export interface RepoData {
	name: string;
	description: string | null;
	url: string;
	isPrivate: boolean;
	isFork: boolean;
	isArchived: boolean;
	primaryLanguage: string | null;
	languages: string[];
	topics: string[];
	license: string | null;
	stars: number;
	forks: number;
	watchers: number;
	openGraphImageUrl: string | null;
	pushedAt: string;
	updatedAt: string;
	issues: IssueData[];
	issuesCount: number;
	pullRequests: PRData[];
	pullRequestsCount: number;
}

export interface IssueData {
	title: string;
	number: number;
	url: string;
	author: string;
	labels: string[];
	createdAt: string;
	updatedAt: string;
}

export interface PRData extends IssueData {
	reviewDecision: string | null;
}

// --- GitHub GraphQL Response Types ---

export interface GraphQLResponse {
	data: {
		user: {
			repositories: {
				nodes: GraphQLRepoNode[];
				pageInfo: {
					hasNextPage: boolean;
					endCursor: string | null;
				};
			};
		};
	};
	errors?: Array<{ message: string }>;
}

export interface GraphQLRepoNode {
	name: string;
	description: string | null;
	url: string;
	isPrivate: boolean;
	isFork: boolean;
	isArchived: boolean;
	primaryLanguage: { name: string } | null;
	languages: { nodes: Array<{ name: string }> };
	repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
	licenseInfo: { spdxId: string; name: string } | null;
	stargazerCount: number;
	forkCount: number;
	watchers: { totalCount: number };
	openGraphImageUrl: string | null;
	pushedAt: string;
	updatedAt: string;
	issues: {
		totalCount: number;
		nodes: GraphQLIssueNode[];
	};
	pullRequests: {
		totalCount: number;
		nodes: GraphQLPRNode[];
	};
}

export interface GraphQLIssueNode {
	title: string;
	number: number;
	url: string;
	author: { login: string } | null;
	labels: { nodes: Array<{ name: string }> };
	createdAt: string;
	updatedAt: string;
}

export interface GraphQLPRNode extends GraphQLIssueNode {
	reviewDecision: string | null;
}
