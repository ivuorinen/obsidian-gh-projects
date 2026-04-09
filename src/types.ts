import type { PullRequestReviewDecision } from "./schemas";

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
  debugMode: boolean;
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
  debugMode: false,
};

// --- GitHub Data (app-level, constructed by parser functions) ---

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
  openGraphImageUrl: string;
  pushedAt: string | null;
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
  reviewDecision: PullRequestReviewDecision | null;
}
