# {{repo.name}}

{{repo.description}}

**Language:** {{repo.language}} | **License:** {{repo.license}} | **Private:** {{repo.private}}

| Stars | Forks | Watchers | Open Issues | Open PRs |
|-------|-------|----------|-------------|----------|
| {{repo.stars}} | {{repo.forks}} | {{repo.watchers}} | {{repo.openIssues}} | {{repo.openPRs}} |

**Languages:** {{repo.languages}}

**Topics:** {{repo.topics}}

**Last push:** {{repo.pushedAt}} | **Last update:** {{repo.updatedAt}}

## Issues

{{#issues}}
- [#{{issue.number}}]({{issue.url}}) **{{issue.title}}** by @{{issue.author}} — {{issue.labels}} ({{issue.createdAt}})
{{/issues}}

## Pull Requests

{{#pullRequests}}
- [#{{pr.number}}]({{pr.url}}) **{{pr.title}}** by @{{pr.author}} — {{pr.status}} — {{pr.labels}} ({{pr.createdAt}})
{{/pullRequests}}
