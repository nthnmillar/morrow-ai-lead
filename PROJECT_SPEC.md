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

## 3. Narrow product concept

The product is an AI Lead Workspace for a service business that receives customer enquiries by email, web form, or manual intake.

Example enquiry:

> Hi, we’re a furniture company using Shopify. We need a product configurator for around 20 products. Customers need to change materials and colours. Ideally we’d launch before Christmas. Our budget is around $20,000.

The application processes this text into a structured lead summary, identifies missing information, suggests a next step, and then requires approval before executing any application action.

## 4. Primary workflow

The intended end-to-end flow is:

1. User enters or imports an enquiry.
2. Server calls an LLM.
3. LLM returns structured output.
4. Application validates the output with Zod.
5. Application proposes one or more actions.
6. User reviews and either approves, edits, or rejects the action.
7. Only approved actions are executed.
8. The result is persisted and visible in the activity timeline.

This is the central demonstration:

unstructured enquiry → LLM → structured output → validation → tool/function request → human approval → application action → database/external API → visible result

## 5. Minimal information architecture

The app should be intentionally small.

Primary surfaces:

- Dashboard / enquiries list
- Enquiry detail with AI analysis and proposed actions
- Activity/history

Optional intake can be a small modal or panel on the dashboard rather than a separate major section.

There should not be a separate leads CRM, project management workspace, or large multi-page sales system in V1.

## 6. Screen descriptions

### Dashboard / enquiries list

Purpose: review incoming enquiries and their current state.

Displays:

- enquiry title or company name
- source
- timestamp
- status
- priority
- project type
- quick summary

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

Purpose: make the AI workflow observable.

Displays:

- enquiry created
- AI analysis started/completed
- validation succeeded/failed
- action proposed
- approval decision
- external action executed
- error states

## 7. Visual direction

The UI should feel like polished B2B SaaS software, not a chatbot.

Design principles:

- professional business styling
- clear hierarchy and readable data density
- tabs, cards, side panels, and compact review states
- distinction between raw enquiry, AI output, and user-approved action
- subtle loading and error states
- little or no decorative AI branding

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

## 9. AI analysis schema

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

The app should support only a few narrow function definitions. The model proposes them; the application validates and executes only approved ones.

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

## 12. One external integration

The V1 should include exactly one real external integration: email.

Preferred provider: Resend.

Use case: send a brief follow-up email after human approval.

This demonstrates the real business flow without building a broader automation platform.

## 13. Simple technical architecture

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

This is a separate design and validation stage.

Purpose: validate the product story and UX before implementing the AI/backend stack.

Scope:

- static or mock data only
- no real LLM call
- no real Supabase or database
- no real email integration
- polished dashboard and detail views
- realistic approval and history states

This stage proves the product is valuable and credible before creating backend complexity.

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

The final V1 should actually prove the end-to-end chain:

unstructured enquiry → LLM → structured output → validation → tool/function request → human approval → application action → database/external API → visible result

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

### Stage 1: UX prototype

Goal: validate the interface and product story.

Deliverables:

- dashboard and enquiry list
- detail view for enquiry and AI analysis
- mock data and approval states

### Stage 2: real AI analysis and validation

Goal: implement a real LLM call and schema validation.

Deliverables:

- server-side API route
- OpenAI call
- Zod schema validation
- structured analysis saved to database

### Stage 3: action approval and execution

Goal: prove the model-to-application boundary.

Deliverables:

- tool proposal flow
- approval UI
- validated action execution path
- small email integration

### Stage 4: final polish

Goal: ensure the product is credible and stable.

Deliverables:

- error handling
- loading states
- duplicate protection
- activity timeline
- final UI tuning

## 21. Acceptance criteria

### UI prototype acceptance criteria

- polished SaaS feel
- clear end-to-end enquiry-to-analysis story
- realistic mock data
- obvious approval states

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

The project is done when the portfolio version demonstrates a small but credible AI workflow that can be understood and trusted by a hiring manager or client.

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
