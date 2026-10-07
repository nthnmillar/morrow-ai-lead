## Local setup

Copy `.env.example` to `.env.local` and set the server-side values below. Never add a `NEXT_PUBLIC_` prefix to these secrets or commit real credentials.

- `GEMINI_API_KEY` and `GEMINI_MODEL` configure structured Gemini analysis.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` configure server-side persistence. Keep this secret key out of browser code and client-visible environment variables.

Create a Supabase project, then run [`supabase/migrations/20261007130000_enquiries_and_analyses.sql`](./supabase/migrations/20261007130000_enquiries_and_analyses.sql) in its SQL Editor. Copy the project URL and its server-side secret key into `.env.local`, then restart `yarn dev`.

Run the app with `yarn dev`. On an enquiry detail page, choose **Analyse with AI** to send the fixture's original text through the server-side Gemini API. The response is validated with `LeadAnalysisSchema`, persisted, and then returned to the UI. A later page load restores the newest saved analysis; fixture data remains the fallback before a live analysis has been saved.

The existing demo IDs (`ENQ-2044` through `ENQ-2048`) are preserved as database enquiry IDs. No bulk fixture seed is needed: the server inserts the matching fixture enquiry the first time its validated analysis is saved, then stores each analysis against that ID.
