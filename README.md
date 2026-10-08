## Local setup

Copy `.env.example` to `.env.local` and set the server-side values below. Never add a `NEXT_PUBLIC_` prefix to these secrets or commit real credentials.

- `GEMINI_API_KEY` and `GEMINI_MODEL` configure structured Gemini analysis.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` configure server-side persistence. Keep this secret key out of browser code and client-visible environment variables.
- `EMAIL_EXECUTION_MODE=demo` is the safe public default. It persists a simulated success and never calls Resend or requires a recipient.
- `EMAIL_EXECUTION_MODE=resend`, `RESEND_API_KEY`, and `TEST_EMAIL_RECIPIENT` enable private controlled delivery. Fictional enquiry addresses are never used.

Create a Supabase project, then apply every SQL file in [`supabase/migrations`](./supabase/migrations) in filename order. The Stage 2E migration adds anonymous-session scope without deleting earlier private development rows. Copy the project URL and its server-side secret key into `.env.local`, then restart `yarn dev`.

Run the app with `yarn dev`. On an enquiry detail page, choose **Analyse with AI** to send the fixture's original text through the server-side Gemini API. The response is validated with `LeadAnalysisSchema`, persisted, and then returned to the UI. A later page load restores the newest saved analysis; fixture data remains the fallback before a live analysis has been saved.

The existing demo IDs (`ENQ-2044` through `ENQ-2048`) remain shared source identities. A server-issued HttpOnly cookie scopes each visitor's Analyses, Actions, execution state, and ActivityEvents, so separate browsers can reuse the same fixture without sharing mutable state. This anonymous session is isolation for a portfolio demo, not authentication. Low-volume demo data is retained for now; automated cleanup is a future deployment concern.

## Email execution modes

- **Public:** human approval → demo adapter → simulated success → `email_simulated` audit event → no external email.
- **Private test:** human approval → Resend adapter → controlled test-inbox delivery → `email_sent` audit event.

Missing or invalid `EMAIL_EXECUTION_MODE` values resolve to `demo`, so omitted configuration cannot enable real delivery. Use `resend` only in a private environment with a test inbox you control.
