"use client";

import {
  ActionErrorSchema,
  ActionResponseSchema,
  UpdateActionRequestSchema,
  type ActionOperation,
  type PersistedAction,
} from "@/lib/action-schema";
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
  LoaderCircle,
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
import {
  AnalyzeEnquiryErrorSchema,
  AnalyzeEnquiryRequestSchema,
  type LeadAnalysis,
} from "@/lib/lead-analysis-schema";
import { AnalyzeEnquiryWorkflowResponseSchema } from "@/lib/analysis-workflow-schema";

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

function formatPriority(priority: LeadAnalysis["priority"]) {
  return `${priority[0].toUpperCase()}${priority.slice(1)}`;
}

function currencyMark(currency: string | null) {
  const marks: Record<string, string> = {
    USD: "$",
    CAD: "C$",
    AUD: "A$",
    NZD: "NZ$",
    GBP: "£",
    EUR: "€",
  };

  return currency ? marks[currency] ?? "¤" : "¤";
}

function formatBudgetRange(budget: LeadAnalysis["budgetRange"]) {
  if (budget.statedText) return budget.statedText;
  if (budget.min === null && budget.max === null) return "Not provided";

  const formatAmount = (amount: number) => `${currencyMark(budget.currency)}${amount.toLocaleString("en-US")}`;
  if (budget.min !== null && budget.max !== null) {
    return budget.min === budget.max ? formatAmount(budget.min) : `${formatAmount(budget.min)}–${formatAmount(budget.max)}`;
  }

  return budget.min !== null ? `From ${formatAmount(budget.min)}` : `Up to ${formatAmount(budget.max as number)}`;
}

// Presents one enquiry's source, restored analysis, proposed action, and local review history.
export function EnquiryDetail({
  enquiry,
  initialAnalysis = null,
  initialAction = null,
  persistenceError = null,
}: {
  enquiry: WorkspaceEnquiry;
  initialAnalysis?: LeadAnalysis | null;
  initialAction?: PersistedAction | null;
  persistenceError?: string | null;
}) {
  // Persisted Action state is the durable source; local text is only the current editor value.
  const [action, setAction] = useState<PersistedAction | null>(initialAction);
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(initialAction?.payload.body ?? enquiry.proposedAction.body);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [events, setEvents] = useState(enquiry.activity);
  // A restored server result initializes the view; later successful runs replace it in local state.
  const [liveAnalysis, setLiveAnalysis] = useState<LeadAnalysis | null>(initialAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Prefer validated saved/live fields individually, falling back to the fixture when a model value is null.
  const analysisFailed = enquiry.analysisStatus === "failed" && liveAnalysis === null;
  const companyName = liveAnalysis?.companyName ?? enquiry.companyName;
  const contactName = liveAnalysis?.contactName ?? enquiry.contactName;
  const contactEmail = liveAnalysis?.contactEmail ?? enquiry.email;
  const projectType = liveAnalysis ? liveAnalysis.projectType ?? "Not identified" : enquiry.projectType;
  const budget = liveAnalysis ? formatBudgetRange(liveAnalysis.budgetRange) : enquiry.budget;
  const timeline = liveAnalysis?.timeline.requestedLaunch ?? (liveAnalysis ? "Not provided" : enquiry.timeline);
  const leadScore = liveAnalysis?.leadScore ?? enquiry.leadScore;
  const priority = liveAnalysis ? formatPriority(liveAnalysis.priority) : enquiry.priority;
  const qualificationSummary = liveAnalysis?.qualificationSummary ?? enquiry.summary;
  const requirements = liveAnalysis?.requirements ?? enquiry.requirements;
  const missingInformation = liveAnalysis?.missingInformation ?? enquiry.missingInformation;
  const recommendedNextAction = liveAnalysis?.recommendedNextStep ?? enquiry.recommendedNextAction;
  const actionState = action?.status ?? "proposed";
  const actionBadgeState = actionState === "approved" || actionState === "cancelled" ? actionState : "awaiting";

  // Requests server-side analysis and persistence, then updates local state after the saved response validates.
  async function runAnalysis() {
    setAnalysisError(null);
    const request = AnalyzeEnquiryRequestSchema.safeParse({
      enquiryId: enquiry.id,
      originalText: enquiry.originalText,
    });

    if (!request.success) {
      setAnalysisError("This enquiry does not contain usable text to analyse.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Send the stable fixture ID with its source text; the server resolves trusted enquiry details.
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const failure = AnalyzeEnquiryErrorSchema.safeParse(payload);
        setAnalysisError(failure.success ? failure.data.error.message : "AI analysis could not be completed. Please try again.");
        return;
      }

      // Validate the endpoint response again before it enters render state.
      const result = AnalyzeEnquiryWorkflowResponseSchema.safeParse(payload);
      if (!result.success) {
        setAnalysisError("The analysis result could not be verified. Please try again.");
        return;
      }

      setLiveAnalysis(result.data.analysis);
      setAction(result.data.action);
      setDraftBody(result.data.action.payload.body);
      setIsEditing(false);
    } catch {
      setAnalysisError("AI analysis could not be completed. Check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function updateAction(operation: ActionOperation) {
    if (!action) return;
    setActionError(null);
    const request = UpdateActionRequestSchema.safeParse({
      enquiryId: enquiry.id,
      actionId: action.id,
      operation,
      payload: { ...action.payload, body: draftBody },
    });
    if (!request.success) {
      setActionError("The draft contains invalid or missing content.");
      return;
    }

    setIsSavingAction(true);
    try {
      const response = await fetch("/api/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const failure = ActionErrorSchema.safeParse(payload);
        setActionError(failure.success ? failure.data.error.message : "The Action could not be saved. Please try again.");
        return;
      }

      const result = ActionResponseSchema.safeParse(payload);
      if (!result.success) {
        setActionError("The saved Action could not be verified. Please refresh and try again.");
        return;
      }
      setAction(result.data.action);
      setDraftBody(result.data.action.payload.body);
      setIsEditing(false);

      if (operation !== "save_edit") {
        const decision = result.data.action.status;
        setEvents((current) => [
          ...current.map((event) => event.id === "awaiting-approval"
            ? { ...event, status: "complete" as const, detail: "Review completed by you" }
            : event),
          {
            id: `action-${decision}`,
            title: decision === "approved" ? "Action approved" : "Action cancelled",
            detail: decision === "approved"
              ? "Approval saved. No email was sent."
              : "The proposed follow-up was cancelled.",
            time: "Just now",
            status: "current",
          },
        ]);
      }
    } catch {
      setActionError("The Action could not be saved. Check your connection and try again.");
    } finally {
      setIsSavingAction(false);
    }
  }

  return (
    <>
      {/* Enquiry identity and current review status */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">ENQUIRY DETAIL <span>/</span> {enquiry.id}</div>
          <h1>{companyName}</h1>
          <p className="page-subtitle">Review the enquiry, analysis and suggested follow-up.</p>
        </div>
        <div className="heading-status">
          <span className={`status-badge ${analysisFailed ? "status-failed" : `status-${actionBadgeState}`}`}><span className="status-dot" />
            {analysisFailed ? "Analysis failed" : !action ? "No saved action" : actionState === "proposed" ? "Awaiting review" : actionState === "edited" ? "Edited · awaiting review" : actionState === "approved" ? "Approved" : "Cancelled"}
          </span>
          <button className="icon-button more-button" type="button" aria-label="More enquiry options"><MoreHorizontal size={20} /></button>
        </div>
      </div>

      <div className="content-grid">
        <div className="primary-column">
          {/* Contact identity uses the derived analysis-or-fixture values; source text stays separate below. */}
          <section className="panel contact-panel" aria-labelledby="contact-heading">
            <div className="contact-identity">
              <div className="company-avatar">{initials(companyName)}</div>
              <div className="contact-name-block">
                <h2 id="contact-heading">{companyName}</h2>
                <p>{contactName} <span>|</span> <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
              </div>
            </div>
            <div className="contact-meta"><span className="source-label"><Inbox size={14} /> {enquiry.source}</span><span className="meta-separator" /><span>Received {enquiry.receivedAt}</span></div>
          </section>

          {/* Persisted analysis takes precedence; fixtures remain visible until the first successful save. */}
          <section className="panel analysis-panel" aria-labelledby="analysis-heading">
            <div className="section-heading analysis-heading">
              <div className="section-title-wrap">
                <span className="analysis-icon"><Sparkles size={16} /></span>
                <div>
                  <div className="section-kicker">AI ANALYSIS {analysisFailed
                    ? <span className="analysis-state-failed">Needs retry</span>
                            : <span className="validated-label"><BadgeCheck size={13} />{liveAnalysis ? "Saved result" : "Validated"}</span>}
                  </div>
                  <h2 id="analysis-heading">{liveAnalysis?.qualificationSummary ?? (enquiry.id === "ENQ-2048" ? "A qualified project with clear intent" : enquiry.summary)}</h2>
                </div>
              </div>
              <button className="quiet-button" type="button" aria-label="Analysis details"><MoreHorizontal size={18} /></button>
            </div>

            <div className="analysis-action-row">
              <button className="button button-secondary analyze-button" type="button" onClick={() => void runAnalysis()} disabled={isAnalyzing}>
                {isAnalyzing ? <LoaderCircle className="analysis-spinner" size={15} /> : <Sparkles size={15} />}
                {isAnalyzing ? "Analysing..." : liveAnalysis ? "Analyse again" : "Analyse with AI"}
              </button>
              {persistenceError && <p className="analysis-request-error" role="alert">{persistenceError}</p>}
              {liveAnalysis && <span className="analysis-local-note">Saved · restored on the next visit</span>}
            </div>
            {analysisError && <p className="analysis-request-error" role="alert">{analysisError}</p>}

            {analysisFailed ? (
              <div className="recommendation analysis-failure">
                <span className="recommendation-icon"><X size={16} /></span>
                <div>
                  <span className="section-kicker">ANALYSIS NEEDS ATTENTION</span>
                  <p>The mock analysis did not produce a usable result. Run AI analysis above to try with the enquiry text.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="score-strip">
                  <div className="score-block"><span className="score-value">{leadScore}</span><span className="score-out-of">/ 100</span><span className="score-caption">Lead score</span></div>
                  <span className="score-divider" />
                  <div className="priority-block"><span className="priority-label">PRIORITY</span><span className="priority-value"><span className="priority-indicator" />{priority}</span></div>
                  <p className="score-context">{qualificationSummary}</p>
                </div>

                <div className="info-grid">
                  <InfoTile label="Project type" value={projectType} icon={<BriefcaseBusiness size={15} />} />
                  <InfoTile label="Approx. budget" value={budget} icon={<span className="currency-icon">{liveAnalysis ? currencyMark(liveAnalysis.budgetRange.currency) : "$"}</span>} />
                  <InfoTile label="Desired timeline" value={timeline} icon={<Clock3 size={15} />} />
                </div>

                <div className="analysis-section">
                  <div className="subsection-heading"><h3>Extracted requirements</h3><span className="count-label">{requirements.length} identified</span></div>
                  <div className="requirements-list">
                    {requirements.map((requirement) => (
                      <div className="requirement-row" key={requirement.label}>
                        <span className="requirement-check"><Check size={13} /></span><span className="requirement-label">{requirement.label}</span><span className="requirement-value">{requirement.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="missing-section">
                  <div className="subsection-heading"><h3>Still to clarify</h3><span className="count-label">{missingInformation.length} questions</span></div>
                  <div className="missing-list">
                    {missingInformation.map((item, index) => (
                      <div className="missing-row" key={item.field}><span className="missing-index">0{index + 1}</span><span>{item.question}</span><span className={`missing-priority priority-${item.priority}`}>{item.priority}</span></div>
                    ))}
                  </div>
                </div>

                <div className="recommendation">
                  <span className="recommendation-icon"><ArrowUpRight size={16} /></span>
                  <div><span className="section-kicker">RECOMMENDED NEXT STEP</span><p>{recommendedNextAction}</p></div>
                </div>
              </>
            )}
          </section>

          {/* Human decisions persist through the server; approval deliberately performs no external action. */}
          {action && <section className="panel action-panel" aria-labelledby="action-heading">
            <div className="section-heading action-heading">
              <div className="section-title-wrap">
                <span className="action-icon"><Send size={15} /></span>
                <div><div className="section-kicker">PROPOSED ACTION</div><h2 id="action-heading">Draft a follow-up email</h2></div>
              </div>
              <span className={`proposal-state${actionBadgeState !== "awaiting" ? ` proposal-${actionBadgeState}` : ""}`}>{actionState === "proposed" ? "Needs approval" : actionState === "edited" ? "Edited · needs approval" : actionState === "approved" ? "Approved" : "Cancelled"}</span>
            </div>
            <div className="action-recipient"><span>TO</span><strong>{action.payload.recipientName}</strong><span className="recipient-email">&lt;{action.payload.to}&gt;</span></div>
            <div className="action-subject"><span>SUBJECT</span>{action.payload.subject}</div>
            {isEditing ? (
              <label className="draft-editor"><span className="sr-only">Edit proposed email</span><textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} rows={8} /></label>
            ) : (
              <div className="draft-preview">{draftBody.split("\n").map((line, index) => <p key={`${index}-${line || "space"}`}>{line || " "}</p>)}</div>
            )}
            <div className="action-footer">
              {actionState === "proposed" || actionState === "edited" ? (
                <>
                  <div className="approval-buttons">
                    <button className="button button-primary" type="button" onClick={() => void updateAction("approve")} disabled={isSavingAction}><CheckCircle2 size={16} /> Approve</button>
                    <button className={`button button-secondary${isEditing ? " is-saving" : ""}`} type="button" disabled={isSavingAction} onClick={() => isEditing ? void updateAction("save_edit") : setIsEditing(true)}><Pencil size={15} />{isEditing ? "Save edits" : "Edit"}</button>
                    <button className="button button-text" type="button" onClick={() => void updateAction("cancel")} disabled={isSavingAction}><X size={15} /> Cancel</button>
                  </div>
                  <span className="approval-note"><ShieldCheck size={14} /> {isSavingAction ? "Saving decision…" : "Approval saves the decision only; nothing is sent."}</span>
                </>
              ) : (
                <div className={`action-result result-${actionState}`}>
                  {actionState === "approved" ? <CheckCircle2 size={16} /> : <X size={16} />}
                  <span>{actionState === "approved"
                    ? "Approval saved. No email was sent."
                    : "This proposed action was cancelled."}</span>
                </div>
              )}
            </div>
            {actionError && <p className="analysis-request-error" role="alert">{actionError}</p>}
          </section>}
        </div>

        <aside className="secondary-column">
          {/* Original enquiry text is preserved separately from the generated analysis. */}
          <section className="panel original-panel" aria-labelledby="original-heading">
            <div className="section-heading compact-heading">
              <div className="section-title-wrap"><span className="document-icon"><FileText size={16} /></span><div><div className="section-kicker">SOURCE MATERIAL</div><h2 id="original-heading">Original enquiry</h2></div></div>
              <button className="quiet-button" type="button" aria-label="More message options"><MoreHorizontal size={18} /></button>
            </div>
            <div className="message-meta"><span className="message-sender-avatar">{initials(enquiry.contactName)}</span><span className="message-sender"><strong>{enquiry.contactName}</strong><small>{enquiry.email}</small></span><time>{enquiry.receivedAt.replace(/^.* at /, "")}</time></div>
            <blockquote className="original-message">&quot;{enquiry.originalText}&quot;</blockquote>
            <span className="message-source"><Mail size={14} /> {enquiry.source}</span>
          </section>

          {/* This page-local timeline is illustrative and is not persisted. */}
          <section className="panel activity-panel" aria-labelledby="activity-heading">
            <div className="section-heading compact-heading">
              <div className="section-title-wrap"><span className="activity-icon"><Activity size={16} /></span><div><div className="section-kicker">PROCESS HISTORY</div><h2 id="activity-heading">Activity</h2></div></div>
              <button className="quiet-button" type="button" aria-label="Activity options"><MoreHorizontal size={18} /></button>
            </div>
            <ol className="timeline-list">{events.map((event, index) => <TimelineItem key={event.id} event={event} isLast={index === events.length - 1} />)}</ol>
            <Link className="activity-link" href="/activity"><span>View full history</span><ChevronRight size={14} /></Link>
          </section>
          <div className="analysis-footnote"><ShieldCheck size={15} /> {liveAnalysis ? "Saved analysis · validated before persistence" : analysisFailed ? "Run AI analysis to replace this mock failure" : "Mock analysis shown until you run AI analysis"}</div>
        </aside>
      </div>
      <footer className="page-footnote"><span><span className="footnote-dot" />Mock enquiry</span><span>Analysis generated {enquiry.receivedAt}</span></footer>
    </>
  );
}
