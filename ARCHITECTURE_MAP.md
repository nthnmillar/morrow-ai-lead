# Architecture map

## 1. Current system architecture

```mermaid
flowchart LR
  subgraph Browser["BROWSER"]
    Queue["EnquiryDashboard<br/>components/enquiry-dashboard.tsx"]
    Detail["EnquiryDetail<br/>components/enquiry-detail.tsx"]
    Activity["ActivityHistory<br/>components/activity-history.tsx"]
    Shell["WorkspaceShell<br/>components/workspace-shell.tsx"]
    Local[("LOCAL-ONLY React state<br/>live analysis · filters · draft · review")]
  end

  subgraph NextServer["NEXT.JS SERVER"]
    Pages["App Router pages<br/>app/dashboard/page.tsx<br/>app/enquiries/page.tsx<br/>app/enquiries/[id]/page.tsx<br/>app/activity/page.tsx"]
    Fixtures["MOCK fixtures<br/>lib/mock-enquiry.ts<br/>lib/mock-workspace.ts"]
    Route["POST /api/ai/analyze<br/>app/api/ai/analyze/route.ts"]
    Provider["Server-only Gemini provider<br/>lib/ai/analyze-enquiry.ts"]
    Schema["Zod contracts<br/>lib/lead-analysis-schema.ts"]
  end

  subgraph External["EXTERNAL"]
    Gemini["Gemini API"]
  end

  Pages -->|"select fixture / compose UI"| Fixtures
  Pages -->|"render client components"| Shell
  Pages --> Queue
  Pages --> Detail
  Pages --> Activity
  Fixtures -.->|"seeded data; not persisted"| Queue
  Fixtures -.->|"seeded detail props"| Detail
  Fixtures -.->|"seeded history; not persisted"| Activity
  Shell --- Queue
  Shell --- Detail
  Shell --- Activity
  Queue -->|"search and filter"| Local
  Detail -->|"analysis and review state"| Local
  Activity -->|"history filter"| Local
  Detail -->|"POST originalText"| Route
  Route -->|"validate request / response"| Schema
  Route -->|"analyzeEnquiryText()"| Provider
  Provider -->|"JSON Schema derived from Zod"| Schema
  Provider -->|"structured-output request"| Gemini
  Gemini -->|"structured JSON"| Provider
  Provider -->|"Zod-validated analysis"| Route
  Route -->|"validated JSON response"| Detail
```

- The browser calls our API route; the browser never calls Gemini directly.
- Fixture records seed the queue, detail page, and activity feed; they are not database records.
- Live analysis and review interactions stay in React state, so refresh loses those changes.

## 2. “Analyse with AI” execution sequence

```mermaid
sequenceDiagram
  actor User
  participant UI as Browser: EnquiryDetail<br/>components/enquiry-detail.tsx
  participant ClientZod as Browser: AnalyzeEnquiryRequestSchema
  participant Route as Next.js server: POST<br/>app/api/ai/analyze/route.ts
  participant ServerZod as Server: request/response Zod schemas
  participant Provider as Server: analyzeEnquiryText()<br/>lib/ai/analyze-enquiry.ts
  participant Gemini as External: Gemini API

  User->>UI: Click “Analyse with AI”
  UI->>UI: runAnalysis()
  UI->>ClientZod: safeParse({ originalText })
  ClientZod-->>UI: Valid request
  UI->>Route: fetch("/api/ai/analyze") with originalText
  Route->>ServerZod: Validate request again
  ServerZod-->>Route: Validated request
  Route->>Provider: analyzeEnquiryText(originalText)
  Provider->>ServerZod: Derive JSON Schema from LeadAnalysisSchema
  Provider->>Gemini: interactions.create(structured JSON request)
  Gemini-->>Provider: Completed response with output_text
  Provider->>Provider: JSON.parse(output_text)
  Provider->>ServerZod: LeadAnalysisSchema.safeParse(parsed value)
  ServerZod-->>Provider: Validated LeadAnalysis
  Provider-->>Route: Return validated analysis
  Route->>ServerZod: Validate { analysis } response
  Route-->>UI: JSON { analysis }
  UI->>ClientZod: Validate response wrapper
  UI->>UI: setLiveAnalysis(analysis)
  UI-->>User: React renders the live analysis
```

- Request text is validated in the browser and revalidated at the server boundary.
- Gemini’s structured output is parsed and then revalidated with `LeadAnalysisSchema`.
- The client validates the API response before storing it in `liveAnalysis`; that state is temporary.
- The provider retries only selected transient HTTP errors; auth, request, and schema failures do not retry.

## 3. File dependency / code map

```mermaid
flowchart TD
  subgraph Pages["Next.js pages · server"]
    DashboardPage["app/dashboard/page.tsx"]
    EnquiriesPage["app/enquiries/page.tsx"]
    DetailPage["app/enquiries/[id]/page.tsx"]
    ActivityPage["app/activity/page.tsx"]
  end

  subgraph Components["React client components · browser"]
    Shell["components/workspace-shell.tsx"]
    Queue["components/enquiry-dashboard.tsx"]
    Detail["components/enquiry-detail.tsx"]
    Activity["components/activity-history.tsx"]
  end

  subgraph DataAndValidation["Shared data and validation"]
    MockWorkspace["lib/mock-workspace.ts"]
    MockEnquiry["lib/mock-enquiry.ts"]
    Schema["lib/lead-analysis-schema.ts"]
  end

  subgraph AIPath["Server AI path"]
    Route["app/api/ai/analyze/route.ts"]
    Provider["lib/ai/analyze-enquiry.ts"]
    Gemini["Gemini API"]
  end

  DashboardPage -->|"composes"| Shell
  DashboardPage -->|"renders overview"| Queue
  EnquiriesPage -->|"composes"| Shell
  EnquiriesPage -->|"renders full queue"| Queue
  DetailPage -->|"composes"| Shell
  DetailPage -->|"selects fixture; passes enquiry"| Detail
  ActivityPage -->|"composes"| Shell
  ActivityPage -->|"renders history"| Activity

  Queue -->|"imports fixture list"| MockWorkspace
  Activity -->|"imports events and enquiries"| MockWorkspace
  DetailPage -->|"imports fixture list"| MockWorkspace
  MockWorkspace -->|"extends base fixture"| MockEnquiry
  MockEnquiry -->|"uses inferred item types"| Schema

  Detail -->|"calls /api/ai/analyze"| Route
  Detail -->|"validates request and response"| Schema
  Route -->|"validates request and response"| Schema
  Route -->|"calls analyzeEnquiryText()"| Provider
  Provider -->|"derives JSON Schema; validates output"| Schema
  Provider -->|"structured request"| Gemini
  Gemini -->|"structured response"| Provider
```

- `WorkspaceShell` is shared navigation/layout; the pages compose it with the screen-specific client component.
- Queue, detail, and activity screens read typed fixtures; activity events are a separate seeded feed.
- `LeadAnalysisSchema` supplies both the inferred TypeScript type and runtime validation contract.

## Read these files in this order

1. [app/enquiries/[id]/page.tsx](./app/enquiries/[id]/page.tsx) — see how the server selects a fixture and passes it to the detail component.
2. [lib/mock-workspace.ts](./lib/mock-workspace.ts) — inspect the queue records and separate activity fixtures.
3. [components/enquiry-detail.tsx](./components/enquiry-detail.tsx) — follow `runAnalysis()`, local state, and the rendered result.
4. [app/api/ai/analyze/route.ts](./app/api/ai/analyze/route.ts) — trace request validation and the stable JSON response.
5. [lib/ai/analyze-enquiry.ts](./lib/ai/analyze-enquiry.ts) — inspect the server-only Gemini request, structured output, retries, and Zod revalidation.
6. [lib/lead-analysis-schema.ts](./lib/lead-analysis-schema.ts) — understand the shared runtime contract used at each boundary.
7. [components/enquiry-dashboard.tsx](./components/enquiry-dashboard.tsx) and [components/activity-history.tsx](./components/activity-history.tsx) — compare the fixture-driven queue and history views.
8. [components/workspace-shell.tsx](./components/workspace-shell.tsx) — see how route content is wrapped with shared navigation.

> The current source includes Gemini analysis; the Stage 1 status paragraph in `PROJECT_SPEC.md` predates that implementation. This map documents current code, not planned persistence or action execution.
