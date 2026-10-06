import { mockEnquiry, type MockEnquiry } from "@/lib/mock-enquiry";

export type EnquiryWorkflowStatus =
  | "awaiting_review"
  | "needs_information"
  | "responded"
  | "analysis_failed";

export type EnquiryAnalysisStatus = "validated" | "failed";
export type EnquiryActionStatus = "awaiting" | "approved" | "cancelled";
export type EnquiryActionOutcome = "draft_created" | "email_sent" | "cancelled";

export interface WorkspaceEnquiry extends MockEnquiry {
  source: "Website form" | "Email";
  summary: string;
  workflowStatus: EnquiryWorkflowStatus;
  analysisStatus: EnquiryAnalysisStatus;
  actionStatus?: EnquiryActionStatus;
  actionOutcome?: EnquiryActionOutcome;
  receivedAtIso: string;
}

export type WorkspaceActivityType =
  | "received"
  | "analysis_started"
  | "validated"
  | "analysis_failed"
  | "action_proposed"
  | "approved"
  | "edited"
  | "cancelled"
  | "email_sent";

export interface WorkspaceActivityEvent {
  id: string;
  enquiryId: string;
  type: WorkspaceActivityType;
  title: string;
  detail: string;
  occurredAt: string;
}

// These fixtures demonstrate queue states; they are not persisted workflow records.
export const mockEnquiries: WorkspaceEnquiry[] = [
  {
    ...mockEnquiry,
    source: "Website form",
    summary: "Shopify configurator for 20 furniture products, with a Christmas launch target.",
    workflowStatus: "awaiting_review",
    analysisStatus: "validated",
    receivedAtIso: "2026-10-05T09:42:00",
  },
  {
    ...mockEnquiry,
    id: "ENQ-2047",
    companyName: "Fieldwork Outdoor",
    contactName: "Ravi Patel",
    email: "ravi@fieldworkoutdoor.com",
    receivedAt: "today at 8:16 AM",
    projectType: "E-commerce website refresh",
    budget: "Not provided",
    timeline: "Spring 2027",
    leadScore: 62,
    priority: "Medium",
    originalText: "Hello, we're looking to refresh our outdoor living website before our spring campaign. We sell through Shopify and have a few ideas for improving product discovery. Could you share how you usually approach a project like this?",
    requirements: [
      { label: "Store platform", value: "Shopify" },
      { label: "Project goal", value: "Website refresh" },
      { label: "Target campaign", value: "Spring 2027" },
      { label: "Product discovery", value: "Needs improvement" },
    ],
    missingInformation: [
      { field: "budget", question: "What budget range have you set aside?", priority: "high" },
      { field: "scope", question: "Which parts of the current experience need the most attention?", priority: "medium" },
    ],
    recommendedNextAction: "Clarify the expected project range and highest-priority pages before suggesting a scope.",
    proposedAction: {
      type: "draft_reply",
      subject: "A couple of questions about your website refresh",
      body: "Hi Ravi,\n\nThanks for getting in touch. Improving product discovery ahead of your spring campaign sounds like a useful place to start.\n\nCould you share the budget range you have in mind and the parts of the current site you most want to improve? That will help us suggest a realistic first scope.\n\nBest,\nJordan\nNorthline Studio",
    },
    activity: [
      { id: "received", title: "Enquiry received", detail: "Submitted via website form", time: "8:16 AM", status: "complete" },
      { id: "analysis-started", title: "AI analysis started", detail: "Enquiry queued for structured review", time: "8:17 AM", status: "complete" },
      { id: "validated", title: "Schema validated", detail: "Requirements and missing information identified", time: "8:18 AM", status: "complete" },
      { id: "awaiting-approval", title: "Awaiting review", detail: "Follow-up draft is ready for your review", time: "Now", status: "current" },
    ],
    source: "Website form",
    summary: "Website refresh requested for spring; budget and page priorities need clarification.",
    workflowStatus: "needs_information",
    analysisStatus: "validated",
    receivedAtIso: "2026-10-05T08:16:00",
  },
  {
    ...mockEnquiry,
    id: "ENQ-2046",
    companyName: "Little Harbor Goods",
    contactName: "Elena Brooks",
    email: "elena@littleharborgoods.com",
    receivedAt: "yesterday at 4:28 PM",
    projectType: "Shopify theme adjustments",
    budget: "$2,000-$4,000",
    timeline: "No fixed date",
    leadScore: 34,
    priority: "Low",
    originalText: "Hi there, I run a small gift shop on Shopify and was wondering if someone could tidy up a few bits on our theme. Mostly spacing, maybe some colour changes. We don't have a big budget, just hoping to get a rough idea.",
    requirements: [
      { label: "Store platform", value: "Shopify" },
      { label: "Project goal", value: "Theme adjustments" },
      { label: "Changes mentioned", value: "Spacing and colour" },
      { label: "Budget", value: "Under $4,000" },
    ],
    missingInformation: [
      { field: "pages", question: "Which pages or templates need updates?", priority: "medium" },
    ],
    recommendedNextAction: "Confirm the affected pages and check whether the requested changes fit a focused support engagement.",
    proposedAction: {
      type: "draft_reply",
      subject: "A quick follow-up about your Shopify updates",
      body: "Hi Elena,\n\nThanks for reaching out. We may be able to help with a focused set of Shopify theme updates.\n\nCould you let us know which pages need attention and share a few examples of the spacing or colour changes you have in mind? We can then confirm whether a small support engagement is a fit.\n\nBest,\nJordan\nNorthline Studio",
    },
    activity: [
      { id: "received", title: "Enquiry received", detail: "Submitted via email", time: "Yesterday, 4:28 PM", status: "complete" },
      { id: "analysis-started", title: "AI analysis started", detail: "Enquiry queued for structured review", time: "Yesterday, 4:29 PM", status: "complete" },
      { id: "validated", title: "Schema validated", detail: "A smaller project scope was identified", time: "Yesterday, 4:30 PM", status: "complete" },
      { id: "cancelled", title: "Action cancelled", detail: "No follow-up action was taken", time: "Yesterday, 4:44 PM", status: "current" },
    ],
    source: "Email",
    summary: "Small Shopify theme tidy-up with a modest budget and no fixed deadline.",
    workflowStatus: "needs_information",
    analysisStatus: "validated",
    actionStatus: "cancelled",
    actionOutcome: "cancelled",
    receivedAtIso: "2026-10-04T16:28:00",
  },
  {
    ...mockEnquiry,
    id: "ENQ-2045",
    companyName: "Meridian Lighting Co.",
    contactName: "Sophie Laurent",
    email: "sophie@meridianlighting.co",
    receivedAt: "yesterday at 2:05 PM",
    projectType: "3D product visualisation",
    budget: "$30,000-$45,000",
    timeline: "Q1 2027",
    leadScore: 91,
    priority: "High",
    originalText: "We're planning to launch a new range of architectural lights in Q1. We need accurate 3D visuals and a product selector for our trade customers. There are 14 product families and we have CAD files ready. Our budget is between $30k and $45k.",
    requirements: [
      { label: "Product families", value: "14 lighting ranges" },
      { label: "Source assets", value: "CAD files available" },
      { label: "Primary need", value: "3D visuals and selector" },
      { label: "Audience", value: "Trade customers" },
    ],
    missingInformation: [
      { field: "selector", question: "Which product attributes should the selector compare?", priority: "medium" },
    ],
    recommendedNextAction: "Arrange a discovery call to review the CAD assets and define the selector requirements.",
    proposedAction: {
      type: "draft_reply",
      subject: "Planning your lighting range launch",
      body: "Hi Sophie,\n\nThanks for sharing the detail on your Q1 launch. Having CAD files ready and a defined product range gives us a strong starting point.\n\nIt would be useful to review the assets and understand which attributes trade customers need to compare. Would you be available for a short discovery call this week?\n\nBest,\nJordan\nNorthline Studio",
    },
    activity: [
      { id: "received", title: "Enquiry received", detail: "Received by email", time: "Yesterday, 2:05 PM", status: "complete" },
      { id: "analysis-started", title: "AI analysis started", detail: "Enquiry queued for structured review", time: "Yesterday, 2:06 PM", status: "complete" },
      { id: "validated", title: "Schema validated", detail: "Project requirements passed review", time: "Yesterday, 2:07 PM", status: "complete" },
      { id: "approved", title: "Action approved", detail: "Discovery-call follow-up approved by Jordan Lee", time: "Yesterday, 2:14 PM", status: "complete" },
      { id: "email-sent", title: "Email sent", detail: "Follow-up delivered to Sophie Laurent", time: "Yesterday, 2:16 PM", status: "current" },
    ],
    source: "Email",
    summary: "Qualified 3D visualisation and selector project; CAD assets are ready for review.",
    workflowStatus: "responded",
    analysisStatus: "validated",
    actionStatus: "approved",
    actionOutcome: "email_sent",
    receivedAtIso: "2026-10-04T14:05:00",
  },
  {
    ...mockEnquiry,
    id: "ENQ-2044",
    companyName: "Cedar & Coast Studio",
    contactName: "Noah Kim",
    email: "noah@cedarcoast.studio",
    receivedAt: "yesterday at 11:37 AM",
    projectType: "Interactive product catalogue",
    budget: "Not provided",
    timeline: "Unclear",
    leadScore: 0,
    priority: "Medium",
    originalText: "Hi, we would like to make our product catalogue more interactive. We have a lot of products and are not sure what information you need from us. Can someone get back to me?",
    requirements: [
      { label: "Project goal", value: "Interactive catalogue" },
      { label: "Product count", value: "Not specified" },
      { label: "Desired outcome", value: "More engaging browsing" },
      { label: "Source", value: "Website enquiry" },
    ],
    missingInformation: [
      { field: "platform", question: "Which platform currently hosts the catalogue?", priority: "high" },
      { field: "scope", question: "How many products should be included?", priority: "high" },
      { field: "budget", question: "What budget range should we plan around?", priority: "medium" },
    ],
    recommendedNextAction: "Retry the analysis before preparing a response; the first attempt did not return usable structured data.",
    proposedAction: {
      type: "draft_reply",
      subject: "A few details about your product catalogue",
      body: "Hi Noah,\n\nThanks for reaching out. We can help work out what an interactive catalogue could look like.\n\nCould you share which platform you use and roughly how many products are in the catalogue? A budget range would also help us point you in the right direction.\n\nBest,\nJordan\nNorthline Studio",
    },
    activity: [
      { id: "received", title: "Enquiry received", detail: "Submitted via website form", time: "Yesterday, 11:37 AM", status: "complete" },
      { id: "analysis-started", title: "AI analysis started", detail: "Enquiry queued for structured review", time: "Yesterday, 11:38 AM", status: "complete" },
      { id: "failed", title: "Analysis needs attention", detail: "The structured response could not be validated", time: "Yesterday, 11:39 AM", status: "current" },
    ],
    source: "Website form",
    summary: "Analysis could not be validated; project platform, scope, and budget are still unknown.",
    workflowStatus: "analysis_failed",
    analysisStatus: "failed",
    receivedAtIso: "2026-10-04T11:37:00",
  },
];

// The history feed is separately seeded and does not update with detail-page local actions.
export const mockWorkspaceActivity: WorkspaceActivityEvent[] = [
  { id: "2048-received", enquiryId: "ENQ-2048", type: "received", title: "Enquiry received", detail: "Alder & Ash Furnishings sent a website enquiry.", occurredAt: "2026-10-05T09:42:00" },
  { id: "2048-analysis", enquiryId: "ENQ-2048", type: "analysis_started", title: "Analysis started", detail: "The enquiry was prepared for structured review.", occurredAt: "2026-10-05T09:43:00" },
  { id: "2048-validated", enquiryId: "ENQ-2048", type: "validated", title: "Analysis validated", detail: "Requirements and follow-up questions passed validation.", occurredAt: "2026-10-05T09:44:00" },
  { id: "2048-proposed", enquiryId: "ENQ-2048", type: "action_proposed", title: "Follow-up proposed", detail: "A draft reply is ready for Jordan Lee to review.", occurredAt: "2026-10-05T09:44:30" },
  { id: "2047-received", enquiryId: "ENQ-2047", type: "received", title: "Enquiry received", detail: "Fieldwork Outdoor sent a website enquiry.", occurredAt: "2026-10-05T08:16:00" },
  { id: "2047-validated", enquiryId: "ENQ-2047", type: "validated", title: "Analysis validated", detail: "Budget and project scope were flagged for clarification.", occurredAt: "2026-10-05T08:18:00" },
  { id: "2045-received", enquiryId: "ENQ-2045", type: "received", title: "Enquiry received", detail: "Meridian Lighting Co. sent an email enquiry.", occurredAt: "2026-10-04T14:05:00" },
  { id: "2045-validated", enquiryId: "ENQ-2045", type: "validated", title: "Analysis validated", detail: "The project requirements and CAD availability were identified.", occurredAt: "2026-10-04T14:07:00" },
  { id: "2045-proposed", enquiryId: "ENQ-2045", type: "action_proposed", title: "Follow-up proposed", detail: "A discovery-call invitation was prepared.", occurredAt: "2026-10-04T14:09:00" },
  { id: "2045-approved", enquiryId: "ENQ-2045", type: "approved", title: "Action approved", detail: "Jordan Lee approved the follow-up email.", occurredAt: "2026-10-04T14:14:00" },
  { id: "2045-sent", enquiryId: "ENQ-2045", type: "email_sent", title: "Email sent", detail: "The approved follow-up was sent to Sophie Laurent.", occurredAt: "2026-10-04T14:16:00" },
  { id: "2046-received", enquiryId: "ENQ-2046", type: "received", title: "Enquiry received", detail: "Little Harbor Goods sent an email enquiry.", occurredAt: "2026-10-04T16:28:00" },
  { id: "2046-edited", enquiryId: "ENQ-2046", type: "edited", title: "Action edited", detail: "Jordan Lee refined the proposed response before saving it.", occurredAt: "2026-10-04T16:41:00" },
  { id: "2046-cancelled", enquiryId: "ENQ-2046", type: "cancelled", title: "Action cancelled", detail: "The proposed follow-up was cancelled; no email was sent.", occurredAt: "2026-10-04T16:44:00" },
  { id: "2044-received", enquiryId: "ENQ-2044", type: "received", title: "Enquiry received", detail: "Cedar & Coast Studio sent a website enquiry.", occurredAt: "2026-10-04T11:37:00" },
  { id: "2044-failed", enquiryId: "ENQ-2044", type: "analysis_failed", title: "Analysis needs attention", detail: "The structured response could not be validated and needs retry.", occurredAt: "2026-10-04T11:39:00" },
];