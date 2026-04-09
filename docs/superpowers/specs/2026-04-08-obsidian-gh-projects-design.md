# Obsidian GitHub Projects Plugin — Design Spec

## Overview

An Obsidian plugin that periodically fetches the authenticated user's GitHub repositories via the GraphQL API and creates/updates markdown files in the vault with repository details, open issues, and pull requests. Designed to integrate with Obsidian's Bases feature for card-based project browsing with cover images.

## Decisions

| Decision | Choice |
|---|---|
| Data source | GitHub Repositories via GraphQL API |
| Per-repo data | Core info, metrics, open issues/PRs, activity, cover image |
| File structure | Flat: one `.md` file per repo in a configurable folder |
| Issue/PR limits | Configurable: 0, 10, 25 (default), 50 |
| Sync frequency | Hourly default, configurable (15/30/60/360 min), plus manual command |
| Repo filters | Owned, non-fork, non-archived by default (configurable) |
| Cover images | Downloaded to vault in a configurable assets folder |
| Token storage | Obsidian SecretStorage API |
| Template support | Built-in `{{mustache}}` template engine; Templater presence detected but not required |
| Architecture | Modular with clear boundaries |

---

## Architecture & Module Layout

```
src/
├── main.ts            — Plugin lifecycle, commands, interval scheduling
├── settings.ts        — Settings tab, defaults, SecretStorage integration
├── github.ts          — GraphQL queries, response types, API client
├── sync.ts            — Orchestrator: fetch → diff → render → write
├── markdown.ts        — Default template rendering (frontmatter + body)
├── templater.ts       — Templater integration: detect plugin, run templates
└── types.ts           — Shared interfaces (RepoData, IssueData, PRData, etc.)
```

**Data flow:**

```
Timer/Command triggers sync
  → sync.ts fetches via github.ts
  → For each repo: downloads cover image if changed
  → Passes RepoData to markdown.ts (default) or templater.ts (if configured)
  → Writes/updates file via Vault API
```

---

## Settings & Configuration

| Setting | Component | Default | Notes |
|---|---|---|---|
| GitHub Token | `SecretComponent` | — | Via SecretStorage, stores only the secret name |
| GitHub Username | `addText` | — | Which user's repos to fetch |
| Output Folder | `addSearch` + `FolderSuggest` | `GitHub` | Autocompletes vault folders |
| Assets Folder | `addSearch` + `FolderSuggest` | `GitHub/assets` | Autocompletes vault folders |
| Template Path | `addSearch` + `FileSuggest` | _(empty)_ | Autocompletes `.md` files in vault |
| Sync Interval | `addDropdown` | `60` (minutes) | Options: 15, 30, 60, 360 |
| Issues Limit | `addDropdown` | `25` | Options: 0, 10, 25, 50 |
| PRs Limit | `addDropdown` | `25` | Options: 0, 10, 25, 50 |
| Include Forks | `addToggle` | `false` | |
| Include Archived | `addToggle` | `false` | |
| Include Org Repos | `addToggle` | `false` | |

**`FolderSuggest` and `FileSuggest`** extend `AbstractInputSuggest` to provide autocomplete for vault folders and markdown files respectively.

**Behavior:**
- Changing sync interval re-registers the timer immediately
- Changing output/assets folder does not move existing files
- Missing token shows a `Notice` pointing to settings
- Template path shows a warning if the file doesn't exist or Templater isn't installed

---

## GitHub GraphQL API & Data Model

### Query

```graphql
query($username: String!, $first: Int!, $issuesFirst: Int!, $prsFirst: Int!) {
  user(login: $username) {
    repositories(first: $first, ownerAffiliations: [OWNER], orderBy: {field: UPDATED_AT, direction: DESC}) {
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
          nodes { title number url author { login } labels(first: 5) { nodes { name } } createdAt updatedAt }
        }
        pullRequests(first: $prsFirst, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes { title number url author { login } labels(first: 5) { nodes { name } } createdAt updatedAt reviewDecision }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

**Pagination:** Repos are paginated using `endCursor` (GitHub caps `first` at 100). Issues/PRs are capped by user settings (max 50), so no pagination needed for those.

**Filtering:** Applied client-side after fetch. Simpler than dynamic GraphQL queries, negligible overhead.

### TypeScript Data Model

```typescript
interface RepoData {
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

interface IssueData {
  title: string;
  number: number;
  url: string;
  author: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

interface PRData extends IssueData {
  reviewDecision: string | null; // APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, null
}
```

---

## Markdown Output & Frontmatter

### Default output example

```markdown
---
name: my-cool-project
description: "A tool for doing cool things"
url: https://github.com/user/my-cool-project
private: false
language: TypeScript
languages:
  - TypeScript
  - JavaScript
topics:
  - cli
  - developer-tools
license: MIT
stars: 142
forks: 23
watchers: 8
open_issues: 5
open_prs: 2
cover: GitHub/assets/my-cool-project.png
pushed_at: 2026-04-07T14:32:00Z
updated_at: 2026-04-08T09:15:00Z
synced_at: 2026-04-08T10:00:00Z
---

# my-cool-project

A tool for doing cool things

## Open Issues (5)

| # | Title | Author | Labels | Created |
|---|-------|--------|--------|---------|
| 42 | [Bug in parser](https://github.com/...) | @alice | `bug` | 2026-04-01 |
| 38 | [Add dark mode](https://github.com/...) | @bob | `enhancement` | 2026-03-28 |

## Open Pull Requests (2)

| # | Title | Author | Labels | Status | Created |
|---|-------|--------|--------|--------|---------|
| 43 | [Fix parser bug](https://github.com/...) | @alice | `bug` | APPROVED | 2026-04-02 |
```

### Frontmatter design choices

- `cover` uses a vault-root-relative path (e.g., `GitHub/assets/my-cool-project.png`) so Bases cards render it correctly regardless of output and assets folder configuration
- `synced_at` tracks when the plugin last updated this file
- Frontmatter is always plugin-controlled (even with Templater); the body is what templates customize
- Tables for issues/PRs render well in both reading view and Bases

---

## Sync Logic & File Management

### Orchestration

1. **Pre-flight** — verify token via SecretStorage, abort with `Notice` if missing
2. **Fetch** — run GraphQL query, paginate if >100 repos, apply client-side filters
3. **Diff & update** — for each repo:
   - Check if file exists at `{outputFolder}/{repo-name}.md`
   - Compare GitHub `updatedAt` against `synced_at` in existing frontmatter
   - Skip write if nothing changed (avoids unnecessary file modification timestamps)
   - If changed: re-render frontmatter + body, write via `vault.modify()` or `vault.create()`
4. **Cover images** — for each repo with `openGraphImageUrl`:
   - Check if image exists at `{assetsFolder}/{repo-name}.png`
   - Download via `requestUrl()` only if missing, or if repo's `updatedAt` is newer than the existing file's modification time
   - Save via `vault.createBinary()` or `vault.modifyBinary()`
5. **Cleanup** — after sync completes, orphan files (repo files no longer matching filters) are detected. A `Notice` informs the user, listing up to 3 orphan file names. Files are not deleted automatically.
6. **Status** — update status bar, show `Notice` on completion or error

### Error handling

- **`GitHubAuthError`** (401 response): show `Notice` pointing to settings
- **`GitHubRateLimitError`** (403 with `x-ratelimit-reset` header, or GraphQL rate limit error): show `Notice` with the reset time
- **Network errors:** show `Notice`, retry on next interval
- **Partial failure** (e.g., image download): sync markdown anyway, log warning

### Concurrency

Only one sync runs at a time. Manual sync during active sync is ignored with a `Notice`.

---

## Plugin Lifecycle & Commands

### `onload()` sequence

1. Load settings (`loadData()`)
2. Register settings tab
3. Register commands
4. Wait for layout ready, then start sync interval
5. Add status bar item

### Commands

- **"Sync GitHub repos now"** — manual trigger
- **"Open GitHub repo"** — `SuggestModal` quick switcher, opens selected repo file

### Ribbon

GitHub icon (Lucide `github`) in left sidebar — triggers manual sync on click.

### Status bar

Shows "GH: synced 5m ago" or "GH: syncing..." during active sync. Desktop only.

### `onunload()`

Clears registered interval. No other cleanup needed.

### Interval registration

```typescript
this.app.workspace.onLayoutReady(() => {
  this.runSync();
  this.registerInterval(
    window.setInterval(() => this.runSync(), this.settings.syncInterval * 60 * 1000)
  );
});
```

---

## Template System

### Detection

Check if Templater is enabled via `this.app.plugins.getPlugin('templater-obsidian')`. No hard dependency — Templater's presence is detected but its rendering engine is never invoked.

### How it works

- User sets a template path in settings (e.g., `Templates/github-repo.md`)
- Plugin always generates frontmatter itself (consistent data for Bases)
- For body: if a template path is configured, the plugin reads the template file directly and performs variable substitution using a built-in engine. Otherwise, the default renderer from `markdown.ts` is used
- Templates use `{{mustache}}` variable syntax and `{{#block}}...{{/block}}` iteration blocks
- Templates work even without Templater installed, as long as a template file path is specified

### Fallback behavior

- Template file doesn't exist → default renderer, one-time `Notice`
- Template rendering error → default renderer for that repo, log error

### Why frontmatter is always plugin-controlled

Bases depends on consistent frontmatter properties. User-templated frontmatter could break Bases integration. The body is the creative space; the frontmatter is the contract.
