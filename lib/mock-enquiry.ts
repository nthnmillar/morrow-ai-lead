import type { LeadAnalysis } from "@/lib/lead-analysis-schema";

// Reuse schema-inferred item types so seeded examples stay aligned with live analysis.
export type Requirement = LeadAnalysis["requirements"][number];

export type MissingInformation = LeadAnalysis["missingInformation"][number];

export interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: "complete" | "current";
}

export interface MockEnquiry {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  receivedAt: string;
  projectType: string;
  budget: string;
  timeline: string;
  leadScore: number;
  priority: "Low" | "Medium" | "High";
  originalText: string;
  requirements: Requirement[];
  missingInformation: MissingInformation[];
  recommendedNextAction: string;
  // Display-only proposal; approval is local and does not send this draft.
  proposedAction: {
    type: "draft_reply";
    subject: string;
    body: string;
  };
  activity: ActivityEvent[];
}

export const mockEnquiry: MockEnquiry = {
  id: "ENQ-2048",
  companyName: "Alder & Ash Furnishings",
  contactName: "Maya Chen",
  email: "maya@alderandash.com",
  receivedAt: "today at 9:42 AM",
  projectType: "Shopify product configurator",
  budget: "$18,000-$24,000",
  timeline: "Before Christmas 2026",
  leadScore: 86,
  priority: "High",
  originalText:
    "Hi, we're an independent furniture company using Shopify. We'd love a product configurator for around 20 of our best-selling pieces so customers can choose different materials and colours. Ideally, we'd launch before Christmas. We have around $20,000 set aside, but aren't sure what needs to be included to get started.",
  requirements: [
    { label: "Store platform", value: "Shopify" },
    { label: "Products in scope", value: "Around 20 pieces" },
    { label: "Configuration options", value: "Materials and colours" },
    { label: "Business type", value: "Furniture retail" },
  ],
  missingInformation: [
    { field: "3d-assets", question: "Are product CAD or 3D model files available?", priority: "high" },
    { field: "launch-scope", question: "Which products are essential for the first release?", priority: "medium" },
  ],
  recommendedNextAction:
    "Confirm product asset readiness and first-release scope before estimating the Shopify integration.",
  proposedAction: {
    type: "draft_reply",
    subject: "A few details for your product configurator",
    body: "Hi Maya,\n\nThanks for reaching out. A configurator for your Shopify store sounds like a strong fit, and the Christmas launch gives us a helpful planning target.\n\nTo shape a realistic first scope, could you let us know whether CAD or 3D files are available for the products, and which pieces are must-haves for the initial release?\n\nOnce we have those details, we can recommend a practical next step and timeline.\n\nBest,\nJordan\nNorthline Studio",
  },
  activity: [
    { id: "received", title: "Enquiry received", detail: "Submitted via website form", time: "9:42 AM", status: "complete" },
    { id: "analysis-started", title: "AI analysis started", detail: "Enquiry queued for structured review", time: "9:43 AM", status: "complete" },
    { id: "extracted", title: "Structured data extracted", detail: "Requirements and follow-up questions identified", time: "9:44 AM", status: "complete" },
    { id: "validated", title: "Schema validated", detail: "All required fields passed validation", time: "9:44 AM", status: "complete" },
    { id: "proposed", title: "Action proposed", detail: "Draft reply prepared for review", time: "9:44 AM", status: "complete" },
    { id: "awaiting-approval", title: "Awaiting human approval", detail: "Review the proposed draft below", time: "Now", status: "current" },
  ],
};