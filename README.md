# Morrow

Morrow is an AI-assisted lead qualification and action workflow for service businesses. It turns an unstructured customer enquiry into a validated, reviewable workflow:

```text
Enquiry
→ AI analysis
→ validated structured output
→ persisted state
→ proposed Action
→ human review
→ controlled execution
→ audit trail
```

The interesting part is not simply calling an LLM. Morrow demonstrates the architecture around AI output: validation at trust boundaries, application-owned Actions, human approval before consequential execution, duplicate protection, durable state, and a visible audit history.

## Architecture

```text
Enquiry
→ Gemini structured analysis
→ Zod validation
→ Supabase persistence
→ proposed Action
→ human approval
→ controlled execution
→ persisted ActivityEvent audit trail
```

Shared fixture enquiries provide reusable source data. Mutable Analyses, Actions, execution results, and ActivityEvents are isolated per anonymous browser session in the public demo.

- [Architecture map](./ARCHITECTURE_MAP.md) — visual overview, dependency map, and workflow diagrams.
- [Architecture walkthrough](./ARCHITECTURE_WALKTHROUGH.md) — deeper explanation of files, data flow, safety boundaries, and implementation decisions.

## Key engineering ideas

- AI and provider outputs are treated as untrusted external input.
- Strict Zod schemas validate model output, API contracts, persisted records, and execution results.
- Gemini, Supabase, and Resend calls remain server-side.
- The model proposes; the application validates and owns execution.
- Consequential execution requires explicit human approval.
- Atomic database claims and provider idempotency prevent duplicate execution.
- ActivityEvents persist the validation, proposal, review, and execution audit trail.
- Anonymous demo sessions isolate each visitor's mutable state without claiming to provide authentication.
- Public demo execution is simulated and cannot send email.

## Execution modes

### Public demo

Set:

```env
EMAIL_EXECUTION_MODE=demo
```

- No external email is sent.
- Execution is simulated after human approval.
- The successful result and `email_simulated` ActivityEvent are persisted.
- The UI displays `Email simulated successfully`.

Missing or invalid execution-mode configuration safely resolves to `demo`.

### Private integration test

Set:

```env
EMAIL_EXECUTION_MODE=resend
RESEND_API_KEY=
TEST_EMAIL_RECIPIENT=
```

This mode uses Resend and sends only to the developer-controlled test recipient, never to fictional enquiry addresses. It is intended for private integration testing, not the public portfolio deployment.

## Public demo safety

- Public deployment runs in `demo` execution mode, so no real email is sent.
- A server-issued HttpOnly cookie scopes mutable Analysis, Action, execution, and ActivityEvent records to one anonymous browser session.
- Shared fixture enquiries remain reusable across visitors without sharing workflow state.
- Demo-session IDs provide portfolio isolation only; they are not user identity or authentication.

## Tech stack

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS
- Google Gemini
- Zod
- Supabase / PostgreSQL
- Resend

## Environment variables

Copy `.env.example` to `.env.local` for local development. Store deployment values in the hosting platform's environment-variable settings. Never commit real credentials or expose these values through `NEXT_PUBLIC_*` variables.

Public deployment:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
EMAIL_EXECUTION_MODE=demo
```

Private Resend testing additionally requires:

```env
RESEND_API_KEY=
TEST_EMAIL_RECIPIENT=
```

## Local development

Install dependencies and create local environment configuration:

```bash
yarn install
cp .env.example .env.local
```

Create a Supabase project and apply every SQL file in [`supabase/migrations`](./supabase/migrations) in filename order. Then add the required server-side values to `.env.local` and start the app:

```bash
yarn dev
```

Useful verification commands:

```bash
yarn lint
yarn typecheck
yarn test:analysis
yarn test:persistence
yarn test:actions
yarn test:execution
yarn test:demo
yarn build
```

The fixture enquiry IDs remain shared source records; no bulk fixture seed is required. The application inserts the corresponding Enquiry when a validated Analysis is first saved for a demo session.

## Current scope

Currently implemented:

- server-side Gemini analysis with structured output
- strict runtime validation and Supabase persistence
- proposed Action review, editing, approval, and cancellation
- public-safe simulation and private controlled Resend execution
- idempotent execution and persisted ActivityEvent history
- anonymous per-browser visitor isolation

Deliberately not production-complete:

- real user authentication or accounts
- CRM integrations
- production customer email delivery
- large-scale retention or cleanup jobs

Morrow is a focused engineering portfolio application, not a production CRM or general workflow platform.
