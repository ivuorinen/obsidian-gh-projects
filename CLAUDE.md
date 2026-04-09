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
| Schemas | `src/schemas.ts` | Zod schemas for GitHub GraphQL API responses and settings validation; all `GraphQL*` types are inferred from schemas via `z.infer<>` |
| Tags | `src/tags.ts` | `generateTags()` — configurable tag generation from `RepoData` fields with slugification; `TAG_FIELDS` constant |
| Logger | `src/logger.ts` | `createLogger()` — prefixed `[GH Projects]` logger with debug mode gating and token redaction |
| Types | `src/types.ts` | App-level interfaces (`GHProjectsSettings`, `RepoData`, `IssueData`, `PRData`) and `DEFAULT_SETTINGS` |

### Data Flow

```
Plugin.runSync()
  → SyncManager.run()
    → fetchRepos() [github.ts] — GraphQL with cursor pagination
      → graphQLResponseSchema.parse() — Zod runtime validation
    → for each RepoData:
        slugifyRepoName() — safe filename from repo name (handles dots, org prefixes)
        shouldUpdateRepo() — compare updatedAt vs synced_at in existing frontmatter
        downloadCoverImage() — fetch social preview with retry/backoff on 429
        renderFrontmatter(settings) — YAML frontmatter + optional tag generation
        renderBodyWithTemplate() or renderBody()
        vault.create/modify()
    → detectOrphans() — find files no longer matching filters
```

### Key Patterns

- **esbuild bundler**: `esbuild.config.mjs` builds `src/main.ts` → `main.js` (CommonJS, single file). The `obsidian` module is marked external.
- **Obsidian API mocking**: Vitest resolves `obsidian` imports to `tests/__mocks__/obsidian.ts` via the alias in `vitest.config.ts`. No real Obsidian runtime needed.
- **SyncManager injection**: Receives `getSettings()` and `getToken()` callbacks rather than direct references, making it testable without the plugin instance.
- **Coverage scope**: `src/main.ts` and `src/settings.ts` are excluded from coverage (heavy Obsidian UI coupling).
- **Test data factories**: Tests use `makeRepo()`, `makeRepoNode()`, `makeGraphQLPage()`, and `makeApp()` helpers to build fixtures.
- **Zod at system boundaries**: All external data (GitHub API responses, `loadData()` settings) is parsed through Zod schemas in `src/schemas.ts`. GraphQL types are inferred via `z.infer<>` — no manually maintained interfaces for API data.
- **Logger with token redaction**: `createLogger()` receives `getDebugMode` and `getToken` callbacks. All log output is scanned for the token value and redacted. `debug`/`info` are gated by `debugMode` setting; `warn`/`error` always emit.
- **Cover image retry**: `downloadCoverImage()` retries up to 3 times on HTTP 429 with exponential backoff (1s, 2s, 4s), respecting the `Retry-After` header.
