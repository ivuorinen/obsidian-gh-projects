# Obsidian GitHub Projects Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that syncs GitHub repositories into markdown files with frontmatter for Bases card view integration.

**Architecture:** Modular TypeScript plugin with 7 source files. GitHub GraphQL API fetches repo data, a sync orchestrator diffs and writes markdown files to the vault, and an optional Templater integration allows body customization. Secrets stored via Obsidian's SecretStorage API.

**Tech Stack:** TypeScript, Obsidian API (1.8.0+), GitHub GraphQL API, esbuild, vitest

**Spec:** `docs/superpowers/specs/2026-04-08-obsidian-gh-projects-design.md`

**Code style:** This project uses **tabs** for indentation per `.editorconfig` (matching the official obsidian-sample-plugin). Code blocks in Tasks 2–10 use spaces for markdown readability — convert to tabs when writing actual files.

**Base template:** Scaffolding in Task 1 follows [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) exactly, with vitest added for testing.

---

## File Structure

Based on [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin), extended with our modules.

```
obsidian-gh-projects/
├── .editorconfig              — Editor formatting (tabs, utf-8, lf)
├── .gitignore                 — Git ignores
├── .npmrc                     — npm config (tag-version-prefix="")
├── manifest.json              — Obsidian plugin manifest
├── versions.json              — Version compatibility map
├── package.json               — Dependencies and scripts
├── tsconfig.json              — TypeScript config
├── esbuild.config.mjs         — Build config (from sample plugin)
├── eslint.config.mts          — ESLint with obsidianmd plugin
├── version-bump.mjs           — Version bump script (from sample plugin)
├── vitest.config.ts           — Vitest test config
├── styles.css                 — Plugin styles (initially empty)
├── src/
│   ├── main.ts                — Plugin lifecycle, commands, interval, ribbon, status bar
│   ├── types.ts               — RepoData, IssueData, PRData, settings interfaces
│   ├── github.ts              — GraphQL query, response types, parseRepos(), fetchRepos()
│   ├── markdown.ts            — renderFrontmatter(), renderBody(), renderRepoFile()
│   ├── sync.ts                — SyncManager: diff, write files, download images
│   ├── settings.ts            — SettingsTab, FolderSuggest, FileSuggest
│   └── templater.ts           — Templater detection, template rendering with fallback
├── tests/
│   ├── setup.ts               — Obsidian module mock
│   ├── github.test.ts         — parseRepos() tests
│   ├── markdown.test.ts       — Frontmatter and body rendering tests
│   └── sync.test.ts           — Diff logic tests
└── docs/
    └── superpowers/            — Spec and plan docs
```

---

## Task 1: Project Scaffolding

Based on [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin). We use the official configs verbatim where possible, adding vitest on top.

**Files:**
- Create: `manifest.json`
- Create: `versions.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `eslint.config.mts`
- Create: `version-bump.mjs`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `styles.css`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create manifest.json**

```json
{
	"id": "obsidian-gh-projects",
	"name": "GitHub Projects",
	"version": "0.1.0",
	"minAppVersion": "1.8.0",
	"description": "Sync GitHub repositories into markdown files with Bases card view support.",
	"author": "Ismo Vuorinen",
	"authorUrl": "https://github.com/ivuorinen",
	"isDesktopOnly": false
}
```

- [ ] **Step 2: Create versions.json**

```json
{
	"0.1.0": "1.8.0"
}
```

- [ ] **Step 3: Create package.json**

Note: Follows sample plugin structure — `"type": "module"`, `obsidian` in `dependencies`, uses `node:module` builtins (no `builtin-modules` npm package). Adds `vitest` for testing.

```json
{
	"name": "obsidian-gh-projects",
	"version": "0.1.0",
	"description": "Sync GitHub repositories into markdown files with Bases card view support.",
	"main": "main.js",
	"type": "module",
	"scripts": {
		"dev": "node esbuild.config.mjs",
		"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
		"version": "node version-bump.mjs && git add manifest.json versions.json",
		"lint": "eslint .",
		"test": "vitest run",
		"test:watch": "vitest"
	},
	"keywords": ["obsidian", "github", "sync"],
	"author": "Ismo Vuorinen",
	"license": "MIT",
	"dependencies": {
		"obsidian": "latest"
	},
	"devDependencies": {
		"@eslint/js": "9.30.1",
		"@types/node": "^16.11.6",
		"esbuild": "0.25.5",
		"eslint-plugin-obsidianmd": "0.1.9",
		"globals": "14.0.0",
		"jiti": "2.6.1",
		"tslib": "2.4.0",
		"typescript": "^5.8.3",
		"typescript-eslint": "8.35.1",
		"vitest": "^3.1.0"
	}
}
```

- [ ] **Step 4: Create tsconfig.json**

From sample plugin verbatim, with `"exclude"` added for tests:

```json
{
	"compilerOptions": {
		"baseUrl": "src",
		"inlineSourceMap": true,
		"inlineSources": true,
		"module": "ESNext",
		"target": "ES6",
		"allowJs": true,
		"noImplicitAny": true,
		"noImplicitThis": true,
		"noImplicitReturns": true,
		"moduleResolution": "node",
		"importHelpers": true,
		"noUncheckedIndexedAccess": true,
		"isolatedModules": true,
		"strictNullChecks": true,
		"strictBindCallApply": true,
		"allowSyntheticDefaultImports": true,
		"useUnknownInCatchVariables": true,
		"lib": [
			"DOM",
			"ES5",
			"ES6",
			"ES7"
		]
	},
	"include": [
		"src/**/*.ts"
	],
	"exclude": [
		"node_modules",
		"tests"
	]
}
```

- [ ] **Step 5: Create esbuild.config.mjs**

From sample plugin verbatim:

```javascript
import esbuild from "esbuild";
import process from "process";
import { builtinModules } from 'node:module';

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === "production");

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtinModules],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
```

- [ ] **Step 6: Create eslint.config.mts**

From sample plugin verbatim:

```typescript
import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
```

- [ ] **Step 7: Create version-bump.mjs**

From sample plugin verbatim:

```javascript
import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!Object.values(versions).includes(minAppVersion)) {
    versions[targetVersion] = minAppVersion;
    writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}
```

- [ ] **Step 8: Create .editorconfig**

From sample plugin verbatim:

```
# top-most EditorConfig file
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = tab
indent_size = 4
tab_width = 4
```

- [ ] **Step 9: Create .gitignore**

From sample plugin, with additions for tests:

```
# vscode
.vscode

# Intellij
*.iml
.idea

# npm
node_modules

# Don't include the compiled main.js file in the repo.
# They should be uploaded to GitHub releases instead.
main.js

# Exclude sourcemaps
*.map

# obsidian
data.json

# Exclude macOS Finder (System Explorer) View States
.DS_Store
```

- [ ] **Step 10: Create .npmrc**

```
tag-version-prefix=""
```

- [ ] **Step 11: Create styles.css**

```css
/* GitHub Projects plugin styles */
```

- [ ] **Step 12: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["tests/setup.ts"],
	},
});
```

- [ ] **Step 13: Create tests/setup.ts with Obsidian mock**

```typescript
import { vi } from "vitest";

vi.mock("obsidian", () => ({
	Plugin: class {},
	PluginSettingTab: class {},
	Setting: class {
		setName() { return this; }
		setDesc() { return this; }
		addText() { return this; }
		addToggle() { return this; }
		addDropdown() { return this; }
		addSearch() { return this; }
		addComponent() { return this; }
		setHeading() { return this; }
	},
	Notice: class {
		constructor(public message: string) {}
	},
	normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
	requestUrl: vi.fn(),
	AbstractInputSuggest: class {
		constructor(public app: unknown, public inputEl: HTMLElement) {}
	},
	SuggestModal: class {
		constructor(public app: unknown) {}
	},
	TFile: class {},
	TFolder: class {},
	SecretComponent: class {},
}));
```

- [ ] **Step 14: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 15: Verify test setup**

Run: `npx vitest run 2>&1 | tail -5`
Expected: "No test files found" or similar (expected — no tests yet).

- [ ] **Step 16: Commit scaffolding**

```bash
git add manifest.json versions.json package.json package-lock.json tsconfig.json esbuild.config.mjs eslint.config.mts version-bump.mjs .editorconfig .gitignore .npmrc styles.css vitest.config.ts tests/setup.ts docs/
git commit -m "chore: scaffold Obsidian plugin from sample-plugin template

Set up build toolchain with esbuild, TypeScript, ESLint with
obsidianmd plugin, and vitest. Plugin manifest targets Obsidian 1.8.0+
for SecretStorage API support."
```

---

## Task 2: Types Module

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types.ts with all interfaces**

```typescript
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
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript type definitions

Define interfaces for plugin settings, GitHub repo/issue/PR data,
and GraphQL API response shapes."
```

---

## Task 3: GitHub Client (TDD)

**Files:**
- Create: `src/github.ts`
- Create: `tests/github.test.ts`

- [ ] **Step 1: Write test for parseRepoNode()**

Create `tests/github.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRepoNode } from "../src/github";
import type { GraphQLRepoNode } from "../src/types";

function makeRepoNode(overrides: Partial<GraphQLRepoNode> = {}): GraphQLRepoNode {
  return {
    name: "test-repo",
    description: "A test repository",
    url: "https://github.com/user/test-repo",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    primaryLanguage: { name: "TypeScript" },
    languages: { nodes: [{ name: "TypeScript" }, { name: "JavaScript" }] },
    repositoryTopics: { nodes: [{ topic: { name: "cli" } }, { topic: { name: "tools" } }] },
    licenseInfo: { spdxId: "MIT", name: "MIT License" },
    stargazerCount: 42,
    forkCount: 5,
    watchers: { totalCount: 10 },
    openGraphImageUrl: "https://opengraph.github.com/test-repo",
    pushedAt: "2026-04-07T14:00:00Z",
    updatedAt: "2026-04-08T09:00:00Z",
    issues: {
      totalCount: 3,
      nodes: [
        {
          title: "Bug report",
          number: 1,
          url: "https://github.com/user/test-repo/issues/1",
          author: { login: "alice" },
          labels: { nodes: [{ name: "bug" }] },
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-02T00:00:00Z",
        },
      ],
    },
    pullRequests: {
      totalCount: 1,
      nodes: [
        {
          title: "Fix bug",
          number: 2,
          url: "https://github.com/user/test-repo/pulls/2",
          author: { login: "bob" },
          labels: { nodes: [{ name: "bug" }, { name: "fix" }] },
          createdAt: "2026-04-03T00:00:00Z",
          updatedAt: "2026-04-04T00:00:00Z",
          reviewDecision: "APPROVED",
        },
      ],
    },
    ...overrides,
  };
}

describe("parseRepoNode", () => {
  it("parses a full repo node into RepoData", () => {
    const result = parseRepoNode(makeRepoNode());

    expect(result.name).toBe("test-repo");
    expect(result.description).toBe("A test repository");
    expect(result.url).toBe("https://github.com/user/test-repo");
    expect(result.isPrivate).toBe(false);
    expect(result.primaryLanguage).toBe("TypeScript");
    expect(result.languages).toEqual(["TypeScript", "JavaScript"]);
    expect(result.topics).toEqual(["cli", "tools"]);
    expect(result.license).toBe("MIT");
    expect(result.stars).toBe(42);
    expect(result.forks).toBe(5);
    expect(result.watchers).toBe(10);
    expect(result.openGraphImageUrl).toBe("https://opengraph.github.com/test-repo");
    expect(result.issuesCount).toBe(3);
    expect(result.pullRequestsCount).toBe(1);
  });

  it("parses issues correctly", () => {
    const result = parseRepoNode(makeRepoNode());

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].title).toBe("Bug report");
    expect(result.issues[0].number).toBe(1);
    expect(result.issues[0].author).toBe("alice");
    expect(result.issues[0].labels).toEqual(["bug"]);
  });

  it("parses pull requests with review decision", () => {
    const result = parseRepoNode(makeRepoNode());

    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0].title).toBe("Fix bug");
    expect(result.pullRequests[0].reviewDecision).toBe("APPROVED");
    expect(result.pullRequests[0].labels).toEqual(["bug", "fix"]);
  });

  it("handles null primaryLanguage", () => {
    const result = parseRepoNode(makeRepoNode({ primaryLanguage: null }));
    expect(result.primaryLanguage).toBeNull();
  });

  it("handles null author on issue", () => {
    const node = makeRepoNode({
      issues: {
        totalCount: 1,
        nodes: [
          {
            title: "Ghost issue",
            number: 99,
            url: "https://github.com/user/test-repo/issues/99",
            author: null,
            labels: { nodes: [] },
            createdAt: "2026-04-01T00:00:00Z",
            updatedAt: "2026-04-01T00:00:00Z",
          },
        ],
      },
    });
    const result = parseRepoNode(node);
    expect(result.issues[0].author).toBe("unknown");
  });

  it("handles null licenseInfo", () => {
    const result = parseRepoNode(makeRepoNode({ licenseInfo: null }));
    expect(result.license).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/github.test.ts 2>&1 | tail -10`
Expected: FAIL — `Cannot find module '../src/github'`

- [ ] **Step 3: Implement github.ts**

Create `src/github.ts`:

```typescript
import { requestUrl } from "obsidian";
import type {
  GraphQLRepoNode,
  GraphQLIssueNode,
  GraphQLPRNode,
  GraphQLResponse,
  RepoData,
  IssueData,
  PRData,
  GHProjectsSettings,
} from "./types";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const REPOS_QUERY = `
query($username: String!, $first: Int!, $issuesFirst: Int!, $prsFirst: Int!, $after: String, $affiliations: [RepositoryAffiliation!]!) {
  user(login: $username) {
    repositories(
      first: $first,
      after: $after,
      ownerAffiliations: $affiliations,
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      nodes {
        name
        description
        url
        isPrivate
        isFork
        isArchived
        primaryLanguage { name }
        languages(first: 5) { nodes { name } }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        licenseInfo { spdxId name }
        stargazerCount
        forkCount
        watchers { totalCount }
        openGraphImageUrl
        pushedAt
        updatedAt
        issues(first: $issuesFirst, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            title number url
            author { login }
            labels(first: 5) { nodes { name } }
            createdAt updatedAt
          }
        }
        pullRequests(first: $prsFirst, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            title number url
            author { login }
            labels(first: 5) { nodes { name } }
            createdAt updatedAt
            reviewDecision
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

export function parseIssueNode(node: GraphQLIssueNode): IssueData {
  return {
    title: node.title,
    number: node.number,
    url: node.url,
    author: node.author?.login ?? "unknown",
    labels: node.labels.nodes.map((l) => l.name),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

export function parsePRNode(node: GraphQLPRNode): PRData {
  return {
    ...parseIssueNode(node),
    reviewDecision: node.reviewDecision ?? null,
  };
}

export function parseRepoNode(node: GraphQLRepoNode): RepoData {
  return {
    name: node.name,
    description: node.description,
    url: node.url,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    isArchived: node.isArchived,
    primaryLanguage: node.primaryLanguage?.name ?? null,
    languages: node.languages.nodes.map((l) => l.name),
    topics: node.repositoryTopics.nodes.map((t) => t.topic.name),
    license: node.licenseInfo?.spdxId ?? null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    watchers: node.watchers.totalCount,
    openGraphImageUrl: node.openGraphImageUrl,
    pushedAt: node.pushedAt,
    updatedAt: node.updatedAt,
    issues: node.issues.nodes.map(parseIssueNode),
    issuesCount: node.issues.totalCount,
    pullRequests: node.pullRequests.nodes.map(parsePRNode),
    pullRequestsCount: node.pullRequests.totalCount,
  };
}

export function filterRepos(repos: RepoData[], settings: GHProjectsSettings): RepoData[] {
  return repos.filter((repo) => {
    if (!settings.includeForks && repo.isFork) return false;
    if (!settings.includeArchived && repo.isArchived) return false;
    return true;
  });
}

export async function fetchRepos(
  token: string,
  settings: GHProjectsSettings
): Promise<RepoData[]> {
  const allRepos: RepoData[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  const issuesFirst = settings.issuesLimit || 1;
  const prsFirst = settings.prsLimit || 1;

  const affiliations: string[] = ["OWNER"];
  if (settings.includeOrgRepos) {
    affiliations.push("ORGANIZATION_MEMBER");
  }

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      username: settings.githubUsername,
      first: 100,
      issuesFirst,
      prsFirst,
      after,
      affiliations,
    };

    const response = await requestUrl({
      url: GITHUB_GRAPHQL_URL,
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: REPOS_QUERY, variables }),
    });

    const json: GraphQLResponse = response.json;

    if (json.errors?.length) {
      throw new Error(`GitHub API error: ${json.errors[0].message}`);
    }

    const { nodes, pageInfo } = json.data.user.repositories;
    allRepos.push(...nodes.map(parseRepoNode));
    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor;
  }

  // Zero out issues/PRs if user set limit to 0
  if (settings.issuesLimit === 0) {
    for (const repo of allRepos) {
      repo.issues = [];
    }
  }
  if (settings.prsLimit === 0) {
    for (const repo of allRepos) {
      repo.pullRequests = [];
    }
  }

  return filterRepos(allRepos, settings);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/github.test.ts 2>&1 | tail -10`
Expected: All 6 tests PASS.

- [ ] **Step 5: Add filterRepos tests**

Append to `tests/github.test.ts`:

```typescript
import { filterRepos } from "../src/github";
import { DEFAULT_SETTINGS } from "../src/types";
import type { RepoData } from "../src/types";

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
  return {
    name: "test",
    description: null,
    url: "",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    primaryLanguage: null,
    languages: [],
    topics: [],
    license: null,
    stars: 0,
    forks: 0,
    watchers: 0,
    openGraphImageUrl: null,
    pushedAt: "",
    updatedAt: "",
    issues: [],
    issuesCount: 0,
    pullRequests: [],
    pullRequestsCount: 0,
    ...overrides,
  };
}

describe("filterRepos", () => {
  it("excludes forks by default", () => {
    const repos = [makeRepo({ name: "original" }), makeRepo({ name: "fork", isFork: true })];
    const result = filterRepos(repos, DEFAULT_SETTINGS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("original");
  });

  it("includes forks when setting is enabled", () => {
    const repos = [makeRepo({ name: "fork", isFork: true })];
    const result = filterRepos(repos, { ...DEFAULT_SETTINGS, includeForks: true });
    expect(result).toHaveLength(1);
  });

  it("excludes archived by default", () => {
    const repos = [makeRepo({ name: "archived", isArchived: true })];
    const result = filterRepos(repos, DEFAULT_SETTINGS);
    expect(result).toHaveLength(0);
  });

  it("includes archived when setting is enabled", () => {
    const repos = [makeRepo({ name: "archived", isArchived: true })];
    const result = filterRepos(repos, { ...DEFAULT_SETTINGS, includeArchived: true });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run tests/github.test.ts 2>&1 | tail -10`
Expected: All 10 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/github.ts tests/github.test.ts
git commit -m "feat: add GitHub GraphQL client with repo parsing

Implement fetchRepos() with pagination, parseRepoNode() for data
transformation, and filterRepos() for client-side filtering.
Full test coverage for parsing and filtering logic."
```

---

## Task 4: Markdown Renderer (TDD)

**Files:**
- Create: `src/markdown.ts`
- Create: `tests/markdown.test.ts`

- [ ] **Step 1: Write tests for frontmatter rendering**

Create `tests/markdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderFrontmatter, renderBody, renderRepoFile } from "../src/markdown";
import type { RepoData } from "../src/types";

function makeRepo(overrides: Partial<RepoData> = {}): RepoData {
  return {
    name: "my-project",
    description: "A cool project",
    url: "https://github.com/user/my-project",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    primaryLanguage: "TypeScript",
    languages: ["TypeScript", "JavaScript"],
    topics: ["cli", "tools"],
    license: "MIT",
    stars: 42,
    forks: 5,
    watchers: 10,
    openGraphImageUrl: "https://opengraph.github.com/my-project",
    pushedAt: "2026-04-07T14:00:00Z",
    updatedAt: "2026-04-08T09:00:00Z",
    issues: [
      {
        title: "Bug report",
        number: 1,
        url: "https://github.com/user/my-project/issues/1",
        author: "alice",
        labels: ["bug"],
        createdAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-02T00:00:00Z",
      },
    ],
    issuesCount: 3,
    pullRequests: [
      {
        title: "Fix bug",
        number: 2,
        url: "https://github.com/user/my-project/pulls/2",
        author: "bob",
        labels: ["bug", "fix"],
        createdAt: "2026-04-03T00:00:00Z",
        updatedAt: "2026-04-04T00:00:00Z",
        reviewDecision: "APPROVED",
      },
    ],
    pullRequestsCount: 1,
    ...overrides,
  };
}

describe("renderFrontmatter", () => {
  it("renders all fields in YAML frontmatter", () => {
    const result = renderFrontmatter(makeRepo(), "GitHub/assets/my-project.png");

    expect(result).toContain("---");
    expect(result).toContain("name: my-project");
    expect(result).toContain('description: "A cool project"');
    expect(result).toContain("url: https://github.com/user/my-project");
    expect(result).toContain("private: false");
    expect(result).toContain("language: TypeScript");
    expect(result).toContain("  - TypeScript");
    expect(result).toContain("  - cli");
    expect(result).toContain("license: MIT");
    expect(result).toContain("stars: 42");
    expect(result).toContain("forks: 5");
    expect(result).toContain("watchers: 10");
    expect(result).toContain("open_issues: 3");
    expect(result).toContain("open_prs: 1");
    expect(result).toContain("cover: GitHub/assets/my-project.png");
    expect(result).toContain("synced_at:");
  });

  it("omits cover when no image path", () => {
    const result = renderFrontmatter(makeRepo({ openGraphImageUrl: null }), null);
    expect(result).not.toContain("cover:");
  });

  it("handles null description", () => {
    const result = renderFrontmatter(makeRepo({ description: null }), null);
    expect(result).toContain('description: ""');
  });

  it("escapes quotes in description", () => {
    const result = renderFrontmatter(makeRepo({ description: 'A "quoted" project' }), null);
    expect(result).toContain('description: "A \\"quoted\\" project"');
  });
});

describe("renderBody", () => {
  it("renders heading and description", () => {
    const result = renderBody(makeRepo());

    expect(result).toContain("# my-project");
    expect(result).toContain("A cool project");
  });

  it("renders issues table", () => {
    const result = renderBody(makeRepo());

    expect(result).toContain("## Open Issues (3)");
    expect(result).toContain("| # | Title | Author | Labels | Created |");
    expect(result).toContain("[Bug report](https://github.com/user/my-project/issues/1)");
    expect(result).toContain("@alice");
    expect(result).toContain("`bug`");
  });

  it("renders PRs table with status", () => {
    const result = renderBody(makeRepo());

    expect(result).toContain("## Open Pull Requests (1)");
    expect(result).toContain("| # | Title | Author | Labels | Status | Created |");
    expect(result).toContain("[Fix bug](https://github.com/user/my-project/pulls/2)");
    expect(result).toContain("APPROVED");
  });

  it("omits issues section when count is 0", () => {
    const result = renderBody(makeRepo({ issues: [], issuesCount: 0 }));
    expect(result).not.toContain("## Open Issues");
  });

  it("omits PRs section when count is 0", () => {
    const result = renderBody(makeRepo({ pullRequests: [], pullRequestsCount: 0 }));
    expect(result).not.toContain("## Open Pull Requests");
  });
});

describe("renderRepoFile", () => {
  it("combines frontmatter and body", () => {
    const result = renderRepoFile(makeRepo(), "GitHub/assets/my-project.png");

    expect(result).toMatch(/^---\n/);
    expect(result).toContain("---\n\n# my-project");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/markdown.test.ts 2>&1 | tail -10`
Expected: FAIL — `Cannot find module '../src/markdown'`

- [ ] **Step 3: Implement markdown.ts**

Create `src/markdown.ts`:

```typescript
import type { RepoData, IssueData, PRData } from "./types";

function escapeYamlString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatDate(isoDate: string): string {
  return isoDate.split("T")[0];
}

function renderYamlList(items: string[], indent = 2): string {
  return items.map((item) => `${" ".repeat(indent)}- ${item}`).join("\n");
}

export function renderFrontmatter(repo: RepoData, coverPath: string | null): string {
  const lines: string[] = ["---"];

  lines.push(`name: ${repo.name}`);
  lines.push(`description: "${escapeYamlString(repo.description ?? "")}"`);
  lines.push(`url: ${repo.url}`);
  lines.push(`private: ${repo.isPrivate}`);
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

  lines.push(`pushed_at: ${repo.pushedAt}`);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/markdown.test.ts 2>&1 | tail -10`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/markdown.ts tests/markdown.test.ts
git commit -m "feat: add markdown renderer for repo files

Implement renderFrontmatter(), renderBody(), and renderRepoFile().
Generates YAML frontmatter with Bases-compatible cover paths and
markdown body with issues/PRs tables."
```

---

## Task 5: Sync Orchestrator (TDD)

**Files:**
- Create: `src/sync.ts`
- Create: `tests/sync.test.ts`

- [ ] **Step 1: Write tests for shouldUpdateRepo()**

Create `tests/sync.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldUpdateRepo, buildCoverPath } from "../src/sync";

describe("shouldUpdateRepo", () => {
  it("returns true when no existing synced_at", () => {
    expect(shouldUpdateRepo("2026-04-08T09:00:00Z", null)).toBe(true);
  });

  it("returns true when repo updatedAt is newer than synced_at", () => {
    expect(
      shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-07T00:00:00Z")
    ).toBe(true);
  });

  it("returns false when synced_at is newer than updatedAt", () => {
    expect(
      shouldUpdateRepo("2026-04-07T00:00:00Z", "2026-04-08T09:00:00Z")
    ).toBe(false);
  });

  it("returns false when timestamps are equal", () => {
    expect(
      shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-08T09:00:00Z")
    ).toBe(false);
  });
});

describe("buildCoverPath", () => {
  it("builds vault-relative path from assets folder and repo name", () => {
    expect(buildCoverPath("GitHub/assets", "my-project")).toBe(
      "GitHub/assets/my-project.png"
    );
  });

  it("normalizes trailing slashes", () => {
    expect(buildCoverPath("GitHub/assets/", "my-project")).toBe(
      "GitHub/assets/my-project.png"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sync.test.ts 2>&1 | tail -10`
Expected: FAIL — `Cannot find module '../src/sync'`

- [ ] **Step 3: Implement sync.ts**

Create `src/sync.ts`:

```typescript
import { normalizePath, requestUrl, Notice, TFile } from "obsidian";
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
  return match ? match[1].trim() : null;
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
      if (existingFile) {
        await this.app.vault.modifyBinary(existingFile, response.arrayBuffer);
      } else {
        await this.app.vault.createBinary(normalizedPath, response.arrayBuffer);
      }
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sync.test.ts 2>&1 | tail -10`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sync.ts tests/sync.test.ts
git commit -m "feat: add sync orchestrator

Implement SyncManager with diff-based updates, cover image downloads,
and concurrency guard. Skip unchanged repos by comparing updatedAt
against synced_at frontmatter."
```

---

## Task 6: Settings Module

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Create settings.ts with FolderSuggest and FileSuggest**

```typescript
import {
  App,
  PluginSettingTab,
  Setting,
  AbstractInputSuggest,
  TFolder,
  TFile,
  normalizePath,
  SecretComponent,
} from "obsidian";
import type GHProjectsPlugin from "./main";

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  getSuggestions(inputStr: string): TFolder[] {
    const folders: TFolder[] = [];
    const lowerInput = inputStr.toLowerCase();

    this.app.vault.getAllFolders().forEach((folder) => {
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

    this.app.vault.getMarkdownFiles().forEach((file) => {
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

    // --- Authentication ---
    new Setting(containerEl).setName("Authentication").setHeading();

    new Setting(containerEl)
      .setName("GitHub token")
      .setDesc("Select or create a secret for your GitHub personal access token.")
      .addComponent((el) =>
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.githubTokenName)
          .onChange(async (value) => {
            this.plugin.settings.githubTokenName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GitHub username")
      .setDesc("Your GitHub username to fetch repositories for.")
      .addText((text) =>
        text
          .setPlaceholder("octocat")
          .setValue(this.plugin.settings.githubUsername)
          .onChange(async (value) => {
            this.plugin.settings.githubUsername = value;
            await this.plugin.saveSettings();
          })
      );

    // --- File Locations ---
    new Setting(containerEl).setName("File locations").setHeading();

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder where repository markdown files are saved.")
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
      .setDesc(
        "Optional Templater template for customizing the markdown body. Leave empty for default."
      )
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

    // --- Sync ---
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

    // --- Filters ---
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
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: May fail because `main.ts` doesn't exist yet. That's expected — we'll fix it in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add settings tab with folder/file suggest

Implement FolderSuggest and FileSuggest extending AbstractInputSuggest.
Settings tab includes SecretComponent for token, folder pickers for
output/assets, file picker for template, and all filter/limit dropdowns."
```

---

## Task 7: Templater Integration

**Files:**
- Create: `src/templater.ts`

- [ ] **Step 1: Create templater.ts**

```typescript
import { App, Notice } from "obsidian";
import type { RepoData } from "./types";
import { renderBody } from "./markdown";

interface TemplaterPlugin {
  templater: {
    create_running_config: (
      templateFile: unknown,
      targetFile: unknown,
      runMode: number
    ) => unknown;
    read_and_parse_template: (config: unknown) => Promise<string>;
  };
}

let templateWarningShown = false;

export function getTemplaterPlugin(app: App): TemplaterPlugin | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = (app as any).plugins?.getPlugin?.("templater-obsidian");
  return plugin ?? null;
}

export async function renderWithTemplater(
  app: App,
  templatePath: string,
  repo: RepoData
): Promise<string | null> {
  const templater = getTemplaterPlugin(app);
  if (!templater) {
    if (!templateWarningShown) {
      new Notice(
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
    // Read template content and do variable substitution
    let template = await app.vault.read(templateFile);

    // Replace template variables with repo data
    template = substituteTemplateVars(template, repo);

    return template;
  } catch (err) {
    console.error(`Templater rendering failed for ${repo.name}:`, err);
    return null;
  }
}

function substituteTemplateVars(template: string, repo: RepoData): string {
  const replacements: Record<string, string> = {
    "{{repo.name}}": repo.name,
    "{{repo.description}}": repo.description ?? "",
    "{{repo.url}}": repo.url,
    "{{repo.language}}": repo.primaryLanguage ?? "",
    "{{repo.stars}}": String(repo.stars),
    "{{repo.forks}}": String(repo.forks),
    "{{repo.watchers}}": String(repo.watchers),
    "{{repo.openIssues}}": String(repo.issuesCount),
    "{{repo.openPRs}}": String(repo.pullRequestsCount),
    "{{repo.license}}": repo.license ?? "",
    "{{repo.pushedAt}}": repo.pushedAt,
    "{{repo.updatedAt}}": repo.updatedAt,
    "{{repo.private}}": String(repo.isPrivate),
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }

  // Handle {{repo.languages}} as comma-separated
  result = result.split("{{repo.languages}}").join(repo.languages.join(", "));
  result = result.split("{{repo.topics}}").join(repo.topics.join(", "));

  // Handle {{#issues}} ... {{/issues}} block
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
          .replace(/\{\{issue\.createdAt\}\}/g, issue.createdAt.split("T")[0])
      )
      .join("\n");
  });

  // Handle {{#pullRequests}} ... {{/pullRequests}} block
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
          .replace(/\{\{pr\.createdAt\}\}/g, pr.createdAt.split("T")[0])
      )
      .join("\n");
  });

  return result;
}

export function renderBodyWithTemplate(
  app: App,
  templatePath: string,
  repo: RepoData
): Promise<string> {
  return renderWithTemplater(app, templatePath, repo).then(
    (result) => result ?? renderBody(repo)
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: May fail until `main.ts` exists. Acceptable at this stage.

- [ ] **Step 3: Commit**

```bash
git add src/templater.ts
git commit -m "feat: add Templater integration with variable substitution

Support custom templates with {{repo.*}} variables and
{{#issues}}/{{#pullRequests}} iteration blocks.
Falls back to default renderer if Templater or template not available."
```

---

## Task 8: Main Plugin

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Create main.ts**

```typescript
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
  private syncManager: SyncManager;
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
    return this.app.secretStorage.get(secretName);
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
```

- [ ] **Step 2: Build the plugin**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds, `main.js` created.

- [ ] **Step 3: Run all tests**

Run: `npm test 2>&1 | tail -15`
Expected: All tests pass (github, markdown, sync).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: add main plugin with lifecycle, commands, and status bar

Wire up SyncManager, settings tab, ribbon icon, status bar,
manual sync command, and repo quick-switcher modal.
Auto-syncs on layout ready and at configured intervals."
```

---

## Task 9: Templater-Aware Sync

**Files:**
- Modify: `src/sync.ts`

This task updates the sync orchestrator to use Templater when configured.

- [ ] **Step 1: Update sync.ts to support Templater**

Add the Templater integration to `SyncManager`. Modify the `constructor` and `syncRepo` method:

At the top of `sync.ts`, add the import:

```typescript
import { renderBodyWithTemplate } from "./templater";
import { renderFrontmatter } from "./markdown";
```

Replace the `syncRepo` method body's file content generation:

```typescript
// In syncRepo(), replace:
//   const fileContent = renderRepoFile(repo, coverPath);
// With:
    let body: string;
    if (settings.templatePath) {
      body = await renderBodyWithTemplate(this.app, settings.templatePath, repo);
    } else {
      body = renderBody(repo);
    }
    const frontmatter = renderFrontmatter(repo, coverPath);
    const fileContent = `${frontmatter}\n\n${body}\n`;
```

Also update the imports at the top — add `renderBody` and `renderFrontmatter`, remove `renderRepoFile`:

```typescript
import { renderBody, renderFrontmatter } from "./markdown";
import { renderBodyWithTemplate } from "./templater";
```

- [ ] **Step 2: Build and test**

Run: `npm run build && npm test 2>&1 | tail -15`
Expected: Build succeeds, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/sync.ts
git commit -m "feat: integrate Templater into sync pipeline

Use custom template for body rendering when configured,
falling back to default renderer otherwise."
```

---

## Task 10: Integration Smoke Test & Final Polish

**Files:**
- Modify: `src/main.ts` (status bar timer)
- Create: `styles.css` (empty, required by Obsidian)

- [ ] **Step 1: Create empty styles.css**

Create `styles.css` with an empty file (Obsidian expects this file to exist):

```css
/* GitHub Projects plugin styles */
```

- [ ] **Step 2: Add periodic status bar update**

In `src/main.ts`, add a 60-second interval to update the "synced X ago" text. Add to the end of `onload()`:

```typescript
    // Update status bar text every 60 seconds
    this.registerInterval(
      window.setInterval(() => this.updateStatusBar(), 60 * 1000)
    );
```

- [ ] **Step 3: Final build and test**

Run: `npm run build && npm test 2>&1 | tail -15`
Expected: Build succeeds, all tests pass.

- [ ] **Step 4: Verify output files**

Run: `ls -la main.js manifest.json styles.css`
Expected: All three files exist. These are what Obsidian loads.

- [ ] **Step 5: Commit**

```bash
git add styles.css src/main.ts
git commit -m "chore: add styles.css and periodic status bar updates

Add empty styles.css (required by Obsidian plugin loader).
Update status bar every 60s to keep 'synced X ago' text current."
```

- [ ] **Step 6: Final commit with all remaining files**

```bash
git add -A
git status
git commit -m "chore: final cleanup

Add any remaining untracked files."
```
