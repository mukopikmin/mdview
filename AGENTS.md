# Agent Instructions for mdview

These technical guidelines apply to the entire repository. Agents MUST follow
them when making changes.

## 1. Quality Control (Highest Priority)

- Use `.github/workflows/test.yml` as the source of truth for required checks.
  Run the checks relevant to the changed code before submitting it.
- Prefer the stable project entry points defined in `deno.json` and
  `package.json` instead of duplicating their underlying commands.
- Use `npm install` to install dependencies. The root `postinstall` installs the
  preview client's dependencies under `src/preview/`.
- Keep `deno.lock`, the root `package-lock.json`, and
  `src/preview/package-lock.json` consistent with dependency changes.
- Add or update focused tests for behavior changes. Do not rely only on a
  successful build.

## 2. Project Architecture

- Keep CLI argument parsing and browser-launch behavior in `src/cli/`.
- Keep HTTP routing and server lifecycle behavior in `src/server/`.
- Keep preview document, asset, shell, and event-stream handling in
  `src/server/preview/`.
- Keep comment persistence and request handling in `src/server/comments/`.
- Keep browser-side React code in `src/preview/`.
- Keep release, installation, and notice-generation logic in `scripts/`.
- Preserve the boundary between the Deno server and the browser client. Pass
  data through the existing HTTP endpoints instead of importing server modules
  into client code.

## 3. Deno and Runtime Behavior

- Use Deno and Web Platform APIs in server code unless an existing dependency
  already provides the required behavior.
- Keep Deno permissions narrowly scoped. When adding a runtime capability,
  update the relevant task or script with only the required `--allow-*`
  permission.
- Run Deno commands with `DENO_NO_PACKAGE_JSON=1` where the existing tasks do
  so, to prevent the root npm configuration from changing Deno resolution.
- Preserve the default security behavior: bind to `127.0.0.1`, escape raw HTML
  in Markdown, and serve Mermaid assets locally.
- Do not weaken path handling, response escaping, or request validation for
  convenience. Treat Markdown and comment contents as untrusted input.

## 4. Preview Client and Generated Assets

- Follow the existing React and TypeScript patterns in `src/preview/`.
- Keep Markdown feature support aligned with the table in `README.md`. Update
  the table and tests when support changes.
- `src/preview/dist/`, root `dist/`, `sadoku`, and `THIRD_PARTY_NOTICES.md` are
  generated outputs and MUST NOT be committed.
- Build client assets with `npm run build:client`; do not edit generated files
  under `src/preview/dist/`.
- Keep Mermaid rendering functional without CDN or other network access.

## 5. Testing Conventions

- Co-locate Deno unit tests with their implementation using `*_test.ts`.
- Put cross-module server workflows in `test/integration/`.
- Put preview client tests in `src/preview/test/` using Vitest and Testing
  Library.
- Prefer behavioral tests through public functions, HTTP requests, or rendered
  UI. Avoid tests coupled to private implementation details.
- Use temporary files and ephemeral or explicitly reserved loopback ports. Tests
  must not open a real browser or depend on external network services.
- When changing generated archives or binaries, verify the relevant `compile`,
  `dist`, or installation path in addition to unit tests.

## 6. GitHub Actions and Communication

- Pin third-party GitHub Actions to a full commit hash and include a comment
  with the corresponding release tag.
- Keep workflow permissions minimal.
- Write commit messages, pull request descriptions, and GitHub issue comments in
  English unless the user explicitly requests another language.
- Do not add unnecessary prefixes such as `[codex]` to pull request titles.
- When a pull request resolves an issue, include `Closes #<issue_number>` or an
  equivalent closing keyword in the pull request description.

## 7. Tool Usage

- Prefer command-line tools for repository management, investigation, and
  verification.
- Use `rg` and `rg --files` for code and file searches.
- Do not modify or revert unrelated working-tree changes.
