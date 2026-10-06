"use client";

import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mockEnquiries, type EnquiryWorkflowStatus } from "@/lib/mock-workspace";

type QueueFilter = "all" | "attention" | EnquiryWorkflowStatus;

const filterLabels: Record<QueueFilter, string> = {
  all: "All enquiries",
  attention: "Needs attention",
  awaiting_review: "Needs review",
  needs_information: "Needs information",
  responded: "Responded",
  analysis_failed: "Analysis failed",
};

const statusLabels: Record<EnquiryWorkflowStatus, string> = {
  awaiting_review: "Awaiting review",
  needs_information: "Needs information",
  responded: "Responded",
  analysis_failed: "Analysis failed",
};

function formatReceivedAt(value: string) {
  return value.replace(/^today at /i, "Today, ").replace(/^yesterday at /i, "Yesterday, ");
}

// Shows either the attention-focused overview or the full mock enquiry queue.
// The view prop chooses the initial filter; search and filter changes stay in component state.
export function EnquiryDashboard({ view = "enquiries" }: { view?: "overview" | "enquiries" }) {
  const [filter, setFilter] = useState<QueueFilter>(view === "overview" ? "attention" : "all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  // Filter fixture data locally; attention means every workflow status except responded.
  const visibleEnquiries = mockEnquiries.filter((enquiry) => {
    const matchesFilter = filter === "all"
      || (filter === "attention" ? enquiry.workflowStatus !== "responded" : enquiry.workflowStatus === filter);
    const searchableText = `${enquiry.companyName} ${enquiry.contactName} ${enquiry.projectType} ${enquiry.summary} ${enquiry.id}`.toLowerCase();
    return matchesFilter && searchableText.includes(normalizedQuery);
  });

  return (
    <>
      {/* Queue title and counts reflect the selected view and filtered fixture data. */}
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">NORTHLINE STUDIO <span>/</span> WORKSPACE</div>
          <h1>{view === "overview" ? "Overview" : "Enquiries"}</h1>
          <p className="page-subtitle">{view === "overview" ? "Review enquiries that need a next step." : "Review incoming requests and their follow-ups."}</p>
        </div>
        <div className="queue-summary"><span className="footnote-dot" />{view === "overview" ? `${mockEnquiries.filter((enquiry) => enquiry.workflowStatus !== "responded").length} need attention` : `${mockEnquiries.length} recent enquiries`}</div>
      </div>

      {/* Search and status selection update only the local queue view. */}
      <section className="enquiry-list-section" id="enquiry-list" aria-labelledby="enquiry-list-heading">
        <div className="queue-toolbar">
          <div>
            <h2 id="enquiry-list-heading">Incoming enquiries</h2>
            <p>{visibleEnquiries.length} {visibleEnquiries.length === 1 ? "enquiry" : "enquiries"} shown</p>
          </div>
          <div className="queue-controls">
            <label className="queue-search">
              <Search size={16} />
              <span className="sr-only">Search enquiries</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search enquiries" />
            </label>
            <label className="queue-filter-label">
              <span className="sr-only">Filter by status</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)}>
                {(Object.keys(filterLabels) as QueueFilter[]).map((status) => <option value={status} key={status}>{filterLabels[status]}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Each queue row links to the corresponding fixture-backed detail route. */}
        <div className="enquiry-list">
          {visibleEnquiries.map((enquiry) => (
            <Link className="enquiry-row" href={`/enquiries/${enquiry.id}`} key={enquiry.id}>
              <span className="enquiry-identity">
                <span className="enquiry-company">{enquiry.companyName}</span>
                <span className="enquiry-contact">{enquiry.contactName} <span>·</span> {enquiry.source}</span>
                <span className="enquiry-received">{formatReceivedAt(enquiry.receivedAt)}</span>
              </span>
              <span className="enquiry-project">
                <span className="enquiry-project-type">{enquiry.projectType}</span>
                <span className="enquiry-summary">{enquiry.summary}</span>
              </span>
              <span className="enquiry-state">
                <span className={`queue-status queue-status-${enquiry.workflowStatus}`}><span className="status-dot" />{statusLabels[enquiry.workflowStatus]}</span>
                <span className={`priority-chip priority-chip-${enquiry.priority.toLowerCase()}`}>{enquiry.priority} priority</span>
              </span>
              <span className="enquiry-score">
                <strong>{enquiry.analysisStatus === "failed" ? "—" : enquiry.leadScore}</strong>
                <span>{enquiry.analysisStatus === "failed" ? "No score" : "Lead score"}</span>
              </span>
              <span className="enquiry-open" aria-hidden="true"><ArrowUpRight size={16} /></span>
            </Link>
          ))}
          {visibleEnquiries.length === 0 && (
            <div className="queue-empty"><strong>No enquiries match this view.</strong><span>Try another status or search term.</span></div>
          )}
        </div>
      </section>

      <footer className="page-footnote"><span><span className="footnote-dot" />Mock workspace data</span><span>All actions are local to this prototype</span></footer>
    </>
  );
}