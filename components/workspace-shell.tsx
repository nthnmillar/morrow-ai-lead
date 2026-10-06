"use client";

import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Inbox,
  Layers3,
  Bell,
  Menu,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

// Shared client shell: route-aware navigation and mobile-menu state wrap server-rendered page content.
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDetail = pathname.startsWith("/enquiries/");
  // Keep nested enquiry details highlighted under the enquiries navigation item.
  const isEnquiries = pathname === "/enquiries" || isDetail;
  // Only the responsive menu is interactive shell state; route selection comes from Next navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const detailId = isDetail ? pathname.split("/").at(-1) : null;

  return (
    <div className="app-shell">
      {/* Persistent desktop workspace navigation. */}
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="Morrow workspace home">
          <span className="brand-mark"><Layers3 size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">morrow<span>.</span></span>
        </Link>
        <div className="workspace-switcher">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northline Studio</strong><small>Workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Workspace">
          <Link className={`nav-item${pathname === "/dashboard" ? " is-active" : ""}`} href="/dashboard">
            <BriefcaseBusiness size={17} /><span>Overview</span>
          </Link>
          <Link className={`nav-item${isEnquiries ? " is-active" : ""}`} href="/enquiries" aria-current={isEnquiries ? "page" : undefined}>
            <Inbox size={17} /><span>Enquiries</span><span className="nav-count">{5}</span>
          </Link>
          <Link className={`nav-item${pathname === "/activity" ? " is-active" : ""}`} href="/activity">
            <Activity size={17} /><span>Activity</span>
          </Link>
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
        {/* Breadcrumbs and mobile controls follow the active pathname. */}
        <header className="topbar">
          <div className="breadcrumbs">
            {isDetail ? <><Link href="/enquiries">Enquiries</Link><ChevronRight size={14} /><strong>{detailId}</strong></> : <strong>{pathname === "/activity" ? "Activity" : pathname === "/dashboard" ? "Overview" : "Enquiries"}</strong>}
          </div>
          <div className="topbar-actions">
            <button className="icon-button search-button" type="button" aria-label="Search"><Search size={18} /></button>
            <button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <button className="icon-button mobile-nav-toggle" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} aria-controls="mobile-workspace-navigation" onClick={() => setMobileNavOpen((current) => !current)}>
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="topbar-divider" /><span className="topbar-avatar">JL</span>
          </div>
          {/* Mobile navigation opens locally and closes after a route is selected. */}
          <nav className="mobile-nav-menu" id="mobile-workspace-navigation" aria-label="Workspace" hidden={!mobileNavOpen}>
            <Link className={`mobile-nav-item${pathname === "/dashboard" ? " is-active" : ""}`} href="/dashboard" onClick={() => setMobileNavOpen(false)}><BriefcaseBusiness size={16} />Overview</Link>
            <Link className={`mobile-nav-item${isEnquiries ? " is-active" : ""}`} href="/enquiries" onClick={() => setMobileNavOpen(false)}><Inbox size={16} />Enquiries<span className="nav-count">5</span></Link>
            <Link className={`mobile-nav-item${pathname === "/activity" ? " is-active" : ""}`} href="/activity" onClick={() => setMobileNavOpen(false)}><Activity size={16} />Activity</Link>
          </nav>
        </header>
        {/* Route pages provide content; this shell owns only shared navigation and layout. */}
        <main className="page-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}