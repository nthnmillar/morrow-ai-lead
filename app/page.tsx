"use client";

import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Inbox,
  Layers3,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { mockEnquiry, type ActivityEvent } from "@/lib/mock-enquiry";

type ActionState = "awaiting" | "approved" | "cancelled";

function InfoTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="info-tile">
      <div className="info-label"><span className="tile-icon">{icon}</span>{label}</div>
      <p>{value}</p>
    </div>
  );
}

function TimelineItem({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const isCurrent = event.status === "current";

  return (
    <li className={`timeline-item${isLast ? " is-last" : ""}`}>
      <span className={`timeline-marker${isCurrent ? " is-current" : ""}`}>
        {isCurrent ? <Clock3 size={12} /> : <Check size={12} strokeWidth={2.5} />}
      </span>
      <div className="timeline-copy">
        <div className="timeline-heading"><span>{event.title}</span><time>{event.time}</time></div>
        <p>{event.detail}</p>
      </div>
    </li>
  );
}

export default function Home() {
  const [actionState, setActionState] = useState<ActionState>("awaiting");
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(mockEnquiry.proposedAction.body);
  const [events, setEvents] = useState(mockEnquiry.activity);

  function updateAction(nextState: Exclude<ActionState, "awaiting">) {
    setActionState(nextState);
    setIsEditing(false);
    setEvents((current) => [
      ...current.map((event) => event.id === "awaiting-approval"
        ? { ...event, status: "complete" as const, detail: "Review completed by you" }
        : event),
      {
        id: `action-${nextState}`,
        title: nextState === "approved" ? "Action approved" : "Action cancelled",
        detail: nextState === "approved"
          ? "Approved for draft creation. No email was sent."
          : "The proposed follow-up was cancelled.",
        time: "Just now",
        status: "current",
      },
    ]);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#main-content" aria-label="Morrow workspace home">
          <span className="brand-mark"><Layers3 size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">morrow<span>.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northline Studio</strong><small>Workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Workspace">
          <div className="nav-item"><BriefcaseBusiness size={17} /><span>Overview</span></div>
          <div className="nav-item is-active" aria-current="page"><Inbox size={17} /><span>Enquiries</span><span className="nav-count">12</span></div>
          <div className="nav-item"><Activity size={17} /><span>Activity</span></div>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><CircleHelp size={17} /><span>Help centre</span><ArrowUpRight size={14} /></div>
          <div className="user-profile">
            <span className="user-avatar">JL</span>
            <span className="user-copy"><strong>Jordan Lee</strong><small>Studio admin</small></span>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>Enquiries</span><ChevronRight size={14} /><strong>{mockEnquiry.id}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button search-button" type="button" aria-label="Search"><Search size={18} /></button>
            <button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <span className="topbar-divider" /><span className="topbar-avatar">JL</span>
          </div>
        </header>

        <main className="page-content" id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">ENQUIRY DETAIL <span>/</span> {mockEnquiry.id}</div>
              <h1>{mockEnquiry.companyName}</h1>
              <p className="page-subtitle">Review the enquiry, analysis and suggested follow-up.</p>
            </div>
            <div className="heading-status">
              <span className={`status-badge status-${actionState}`}><span className="status-dot" />
                {actionState === "awaiting" ? "Awaiting review" : actionState === "approved" ? "Approved" : "Cancelled"}
              </span>
              <button className="icon-button more-button" type="button" aria-label="More enquiry options"><MoreHorizontal size={20} /></button>
            </div>
          </div>

          <div className="content-grid">
            <div className="primary-column">
              <section className="panel contact-panel" aria-labelledby="contact-heading">
                <div className="contact-identity">
                  <div className="company-avatar">AA</div>
                  <div className="contact-name-block">
                    <h2 id="contact-heading">{mockEnquiry.companyName}</h2>
                    <p>{mockEnquiry.contactName} <span>|</span> <a href={`mailto:${mockEnquiry.email}`}>{mockEnquiry.email}</a></p>
                  </div>
                </div>
                <div className="contact-meta"><span className="source-label"><Inbox size={14} /> Website enquiry</span><span className="meta-separator" /><span>Received {mockEnquiry.receivedAt}</span></div>
              </section>

              <section className="panel analysis-panel" aria-labelledby="analysis-heading">
                <div className="section-heading analysis-heading">
                  <div className="section-title-wrap">
                    <span className="analysis-icon"><Sparkles size={16} /></span>
                    <div><div className="section-kicker">AI ANALYSIS <span className="validated-label"><BadgeCheck size={13} /> Validated</span></div><h2 id="analysis-heading">A qualified project with clear intent</h2></div>
                  </div>
                  <button className="quiet-button" type="button" aria-label="Analysis details"><MoreHorizontal size={18} /></button>
                </div>

                <div className="score-strip">
                  <div className="score-block"><span className="score-value">{mockEnquiry.leadScore}</span><span className="score-out-of">/ 100</span><span className="score-caption">Lead score</span></div>
                  <span className="score-divider" />
                  <div className="priority-block"><span className="priority-label">PRIORITY</span><span className="priority-value"><span className="priority-indicator" />{mockEnquiry.priority}</span></div>
                  <p className="score-context">Strong fit: defined platform, product count and seasonal launch window.</p>
                </div>

                <div className="info-grid">
                  <InfoTile label="Project type" value={mockEnquiry.projectType} icon={<BriefcaseBusiness size={15} />} />
                  <InfoTile label="Approx. budget" value={mockEnquiry.budget} icon={<span className="currency-icon">$</span>} />
                  <InfoTile label="Desired timeline" value={mockEnquiry.timeline} icon={<Clock3 size={15} />} />
                </div>

                <div className="analysis-section">
                  <div className="subsection-heading"><h3>Extracted requirements</h3><span className="count-label">{mockEnquiry.requirements.length} identified</span></div>
                  <div className="requirements-list">
                    {mockEnquiry.requirements.map((requirement) => (
                      <div className="requirement-row" key={requirement.label}>
                        <span className="requirement-check"><Check size={13} /></span><span className="requirement-label">{requirement.label}</span><span className="requirement-value">{requirement.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="missing-section">
                  <div className="subsection-heading"><h3>Still to clarify</h3><span className="count-label">{mockEnquiry.missingInformation.length} questions</span></div>
                  <div className="missing-list">
                    {mockEnquiry.missingInformation.map((item, index) => (
                      <div className="missing-row" key={item.field}><span className="missing-index">0{index + 1}</span><span>{item.question}</span><span className={`missing-priority priority-${item.priority}`}>{item.priority}</span></div>
                    ))}
                  </div>
                </div>

                <div className="recommendation">
                  <span className="recommendation-icon"><ArrowUpRight size={16} /></span>
                  <div><span className="section-kicker">RECOMMENDED NEXT STEP</span><p>{mockEnquiry.recommendedNextAction}</p></div>
                </div>
              </section>

              <section className="panel action-panel" aria-labelledby="action-heading">
                <div className="section-heading action-heading">
                  <div className="section-title-wrap">
                    <span className="action-icon"><Send size={15} /></span>
                    <div><div className="section-kicker">PROPOSED ACTION</div><h2 id="action-heading">Draft a follow-up email</h2></div>
                  </div>
                  <span className={`proposal-state${actionState !== "awaiting" ? ` proposal-${actionState}` : ""}`}>{actionState === "awaiting" ? "Needs approval" : actionState === "approved" ? "Approved" : "Cancelled"}</span>
                </div>
                <div className="action-recipient"><span>TO</span><strong>{mockEnquiry.contactName}</strong><span className="recipient-email">&lt;{mockEnquiry.email}&gt;</span></div>
                <div className="action-subject"><span>SUBJECT</span>{mockEnquiry.proposedAction.subject}</div>
                {isEditing ? (
                  <label className="draft-editor"><span className="sr-only">Edit proposed email</span><textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} rows={8} /></label>
                ) : (
                  <div className="draft-preview">{draftBody.split("\n").map((line, index) => <p key={`${index}-${line || "space"}`}>{line || " "}</p>)}</div>
                )}
                <div className="action-footer">
                  {actionState === "awaiting" ? (
                    <>
                      <div className="approval-buttons">
                        <button className="button button-primary" type="button" onClick={() => updateAction("approved")}><CheckCircle2 size={16} /> Approve</button>
                        <button className={`button button-secondary${isEditing ? " is-saving" : ""}`} type="button" onClick={() => setIsEditing((current) => !current)}><Pencil size={15} />{isEditing ? "Save edits" : "Edit"}</button>
                        <button className="button button-text" type="button" onClick={() => updateAction("cancelled")}><X size={15} /> Cancel</button>
                      </div>
                      <span className="approval-note"><ShieldCheck size={14} /> Nothing is sent without your approval.</span>
                    </>
                  ) : (
                    <div className={`action-result result-${actionState}`}>
                      {actionState === "approved" ? <CheckCircle2 size={16} /> : <X size={16} />}
                      <span>{actionState === "approved" ? "Approved for draft creation. This prototype sends nothing." : "This proposed action was cancelled."}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="secondary-column">
              <section className="panel original-panel" aria-labelledby="original-heading">
                <div className="section-heading compact-heading">
                  <div className="section-title-wrap"><span className="document-icon"><FileText size={16} /></span><div><div className="section-kicker">SOURCE MATERIAL</div><h2 id="original-heading">Original enquiry</h2></div></div>
                  <button className="quiet-button" type="button" aria-label="More message options"><MoreHorizontal size={18} /></button>
                </div>
                <div className="message-meta"><span className="message-sender-avatar">MC</span><span className="message-sender"><strong>{mockEnquiry.contactName}</strong><small>{mockEnquiry.email}</small></span><time>9:42 AM</time></div>
                <blockquote className="original-message">&quot;{mockEnquiry.originalText}&quot;</blockquote>
                <button className="message-source" type="button"><Mail size={14} /> Web form submission</button>
              </section>

              <section className="panel activity-panel" aria-labelledby="activity-heading">
                <div className="section-heading compact-heading">
                  <div className="section-title-wrap"><span className="activity-icon"><Activity size={16} /></span><div><div className="section-kicker">PROCESS HISTORY</div><h2 id="activity-heading">Activity</h2></div></div>
                  <button className="quiet-button" type="button" aria-label="Activity options"><MoreHorizontal size={18} /></button>
                </div>
                <ol className="timeline-list">{events.map((event, index) => <TimelineItem key={event.id} event={event} isLast={index === events.length - 1} />)}</ol>
                <button className="activity-link" type="button">View full history <ChevronRight size={14} /></button>
              </section>
              <div className="analysis-footnote"><ShieldCheck size={15} /> AI output validated before review</div>
            </aside>
          </div>
          <footer className="page-footnote"><span><span className="footnote-dot" />Mock enquiry</span><span>Analysis generated today at 9:44 AM</span></footer>
        </main>
      </div>
    </div>
  );
}
