# Architecture walkthrough

This guide describes the implementation in this repository now. Stage 2C persists a validated proposed Action beside each new Analysis and persists human edit/approve/cancel decisions. External execution, email, and durable activity events remain future work.

## 1. Big picture

The current application combines fixture-driven workspace screens with a persisted AI analysis flow:

1. **Fixture enquiry and activity data** in `lib/mock-enquiry.ts` and `lib/mock-workspace.ts` still seed queue rows, detail-page enquiry fields, and the workspace activity feed.
2. **AI analysis and proposal** run through `POST /api/ai/analyze`. Validated output is saved as an Analysis, then the application creates one validated `draft_reply` Action linked to it.
3. **Human review** runs through `PATCH /api/actions`; valid proposed/edited Actions can be saved as edited, approved, or cancelled. Approval performs no execution.
4. **Restored state** loads the latest Analysis and its associated Action, validates both, and passes them to `EnquiryDetail`.

React state holds the open editor and current server-confirmed values while mounted. Supabase remains the durable source for Analysis, Action payload, and review status. Activity history remains a separate seeded fixture feed.

```mermaid
flowchart LR
  Browser["Browser"]
  Routes["Next.js App Router pages<br/>app/**/page.tsx"]
  Fixtures["Typed mock fixtures<br/>lib/mock-enquiry.ts<br/>lib/mock-workspace.ts"]
  Client["React client components<br/>detail / dashboard / activity / shell"]
  State["React state<br/>filters · editor · server-confirmed state"]
  API["Next.js API routes<br/>POST /api/ai/analyze<br/>PATCH /api/actions"]
  RequestSchema["Request Zod validation"]
  Provider["Server-only Gemini provider<br/>lib/ai/analyze-enquiry.ts"]
  AnalysisSchema["LeadAnalysisSchema<br/>AI and persisted JSON"]
  Gemini["Gemini API"]
  Persistence["Server-only persistence boundary<br/>lib/persistence/supabase.ts"]
  ActionSchema["PersistedActionSchema<br/>payload + transitions"]
  Supabase[("Supabase<br/>enquiries · analyses · actions")]

  Browser --> Routes
  Routes --> Fixtures
  Routes --> Client
  Fixtures --> Client
  Client --> State
  Client -- "enquiry ID + original text" --> API
  API --> RequestSchema
  API --> Provider
  Provider --> Gemini
  Provider --> AnalysisSchema
  Gemini -- "structured JSON text" --> Provider
  AnalysisSchema -->|"validated output only"| Persistence
  Persistence -->|"save Analysis, Action, review decision"| Supabase
  Routes -->|"load newest Analysis + Action"| Persistence
  Persistence -->|"validate persisted JSON"| AnalysisSchema
  Persistence --> ActionSchema
  API -->|"after save: validated state"| Client
  Client --> State
  State --> Browser
```

The dashboard queue and activity feed remain fixture-driven. The detail page starts with fixture enquiry fields, but saved Analysis and Action state take precedence when present.

The browser communicates with the Next.js server, not directly with either external service. Secrets stay server-only. Supabase RLS remains enabled; the Action migration explicitly revokes `anon` and `authenticated` privileges and grants `service_role` only `select`, `insert`, and `update`. Database/provider failures are logged without enquiry or proposed-reply contents.

## 2. Exact “Analyse with AI” execution chain

The implemented path is:

```text
User clicks “Analyse with AI”
↓
EnquiryDetail validates { enquiryId, originalText } and POSTs to /api/ai/analyze
↓
Next.js route validates the request and matches ID + source text to a fixture
↓
analyzeEnquiryText(originalText) sends a structured-output request to Gemini
↓
Provider parses Gemini output and validates it with LeadAnalysisSchema
↓
Route validates the Analysis and constructs a validated Action
↓
lib/persistence/supabase.ts inserts the validated Analysis and one proposed Action
↓
Route returns validated { analysis, action }
↓
EnquiryDetail validates the response and renders persisted review controls
```

### Step-by-step with execution location and data

1. **Click — browser.** The analyze button in `EnquiryDetail` calls `runAnalysis()`. The component has the current enquiry as its `enquiry` prop; the detail route obtained that object from the mock fixture list.
2. **Validate the request — browser.** `runAnalysis()` calls `AnalyzeEnquiryRequestSchema.safeParse({ enquiryId: enquiry.id, originalText: enquiry.originalText })`. This checks the fixture ID and catches empty or overlong text before sending a request.
3. **Send source text — browser to server.** The client posts JSON containing `enquiryId` and `originalText`; contact details are not sent separately.
4. **Validate at the boundary — server.** `POST()` parses and validates the body, then requires the ID and original text to match a current fixture enquiry. Browser validation is only a UX aid.
5. **Call the provider — server.** The route invokes `analyzeEnquiryText()` with the trusted fixture text. The provider reads `GEMINI_API_KEY` and `GEMINI_MODEL` and calls Gemini's `interactions.create()`.
6. **Request and validate structured output — server.** Gemini receives a JSON response schema derived from `LeadAnalysisSchema`. The provider requires a completed interaction, parses `output_text`, and validates the unknown result with `LeadAnalysisSchema.safeParse()`.
7. **Validate the workflow response — server.** The route independently validates the Analysis before any persistence, then validates `{ analysis, action }` before returning.
8. **Persist validated output and proposal — server.** `saveValidatedAnalysis()` revalidates, upserts the fixture Enquiry, inserts an Analysis, constructs an application-owned `draft_reply` from the existing fixture draft plus validated analysis key points, validates it, and inserts one linked proposed Action.
9. **Return and store the result — server to browser.** Only after both records save does the route return `{ analysis, action }`. The client validates the combined response before updating render state.
10. **Render — browser.** React displays the current validated analysis. When nullable identity values are absent, the component uses the fixture identity as a fallback.

```mermaid
sequenceDiagram
  actor User
  participant UI as Browser: EnquiryDetail
  participant API as Next.js: POST /api/ai/analyze
  participant Request as Request Zod validation
  participant Provider as Server: analyzeEnquiryText
  participant Gemini as Gemini API
  participant Output as LeadAnalysisSchema
  participant DB as Server persistence / Supabase

  User->>UI: Click Analyse with AI
  UI->>Request: safeParse({ enquiryId, originalText })
  alt Invalid source text
    Request-->>UI: Validation issues
    UI-->>User: Show local input error
  else Valid source text
    UI->>API: POST JSON { enquiryId, originalText }
    API->>Request: Validate request and match fixture
    alt Invalid request
      API-->>UI: 400 { error }
    else Valid request
      API->>Provider: analyzeEnquiryText(originalText)
      Provider->>Gemini: interactions.create(structured JSON schema)
      Gemini-->>Provider: completed interaction / output_text
      Provider->>Output: JSON.parse then LeadAnalysisSchema.safeParse
      Output-->>Provider: Validated LeadAnalysis
      Provider-->>API: validated LeadAnalysis
      API->>Output: Validate Analysis before persistence
      Note over API,DB: Persistence starts only after AI output passes Zod validation
      API->>DB: Save validated analysis + proposed Action
      DB-->>API: Save succeeds
      API-->>UI: 200 JSON { analysis, action }
      UI->>Output: Validate combined response
      UI->>UI: Set server-confirmed state
      UI-->>User: Render saved result
    end
  end
```

Persistence errors use the stable `persistence_unavailable` API error and prevent unsaved state entering the UI. A separate validated `PATCH /api/actions` request saves edits or transitions `proposed|edited` to `approved|cancelled`; terminal decisions cannot be changed. No route executes email or another external action.

## 3. Important files, one by one

### `app/layout.tsx`

**Purpose:** Root App Router layout. Imports global CSS and defines page metadata and the outer HTML document.

**Called by:** Next.js for routes under `app/`.

**Calls / depends on:** `app/globals.css`; Next.js `Metadata` and `LayoutProps` types.

**Important exports/functions/components:** `metadata`; `RootLayout`.

**Data in:** `children`, supplied by the active route tree.

**Data out:** `<html lang="en"><body>…</body></html>` around the route.

**Runs where:** Next.js server rendering.

**Why it exists:** The root layout is the shared document shell; individual pages provide route content.

### `app/page.tsx`

**Purpose:** Implements `/` as a redirect to `/dashboard`.

**Called by:** A request or navigation to `/`.

**Calls / depends on:** `redirect` from `next/navigation`.

**Important exports/functions/components:** `Home`.

**Data in:** No application data.

**Data out:** A redirect response to `/dashboard`.

**Runs where:** Next.js server.

**Why it exists:** Keeps `/dashboard` as the application's default workspace view.

### `app/dashboard/page.tsx`

**Purpose:** Route page for the Overview triage queue.

**Called by:** A request/navigation to `/dashboard`.

**Calls / depends on:** `WorkspaceShell` and `EnquiryDashboard`.

**Important exports/functions/components:** `DashboardPage`.

**Data in:** No fetched data; the dashboard component reads mock fixtures.

**Data out:** The shared shell containing `EnquiryDashboard` with `view="overview"`.

**Runs where:** Page composition runs as a Next.js Server Component; the imported interactive components run client-side.

**Why it exists:** Separates route composition from reusable queue rendering.

### `app/enquiries/page.tsx`

**Purpose:** Route page for the full enquiries queue.

**Called by:** A request/navigation to `/enquiries`.

**Calls / depends on:** `WorkspaceShell` and `EnquiryDashboard`.

**Important exports/functions/components:** `EnquiriesPage`.

**Data in:** No fetched data; `EnquiryDashboard` reads fixtures.

**Data out:** The queue configured with `view="enquiries"` (initially showing all statuses).

**Runs where:** Server Component composition plus client-rendered interactive children.

**Why it exists:** Reuses the queue UI with a different initial view instead of duplicating the list.

### `app/enquiries/[id]/page.tsx`

**Purpose:** Resolves a detail URL to its fixture Enquiry and loads its newest saved Analysis plus associated Action.

**Called by:** A request/navigation to a dynamic enquiry detail URL.

**Calls / depends on:** `mockEnquiries`, `getLatestAnalysisState()` from `lib/persistence/supabase.ts`, `WorkspaceShell`, `EnquiryDetail`, and Next.js `notFound()`.

**Important exports/functions/components:** `EnquiryPage()` uses `connection()` so each visit loads and validates the latest Analysis and its Action rather than freezing database state at build time.

**Data in:** The dynamic `id` route parameter.

**Data out:** `EnquiryDetail` receives `initialAnalysis`, `initialAction`, the fixture Enquiry, and an optional safe persistence warning.

**Runs where:** Next.js server. `generateStaticParams()` supplies known fixture IDs, while `connection()` keeps the per-visit persistence query out of build-time rendering.

**Why it exists:** Keeps fixture lookup and database access server-side, then gives the interactive detail component both the stable source enquiry and the validated saved result.

### `app/activity/page.tsx`

**Purpose:** Route page for workspace activity history.

**Called by:** A request/navigation to `/activity`.

**Calls / depends on:** `WorkspaceShell` and `ActivityHistory`.

**Important exports/functions/components:** `ActivityPage`.

**Data in:** No fetched data; the activity component reads seeded events.

**Data out:** The shared shell containing the client-side activity feed.

**Runs where:** Server Component composition plus client component behavior.

**Why it exists:** Keeps route composition separate from the filterable history UI.

### `components/workspace-shell.tsx`

**Purpose:** Shared navigation and visual shell around route content.

**Called by:** The dashboard, enquiries, activity, and enquiry detail route pages.

**Calls / depends on:** Next.js `usePathname()` and `Link`; React `useState`; Lucide icons.

**Important exports/functions/components:** `WorkspaceShell` reads the current path to select active navigation/breadcrumbs and owns `mobileNavOpen` for the responsive menu.

**Data in:** `children` as `ReactNode`, usually page content composed by a Server Component.

**Data out:** Sidebar, top bar, mobile navigation, and a main region containing those children.

**Runs where:** Browser, because the module starts with `"use client"` and uses pathname and React state.

**Why it exists:** Centralizes workspace navigation/layout while letting route pages provide their own content.

### `components/enquiry-dashboard.tsx`

**Purpose:** Renders both the Overview attention queue and the full Enquiries list.

**Called by:** `app/dashboard/page.tsx` and `app/enquiries/page.tsx`.

**Calls / depends on:** `mockEnquiries`; Next.js `Link`; local React state; icons.

**Important exports/functions/components:** `EnquiryDashboard({ view })`; `QueueFilter`; `formatReceivedAt()`.

**Data in:** Optional `view` prop (`"overview"` or `"enquiries"`), and mock records from `mockEnquiries`.

**Data out:** Filtered display rows that link to `/enquiries/[id]`; it does not fetch or mutate records.

**Runs where:** Browser (`"use client"`), because search input and filter selection are interactive.

**Why it exists:** One client component serves two queue routes. `view` selects the initial status filter; search and selected filter are local state. “Attention” means all workflow statuses except `"responded"`.

### `components/enquiry-detail.tsx`

**Purpose:** Main enquiry review screen: identity, Analysis, source message, and persisted Action review.

**Called by:** `app/enquiries/[id]/page.tsx`, which passes a fixture as `enquiry`.

**Calls / depends on:** Analysis and Action schemas; same-origin `/api/ai/analyze` and `/api/actions`; `initialAnalysis`, `initialAction`, and fixture props.

**Important exports/functions/components:** `runAnalysis()` accepts only a validated saved Analysis+Action response. `updateAction()` validates editable payloads, saves edits or review decisions, and updates the UI only from a validated server response.

**Data in:** A fixture Enquiry plus optional Zod-validated persisted Analysis and Action.

**Data out:** Review UI whose draft body and Action status come from persisted state. Only the illustrative per-enquiry timeline remains local/fixture data.

**Runs where:** Browser (`"use client"`), because it owns button events, request loading/errors, editing, and local review interactions.

**Why it exists:** It keeps interactive editing in the browser while delegating all database access, validation, and transitions to the server.

### `components/activity-history.tsx`

**Purpose:** Renders the workspace-wide seeded activity feed.

**Called by:** `app/activity/page.tsx`.

**Calls / depends on:** `mockWorkspaceActivity`, `mockEnquiries`, `WorkspaceActivityType`; local React filter state; Next.js links.

**Important exports/functions/components:** `ActivityHistory`; `matchesFilter()` defines event categories; `eventPresentation` maps event types to icons/styles; `formatDate()` and `formatTime()` produce labels.

**Data in:** Seeded workspace events and seeded enquiries used to resolve event links.

**Data out:** Events filtered by type, sorted newest-first, grouped by date, and linked to matching enquiry details where possible.

**Runs where:** Browser (`"use client"`), as the activity filter is interactive.

**Why it exists:** Keeps the history view separate from per-enquiry detail interactions. Its source array is fixture data, not a live event store.

### `app/api/ai/analyze/route.ts`

**Purpose:** Server-side HTTP boundary for analysis requests.

**Called by:** The browser's `fetch("/api/ai/analyze")` from `EnquiryDetail.runAnalysis()`.

**Calls / depends on:** Analysis/workflow schemas, `analyzeEnquiryText()`, `saveValidatedAnalysis()`, and typed safe errors.

**Important exports/functions/components:** `POST(request)` validates input, runs and validates analysis, persists the Analysis and proposed Action, and only then returns the combined response.

**Data in:** An HTTP JSON request containing `enquiryId` and `originalText`.

**Data out:** Success only after save: `{ analysis, action }`; failures retain stable safe 400/502/503 contracts.

### `app/api/actions/route.ts`

**Purpose:** Small server mutation boundary for Action review.

**Important behavior:** `PATCH()` validates Action ID, enquiry ID, operation, and full draft payload; verifies the demo enquiry; then delegates to the persistence layer. Invalid or stale/terminal transitions return `409 invalid_transition`. Approval stores status and content only—there is no execution call.

**Runs where:** Next.js server route handler, not in the browser.

**Why it exists:** It prevents the browser from needing provider or database credentials, validates untrusted incoming requests, orders persistence after output validation, and keeps provider/database errors behind a stable application response contract.

### `lib/ai/analyze-enquiry.ts`

**Purpose:** Implements the Gemini provider boundary for one enquiry analysis.

**Called by:** `POST()` in `app/api/ai/analyze/route.ts`.

**Calls / depends on:** `@google/genai` (`GoogleGenAI`, `ApiError`); Zod's `toJSONSchema()`; `LeadAnalysisSchema` and `LeadAnalysis`.

**Important exports/functions/components:** `analyzeEnquiryText(originalText)` reads server environment variables, submits the request, checks/parses output, and returns validated analysis. `AnalysisConfigurationError` signals missing key/model; `AnalysisOutputError` signals unavailable, malformed, or schema-invalid output.

**Data in:** `originalText` from the validated API request; `GEMINI_API_KEY` and `GEMINI_MODEL` from the server environment.

**Data out:** A `LeadAnalysis` value only after successful Zod validation.

**Runs where:** Next.js server only. The module imports `"server-only"` and must not be imported into client components.

**Why it exists:** Keeps provider SDK calls and the secret key out of the UI and route implementation. It also owns structured-output configuration and provider retry policy.

**Current provider behavior:** The model is read from `GEMINI_MODEL`; `.env.example` sets the development example to `gemini-3.5-flash-lite`. The provider does not silently substitute a model if this environment variable is missing. Thinking is set to `"minimal"`. The request has a 30-second SDK timeout and SDK retries are disabled. The provider retries only `ApiError` HTTP statuses 429, 500, 502, 503, and 504, up to two retries after the first attempt, waiting 500 ms and then 1,000 ms. Authentication, bad-request, schema, and non-HTTP errors are not retried. Development logs include only model, attempt, and elapsed milliseconds.

### `lib/persistence/supabase.ts`

**Purpose:** Owns the server-only Supabase boundary for Analysis creation, Action creation/restoration, and Action review mutations.

**Called by:** Both API routes and the server detail page.

**Calls / depends on:** Supabase, server-only credentials, Analysis schemas, and Action schemas/transition rules.

**Important exports/functions/components:** `saveValidatedAnalysis()` inserts an Analysis and its single proposed Action; every explicit rerun creates a new pair. `getLatestAnalysisState()` validates the newest Analysis and linked Action. `updatePersistedAction()` validates payload/current row, enforces allowed transitions with an optimistic status match, and returns validated stored state.

**Runs where:** Next.js server only. The module imports `"server-only"`; its privileged credential and client are never sent to the browser.

**Why it exists:** Centralizes database access and validation of saved JSON. Database diagnostics are logged without enquiry data or credentials; the API returns safe error messages.

### Supabase migrations

The original migrations create `enquiries` and `analyses`. `20261008120000_actions.sql` adds the linked `actions` table, strict database checks, latest-action index, RLS, explicit browser-role revocation, and only `select/insert/update` for `service_role`.

The browser never queries these tables. The service role is used only inside the `server-only` persistence module.

### `lib/action-schema.ts` and `lib/analysis-workflow-schema.ts`

`PersistedActionSchema` accepts only a strict `draft_reply` payload and statuses `proposed`, `edited`, `approved`, or `cancelled`. IDs, timestamps, recipient email, subject, body, tone, and key points are validated. `transitionActionStatus()` allows only pending review transitions; approved/cancelled are terminal. The workflow schema validates the combined `{ analysis, action }` API response.

### `lib/lead-analysis-schema.ts`

**Purpose:** Defines the application validation contract shared by the browser and server.

**Called by:** API route, provider, enquiry detail component, persistence module, and schema/persistence tests.

**Calls / depends on:** Zod.

**Important exports/functions/components:** `LeadAnalysisSchema` defines company/contact/project fields; nullable budget and timeline facts; bounded priority and score; requirements; missing information; qualification summary; and recommended next step. The nested analysis objects and outer analysis schema are strict. `parsePersistedAnalysis()` applies that same contract to untrusted stored JSON. Request and safe error schemas cover the HTTP boundary. `LeadAnalysis` is inferred from the runtime schema.

**Data in:** Unknown JavaScript values from Gemini, HTTP payloads, and persisted JSON.

**Data out:** Parse results (success with typed data or failure with issues); the inferred `LeadAnalysis` TypeScript type.

**Runs where:** Both browser and server. The client validates request/response/error payloads; the server validates requests and AI results, and the persistence module validates both before save and after restore.

**Why it exists:** One runtime schema and inferred type keep validation and TypeScript shapes aligned. The provider also derives Gemini's JSON Schema from this source of truth.

### `lib/mock-enquiry.ts`

**Purpose:** Defines the base `MockEnquiry` shape, reusable fixture item types, and one complete sample enquiry.

**Called by:** `lib/mock-workspace.ts` uses the sample as a base; detail-related types consume its declared interfaces.

**Calls / depends on:** `LeadAnalysis` types for requirement and missing-information item shapes.

**Important exports/functions/components:** `Requirement`, `MissingInformation`, `ActivityEvent`, `MockEnquiry`, and `mockEnquiry`.

**Data in:** No runtime external data.

**Data out:** A representative fixture including original text, prefilled analysis-like display fields, a draft reply, and per-enquiry activity.

**Runs where:** Imported in both server page composition and client components; it is static module data.

**Why it exists:** Gives the mock UI a typed example and keeps fixture definitions separate from rendering.

### `lib/mock-workspace.ts`

**Purpose:** Defines workflow-oriented types and the queue/activity fixtures for the workspace.

**Called by:** Dashboard, activity history, and dynamic detail route.

**Calls / depends on:** Spreads and extends `mockEnquiry`.

**Important exports/functions/components:** `WorkspaceEnquiry` extends `MockEnquiry` with source, summary, workflow/analysis statuses, optional action state/outcome, and an ISO timestamp. `mockEnquiries` is the detail/queue record set. `WorkspaceActivityEvent` and `mockWorkspaceActivity` provide the separate workspace history feed.

**Data in:** The base `mockEnquiry` object, overridden to create the other examples.

**Data out:** Typed arrays consumed as initial UI data.

**Runs where:** Server and client as imported by route files and client components.

**Why it exists:** Separates the workspace's seeded records and event taxonomy from both shared display types and UI. These are not database records; the activity feed is not automatically updated by detail-page state changes.

### `tests/lead-analysis-schema.test.mjs`

**Purpose:** Focused Node tests for `LeadAnalysisSchema`.

**Called by:** `yarn test:analysis`.

**Calls / depends on:** Imports the schema from `lib/lead-analysis-schema.ts` and uses Node's test/assert APIs.

**Important exports/functions/components:** Tests complete analysis acceptance, nullable source data, arbitrary/null project types, score bounds, and allowed priority values.

**Data in:** Example JavaScript analysis objects.

**Data out:** Pass/fail results. This test file does not call the Gemini API or test the API route/retry flow.

**Runs where:** Node test process, outside the browser.

**Why it exists:** Verifies the core runtime model independently of UI and provider availability.

### `tests/persisted-analysis.test.mjs`

**Purpose:** Focused Node tests for validating stored Analysis JSON.

**Called by:** `yarn test:persistence`.

**Calls / depends on:** `parsePersistedAnalysis()` from `lib/lead-analysis-schema.ts`; Node's test/assert APIs.

**What it verifies:** A valid analysis object can be restored, while malformed or schema-extended stored JSON is rejected. It does not connect to Supabase or test network persistence.

### `tests/action-schema.test.mjs`

**Purpose:** Verifies valid persisted Action parsing, rejection of unsupported types/statuses and malformed payloads, schema-valid edited content, allowed approval/cancellation transitions, and terminal-state protection. It is a pure application-logic test, not a live Supabase test.

### Verification status

The automated suites cover Analysis and Action contracts. The pre-existing Analysis round trip was manually verified in Stage 2B; the Stage 2C Action migration and live edit/decision round trip still require manual Supabase verification.

### `README.md`, `.env.example`, and `.gitignore`

**Purpose:** Document local Gemini setup and keep local secrets out of source control.

**Called by:** Developers while configuring/running the app; `.gitignore` is applied by Git.

**Calls / depends on:** `.env.example` names `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`; `README.md` explains server-side setup; `.gitignore` ignores `.env*` but permits `.env.example`.

**Important exports/functions/components:** None; these are setup files.

**Data in:** Developer-provided environment configuration.

**Data out:** A documented environment setup. Actual values are loaded from the local environment by Next.js and read by server code.

**Runs where:** Documentation/Git tooling; environment values are made available to Next.js server runtime.

**Why it exists:** Keeps setup instructions separate from runtime code and reduces the risk of committing `.env.local`. The Supabase secret key must remain server-only and must not use a `NEXT_PUBLIC_` prefix.

## 4. React state and what survives refresh

Keep these data/state categories separate:

1. **Fixture enquiry data** seeds queue rows and the detail page's source/contact fields; the activity page remains a separately seeded fixture feed.
2. **Persisted Analysis and Action** are the durable AI result, editable proposal, and review decision.
3. **Temporary React state** holds editor text/loading/errors and the latest server-confirmed records while mounted.
4. **Server-loaded persisted state** is queried and validated on each detail-page visit, then passed as `initialAnalysis` and `initialAction`.

### `EnquiryDashboard`

- `filter` begins as `"attention"` on the overview and `"all"` on the full enquiries route. The `key` props in those route pages ensure the shared component gets distinct initial state when switching route identity.
- `query` stores the search input.
- `visibleEnquiries` is derived on each render by filtering `mockEnquiries` by status and searchable text.
- Both states are in the browser only. Refresh restores the route's initial filter and an empty search string.

### `ActivityHistory`

- `filter` begins as `"all"` and changes when the user selects an activity category.
- Sorted, filtered, grouped events and the enquiry lookup map are derived from static arrays; they are not persisted.
- Refresh restores `"all"` and reloads the same seeded history.

### `WorkspaceShell`

- `mobileNavOpen` controls only whether its responsive navigation is visible.
- Active navigation and breadcrumb values derive from `usePathname()`, not a separate saved state.
- A route transition or refresh does not persist an open-menu setting.

### `EnquiryDetail`

- Initial `enquiry` data comes from `mockEnquiries` selected in the server route.
- `action` starts from validated `initialAction`; `draftBody` is only the controlled editor value. Saving, approving, or cancelling must succeed through `/api/actions` before durable UI state changes.
- `liveAnalysis` starts from the server-provided `initialAnalysis` (or `null`). A successful `/api/ai/analyze` response replaces it after the server has persisted the validated result.
- `isAnalyzing` drives the loading UI; `analysisError` holds a message for the current request.
- The analysis fields shown are derived from the live object when present, otherwise from the fixture. Some nullable live values intentionally display as “Not identified” or “Not provided” rather than returning to a seeded analysis value.
- Approval and cancellation persist terminal decisions but do not send email or update `mockWorkspaceActivity`.

On refresh, filters and illustrative timeline changes reset. The server restores the newest validated Analysis plus associated validated Action, so edited content and approved/cancelled status survive.

## 5. The AI boundary and environment

The external-service paths are:

```text
Browser → Next.js server → Gemini
Enquiry detail page → Next.js server → Supabase
```

`EnquiryDetail` knows only same-origin `/api/ai/analyze` and `/api/actions`. Both delegate database work to the server-only persistence module. The browser never receives Gemini or Supabase credentials.

The server reads `GEMINI_API_KEY` and `GEMINI_MODEL` for Gemini, and `SUPABASE_URL` plus `SUPABASE_SECRET_KEY` for persistence. The Supabase key is server-only, is not prefixed `NEXT_PUBLIC_`, and is not included in requests, page props, or API responses. `.env.example` lists variable names only; real values belong in ignored `.env.local` or another server environment. A missing Gemini key/model maps to `503 missing_configuration`; missing Supabase configuration or persistence failure maps to `503 persistence_unavailable`.

RLS is enabled on all three tables. The Action migration explicitly revokes `anon` and `authenticated` privileges and grants only required service-role operations. Provider/database diagnostics omit enquiry contents, reply contents, and credentials.

The provider retries known transient HTTP API errors only: 429 and selected 5xx statuses (500, 502, 503, 504). These commonly represent rate limiting or temporary service trouble. It makes at most three calls total (initial attempt plus two retries), with short increasing delays. Other failures such as authentication or malformed requests cannot be fixed by repeating the same request, so they fail immediately. Model output validation failures happen after the provider call and are not part of this retry loop.

In development, timing logs report model name, attempt number, and elapsed milliseconds. They do not log the key, enquiry, or model output. The API route has separate server-side provider diagnostics; browser-facing errors remain generic or schema-defined.

## 6. Zod and structured AI output

`LeadAnalysisSchema` in `lib/lead-analysis-schema.ts` is the runtime source of truth for a valid analysis. It describes required fields and constraints such as nullable unknown facts, allowed priority values, numeric lead score between 0 and 100, and strict nested objects. `LeadAnalysis` is inferred from that schema, so TypeScript consumers use the same field structure that runtime validation enforces.

The provider converts the schema for Gemini and then still validates Gemini's answer:

```text
LeadAnalysisSchema (Zod)
↓ z.toJSONSchema(..., { target: "draft-7" })
JSON Schema passed as response_format.schema
↓
Gemini structured JSON output in output_text
↓ JSON.parse()
unknown JavaScript value
↓ LeadAnalysisSchema.safeParse()
validated LeadAnalysis
```

The exact Gemini request sets `response_format` to text with `mime_type: "application/json"` and supplies the JSON Schema. That asks the model to constrain output to the structured shape; it does not make external output inherently trustworthy. The response still crosses a network/provider boundary and can be absent, malformed, or violate application constraints. `JSON.parse()` checks JSON syntax; it does not check field types or business constraints. `safeParse()` performs that second check and produces a typed value only on success.

The route validates AI output independently, then validates the combined `{ analysis, action }` workflow response before returning. Action requests/responses and restored rows have their own strict schemas.

## 7. Next.js concepts used here

- **App Router:** The `app/` directory maps pages and the `/api/ai/analyze` plus `/api/actions` route handlers.
- **`page.tsx`:** Route UI entry points are in `app/**/page.tsx`. They are Server Components by default. Here they compose the shell and client components, rather than owning interactive state.
- **Dynamic route:** `app/enquiries/[id]/page.tsx` uses the `[id]` folder to capture an enquiry ID. It awaits Next.js's `params` promise, selects a matching mock record, and uses `notFound()` when no fixture matches. `generateStaticParams()` exposes the existing fixture IDs; `connection()` ensures the saved-analysis query runs at request time.
- **API `route.ts`:** Analysis uses `POST`; Action review uses uncached `PATCH`. Both are server boundaries called by the client component.
- **Client components:** `components/enquiry-detail.tsx`, `components/enquiry-dashboard.tsx`, `components/activity-history.tsx`, and `components/workspace-shell.tsx` start with `"use client"` because they use state, event handlers, browser fetch, or client navigation state.
- **Server/client composition:** The detail page passes fixture props plus validated `initialAnalysis` and `initialAction` to the client component.
- **Server-only integrations:** `lib/ai/analyze-enquiry.ts` and `lib/persistence/supabase.ts` import `"server-only"` to prevent accidental client use. They access private environment variables and their respective service SDKs.
- **Root layout:** `app/layout.tsx` provides the shared document, global stylesheet import, and metadata. `app/page.tsx` uses Next's `redirect()` to send the root route to the dashboard.

## 8. Recommended reading order

1. **`app/enquiries/[id]/page.tsx`** — Follow request-time Analysis+Action restore.
2. **`lib/persistence/supabase.ts`** — Understand save, restore, and guarded transition paths.
3. **`components/enquiry-detail.tsx`** — Follow persisted review interactions.
4. **`app/api/ai/analyze/route.ts`** — Trace request validation, AI validation, persistence ordering, and response.
5. **`lib/ai/analyze-enquiry.ts`** — Read the server-only Gemini request, structured-output config, retries, and Zod validation.
6. **`lib/lead-analysis-schema.ts`** and **`lib/action-schema.ts`** — Learn the strict boundary contracts.
7. **`supabase/migrations/20261008120000_actions.sql`** — Review Action constraints, RLS, and grants.
8. **`lib/mock-workspace.ts`** and **`lib/mock-enquiry.ts`** — Compare fixture enquiry/activity data with persisted Analysis data.
9. **`components/enquiry-dashboard.tsx`** and **`components/activity-history.tsx`** — See which screens remain fixture-driven.
10. **`components/workspace-shell.tsx`** — See shared navigation and its local state.
11. **`tests/*.test.mjs`** — Review pure Analysis and Action validation tests; none calls Gemini or Supabase.
12. **`app/dashboard/page.tsx`, `app/enquiries/page.tsx`, `app/activity/page.tsx`, `app/layout.tsx`, and `app/page.tsx`** — Review the remaining route composition and root layout/redirect.

## 9. Current architecture versus future work

### Current implementation

```text
fixture enquiry
       ↓
React client → POST /api/ai/analyze
       ↓
Next.js server → Gemini structured output
       ↓
Zod validation → persisted Analysis + proposed Action
↓
human edit / approve / cancel → validated PATCH → persisted Action
↓ later visit / refresh
server-side Supabase query → stored Analysis + Action Zod validation
↓
EnquiryDetail restores saved analysis, content, and decision
```

The queue, source enquiries, and activity feed remain fixture-based. Analysis and review state are persisted. No email is sent and no Action is executed.

### Future architecture

Only execution and durable audit history remain future:

```text
approved tool/function execution
       ↓
email / external API
       ↓
persisted ActivityEvent
```

Approval is now durable but deliberately disconnected from execution. Email and persisted `ActivityEvent` records belong to Stage 2D.
