<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Start here

Read `docs/HANDOVER.md` before working on StudyLab / LearnSpace. It carries what
is half-built and where it stops, the decisions that cost real time to find, and
the traps in this codebase that passing tests do not catch — renderers that
cannot be unit-tested, Tailwind alpha silently emitting no rule on the `ss-*`
tokens, a hardened expression parser that must never be extended.

Verification gate for any change: `npx tsc --noEmit && npx vitest run`.
`npm run lint` is broken project-wide (Next 16 removed `next lint`) — its
failure is not a regression. `aws_deploy` is the deploy branch: pushing it
deploys, so pushing is always an explicit decision.

<!-- END:nextjs-agent-rules -->
