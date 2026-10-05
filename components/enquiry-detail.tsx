"use client";

import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  ChevronRight,
  FileText,
  Inbox,
  Mail,
  MoreHorizontal,
  Pencil,
  BriefcaseBusiness,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ActivityEvent } from "@/lib/mock-enquiry";
import type { WorkspaceEnquiry } from "@/lib/mock-workspace";

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

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function EnquiryDetail({ enquiry }: { enquiry: WorkspaceEnquiry }) {
  const [actionState, setActionState] = useState<ActionState>(enquiry.actionStatus ?? "awaiting");
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(enquiry.proposedAction.body);
  const [events, setEvents] = useState(enquiry.activity);
  const [retryRequested, setRetryRequested] = useState(false);
  const analysisFailed = enquiry.analysisStatus === "failed";

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
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ENQUIRY DETAIL <span>/</span> {enquiry.id}</div>
          <h1>{enquiry.companyName}</h1>
          <p className="page-subtitle">Review the enquiry, analysis and suggested follow-up.</p>
        </div>
        <div className="heading-status">
          <span className={`status-badge ${analysisFailed ? "status-failed" : `status-${actionState}`}`}><span className="status-dot" />
            {analysisFailed ? "Analysis failed" : actionState === "awaiting" ? "Awaiting review" : actionState === "approved" ? "Approved" : "Cancelled"}
          </span>
          <button className="icon-button more-button" type="button" aria-label="More enquiry options"><MoreHorizontal size={20} /></button>
        </div>
      </div>

      <div className="content-grid">
        <div className="primary-column">
          <section className="panel contact-panel" aria-labelledby="contact-heading">
            <div className="contact-identity">
              <div className="company-avatar">{initials(enquiry.companyName)}</div>
              <div className="contact-name-block">
                <h2 id="contact-heading">{enquiry.companyName}</h2>
                <p>{enquiry.contactName} <span>|</span> <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></p>
              </div>
            </div>
            <div className="contact-meta"><span className="source-label"><Inbox size={14} /> {enquiry.source}</span><span className="meta-separator" /><span>Received {enquiry.receivedAt}</span></div>
          </section>

          <section className="panel analysis-panel" aria-labelledby="analysis-heading">
            <div className="section-heading analysis-heading">
              <div className="section-title-wrap">
                <span className="analysis-icon"><Sparkles size={16} /></span>
                <div>
                  <div className="section-kicker">AI ANALYSIS {analysisFailed
                    ? <span className="analysis-state-failed">Needs retry</span>
                    : <span className="validated-label"><BadgeCheck size={13} /> Validated</span>}
                  </div>
                  <h2 id="analysis-heading">{enquiry.id === "ENQ-2048" ? "A qualified project with clear intent" : enquiry.summary}</h2>
                </div>
              </div>
              <button className="quiet-button" type="button" aria-label="Analysis details"><MoreHorizontal size={18} /></button>
            </div>

            {analysisFailed ? (
              <div className="recommendation analysis-failure">
                <span className="recommendation-icon"><X size={16} /></span>
                <div>
                  <span className="section-kicker">ANALYSIS NEEDS ATTENTION</span>
                  <p>{retryRequested ? "A mock retry has been queued for review." : "The structured response could not be validated. No follow-up action has been prepared."}</p>
                  <button className="button button-secondary retry-button" type="button" onClick={() => setRetryRequested(true)} disabled={retryRequested}>
                    {retryRequested ? "Retry requested" : "Retry analysis"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="score-strip">
                  <div className="score-block"><span className="score-value">{enquiry.leadScore}</span><span className="score-out-of">/ 100</span><span className="score-caption">Lead score</span></div>
                  <span className="score-divider" />
                  <div className="priority-block"><span className="priority-label">PRIORITY</span><span className="priority-value"><span className="priority-indicator" />{enquiry.priority}</span></div>
                  <p className="score-context">{enquiry.summary}</p>
                </div>

                <div className="info-grid">
                  <InfoTile label="Project type" value={enquiry.projectType} icon={<BriefcaseBusiness size={15} />} />
                  <InfoTile label="Approx. budget" value={enquiry.budget} icon={<span className="currency-icon">$</span>} />
                  <InfoTile label="Desired timeline" value={enquiry.timeline} icon={<Clock3 size={15} />} />
                </div>

                <div className="analysis-section">
                  <div className="subsection-heading"><h3>Extracted requirements</h3><span className="count-label">{enquiry.requirements.length} identified</span></div>
                  <div className="requirements-list">
                    {enquiry.requirements.map((requirement) => (
                      <div className="requirement-row" key={requirement.label}>
                        <span className="requirement-check"><Check size={13} /></span><span className="requirement-label">{requirement.label}</span><span className="requirement-value">{requirement.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="missing-section">
                  <div className="subsection-heading"><h3>Still to clarify</h3><span className="count-label">{enquiry.missingInformation.length} questions</span></div>
                  <div className="missing-list">
                    {enquiry.missingInformation.map((item, index) => (
                      <div className="missing-row" key={item.field}><span className="missing-index">0{index + 1}</span><span>{item.question}</span><span className={`missing-priority priority-${item.priority}`}>{item.priority}</span></div>
                    ))}
                  </div>
                </div>

                <div className="recommendation">
                  <span className="recommendation-icon"><ArrowUpRight size={16} /></span>
                  <div><span className="section-kicker">RECOMMENDED NEXT STEP</span><p>{enquiry.recommendedNextAction}</p></div>
                </div>
              </>
            )}
          </section>

          {!analysisFailed && <section className="panel action-panel" aria-labelledby="action-heading">
            <div className="section-heading action-heading">
              <div className="section-title-wrap">
                <span className="action-icon"><Send size={15} /></span>
                <div><div className="section-kicker">PROPOSED ACTION</div><h2 id="action-heading">Draft a follow-up email</h2></div>
              </div>
              <span className={`proposal-state${actionState !== "awaiting" ? ` proposal-${actionState}` : ""}`}>{actionState === "awaiting" ? "Needs approval" : actionState === "approved" ? "Approved" : "Cancelled"}</span>
            </div>
            <div className="action-recipient"><span>TO</span><strong>{enquiry.contactName}</strong><span className="recipient-email">&lt;{enquiry.email}&gt;</span></div>
            <div className="action-subject"><span>SUBJECT</span>{enquiry.proposedAction.subject}</div>
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
                  <span>{actionState === "approved"
                    ? enquiry.actionOutcome === "email_sent" ? "Approved follow-up sent in this mock history." : "Approved for draft creation. This prototype sends nothing."
                    : "This proposed action was cancelled."}</span>
                </div>
              )}
            </div>
          </section>}
        </div>

        <aside className="secondary-column">
          <section className="panel original-panel" aria-labelledby="original-heading">
            <div className="section-heading compact-heading">
              <div className="section-title-wrap"><span className="document-icon"><FileText size={16} /></span><div><div className="section-kicker">SOURCE MATERIAL</div><h2 id="original-heading">Original enquiry</h2></div></div>
              <button className="quiet-button" type="button" aria-label="More message options"><MoreHorizontal size={18} /></button>
            </div>
            <div className="message-meta"><span className="message-sender-avatar">{initials(enquiry.contactName)}</span><span className="message-sender"><strong>{enquiry.contactName}</strong><small>{enquiry.email}</small></span><time>{enquiry.receivedAt.replace(/^.* at /, "")}</time></div>
            <blockquote className="original-message">&quot;{enquiry.originalText}&quot;</blockquote>
            <span className="message-source"><Mail size={14} /> {enquiry.source}</span>
          </section>

          <section className="panel activity-panel" aria-labelledby="activity-heading">
            <div className="section-heading compact-heading">
              <div className="section-title-wrap"><span className="activity-icon"><Activity size={16} /></span><div><div className="section-kicker">PROCESS HISTORY</div><h2 id="activity-heading">Activity</h2></div></div>
              <button className="quiet-button" type="button" aria-label="Activity options"><MoreHorizontal size={18} /></button>
            </div>
            <ol className="timeline-list">{events.map((event, index) => <TimelineItem key={event.id} event={event} isLast={index === events.length - 1} />)}</ol>
            <Link className="activity-link" href="/activity"><span>View full history</span><ChevronRight size={14} /></Link>
          </section>
          <div className="analysis-footnote"><ShieldCheck size={15} /> {analysisFailed ? "Review the analysis before taking action" : "AI output validated before review"}</div>
        </aside>
      </div>
      <footer className="page-footnote"><span><span className="footnote-dot" />Mock enquiry</span><span>Analysis generated {enquiry.receivedAt}</span></footer>
    </>
  );
}