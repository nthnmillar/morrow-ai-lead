# AGENTS.md

This repository’s product and architecture source of truth is [PROJECT_SPEC.md](PROJECT_SPEC.md).

Before making product, UX, or architecture decisions, read [PROJECT_SPEC.md](PROJECT_SPEC.md) and stay aligned with it.

Rules for contributors:

- Do not introduce major features, libraries, frameworks, or patterns that are outside the specification unless explicitly instructed.
- Avoid scope drift. Keep work incremental and reviewable.
- Prefer small, focused changes that can be validated independently.
- Preserve strong TypeScript type safety throughout implementation.
- Validate at system boundaries. Treat all external input, especially LLM output, as untrusted.
- Keep AI recommendations and tool requests separate from application execution.
- Application code must validate and authorize any model-generated action before it is executed.
- Consequential actions must follow the human-approval model described in the specification.
- Keep secrets server-side and never expose them to the client.
- Run the appropriate linting, type checking, and tests after implementation changes.
- Do not silently modify [PROJECT_SPEC.md](PROJECT_SPEC.md) to justify a design decision.
- Only change the product specification when explicitly instructed to do so.

If a decision is unclear, prefer the simplest implementation that matches the specification and supports the stated portfolio goal.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
