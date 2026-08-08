# Repository guidance

This is the canonical instruction file for this repository. Claude Code loads it through
`CLAUDE.md`.

## Start here

- Inspect branch, upstream divergence, status, and diff before editing.
- Preserve pre-existing changes and keep unrelated work out of the patch.
- Use the repository's existing runtime, package manager, framework, and deployment model.
- Do not refactor an existing project into the preferred new-project stack unless explicitly requested.
- Verify current documentation before changing version-dependent dependencies or hosting behavior.

## Project

This application imports club member data, generates personalized letters, and collects corrections through signed links.

It is a TypeScript service using Node.js, Hono, PostgreSQL, npm, Docker, and Railway.

## Project rules

- Use npm and preserve `package-lock.json`.
- Treat member data, addresses, contact details, IBANs, and signed URLs as sensitive.
- Never log imported records, tokens, or complete signed links.
- Keep imports reviewable and avoid silently changing source records.
- Do not migrate the runtime or framework as unrelated work.

## Commands

- `npm run build`: production build
- `npm start`: start the service
- Exercise import, PDF generation, and signed correction flows when affected

## Verification

Run the relevant checks and exercise the affected workflow, endpoint, or generated artifact.
State clearly when authenticated, database, deployment, or live verification was not possible.

## Maintaining instructions

Update `AGENTS.md` when verified, durable repository behavior changes. Keep it concise and
move detailed explanations into `docs/`. Keep `CLAUDE.md` as the compatibility import
unless Claude-specific guidance is genuinely required.
