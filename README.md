## Gemini analysis

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` and `GEMINI_MODEL` with server-side values. The example uses `gemini-3.5-flash-lite` for development. The API key must remain server-side; never prefix it with `NEXT_PUBLIC_` or commit a real key.

Run the app with `yarn dev`. On an enquiry detail page, choose **Analyse with AI** to send that enquiry's original text through the server-side Gemini API using structured JSON output. The response is validated with the existing Zod schema before it reaches the UI. The validated result remains in client state for this prototype and is cleared on refresh.
