# AI Lead Workspace — Product Specification

## 1. Project purpose

This project is a portfolio application for an experienced TypeScript and React engineer who wants to demonstrate applied AI integration in a realistic business workflow.

The core story is not “build a chatbot.” The core story is: a service business receives messy customer enquiries, an AI extracts structure, the software validates the result, and a human approves any consequential action before it is executed.

The product should feel like a credible B2B workflow tool, not a speculative AI demo.

## 2. Portfolio objective

The portfolio should show that the developer can:

- build a polished SaaS-style interface
- work with real AI-generated structured data
- validate model output before using it
- keep model suggestions separate from application execution
- apply human approval controls
- persist and display workflow state clearly
- integrate one real external service in a small, controlled way

The product is intended to prove applied AI engineering in a small, credible, buildable slice.

### Current implementation status

Stage 1 is complete, reviewed, and approved. The current application is a frontend-only prototype using typed mock enquiry and activity data with local/mock interactions. It has no real LLM connection, runtime Zod validation, persistence, external email integration, or external API calls. The final V1 capabilities described below remain future work.

## 3. Narrow product concept

The product is an AI Lead Workspace for a service business that receives customer enquiries by email, web form, or manual intake.

Example enquiry:

> Hi, we’re a furniture company using Shopify. We need a product configurator for around 20 products. Customers need to change materials and colours. Ideally we’d launch before Christmas. Our budget is around $20,000.

The application processes this text into a structured lead summary, identifies missing information, suggests a next step, and then requires approval before executing any application action.

## 4. Primary workflow

### Final V1 workflow

The final end-to-end workflow is:

1. User submits an unstructured enquiry.
2. The server sends it to a real LLM and receives structured output.
3. The application validates the output with Zod and persists the analysis.
4. The model proposes a narrow tool/function action.
5. The application validates the proposed action independently.
6. The user reviews, edits, approves, or rejects the proposal.
7. The application executes only an approved action through the database or external integration.
8. The result is persisted and visible in activity history.

The required V1 demonstration is:

unstructured enquiry → real LLM → structured output → Zod validation → persistence → tool/function proposal → application-side validation → human approval → approved action execution → external API/database → visible result

This describes the final V1 goal, not current Stage 1 behavior. Stage 1 displays seeded analysis and activity fixtures. Its search, filters, draft editing, approval/cancellation states, and failed-analysis retry state are local UI interactions; they do not call a model, validate a live response, persist changes, send email, or execute an external action.

## 5. Minimal information architecture

The app should be intentionally small. Its canonical routes are:

- `/` redirects to `/dashboard`.
- `/dashboard` is the Overview triage workspace, initially filtered to enquiries needing attention.
- `/enquiries/[id]` is the enquiry detail, AI analysis, and approval experience.
- `/activity` is the workspace activity/history view.

The current implementation also exposes `/enquiries` as the full, unfiltered enquiry list, linked from workspace navigation. This is an alternate view of the queue, not a separate product surface.

There should not be a separate leads CRM, project management workspace, or large multi-page sales system in V1. Optional intake can remain a small modal or panel rather than a major section.

## 6. Screen descriptions

### Dashboard / enquiries list

Purpose: triage incoming enquiries and navigate to their detail views, not present analytics.

The current Overview shows enquiries needing attention; `/enquiries` shows the full list. Both use local search and status filtering over typed mock data. Rows display company/contact, source, received time, project type, summary, workflow status, priority, and lead score when available. Selecting a row opens `/enquiries/[id]`.

### Enquiry detail

Purpose: show the original text, AI interpretation, and any proposed next actions.

Displays:

- original enquiry text
- company/contact details
- inferred project type
- budget and timeline
- requirements
- missing information
- lead score / priority
- recommended next action
- proposed action cards
- approve / edit / reject controls

### Activity/history

Purpose: make the workflow understandable to a business user.

Displays:

- enquiry created
- AI analysis started/completed
- validation succeeded/failed
- action proposed
- approval decision
- external action executed
- error states

Stage 1 renders this history from typed mock activity fixtures. Date grouping, filters, timestamps, and links to enquiry details are present; events are not written by a backend or guaranteed to match locally changed detail-page state.

## 7. Visual direction

The implemented and approved Stage 1 UI is the visual source of truth. Extend its existing styles rather than reverting to earlier generic descriptions or introducing a new visual system.

The current visual language uses Rajdhani typography; a deep aubergine/indigo sidebar and ink; a pale lilac canvas with white panels and subtle lilac borders; and restrained green and amber accents for workflow status. Muted text is darker on light surfaces and uses a separate light-grey treatment on the dark sidebar. Visible text has a 12px minimum. Keep the existing compact B2B information hierarchy, panel/card treatment, borders, spacing, and responsive navigation and column behavior. Preserve the distinction between source enquiry, seeded analysis, and proposed action. Do not redesign or reinterpret these choices.

## 8. Minimal data model

The data model should be small and focused.

### Enquiry

- id
- source
- companyName
- contactName
- email
- originalText
- createdAt
- status

### Analysis

- id
- enquiryId
- projectType
- budgetRange
- timeline
- requirements
- missingInformation
- leadScore
- priority
- recommendedNextAction
- reasoning
- modelOutputJson
- createdAt
- status

### Action

- id
- enquiryId
- type
- payload
- status
- proposedAt
- approvedByUserAt
- rejectedAt
- executedAt
- errorMessage

### ActivityEvent

- id
- enquiryId
- type
- summary
- details
- createdAt

These four entities are enough to prove the workflow without turning the app into a CRM product.

This is the target domain model for the final V1, not a description of Stage 1 persistence. Stage 1 currently represents these concepts with typed mock fixtures; it has no database or persisted domain entities.

## 9. AI analysis schema

This is the planned runtime schema for real model output in a later stage. Stage 1 does not call an LLM or run this Zod validation; its “validated” labels are seeded mock presentation state.

The LLM must return structured data. All model output is validated with Zod before it is used.

```ts
import { z } from 'zod';

export const LeadAnalysisSchema = z.object({
  companyName: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  projectType: z.enum(['configurator', 'website', '3d-visualisation', 'other']),
  budgetRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string().default('USD')
  }),
  timeline: z.object({
    requestedLaunch: z.string().nullable(),
    urgency: z.enum(['low', 'medium', 'high'])
  }),
  requirements: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1)
    })
  ),
  missingInformation: z.array(
    z.object({
      field: z.string(),
      question: z.string(),
      priority: z.enum(['low', 'medium', 'high'])
    })
  ),
  leadScore: z.number().min(0).max(100),
  priority: z.enum(['low', 'medium', 'high']),
  recommendedNextAction: z.string(),
  nextActionType: z.enum(['draft_reply', 'request_missing_information', 'send_email']),
  reasoning: z.array(z.string())
});
```

Validation rules:

- no untrusted model output enters app state without validation
- malformed data is rejected clearly
- tool requests are validated before execution

## 10. LLM tools/functions

The final V1 should support only a few narrow function definitions. The model will propose them; the application will validate and execute only approved ones. Stage 1 has no model tool/function calls or application-side action validation.

### `draft_reply`

Purpose: generate a customer follow-up draft.

Input:

- enquiryId
- recipientName
- tone
- keyPoints

### `request_missing_information`

Purpose: request missing details from the customer.

Input:

- enquiryId
- missingFields
- message

### `send_email`

Purpose: send an approved customer email via external service.

Input:

- enquiryId
- to
- subject
- body

These are not general-purpose workflow primitives. They are only enough to prove role separation and approval control.

## 11. Human approval rules

Any consequential action must require human approval.

Approval flow:

1. AI proposes action.
2. Server validates the payload.
3. User reviews the action.
4. User may approve, edit, or reject it.
5. Only approved actions are executed.
6. Result is logged to activity history.

Important rule:

- the model may suggest actions, but the application owns execution

In Stage 1, approval, edit, cancellation, and retry are local prototype states only. Approval does not trigger execution, and retry does not rerun analysis. Seeded history may illustrate outcomes such as an email being sent, but no email is sent by the prototype.

## 12. One external integration

The final V1 should include exactly one real external integration: email. Stage 1 has no email or other external API integration.

Preferred provider: Resend.

Use case: send a brief follow-up email after human approval.

This demonstrates the real business flow without building a broader automation platform.

## 13. Simple technical architecture

The following is the target architecture for final V1. Stage 1 is limited to the Next.js App Router, React, TypeScript, shared UI components, and typed local mock data; it has no backend, database, AI, or email service layer.

Preferred stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase or PostgreSQL
- Zod
- OpenAI API
- Resend for email

Recommended structure:

```text
app/
  dashboard/
  enquiries/[id]/
  api/
components/
  dashboard/
  enquiry/
  activity/
  ui/
lib/
  ai/
  validation/
  actions/
  data/
services/
  ai/
  email/
  persistence/
```

The architecture should be simple and explicit:

- UI layer for review and approval
- server-side AI workflow
- validation layer for model responses
- application action layer for approved execution
- database for persistence
- email service for one external integration

## 14. Security and validation rules

- Secrets remain on the server; never send them to the browser
- LLM output is untrusted until schema validation succeeds
- Model-generated requests must match API payload schemas
- Email and database operations happen only from server-side logic
- The UI can propose actions, but it cannot directly trigger them without an approved server-side path
- Logging should avoid raw secrets and sensitive data where possible

## 15. Practical error and reliability handling

The product should include useful production-minded safeguards without enterprise complexity.

The requirements below apply to the final working V1. Stage 1 only presents mock failure/retry states and local approval states; these do not represent live API, validation, persistence, or email error handling.

Required handling:

- loading states during analysis
- validation failure states
- API failure states
- human review states before execution
- basic duplicate protection for email sends
- activity log for every meaningful event

Avoid introducing:

- queues
- distributed tracing systems
- event sourcing
- large observability infrastructure
- general workflow orchestration frameworks

## 16. Stage 1 — frontend-only prototype

Status: complete, reviewed, and approved. Stage 1 validates the product story and UX before backend implementation.

The implemented experience includes:

- `/` redirecting to `/dashboard`
- an Overview triage queue at `/dashboard` and a full enquiry list at `/enquiries`
- enquiry detail, seeded analysis, and local approval controls at `/enquiries/[id]`
- workspace activity/history at `/activity`
- typed mock enquiry records and typed mock activity events
- local search, queue/activity filters, draft editing, approval/cancellation presentation, and a mock analysis retry state
- the approved visual system described in Section 7

Stage 1 has no real LLM connection, runtime Zod validation, persistence, database, email integration, or external API calls. Seeded labels and outcomes are prototype data, not proof that those backend capabilities exist. Do not implement Stage 2 as part of Stage 1 maintenance.

## 17. Final working V1 scope

The final portfolio V1 must demonstrate real applied AI integration.

It must include:

- unstructured enquiry input
- server-side LLM API call
- structured output
- Zod validation
- persistence in a small database
- 2–3 LLM tool proposals
- application-side validation of tool requests
- human approval before execution
- one real external integration, preferably email
- visible activity/history
- loading/error states

The final V1 must actually prove the complete end-to-end chain:

unstructured enquiry → real LLM → structured output → Zod validation → persistence → tool/function proposal → application-side validation → human approval → approved action execution → external API/database → visible result

Stage 1 is not the final V1 and does not satisfy these real integration requirements.

## 18. Explicit non-goals

The V1 should not include:

- LangChain
- LangGraph
- multi-agent systems
- MCP
- autonomous browser agents
- voice features
- Python microservices
- vector databases
- RAG
- large CRM functionality
- broad workflow engine or task platform
- large observability stack

The first version should stay narrow and buildable.

## 19. Short later/backlog section

The following can be considered later:

- CRM sync
- richer automation
- document retrieval and RAG
- additional external integrations
- more advanced approval workflows and roles
- reporting and analytics

These should come after the core AI workflow is proven, not before.

## 20. Implementation stages

### Stage 1: UX prototype (completed)

Status: complete, reviewed, and approved. The dashboard/queue, detail and approval experience, activity/history, typed mock data, and local interactions are implemented. No backend capability is implied by the mock states.

### Stage 2: replace mock analysis incrementally

This is the next implementation stage. Replace the mock analysis for an enquiry with a server-side call to a real LLM, validate its structured response with the Section 9 Zod schema, and expose clear loading and failure states. Keep the existing UI and mock-only areas that are not part of this slice; do not attempt to build the whole V1 at once. Persist the validated analysis as the next increment when its data path is ready.

### Stage 3: persistence, proposals, and approved execution

Goal: replace mock workflow state with a small persisted domain model and prove the model-to-application boundary.

Deliverables:

- persistence for Enquiry, Analysis, Action, and ActivityEvent
- narrow tool/function proposals and application-side payload validation
- human review, edit, approve, and reject flow
- server-side execution of approved actions only
- the single planned email integration

### Stage 4: final polish

Goal: ensure the final V1 is credible and stable.

Deliverables:

- production-minded loading and error handling
- basic duplicate protection for email sends
- complete activity history for meaningful workflow events
- final UI tuning within the approved Stage 1 visual system

## 21. Acceptance criteria

### UI prototype acceptance criteria

- polished SaaS feel
- clear end-to-end enquiry-to-analysis story
- realistic mock data
- obvious approval states
- canonical routes and Stage 1 limitations are documented accurately

### Final V1 acceptance criteria

- user can submit a real enquiry
- server calls a real LLM
- output is validated by Zod
- model proposals are visible and reviewable
- approved action executes through server-side logic
- one real external integration works
- activity log is visible to the user
- failure states are understandable

## 22. Definition of done

The final V1 is done when the portfolio version demonstrates a small but credible real AI workflow that can be understood and trusted by a hiring manager or client. Completion of Stage 1 alone does not meet this definition.

Specifically, the final V1 should show:

- clean SaaS UI
- real unstructured input handling
- real LLM-based analysis
- strong validation and type safety
- model suggestions separated from execution
- human approval before action
- simple real external integration
- durable state and activity visibility

It should feel like a real applied-AI product, not a tutorial or a generic chatbot.
