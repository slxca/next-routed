# Contributing to next-routed

Thanks for helping improve `next-routed`. Bug reports, documentation fixes, tests, and focused feature proposals are welcome.

## Reporting issues

Before opening an issue, search existing issues and verify the behavior against the latest package version. Include:

- The package version and Next.js version
- Node.js and package-manager versions
- A minimal reproduction or focused code sample
- The expected behavior and the behavior you observed
- Relevant error messages and stack traces

Do not include credentials, tokens, session cookies, or private application data.

## Development setup

Requirements:

- Node.js 20 or newer
- pnpm 9 or newer

Clone the repository and install dependencies:

```bash
pnpm install
```

Run the standard checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The basic consumer example is in `examples/basic`:

```bash
pnpm --filter next-routed-basic-example dev
pnpm --filter next-routed-basic-example typecheck
pnpm --filter next-routed-basic-example build
```

## Pull requests

Keep pull requests focused and explain:

- What changed and why
- How the change was tested
- Whether the public API or generated output changed
- Any compatibility or migration considerations

Add or update tests for behavior changes. Update the README when public usage changes. Do not add GitHub Actions workflows without an explicit maintainer decision.

## Code style

- Use strict TypeScript and preserve the existing public types.
- Prefer small, composable functions and existing package helpers.
- Keep runtime dependencies at zero beyond the documented peer dependencies.
- Avoid unrelated refactors or generated-file churn.
- Use the repository formatter and keep imports, naming, and error handling consistent with nearby code.

## Commits and release notes

Use concise imperative commit subjects, for example:

```text
Add params validation example
Fix response status handling
Update route handler documentation
```

For user-facing changes, update the changelog as part of the release preparation.
