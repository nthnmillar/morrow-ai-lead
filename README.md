## OpenAI analysis

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` and `OPENAI_MODEL` with server-side values. Never prefix the API key with `NEXT_PUBLIC_` or commit a real key.

Run the app with `yarn dev`. On an enquiry detail page, choose **Analyse with AI** to send that enquiry's original text through the server-side Responses API. The validated result remains in client state for this prototype and is cleared on refresh.
