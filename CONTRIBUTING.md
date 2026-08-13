# Contributing to Forge

## CI/CD Overview

All changes to Forge pass through automated quality gates. No gate can be skipped.

### Required CI checks (branch protection on `main`)

| Check | What it does |
|-------|-------------|
| `lint` | ESLint with TypeScript, React, and React Hooks plugins |
| `typecheck` | `tsc --noEmit` for server and client |
| `build` | Client (Vite) and server (tsc) production build |
| `test` | Vitest — 35 tests covering workspace path security and agent tools |
| `security-audit` | `npm audit` with pinned safe overrides for transitive deps |

### Deployment

- **Self-hosted runner**: A GitHub Actions runner (`iamfaulty-mini`) runs directly on the mini via launchd. Deploy and rollback workflows execute locally — no SSH required.
- **Deploy workflow** (`.github/workflows/deploy.yml`): triggers on push to `main` or manual dispatch. Checks out the commit, builds Forge, restarts the launchd service, and runs a health check against `/api/health`.
- **Rollback workflow** (`.github/workflows/rollback.yml`): manual dispatch with a target ref. Checks out that commit, rebuilds, restarts, and health-checks.

### No secrets required

The self-hosted runner approach eliminates the need for SSH keys or host configuration. The `production` environment can be used for approval gates if desired.

### Failure notifications

- `.github/workflows/notify.yml` watches CI, Deploy, and Rollback workflow runs.
- On failure, it creates a GitHub issue labeled `ci-failure` and `automated`.
- Duplicate issues are deduplicated by workflow run ID.

## Local development

### Pre-commit hooks

This repo uses Husky + lint-staged for pre-commit validation:

```bash
# After cloning, install hooks:
npm install  # triggers `prepare` script which runs `husky`
```

The pre-commit hook runs lint-staged against staged Forge files.

### Running tests

```bash
cd forge
npm test           # vitest run
npm run test:watch # vitest in watch mode
npm run test:coverage  # with coverage report
```

### Running locally

```bash
cd forge
npm run dev  # server on :3100, client on :5173
```

For production simulation:

```bash
cd forge
npm run build
npm start
```

## Dependency update policy

Dependabot is configured to open PRs for npm and GitHub Actions updates weekly.

Major version updates to critical dependencies are ignored to prevent breaking changes:

- `eslint`
- `typescript`
- `vite`
- `express`

Patch and minor updates are automatically PR'd and should be reviewed and merged when CI passes.

## Architecture notes

- Forge is an npm workspaces monorepo: `forge/server` (Express API) and `forge/client` (React + Vite).
- `FORGE_WORKSPACE` sets the directory the file tree, editor, and agent tools operate on.
- The API enforces a Host-header allowlist and optional `FORGE_AUTH_TOKEN` bearer token.
- Path traversal protection is in `forge/server/src/utils/paths.ts` — all file operations resolve through `resolveWorkspacePath()`.
- Agent tools are in `forge/server/src/agent/tools.ts` — `run_command` has a best-effort blocklist but it is not a security boundary.
