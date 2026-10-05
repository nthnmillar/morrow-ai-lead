"use client";

import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  FilePlus2,
  MailCheck,
  Pencil,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mockEnquiries, mockWorkspaceActivity, type WorkspaceActivityType } from "@/lib/mock-workspace";

type ActivityFilter = "all" | "analysis" | "decisions" | "email";

const activityFilters: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "analysis", label: "Analysis" },
  { value: "decisions", label: "Review decisions" },
  { value: "email", label: "Email" },
];

const eventPresentation: Record<WorkspaceActivityType, { icon: typeof FilePlus2; className: string }> = {
  received: { icon: FilePlus2, className: "received" },
  analysis_started: { icon: Sparkles, className: "analysis" },
  validated: { icon: BadgeCheck, className: "validated" },
  analysis_failed: { icon: CircleAlert, className: "failed" },
  action_proposed: { icon: Send, className: "proposed" },
  approved: { icon: CheckCircle2, className: "approved" },
  edited: { icon: Pencil, className: "edited" },
  cancelled: { icon: XCircle, className: "cancelled" },
  email_sent: { icon: MailCheck, className: "sent" },
};

function matchesFilter(type: WorkspaceActivityType, filter: ActivityFilter) {
  if (filter === "all") return true;
  if (filter === "analysis") return ["analysis_started", "validated", "analysis_failed"].includes(type);
  if (filter === "decisions") return ["action_proposed", "approved", "edited", "cancelled"].includes(type);
  return type === "email_sent";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function ActivityHistory() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const sortedEvents = [...mockWorkspaceActivity]
    .filter((event) => matchesFilter(event.type, filter))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const enquiriesById = new Map(mockEnquiries.map((enquiry) => [enquiry.id, enquiry]));
  const groupedEvents = sortedEvents.reduce<Record<string, typeof sortedEvents>>((groups, event) => {
    const date = event.occurredAt.slice(0, 10);
    groups[date] ??= [];
    groups[date].push(event);
    return groups;
  }, {});

  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">NORTHLINE STUDIO <span>/</span> WORKSPACE</div>
          <h1>Activity</h1>
          <p className="page-subtitle">A clear history of enquiries, reviews and follow-ups.</p>
        </div>
        <div className="queue-summary"><span className="footnote-dot" />{mockWorkspaceActivity.length} recent events</div>
      </div>

      <section className="history-section" aria-labelledby="history-heading">
        <div className="history-toolbar">
          <div>
            <h2 id="history-heading">Workspace history</h2>
            <p>{sortedEvents.length} {sortedEvents.length === 1 ? "event" : "events"}</p>
          </div>
          <div className="activity-filters" role="group" aria-label="Filter activity">
            {activityFilters.map((item) => (
              <button className={filter === item.value ? "is-selected" : ""} type="button" key={item.value} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="history-feed">
          {Object.entries(groupedEvents).map(([date, events]) => (
            <section className="history-day" key={date} aria-label={formatDate(`${date}T12:00:00`)}>
              <h3 className="history-date">{formatDate(`${date}T12:00:00`)}</h3>
              <ol className="history-list">
                {events.map((event) => {
                  const presentation = eventPresentation[event.type];
                  const EventIcon = presentation.icon;
                  const enquiry = enquiriesById.get(event.enquiryId);

                  return (
                    <li className="history-event" key={event.id}>
                      <span className={`history-event-icon history-event-${presentation.className}`}><EventIcon size={15} /></span>
                      <div className="history-event-copy">
                        <div className="history-event-heading"><strong>{event.title}</strong><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></div>
                        <p>{event.detail}</p>
                        {enquiry && <Link className="history-enquiry-link" href={`/enquiries/${enquiry.id}`}>{enquiry.companyName}<span>·</span>{enquiry.id}</Link>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {sortedEvents.length === 0 && <div className="queue-empty"><strong>No matching activity yet.</strong><span>Choose another activity filter.</span></div>}
        </div>
      </section>

      <footer className="page-footnote"><span><span className="footnote-dot" />Mock workspace history</span><span>Activity is shown for demonstration</span></footer>
    </>
  );
}