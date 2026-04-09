# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # development build with watch (esbuild)
npm run build        # production build (tsc check + esbuild)
npm run lint         # eslint
npm test             # vitest run (all tests, once)
npm run test:cov     # tests with v8 coverage
npm run test:watch   # vitest in watch mode

# Run a single test file
npx vitest run tests/github.test.ts

# Run tests matching a name pattern
npx vitest run -t "fetchRepos"
```

## Architecture

Obsidian plugin that syncs GitHub repositories into markdown files with YAML frontmatter, designed for Obsidian Bases card views.

### Module Map

| Module | File | Purpose |
|--------|------|---------|
| Plugin entry | `src/main.ts` | Lifecycle, commands, ribbon icon, status bar, auto-sync scheduling |
| GitHub API | `src/github.ts` | GraphQL queries, pagination, repo/issue/PR parsing, custom error classes (`GitHubAuthError`, `GitHubRateLimitError`) |
| Sync engine | `src/sync.ts` | `SyncManager` — orchestrates fetch → diff → render → write cycle, downloads cover images, detects orphans |
| Markdown | `src/markdown.ts` | Renders `RepoData` into YAML frontmatter + markdown body with issue/PR tables |
| Templater | `src/templater.ts` | `{{mustache}}`-style variable substitution and `{{#issues}}...{{/issues}}` block iteration for custom templates |
| Settings UI | `src/settings.ts` | Setting tab with `FolderSuggest`/`FileSuggest` autocomplete, secure token via `SecretStorage` |
| Types | `src/types.ts` | All interfaces (`GHProjectsSettings`, `RepoData`, `IssueData`, `PRData`) and `DEFAULT_SETTINGS` |

### Data Flow

```
Plugin.runSync()
  → SyncManager.run()
    → fetchRepos() [github.ts] — GraphQL with cursor pagination
    → for each RepoData:
        shouldUpdateRepo() — compare updatedAt vs synced_at in existing frontmatter
        downloadCoverImage() — fetch social preview to assets folder
        renderFrontmatter() + renderBodyWithTemplate() or renderBody()
        vault.create/modify()
    → detectOrphans() — find files no longer matching filters
  → status bar update
```

### Key Patterns

- **esbuild bundler**: `esbuild.config.mjs` builds `src/main.ts` → `main.js` (CommonJS, single file). The `obsidian` module is marked external.
- **Obsidian API mocking**: Vitest resolves `obsidian` imports to `tests/__mocks__/obsidian.ts` via the alias in `vitest.config.ts`. No real Obsidian runtime needed.
- **SyncManager injection**: Receives `getSettings()` and `getToken()` callbacks rather than direct references, making it testable without the plugin instance.
- **Coverage scope**: `src/main.ts` and `src/settings.ts` are excluded from coverage (heavy Obsidian UI coupling).
- **Test data factories**: Tests use `makeRepo()`, `makeRepoNode()`, `makeGraphQLPage()`, and `makeApp()` helpers to build fixtures.
