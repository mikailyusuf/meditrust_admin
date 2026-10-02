"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ApiError, ageFromDob, clearSession, formatDate, loadSession, meditrustApi,
  type AiDiagnosisSuggestion, type Appointment, type CheckInRequest, type Encounter, type Facility, type LabCatalogItem, type LabRequest, type PatientSummary,
  type Prescription, type Session, type StaffRole, type TimelineItem, type WalkInPatientResult,
  type Visit, type Vitals,
} from "../lib/meditrust";
import { Icon, type IconName } from "./icons";
import { FinanceLabRequestsWorkspace, FinanceOverviewWorkspace, FinancePrescriptionsWorkspace, LabTechWorkspace, PharmacyWorkspace } from "./ancillary-workspaces";
import { SupportWidget } from "./support-widget";
import { PatientFullRecord, PatientSnapshot } from "./patient-full-record";

type NavItem = { label: string; icon: IconName };
type QueueFilter = "active" | "waiting" | "vitals_done" | "with_doctor" | "completed" | "cancelled";

const queueFilters: { value: QueueFilter; label: string }[] = [
  { value: "active", label: "Active queue" },
  { value: "waiting", label: "Waiting" },
  { value: "vitals_done", label: "Vitals done" },
  { value: "with_doctor", label: "With doctor" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const activeQueueStatuses = ["waiting", "vitals_done", "with_doctor"] as const;

const navigation: Record<StaffRole, NavItem[]> = {
  reception: [{ label: "Overview", icon: "grid" }, { label: "Patient check-in", icon: "userPlus" }, { label: "Register patient", icon: "userPlus" }, { label: "Check-in requests", icon: "userCheck" }, { label: "Visit queue", icon: "clock" }],
  nurse: [{ label: "Overview", icon: "grid" }, { label: "Visit queue", icon: "clock" }],
  doctor: [{ label: "Overview", icon: "grid" }, { label: "Visit queue", icon: "clock" }, { label: "Appointments", icon: "calendar" }, { label: "Patient search", icon: "search" }],
  pharmacy: [{ label: "Overview", icon: "grid" }],
  pharmacist: [{ label: "Overview", icon: "grid" }],
  lab: [{ label: "Overview", icon: "grid" }],
  lab_tech: [{ label: "Overview", icon: "grid" }],
  finance: [{ label: "Overview", icon: "grid" }, { label: "Prescriptions", icon: "file" }, { label: "Lab requests", icon: "hospital" }],
};

const roleLabels: Record<StaffRole, string> = { reception: "Reception", nurse: "Nursing", doctor: "Doctor", pharmacy: "Pharmacy", pharmacist: "Pharmacy", lab: "Laboratory", lab_tech: "Lab technician", finance: "Finance" };

export function DashboardApp() {
  const router = useRouter();
  const logoutDialogRef = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [queue, setQueue] = useState<Visit[]>([]);
  const [doctorQueueFilter, setDoctorQueueFilter] = useState<QueueFilter>("active");
  const [staffQueueFilter, setStaffQueueFilter] = useState<QueueFilter>("waiting");
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [recordPatientId, setRecordPatientId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [checkInRequests, setCheckInRequests] = useState<CheckInRequest[]>([]);
  const [checkInRequestsLoading, setCheckInRequestsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadSession();
      if (!stored) router.replace("/login"); else setSession(stored);
      setAuthReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  const role = session?.user.facility_staff.role;
  const facilityId = session?.user.facility_staff.facility_id;
  const queueFilter = role === "doctor" ? doctorQueueFilter : staffQueueFilter;

  const reportError = useCallback((reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 401) { clearSession(); router.replace("/login"); return; }
    setError(reason instanceof Error ? reason.message : "Something went wrong.");
  }, [router]);

  const notify = useCallback((message: string) => {
    setToast(message); window.setTimeout(() => setToast(""), 2800);
  }, []);

  const refreshFacility = useCallback(async () => {
    if (!facilityId) return;
    setFacilityLoading(true);
    try { setFacility(await meditrustApi.getMyFacility()); }
    catch (reason) { reportError(reason); }
    finally { setFacilityLoading(false); }
  }, [facilityId, reportError]);

  useEffect(() => { void Promise.resolve().then(refreshFacility); }, [refreshFacility]);

  const refreshQueue = useCallback(async () => {
    if (!facilityId || !role || isPharmacyRole(role) || isLabRole(role) || isFinanceRole(role)) return;
    setQueueLoading(true); setError("");
    try {
      const statuses = queueFilter === "active" ? activeQueueStatuses : [queueFilter];
      const results = await Promise.all(statuses.map((status) => meditrustApi.listVisits(facilityId, status)));
      const visits = Array.from(new Map(results.flat().map((visit) => [visit.id, visit])).values())
        .sort((left, right) => new Date(left.checked_in_at).getTime() - new Date(right.checked_in_at).getTime());
      setQueue(visits);
      setSelectedVisit((current) => current ? visits.find((visit) => visit.id === current.id) || null : null);
    } catch (reason) { reportError(reason); }
    finally { setQueueLoading(false); }
  }, [facilityId, queueFilter, role, reportError]);

  useEffect(() => { void Promise.resolve().then(refreshQueue); }, [refreshQueue]);

  const refreshAppointments = useCallback(async () => {
    if (role !== "doctor") return;
    setAppointmentsLoading(true); setError("");
    try { setAppointments(await meditrustApi.getDoctorAppointments()); }
    catch (reason) { reportError(reason); }
    finally { setAppointmentsLoading(false); }
  }, [role, reportError]);

  useEffect(() => { void Promise.resolve().then(refreshAppointments); }, [refreshAppointments]);

  const refreshCheckInRequests = useCallback(async () => {
    if (!facilityId || role !== "reception") return;
    setCheckInRequestsLoading(true);
    try { setCheckInRequests(await meditrustApi.listCheckInRequests(facilityId, "pending")); }
    catch (reason) { reportError(reason); }
    finally { setCheckInRequestsLoading(false); }
  }, [facilityId, role, reportError]);

  useEffect(() => { void Promise.resolve().then(refreshCheckInRequests); }, [refreshCheckInRequests]);

  useEffect(() => {
    if (role !== "reception" || active !== "Check-in requests") return;
    const timer = window.setInterval(() => { void refreshCheckInRequests(); }, 20000);
    return () => window.clearInterval(timer);
  }, [role, active, refreshCheckInRequests]);

  async function logout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    logoutDialogRef.current?.close();
    clearSession(); router.replace("/login");
  }

  function navigate(label: string) { setActive(label); setSelectedVisit(null); setRecordPatientId(null); setError(""); setMenuOpen(false); }

  if (!authReady || !session || !role || !facilityId) return <div className="auth-loader"><span className="spinner" />Loading secure workspace…</div>;

  const initials = session.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const navItems = navigation[role];
  const mobileNavItems = role === "reception" ? navItems.slice(0, 3) : navItems;

  return <div className="app-shell role-app">
    <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand-row"><Image src="/meditrust360-logo-transparent.png" alt="MediTrust360" width={168} height={52} priority /><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="x" /></button></div>
      <div className="staff-facility-card">
        <span className="staff-facility-icon"><Icon name="hospital" size={19} /></span>
        <div><strong>{facility?.name || (facilityLoading ? "Loading facility…" : "Facility unavailable")}</strong><small>{facility ? `${titleCase(facility.type)}${facility.address ? ` · ${facility.address}` : ""}` : "Your assigned facility"}</small></div>
        {facility?.status && <i className={facility.status === "active" ? "active" : ""}>{facility.status}</i>}
      </div>
      <div className="role-badge"><span>{roleLabels[role]} workspace</span><small>{session.user.facility_staff.staff_code}</small></div>
      <nav className="nav-group" aria-label="Main navigation"><p className="nav-label">Workspace</p>{navItems.map((item) => <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => navigate(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Visit queue" && queue.length > 0 && <b>{queue.length}</b>}{item.label === "Check-in requests" && checkInRequests.length > 0 && <b>{checkInRequests.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="doctor-card"><div className="avatar avatar-dark">{initials}</div><div><strong>{session.user.name}</strong><span>{roleLabels[role]} · {session.user.facility_staff.staff_code}</span></div></div><button className="logout-button sidebar-logout" onClick={() => logoutDialogRef.current?.showModal()}>Sign out securely</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar role-topbar"><div><span className="topbar-role">{facility?.name || `${roleLabels[role]} workspace`}</span><strong>{session.user.name} · {roleLabels[role]}</strong></div><div className="top-actions"><span className="avatar avatar-small">{initials}</span></div></header>
      <div className="dashboard role-dashboard">
        {error && <div className="workspace-error" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {recordPatientId && role === "doctor" && <PatientFullRecord key={recordPatientId} patientId={recordPatientId} backLabel={`Back to ${active.toLowerCase()}`} onBack={() => setRecordPatientId(null)} />}
        <div className="workspace-stack" hidden={!!recordPatientId && role === "doctor"}>
        {active === "Overview" && !isPharmacyRole(role) && !isLabRole(role) && !isFinanceRole(role) && <RoleOverview session={session} facility={facility} queue={queue} queueFilter={queueFilter} loading={queueLoading} onNavigate={navigate} onSelect={(visit) => { setSelectedVisit(visit); setActive("Visit queue"); }} />}
        {(active === "Patient check-in" || active === "Patient search") && <PatientSearch role={role} facilityId={facilityId} onOpenRecord={setRecordPatientId} onCheckInRequested={(request) => { setCheckInRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]); notify(`Check-in code sent to ${request.patient.name}`); setActive("Check-in requests"); }} onError={reportError} />}
        {active === "Register patient" && role === "reception" && <WalkInRegistration facilityId={facilityId} onCheckedIn={(visit) => { void refreshQueue(); notify(`${visit.patient.name} checked in`); }} onOpenQueue={(visit) => { setSelectedVisit(visit); setActive("Visit queue"); }} onError={reportError} />}
        {active === "Check-in requests" && role === "reception" && <CheckInRequests requests={checkInRequests} loading={checkInRequestsLoading} onRefresh={refreshCheckInRequests} onResolved={(id) => setCheckInRequests((current) => current.filter((item) => item.id !== id))} onCheckedIn={(visit) => { void refreshQueue(); notify(`${visit.patient.name} checked in`); }} onError={reportError} notify={notify} />}
        {active === "Appointments" && role === "doctor" && <AppointmentsPanel appointments={appointments} loading={appointmentsLoading} onRefresh={refreshAppointments} onOpenRecord={setRecordPatientId} />}
        {active === "Visit queue" && <VisitQueue role={role} statusFilter={queueFilter} onStatusFilterChange={role === "doctor" ? setDoctorQueueFilter : setStaffQueueFilter} visits={queue} loading={queueLoading} selected={selectedVisit} onSelect={setSelectedVisit} onRefresh={refreshQueue} onOpenRecord={setRecordPatientId} onVisitChanged={(visit) => { const visibleStatuses: readonly string[] = queueFilter === "active" ? activeQueueStatuses : [queueFilter]; const remainsVisible = visibleStatuses.includes(visit.status); setQueue((current) => remainsVisible ? current.map((item) => item.id === visit.id ? visit : item) : current.filter((item) => item.id !== visit.id)); setSelectedVisit(remainsVisible ? visit : null); if (role === "reception") notify(`Visit marked ${visit.status}`); }} onError={reportError} notify={notify} />}
        {isLabRole(role) && active === "Overview" && <LabTechWorkspace facilityId={facilityId} role={role} onError={reportError} notify={notify} />}
        {isPharmacyRole(role) && active === "Overview" && <PharmacyWorkspace facilityId={facilityId} role={role} onError={reportError} notify={notify} />}
        {isFinanceRole(role) && active === "Overview" && <FinanceOverviewWorkspace onError={reportError} />}
        {isFinanceRole(role) && active === "Prescriptions" && <FinancePrescriptionsWorkspace onError={reportError} notify={notify} />}
        {isFinanceRole(role) && active === "Lab requests" && <FinanceLabRequestsWorkspace onError={reportError} notify={notify} />}
        </div>
      </div>
    </main>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{mobileNavItems.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => navigate(item.label)}><span><Icon name={item.icon} size={20} />{((item.label === "Visit queue" && queue.length > 0) || (item.label === "Check-in requests" && checkInRequests.length > 0)) && <i />}</span><small>{item.label.replace("Patient ", "")}</small></button>)}<button onClick={() => setMenuOpen(true)}><span><Icon name="more" size={20} /></span><small>More</small></button></nav>
    <dialog ref={logoutDialogRef} className="app-modal confirmation-dialog" aria-labelledby="signout-title" aria-describedby="signout-description" onCancel={(event) => { if (signingOut) event.preventDefault(); }}>
      <h2 id="signout-title">Sign out?</h2>
      <p id="signout-description">You’ll need to sign in again to access your workspace.</p>
      <div className="confirmation-actions">
        <button type="button" className="secondary-button" disabled={signingOut} onClick={() => logoutDialogRef.current?.close()}>Cancel</button>
        <button type="button" className="logout-button" disabled={signingOut} onClick={() => void logout()}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </div>
    </dialog>
    <SupportWidget />
    {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
  </div>;
}

function RoleOverview({ session, facility, queue, queueFilter, loading, onNavigate, onSelect }: { session: Session; facility: Facility | null; queue: Visit[]; queueFilter: QueueFilter; loading: boolean; onNavigate: (label: string) => void; onSelect: (visit: Visit) => void }) {
  const role = session.user.facility_staff.role;
  if (isPharmacyRole(role) || isLabRole(role) || isFinanceRole(role)) return null;
  const actionLabel = role === "reception" ? "Patient check-in" : "Visit queue";
  const queueLabel = queueFilters.find((filter) => filter.value === queueFilter)?.label || "Queue";
  return <><section className="welcome-row"><div><p className="eyebrow">{new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1>Good {dayPeriod()}, {firstName(session.user.name)}</h1><p className="subtext">{facility ? `${facility.name}${facility.address ? ` · ${facility.address}` : ""}` : role === "reception" ? "Manage arrivals and keep today’s patient flow moving." : role === "nurse" ? "Review waiting patients and capture accurate triage observations." : "Review the clinical queue and continue patient care."}</p></div><button className="primary-button" onClick={() => onNavigate(actionLabel)}><Icon name={role === "reception" ? "userPlus" : "clock"} size={18} />{role === "reception" ? "Find & check in patient" : role === "nurse" ? "Open triage queue" : "Open consultation queue"}</button></section>
    <section className="stats-grid role-stats"><article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="clock" /></span><span className="unread-chip">Live</span></div><strong>{loading ? "—" : queue.length}</strong><p>{queueFilter === "active" ? "Active visits" : `${queueLabel} visits`}</p><span className="stat-note">{facility?.name || "Current facility queue"}</span></article><article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="hospital" /></span></div><strong>{session.user.facility_staff.staff_code}</strong><p>Staff code</p><span className="stat-note">{roleLabels[role]} access</span></article><article className="stat-card"><div className="stat-top"><span className="stat-icon purple"><Icon name="check" /></span></div><strong>{facility?.status ? titleCase(facility.status) : "Active"}</strong><p>Facility status</p><span className="stat-note">{facility ? titleCase(facility.type) : "Facility-scoped access"}</span></article></section>
    <section className="panel queue-preview"><div className="panel-heading"><div><h2>{queueLabel}</h2><p>{queueFilter === "active" ? "Patients waiting, ready, or already in consultation" : `Visits with status: ${queueLabel.toLowerCase()}`}</p></div><button className="text-button" onClick={() => onNavigate("Visit queue")}>View all <Icon name="arrow" size={16} /></button></div><div className="visit-list">{loading ? <LoadingState /> : queue.length ? queue.slice(0, 5).map((visit, index) => <VisitRow key={visit.id} visit={visit} position={index + 1} onClick={() => onSelect(visit)} />) : <EmptyState title={`No ${queueLabel.toLowerCase()} visits`} body="No visits match the selected status." />}</div></section></>;
}

function PatientSearch({ role, facilityId, onOpenRecord, onCheckInRequested, onError }: { role: StaffRole; facilityId: string; onOpenRecord: (patientId: string) => void; onCheckInRequested: (request: CheckInRequest) => void; onError: (reason: unknown) => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<PatientSummary[]>([]); const [selected, setSelected] = useState<PatientSummary | null>(null); const [loading, setLoading] = useState(false); const [checkingIn, setCheckingIn] = useState(false); const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!query.trim()) return; setLoading(true); setSelected(null); setTimeline([]); try { setResults(await meditrustApi.searchPatients(query.trim())); } catch (reason) { onError(reason); } finally { setLoading(false); } }
  async function choose(patient: PatientSummary) { setSelected(patient); if (role === "doctor") { try { setTimeline(await meditrustApi.getTimeline(patient.id)); } catch (reason) { onError(reason); } } }
  async function checkIn() { if (!selected) return; setCheckingIn(true); try { onCheckInRequested(await meditrustApi.checkIn(facilityId, selected.digital_health_id)); } catch (reason) { onError(reason); } finally { setCheckingIn(false); } }
  return <section className="role-workspace"><WorkspaceHeading eyebrow={role === "reception" ? "Front desk" : "Clinical records"} title={role === "reception" ? "Find and check in a patient" : "Patient search"} description={role === "reception" ? "Search by Digital Health ID or patient name, then confirm the patient. A one-time code is emailed to the patient — verify it (or let the patient approve on their device) to complete check-in." : "Find a patient and review their longitudinal clinical timeline."} />
    <form className="patient-search-form" onSubmit={search}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digital Health ID or patient name" aria-label="Patient search" /><button className="primary-button" disabled={loading}>{loading ? "Searching…" : "Search"}</button></form>
    <div className="search-workspace-grid"><div className="data-panel search-patient-list"><div className="data-toolbar"><strong>Search results</strong><span>{results.length} found</span></div>{loading ? <LoadingState /> : results.length ? results.map((patient) => <button key={patient.id} className={`patient-result ${selected?.id === patient.id ? "selected" : ""}`} onClick={() => void choose(patient)}><PatientAvatar patient={patient} /><span><strong>{patient.name}</strong><small>{patient.digital_health_id} · {ageFromDob(patient.dob)} years · {patient.sex}</small></span><Icon name="chevron" /></button>) : <EmptyState title="Search for a patient" body="Results will appear here." />}</div>
      <div className="panel patient-selection">{selected ? <><div className="selected-patient-head"><PatientAvatar patient={selected} large /><div><span>Patient confirmed</span><h2>{selected.name}</h2><p>{selected.digital_health_id}</p></div></div><dl className="patient-facts"><div><dt>Date of birth</dt><dd>{selected.dob}</dd></div><div><dt>Sex</dt><dd>{selected.sex}</dd></div><div><dt>Phone</dt><dd>{selected.phone || "Not provided"}</dd></div></dl>{role === "reception" ? <button className="modal-primary" disabled={checkingIn} onClick={checkIn}>{checkingIn ? "Sending code…" : "Confirm & send check-in code"} <Icon name="arrow" size={17} /></button> : <><button className="modal-primary" onClick={() => onOpenRecord(selected.id)}>Open full patient record <Icon name="arrow" size={17} /></button><Timeline items={timeline} /></>}</> : <EmptyState title="Select a patient" body="Confirm the correct record before continuing." />}</div></div>
  </section>;
}

function WalkInRegistration({ facilityId, onCheckedIn, onOpenQueue, onError }: { facilityId: string; onCheckedIn: (visit: Visit) => void; onOpenQueue: (visit: Visit) => void; onError: (reason: unknown) => void }) {
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState<WalkInPatientResult | null>(null);
  const [consentMethod, setConsentMethod] = useState<"verbal" | "signed_form">("verbal");
  const [checkingIn, setCheckingIn] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      const result = await meditrustApi.registerWalkInPatient(facilityId, {
        name: String(values.get("name")).trim(),
        dob: String(values.get("dob")),
        sex: String(values.get("sex")) as "female" | "male",
        phone: String(values.get("phone")).trim(),
        consent_accepted: true,
      });
      setRegistered(result);
      form.reset();
    } catch (reason) { onError(reason); }
    finally { setSaving(false); }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registered || checkingIn) return;
    const values = new FormData(event.currentTarget);
    const consentReference = String(values.get("consent_reference") || "").trim();
    if (consentMethod === "signed_form" && !consentReference) return;
    setCheckingIn(true);
    try {
      const checkedInVisit = await meditrustApi.checkInWalkInPatient(facilityId, registered.patient.id, {
        consent_accepted: true,
        consent_method: consentMethod,
        ...(consentMethod === "signed_form" ? { consent_reference: consentReference } : {}),
      });
      setVisit(checkedInVisit);
      onCheckedIn(checkedInVisit);
    } catch (reason) { onError(reason); }
    finally { setCheckingIn(false); }
  }

  return <section className="role-workspace">
    <WorkspaceHeading eyebrow="Front desk" title="Register a walk-in patient" description="Create a patient profile, provide their Digital Health ID, and check them in when they are ready." />
    {registered ? <div className="panel walk-in-result" role="status">
      <span className="walk-in-success"><Icon name="check" size={19} /></span>
      <div><p className="eyebrow">Patient registered</p><h2>{registered.patient.name}</h2><p>Digital Health ID</p><strong className="walk-in-health-id">{registered.patient.digital_health_id}</strong></div>
      <dl className="patient-facts"><div><dt>Date of birth</dt><dd>{registered.patient.dob}</dd></div><div><dt>Sex</dt><dd>{registered.patient.sex}</dd></div><div><dt>Phone</dt><dd>{registered.patient.phone || "Not provided"}</dd></div></dl>
      <div className="walk-in-actions"><a className="secondary-button" href={meditrustApi.walkInPrintPath(facilityId, registered.patient.id)} target="_blank" rel="noopener noreferrer"><Icon name="file" size={17} />Open printable profile</a><button type="button" className="secondary-button" onClick={() => { setRegistered(null); setVisit(null); setConsentMethod("verbal"); }}>Register another patient</button></div>
      {visit ? <div className="walk-in-checkin-complete"><span className="walk-in-success"><Icon name="check" size={19} /></span><div><h3>Patient checked in</h3><p>The visit is waiting in the queue.</p></div><button type="button" className="primary-button" onClick={() => onOpenQueue(visit)}>View visit queue</button></div> : <form className="walk-in-checkin" onSubmit={checkIn}>
        <h3>Check in this patient</h3><p>Record how the patient consented before adding them to the waiting queue.</p>
        <label>Consent method<select name="consent_method" value={consentMethod} onChange={(event) => setConsentMethod(event.target.value as "verbal" | "signed_form")}><option value="verbal">Verbal</option><option value="signed_form">Signed paper form</option></select></label>
        {consentMethod === "signed_form" && <label>Consent reference<input name="consent_reference" type="text" maxLength={255} placeholder="Paper form or file reference" required /></label>}
        <label className="walk-in-consent"><input name="check_in_consent" type="checkbox" required /><span>I confirm the patient accepted consent for this check-in.</span></label>
        <button className="primary-button" disabled={checkingIn}>{checkingIn ? "Checking in…" : "Check in patient"}</button>
      </form>}
    </div> : <form className="panel walk-in-form" onSubmit={submit}>
      <div className="panel-heading"><div><h2>Patient details</h2><p>Enter the patient’s details exactly as confirmed with them.</p></div></div>
      <div className="walk-in-fields">
        <label className="walk-in-full">Full name<input name="name" type="text" autoComplete="name" maxLength={255} placeholder="e.g. Amina Musa" required /></label>
        <label>Date of birth<input name="dob" type="date" max={new Date().toISOString().slice(0, 10)} required /></label>
        <label>Sex<select name="sex" defaultValue="" required><option value="" disabled>Select sex</option><option value="female">Female</option><option value="male">Male</option></select></label>
        <label className="walk-in-full">Phone number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="e.g. 08012345678" required /></label>
        <label className="walk-in-consent walk-in-full"><input name="consent" type="checkbox" required /><span>I confirm the patient has accepted consent to register their profile.</span></label>
      </div>
      <div className="walk-in-form-actions"><button className="primary-button" disabled={saving}>{saving ? "Registering patient…" : "Register patient"}</button></div>
    </form>}
  </section>;
}

function CheckInRequests({ requests, loading, onRefresh, onResolved, onCheckedIn, onError, notify }: { requests: CheckInRequest[]; loading: boolean; onRefresh: () => Promise<void>; onResolved: (id: string) => void; onCheckedIn: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  return <section className="role-workspace">
    <WorkspaceHeading eyebrow="Front desk" title="Check-in requests" description="Patients awaiting check-in confirmation. Enter the one-time code emailed to the patient, or wait for them to approve on their own device." action={<button className="secondary-button" onClick={() => void onRefresh()} disabled={loading}><Icon name="trend" size={17} />Refresh</button>} />
    <div className="queue-workspace-grid">
      <div className="data-panel queue-list">
        <div className="data-toolbar"><strong>{requests.length} pending</strong><span>Awaiting verification</span></div>
        {loading && !requests.length ? <LoadingState /> : requests.length ? requests.map((request) => <button key={request.id} className={`patient-result ${selected?.id === request.id ? "selected" : ""}`} onClick={() => setSelectedId(request.id)}>
          <div className="avatar blue">{initialsOf(request.patient.name)}</div>
          <span><strong>{request.patient.name}</strong><small>{request.patient.digital_health_id} · {request.otp_sent ? "Code sent" : "Code not sent"}</small></span>
          <Icon name="chevron" />
        </button>) : <EmptyState title="No pending requests" body="New check-in requests will appear here." />}
      </div>
      <div className="panel visit-detail-panel">{selected
        ? <CheckInRequestDetail key={selected.id} request={selected} onResolved={onResolved} onCheckedIn={onCheckedIn} onError={onError} notify={notify} />
        : <EmptyState title="Select a request" body="Verification actions will appear here." />}</div>
    </div>
  </section>;
}

function CheckInRequestDetail({ request, onResolved, onCheckedIn, onError, notify }: { request: CheckInRequest; onResolved: (id: string) => void; onCheckedIn: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"verify" | "resend" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length < 4) return;
    setBusy("verify");
    try { const visit = await meditrustApi.verifyCheckInOtp(request.id, otp); onResolved(request.id); onCheckedIn(visit); }
    catch (error) { onError(error); }
    finally { setBusy(null); }
  }

  async function resend() {
    setBusy("resend");
    try { await meditrustApi.resendCheckInOtp(request.id); notify("Check-in code resent to patient"); }
    catch (error) { onError(error); }
    finally { setBusy(null); }
  }

  async function cancel() {
    if (!reason.trim()) return;
    setBusy("cancel");
    try { await meditrustApi.cancelCheckInRequest(request.id, reason.trim()); onResolved(request.id); notify("Check-in request cancelled"); }
    catch (error) { onError(error); }
    finally { setBusy(null); }
  }

  return <>
    <div className="visit-patient-head">
      <div className="avatar blue large">{initialsOf(request.patient.name)}</div>
      <div><span className={`record-status ${request.status}`}>{titleCase(request.status)}</span><h2>{request.patient.name}</h2><p>{request.patient.digital_health_id}</p></div>
    </div>
    <div className="checkin-otp-note"><Icon name="mail" size={16} /><span>{request.otp_sent ? "A one-time check-in code was emailed to the patient. The patient can also approve this check-in from their own device — refresh to pick that up." : "No code has been sent yet. Use “Resend code” to email the patient a check-in code."}</span></div>
    <form className="checkin-otp-form" onSubmit={verify}>
      <label>Check-in code
        <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the 6-digit code" />
      </label>
      <div className="checkin-otp-actions">
        <button type="submit" className="modal-primary" disabled={busy !== null || otp.length < 4}>{busy === "verify" ? "Verifying…" : "Verify & check in"}</button>
        <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void resend()}>{busy === "resend" ? "Sending…" : "Resend code"}</button>
      </div>
    </form>
    <div className="visit-actions checkin-cancel">
      <p>Wrong patient selected?</p>
      {cancelling
        ? <div className="checkin-cancel-confirm"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for cancelling" /><button className="danger-outline" disabled={busy !== null || !reason.trim()} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelling…" : "Confirm cancel"}</button></div>
        : <button className="danger-outline" disabled={busy !== null} onClick={() => setCancelling(true)}>Cancel request</button>}
    </div>
  </>;
}

function VisitQueue({ role, statusFilter, onStatusFilterChange, visits, loading, selected, onSelect, onRefresh, onOpenRecord, onVisitChanged, onError, notify }: { role: StaffRole; statusFilter: QueueFilter; onStatusFilterChange: (status: QueueFilter) => void; visits: Visit[]; loading: boolean; selected: Visit | null; onSelect: (visit: Visit | null) => void; onRefresh: () => Promise<void>; onOpenRecord: (patientId: string) => void; onVisitChanged: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [queueExpanded, setQueueExpanded] = useState(false);
  const showQueue = role === "reception" || !selected || queueExpanded;
  const filterLabel = queueFilters.find((filter) => filter.value === statusFilter)?.label || "Queue";
  return <section className={`role-workspace ${role === "doctor" ? "" : "staff-visit-queue"}`}><WorkspaceHeading eyebrow="Live patient flow" title="Visit queue" description={role === "reception" ? "Monitor visits across the patient flow." : role === "nurse" ? "Record vitals for waiting patients or review visit status." : "Review active visits or filter the queue by clinical status."} action={<div className="queue-toolbar-actions"><label><span>Visit status</span><select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as QueueFilter)} disabled={loading}>{queueFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label><button className="secondary-button" onClick={() => void onRefresh()} disabled={loading}><Icon name="trend" size={17} />Refresh</button></div>} />
    <div className={`queue-workspace-grid ${role === "doctor" ? "doctor-queue-layout" : role === "nurse" ? "nurse-queue-layout" : ""} ${role === "nurse" && selected ? "nurse-queue-focused" : ""}`}>
      <div className="data-panel queue-list">
        <div className="data-toolbar">
          <strong>{visits.length} {filterLabel.toLowerCase()}</strong>
          <span>{role !== "reception" && selected ? <button type="button" className="queue-toggle" aria-expanded={showQueue} aria-controls="visit-queue-items" onClick={() => setQueueExpanded((value) => !value)}>{queueExpanded ? "Keep current visit" : "Choose another visit"}</button> : "Oldest first"}</span>
        </div>
        <div id="visit-queue-items" hidden={!showQueue}>
          {queueExpanded && selected && <p className="queue-picker-hint">Select a visit below to switch records.</p>}
          {loading ? <LoadingState /> : visits.length ? visits.map((visit, index) => <VisitRow key={visit.id} visit={visit} position={index + 1} selected={selected?.id === visit.id} onClick={() => { onSelect(visit); setQueueExpanded(false); }} />) : <EmptyState title={`No ${filterLabel.toLowerCase()} visits`} body="No visits match the selected status." />}
        </div>
      </div>
      <div className="panel visit-detail-panel">{selected ? <VisitDetail key={selected.id} role={role} visit={selected} onOpenRecord={onOpenRecord} onVisitChanged={onVisitChanged} onError={onError} notify={notify} /> : <EmptyState title="Select a visit" body="Patient information and available actions will appear here." />}</div>
    </div>
  </section>;
}

function AppointmentsPanel({ appointments, loading, onRefresh, onOpenRecord }: { appointments: Appointment[]; loading: boolean; onRefresh: () => Promise<void>; onOpenRecord: (patientId: string) => void }) {
  const [selected, setSelected] = useState<Appointment | null>(null);
  return <section className="role-workspace">
    <WorkspaceHeading eyebrow="Consultations" title="Appointments" description="Appointments scheduled with you across your facilities." action={<button className="secondary-button" onClick={() => void onRefresh()} disabled={loading}><Icon name="trend" size={17} />Refresh</button>} />
    <div className="queue-workspace-grid">
      <div className="data-panel">
        <div className="data-toolbar"><strong>{appointments.length} appointments</strong><span>Upcoming first</span></div>
        <div className="data-table">{loading ? <LoadingState /> : appointments.length ? appointments.map((appointment) => <button key={appointment.id} className={`data-row appointment-data-row ${selected?.id === appointment.id ? "highlighted" : ""}`} onClick={() => setSelected(appointment)}>
          <span className="data-time"><strong>{formatTime(appointment.scheduled_at)}</strong><small>{formatShortDate(appointment.scheduled_at)}</small></span>
          <PatientAvatar patient={appointment.patient} />
          <span><strong>{appointment.patient.name}</strong><small>{appointment.patient.digital_health_id} · {ageFromDob(appointment.patient.dob)} yrs</small></span>
          <span><strong>{appointment.facility.name}</strong><small>{titleCase(appointment.type)}</small></span>
          <em className={`record-status ${appointment.status}`}>{titleCase(appointment.status)}</em>
          <Icon name="chevron" />
        </button>) : <EmptyState title="No appointments" body="You have no scheduled appointments yet." />}</div>
      </div>
      <div className="panel visit-detail-panel">{selected ? <AppointmentDetail appointment={selected} onOpenRecord={onOpenRecord} /> : <EmptyState title="Select an appointment" body="Appointment and patient information will appear here." />}</div>
    </div>
  </section>;
}

function AppointmentDetail({ appointment, onOpenRecord }: { appointment: Appointment; onOpenRecord: (patientId: string) => void }) {
  const patient = appointment.patient;
  return <><div className="visit-patient-head"><PatientAvatar patient={patient} large /><div><span className={`record-status ${appointment.status}`}>{titleCase(appointment.status)}</span><h2>{patient.name}</h2><p>{patient.digital_health_id}</p></div><FullRecordButton onClick={() => onOpenRecord(patient.id)} /></div>
    <dl className="patient-facts">
      <div><dt>Scheduled for</dt><dd>{formatDate(appointment.scheduled_at)}</dd></div>
      <div><dt>Type</dt><dd>{titleCase(appointment.type)}</dd></div>
      <div><dt>Facility</dt><dd>{appointment.facility.name}</dd></div>
      <div><dt>Age / sex</dt><dd>{ageFromDob(patient.dob)} · {patient.sex}</dd></div>
      <div><dt>Blood group</dt><dd>{patient.blood_group || "Not provided"}</dd></div>
      <div><dt>Fee</dt><dd>{appointment.fee ? `₦${Number(appointment.fee).toLocaleString()}` : "Not set"}</dd></div>
      <div><dt>Notes</dt><dd>{appointment.notes || "No additional notes"}</dd></div>
    </dl>
  </>;
}

function VisitDetail({ role, visit, onOpenRecord, onVisitChanged, onError, notify }: { role: StaffRole; visit: Visit; onOpenRecord: (patientId: string) => void; onVisitChanged: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function changeStatus(status: "cancelled" | "completed") { setBusy(true); try { onVisitChanged(await meditrustApi.updateVisitStatus(visit.id, status)); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <><div className="visit-patient-head"><PatientAvatar patient={visit.patient} large /><div><span className={`record-status ${visit.status}`}>{titleCase(visit.status)}</span><h2>{visit.patient.name}</h2><p>{visit.patient.digital_health_id}</p></div>{role === "doctor" && <FullRecordButton onClick={() => onOpenRecord(visit.patient.id)} />}</div><dl className="patient-facts"><div><dt>Age / sex</dt><dd>{ageFromDob(visit.patient.dob)} · {visit.patient.sex}</dd></div><div><dt>Checked in</dt><dd>{formatDate(visit.checked_in_at)}</dd></div><div><dt>Phone</dt><dd>{visit.patient.phone || "Not provided"}</dd></div></dl>
    {role === "doctor" && <PatientSnapshot patientId={visit.patient.id} onOpenRecord={() => onOpenRecord(visit.patient.id)} />}
    {role === "reception" && visit.status === "waiting" && <div className="visit-actions"><p>Front desk actions</p><button className="danger-outline" disabled={busy} onClick={() => void changeStatus("cancelled")}>Cancel visit</button></div>}
    {role === "nurse" && (visit.status === "waiting" ? <VitalsForm visit={visit} onRecorded={() => onVisitChanged({ ...visit, status: "vitals_done" })} onError={onError} notify={notify} /> : <div className="historical-visit-note"><Icon name="check" /><strong>{titleCase(visit.status)} visit</strong><span>Vitals can be recorded from the waiting queue.</span></div>)}
    {role === "doctor" && (visit.status === "completed" || visit.status === "cancelled" ? <div className="historical-visit-note"><Icon name={visit.status === "completed" ? "check" : "x"} /><strong>{titleCase(visit.status)} visit</strong><span>This visit is read-only and no longer accepts clinical actions.</span></div> : <DoctorWorkspace visit={visit} onStarted={() => onVisitChanged({ ...visit, status: "with_doctor" })} onFinalized={() => onVisitChanged({ ...visit, status: "completed" })} onError={onError} notify={notify} />)}
  </>;
}

function VitalsForm({ visit, onRecorded, onError, notify }: { visit: Visit; onRecorded: () => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Vitals[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    meditrustApi.getVitals(visit.patient.id).then(setHistory).catch(onError).finally(() => setHistoryLoading(false));
  }, [visit.patient.id, onError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => {
      const raw = data.get(name);
      return typeof raw === "string" && raw.trim() !== "" ? Number(raw) : undefined;
    };
    try {
      await meditrustApi.recordVitals(visit.id, {
        blood_pressure_systolic: value("systolic"), blood_pressure_diastolic: value("diastolic"),
        temperature: value("temperature"), pulse: value("pulse"), respiratory_rate: value("respiratory_rate"),
        spo2: value("spo2"), weight: value("weight"), height: value("height"),
      });
      notify("Vitals saved. Patient is ready for the doctor.");
      onRecorded();
    } catch (reason) { onError(reason); }
    finally { setSaving(false); }
  }

  const fields = [
    { name: "systolic", label: "Systolic BP", unit: "mmHg" },
    { name: "diastolic", label: "Diastolic BP", unit: "mmHg" },
    { name: "temperature", label: "Temperature", unit: "°C" },
    { name: "pulse", label: "Pulse", unit: "bpm" },
    { name: "respiratory_rate", label: "Respiratory rate", unit: "/min" },
    { name: "spo2", label: "Oxygen saturation", unit: "%" },
    { name: "weight", label: "Weight", unit: "kg" },
    { name: "height", label: "Height", unit: "cm" },
  ];
  const latest = history[0];

  return <section className="nurse-vitals-workspace" aria-label="Record patient vital signs">
    <header className="nurse-vitals-heading"><span className="nurse-vitals-icon"><Icon name="activity" size={19} /></span><div><span>TRIAGE · CURRENT VISIT</span><h3>Record vital signs</h3></div><small>Enter the readings available.</small></header>
    <form className="nurse-vitals-form" onSubmit={submit}>
      <fieldset className="nurse-vitals-grid" disabled={saving}>
        {fields.map((field) => <label key={field.name}><span>{field.label}</span><span className="nurse-vitals-input"><input name={field.name} type="number" inputMode="decimal" step="any" /><small>{field.unit}</small></span></label>)}
      </fieldset>
      <div className="nurse-vitals-actions"><p>Review readings, then save to move the patient to the doctor’s queue.</p><button className="modal-primary" disabled={saving}>{saving ? "Saving vital signs…" : "Save vitals"}</button></div>
    </form>
    <details className="nurse-previous-vitals"><summary>Previous readings <span>{latest ? formatDate(latest.recorded_at) : historyLoading ? "Loading…" : "None recorded"}</span></summary>{latest && <dl><div><dt>Blood pressure</dt><dd>{latest.blood_pressure_systolic ?? "—"}/{latest.blood_pressure_diastolic ?? "—"} <small>mmHg</small></dd></div><div><dt>Temperature</dt><dd>{latest.temperature ?? "—"} <small>°C</small></dd></div><div><dt>Pulse</dt><dd>{latest.pulse ?? "—"} <small>bpm</small></dd></div><div><dt>SpO₂</dt><dd>{latest.spo2 ?? "—"}<small>%</small></dd></div></dl>}</details>
  </section>;
}

function DoctorWorkspace({ visit, onStarted, onFinalized, onError, notify }: { visit: Visit; onStarted: () => void; onFinalized: () => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [vitals, setVitals] = useState<Vitals[]>([]); const [timeline, setTimeline] = useState<TimelineItem[]>([]); const [encounter, setEncounter] = useState<Encounter | null>(null);
  useEffect(() => { Promise.all([meditrustApi.getVitals(visit.patient.id), meditrustApi.getTimeline(visit.patient.id)]).then(([v, t]) => { setVitals(v); setTimeline(t); const existing = t.find((item) => item.type === "encounter" && (item.data as Encounter).visit_id === visit.id && !(item.data as Encounter).superseded_by_id); if (existing) setEncounter(existing.data as Encounter); }).catch(onError); }, [visit.id, visit.patient.id, onError]);
  return <div className="doctor-clinical"><div className="latest-vitals doctor-vitals"><strong>Latest vitals</strong>{vitals[0] ? <><span>BP {vitals[0].blood_pressure_systolic ?? "—"}/{vitals[0].blood_pressure_diastolic ?? "—"}</span><span>{vitals[0].temperature ?? "—"} °C</span><span>Pulse {vitals[0].pulse ?? "—"}</span><span>SpO₂ {vitals[0].spo2 ?? "—"}%</span></> : <small>No vitals recorded</small>}</div>{!encounter ? <><nav className="encounter-section-nav encounter-section-preview" aria-label="Encounter sections"><button type="button" aria-pressed="true" disabled>Clinical notes</button><button type="button" disabled>Pharmacy</button><button type="button" disabled>Laboratory</button></nav><EncounterCreate visitId={visit.id} patientId={visit.patient.id} onCreated={(value) => { setEncounter(value); onStarted(); notify("Encounter started"); }} onError={onError} /></> : <EncounterEditor encounter={encounter} onChange={setEncounter} onFinalized={onFinalized} onError={onError} notify={notify} />}<details className="timeline-details"><summary>Patient timeline <span>{timeline.length} entries</span></summary><Timeline items={timeline} /></details></div>;
}

function EncounterCreate({ visitId, patientId, onCreated, onError }: { visitId: string; patientId: string; onCreated: (encounter: Encounter) => void; onError: (reason: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [symptoms, setSymptoms] = useState(""); const [diagnosis, setDiagnosis] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); try { onCreated(await meditrustApi.createEncounter(visitId, { symptoms: String(data.get("symptoms")), assessment: String(data.get("assessment")), diagnosis: String(data.get("diagnosis")) })); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <form className="clinical-form" onSubmit={submit}><div className="section-title compact"><h3>Start encounter</h3><p>Capture symptoms and your assessment to start a draft. Pharmacy and laboratory sections become available once the draft is created.</p></div><AiSymptomField patientId={patientId} inputId={`new-symptoms-${visitId}`} symptoms={symptoms} onChange={setSymptoms} onApplyDiagnosis={setDiagnosis} rows={3} placeholder="Presenting symptoms and duration" /><label>Assessment<textarea name="assessment" rows={3} required placeholder="Clinical assessment" /></label><label>Diagnosis<input name="diagnosis" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} required placeholder="Working diagnosis" /></label><button className="modal-primary" disabled={busy}>{busy ? "Starting…" : "Start encounter"}</button></form>;
}

function EncounterEditor({ encounter, onChange, onFinalized, onError, notify }: { encounter: Encounter; onChange: (encounter: Encounter) => void; onFinalized: () => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const finalizeDialogRef = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState("notes");
  const sections = [["notes", "Clinical notes"], ["prescriptions", "Pharmacy"], ["labs", "Laboratory"]];
  const formId = `encounter-notes-${encounter.id}`;
  const [busy, setBusy] = useState(false); const [prescriptions, setPrescriptions] = useState<Prescription[]>(encounter.prescriptions ?? []); const [labRequests, setLabRequests] = useState<LabRequest[]>(encounter.lab_requests ?? []);
  const [symptoms, setSymptoms] = useState(encounter.symptoms || ""); const [assessment, setAssessment] = useState(encounter.assessment || ""); const [diagnosis, setDiagnosis] = useState(encounter.diagnosis || "");
  const [notes, setNotes] = useState(encounter.notes || "");
  const dirty = symptoms !== (encounter.symptoms || "") || assessment !== (encounter.assessment || "") || diagnosis !== (encounter.diagnosis || "") || notes !== (encounter.notes || "");
  async function save(finalize: boolean) {
    setBusy(true);
    try {
      const values = { symptoms, assessment, diagnosis, notes };
      const updated = encounter.status === "draft" ? await meditrustApi.updateEncounter(encounter.id, values) : await meditrustApi.amendEncounter(encounter.id, values);
      onChange(updated);
      if (finalize) {
        onChange(await meditrustApi.finalizeEncounter(updated.id));
        finalizeDialogRef.current?.close();
        onFinalized();
        notify("Encounter saved and finalized");
      } else notify(encounter.status === "draft" ? "Draft saved" : "Amendment created");
    } catch (reason) { finalizeDialogRef.current?.close(); onError(reason); } finally { setBusy(false); }
  }
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "finalize") finalizeDialogRef.current?.showModal();
    else void save(false);
  }
  return <div className="encounter-editor">
    <div className="encounter-workflow"><div><p className="eyebrow">Consultation workspace</p><h3>Clinical encounter</h3><p>Document your assessment, review AI insights and plan care.</p></div><span className={`record-status ${encounter.status}`}>{encounter.status}</span></div>
    <nav className="encounter-section-nav" aria-label="Encounter sections">{sections.map(([value, label]) => <button key={value} type="button" aria-pressed={section === value} aria-controls={`encounter-section-${value}-${encounter.id}`} onClick={() => setSection(value)}>{label}{value === "prescriptions" && prescriptions.length > 0 && <span>{prescriptions.length}</span>}{value === "labs" && labRequests.length > 0 && <span>{labRequests.length}</span>}</button>)}</nav>
    <div className="encounter-review-layout encounter-focused-layout" hidden={section !== "notes"}>
    <div id={`encounter-section-notes-${encounter.id}`} hidden={section !== "notes"}><form id={formId} className="clinical-form encounter-form" onSubmit={update} hidden={section !== "notes"} onInvalid={() => setSection("notes")} aria-label="Clinical notes">
      <div className="encounter-form-heading"><span><Icon name="file" size={18} /></span><div><p>Clinical documentation</p><h3>{encounter.status === "draft" ? "Encounter notes" : "Amend encounter"}</h3></div><small className="encounter-save-state" role="status">{busy ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</small></div>
      <fieldset className="encounter-fields" disabled={busy}>
      <div className="encounter-field-grid"><AiSymptomField patientId={encounter.patient_id} inputId={`encounter-symptoms-${encounter.id}`} symptoms={symptoms} onChange={setSymptoms} onApplyDiagnosis={setDiagnosis} rows={5} placeholder="Main concern, onset, duration and associated symptoms" /><label>Clinical assessment<textarea name="assessment" rows={5} value={assessment} onChange={(event) => setAssessment(event.target.value)} required placeholder="Examination findings and your clinical impression" /></label></div>
      <label>Working diagnosis<input name="diagnosis" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} required placeholder="Enter your diagnosis or review an AI suggestion" /><small className="encounter-field-hint">AI suggestions are added only when you choose to use them.</small></label>
      <label>Care plan & clinical notes<textarea name="notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Treatment plan, follow-up instructions and patient advice" /></label>
      </fieldset>

    </form></div>
    </div>
    <section className="clinical-orders-section" hidden={section !== "prescriptions" && section !== "labs"}>
      <div className="clinical-orders-heading"><span><Icon name="sparkles" size={18} /></span><div><p>Next steps</p><h3>Prescription & diagnostic orders</h3><small>Create the patient’s medication and laboratory plan after documenting the encounter.</small></div></div>
      <div className="orders-grid encounter-focused-orders"><div id={`encounter-section-prescriptions-${encounter.id}`} hidden={section !== "prescriptions"}><PrescriptionForm encounterId={encounter.id} items={prescriptions} onCreated={(value) => setPrescriptions((current) => [...current, value])} onUpdated={(value) => setPrescriptions((current) => current.map((item) => item.id === value.id ? value : item))} onError={onError} notify={notify} /></div><div id={`encounter-section-labs-${encounter.id}`} hidden={section !== "labs"}><LabOrderForm encounterId={encounter.id} items={labRequests} onCreated={(value) => setLabRequests((current) => [...current, value])} onUpdated={(value) => setLabRequests((current) => current.map((item) => item.id === value.id ? value : item))} onError={onError} notify={notify} /></div></div>
    </section>
      <div className="encounter-save-bar"><small role="status">{busy ? "Saving…" : dirty ? "Unsaved changes · " : "All changes saved · "}{encounter.status === "draft" ? "Finalizing saves your notes and closes the draft." : "Save your edits as a new amendment."}</small><div className="form-actions"><button form={formId} type="submit" className="secondary-button" disabled={busy}>{busy ? "Saving…" : encounter.status === "draft" ? "Save draft" : "Create amendment"}</button>{encounter.status === "draft" && <button form={formId} type="submit" value="finalize" className="primary-button" disabled={busy}>Save & finalize</button>}</div></div>
      <dialog ref={finalizeDialogRef} className="app-modal confirmation-dialog" aria-labelledby={`finalize-title-${encounter.id}`} aria-describedby={`finalize-description-${encounter.id}`} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <h2 id={`finalize-title-${encounter.id}`}>Finalize this encounter?</h2>
        <p id={`finalize-description-${encounter.id}`}>Your current notes will be saved, the encounter will be finalized, and this visit will move to completed. Review any prescriptions and lab requests before continuing.</p>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => finalizeDialogRef.current?.close()}>Continue editing</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void save(true)}>{busy ? "Finalizing…" : "Save & finalize"}</button>
        </div>
      </dialog>
  </div>;
}

function PrescriptionForm({ encounterId, items, onCreated, onUpdated, onError, notify }: { encounterId: string; items: Prescription[]; onCreated: (value: Prescription) => void; onUpdated: (value: Prescription) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [facilities, setFacilities] = useState<Facility[]>([]); const [busy, setBusy] = useState(false); const [pharmacyByPrescription, setPharmacyByPrescription] = useState<Record<string, string>>({});
  useEffect(() => { meditrustApi.directory("pharmacy").then(setFacilities).catch(onError); }, [onError]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; setBusy(true); const data = new FormData(form); try { onCreated(await meditrustApi.createPrescription(encounterId, { medication_name: String(data.get("medication_name")), dosage: String(data.get("dosage")), frequency: String(data.get("frequency")), duration_days: Number(data.get("duration_days")), instructions: String(data.get("instructions")) })); notify("Prescription issued"); form.reset(); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  async function forward(id: string) { const pharmacyId = pharmacyByPrescription[id]; if (!pharmacyId) return; setBusy(true); try { onUpdated(await meditrustApi.forwardPrescription(id, pharmacyId)); notify("Prescription forwarded to pharmacy"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <div className="order-card prescription-card"><div className="order-card-heading"><span><Icon name="file" size={17} /></span><div><h4>Prescription</h4><p>Medication and dispensing instructions</p></div></div>
    {items.length > 0 && <div className="created-order-list">{items.map((item) => <div className="created-order" key={item.id}><strong>{item.medication_name}</strong><span>{item.dosage} · {item.frequency} · {item.duration_days} days</span>{item.forward_status ? <em>Forwarded · {item.forward_status}</em> : <><select value={pharmacyByPrescription[item.id] || ""} onChange={(event) => setPharmacyByPrescription((current) => ({ ...current, [item.id]: event.target.value }))}><option value="" disabled>Select pharmacy</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><button disabled={busy || !pharmacyByPrescription[item.id]} onClick={() => void forward(item.id)}>Forward to pharmacy</button></>}</div>)}</div>}
    <form onSubmit={submit}><label>Medication<input name="medication_name" required placeholder="e.g. Amoxicillin" /></label><div><label>Dosage<input name="dosage" required placeholder="e.g. 500 mg" /></label><label>Frequency<input name="frequency" required placeholder="e.g. Twice daily" /></label></div><label>Duration<input name="duration_days" type="number" min="1" required placeholder="Number of days" /></label><label>Instructions<input name="instructions" placeholder="Additional instructions (optional)" /></label><button disabled={busy}>{items.length > 0 ? "Add another prescription" : "Issue prescription"}</button></form>
  </div>;
}

function LabOrderForm({ encounterId, items, onCreated, onUpdated, onError, notify }: { encounterId: string; items: LabRequest[]; onCreated: (value: LabRequest) => void; onUpdated: (value: LabRequest) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [facilities, setFacilities] = useState<Facility[]>([]); const [busy, setBusy] = useState(false); const [labByRequest, setLabByRequest] = useState<Record<string, string>>({});
  const [testQuery, setTestQuery] = useState(""); const [selectedTest, setSelectedTest] = useState<LabCatalogItem | null>(null); const [manualTestName, setManualTestName] = useState(""); const [testEntryMode, setTestEntryMode] = useState<"catalog" | "manual">("catalog"); const [suggestions, setSuggestions] = useState<LabCatalogItem[]>([]); const [searchingTests, setSearchingTests] = useState(false); const [testSearchError, setTestSearchError] = useState(""); const [showSuggestions, setShowSuggestions] = useState(false);
  useEffect(() => { meditrustApi.directory("lab").then(setFacilities).catch(onError); }, [onError]);
  useEffect(() => {
    const query = testQuery.trim();
    if (testEntryMode === "manual" || !query || selectedTest?.name === testQuery) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchingTests(true); setTestSearchError("");
      meditrustApi.searchLabCatalog(query).then((results) => { if (active) setSuggestions(results); }).catch(() => { if (active) { setSuggestions([]); setTestSearchError("Unable to load test suggestions. Please try again."); } }).finally(() => { if (active) setSearchingTests(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [testQuery, selectedTest, testEntryMode]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const testName = testEntryMode === "manual" ? manualTestName.trim() : selectedTest?.name; if (!testName) { setTestSearchError(testEntryMode === "manual" ? "Enter the test or investigation name." : "Select a laboratory test from the suggestions before creating the request."); setShowSuggestions(true); return; } const form = event.currentTarget; setBusy(true); const data = new FormData(form); try { onCreated(await meditrustApi.createLabRequest(encounterId, testName, String(data.get("notes")))); notify("Lab request created"); form.reset(); setTestQuery(""); setSelectedTest(null); setManualTestName(""); setSuggestions([]); setShowSuggestions(false); setTestEntryMode("catalog"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  async function forward(id: string) { const labId = labByRequest[id]; if (!labId) return; setBusy(true); try { onUpdated(await meditrustApi.forwardLabRequest(id, labId)); notify("Request forwarded to laboratory"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <div className="order-card laboratory-card"><div className="order-card-heading"><span><Icon name="hospital" size={17} /></span><div><h4>Laboratory request</h4><p>Diagnostic tests and investigations</p></div></div>
    {items.length > 0 && <div className="created-order-list">{items.map((item) => <div className="created-order" key={item.id}><strong>{item.test_name}</strong><span>{item.notes || "No additional notes"}</span><span>Status · {titleCase(item.status)}</span>{item.result && <div className="created-lab-result"><strong>Submitted result</strong>{item.result.result_text && <p>{item.result.result_text}</p>}{item.result.values && Object.keys(item.result.values).length > 0 && <dl>{Object.entries(item.result.values).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || "—"}</dd></div>)}</dl>}{item.result.resulted_at && <small>Reported {formatDate(item.result.resulted_at)}</small>}</div>}{item.forwarded_to_facility_id ? <em>Forwarded to laboratory</em> : <><select value={labByRequest[item.id] || ""} onChange={(event) => setLabByRequest((current) => ({ ...current, [item.id]: event.target.value }))}><option value="" disabled>Select laboratory</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><button disabled={busy || !labByRequest[item.id]} onClick={() => void forward(item.id)}>Forward to laboratory</button></>}</div>)}</div>}
    <form onSubmit={submit}><label>Test or investigation<div className="lab-test-mode"><button type="button" className={testEntryMode === "catalog" ? "selected" : ""} onClick={() => { setTestEntryMode("catalog"); setManualTestName(""); setTestSearchError(""); }}>Search catalog</button><button type="button" className={testEntryMode === "manual" ? "selected" : ""} onClick={() => { setTestEntryMode("manual"); setSelectedTest(null); setSuggestions([]); setSearchingTests(false); setShowSuggestions(false); setTestSearchError(""); }}>Other test</button></div>{testEntryMode === "manual" ? <input name="test_name" value={manualTestName} onChange={(event) => { setManualTestName(event.target.value); setTestSearchError(""); }} required placeholder="Enter a test or investigation" /> : <><div className="lab-test-picker"><input value={testQuery} onChange={(event) => { setTestQuery(event.target.value); setSelectedTest(null); setSuggestions([]); setSearchingTests(false); setTestSearchError(""); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions && (suggestions.length > 0 || searchingTests)} aria-controls={`lab-test-suggestions-${encounterId}`} placeholder="Search laboratory tests, e.g. malaria" autoComplete="off" />{selectedTest && <button type="button" className="lab-test-clear" aria-label="Clear selected test" title="Clear selected test" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedTest(null); setTestQuery(""); setSuggestions([]); setSearchingTests(false); }}><Icon name="x" size={14} /><span>Clear</span></button>}{showSuggestions && (searchingTests || suggestions.length > 0 || testSearchError) && <div id={`lab-test-suggestions-${encounterId}`} className="lab-test-suggestions" role="listbox">{searchingTests ? <p>Searching tests…</p> : testSearchError ? <p className="lab-test-search-error">{testSearchError}</p> : suggestions.map((test) => <button key={test.id} type="button" role="option" aria-selected={selectedTest?.id === test.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedTest(test); setTestQuery(test.name); setSuggestions([]); setSearchingTests(false); setShowSuggestions(false); }}><strong>{test.name}</strong><span>{[test.code, test.category, test.specimen && `${test.specimen} specimen`].filter(Boolean).join(" · ")}</span>{test.aliases.length > 0 && <small>Also known as: {test.aliases.join(", ")}</small>}</button>)}</div>}</div><input name="catalog_test_name" type="hidden" value={selectedTest?.name || ""} /></>}</label><label>Notes<textarea name="notes" rows={3} required placeholder="Clinical context or instructions for the laboratory" /></label><button disabled={busy}>{items.length > 0 ? "Add another lab request" : "Create lab request"}</button></form>
  </div>;
}

function Timeline({ items }: { items: TimelineItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!items.length) return <div className="patient-timeline"><EmptyState title="No timeline entries" body="Clinical activity will appear here." /></div>;
  return <div className="patient-timeline">{items.map((item, index) => {
    const data = item.data as unknown as Record<string, unknown>;
    const key = `${item.type}-${String(data.id || item.at)}-${index}`;
    const open = expanded === key;
    return <article className={`timeline-entry ${open ? "open" : ""}`} key={key}>
      <button className="timeline-entry-button" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : key)}>
        <span className={`timeline-icon ${item.type}`}><Icon name={timelineIcon(item.type)} size={16} /></span>
        <span className="timeline-entry-copy"><span><strong>{timelineTitle(item.type)}</strong>{typeof data.status === "string" && <em className={`record-status ${data.status}`}>{titleCase(data.status)}</em>}</span><small>{formatDate(item.at)}</small><p>{timelineSummary(item.type, data)}</p></span>
        <span className="timeline-expand-icon"><Icon name="chevron" size={16} /></span>
      </button>
      {open && <TimelineDetails item={item} />}
    </article>;
  })}</div>;
}

function TimelineDetails({ item }: { item: TimelineItem }) {
  const data = item.data as unknown as Record<string, unknown>;
  if (item.type === "vitals") return <div className="timeline-details-grid vitals-details">
    <TimelineField label="Blood pressure" value={`${displayValue(data.blood_pressure_systolic)}/${displayValue(data.blood_pressure_diastolic)} mmHg`} />
    <TimelineField label="Temperature" value={`${displayValue(data.temperature)} °C`} />
    <TimelineField label="Pulse" value={`${displayValue(data.pulse)} bpm`} />
    <TimelineField label="Respiratory rate" value={`${displayValue(data.respiratory_rate)} /min`} />
    <TimelineField label="SpO₂" value={`${displayValue(data.spo2)}%`} />
    <TimelineField label="Weight / height" value={`${displayValue(data.weight)} kg · ${displayValue(data.height)} cm`} />
  </div>;

  if (item.type === "encounter") {
    const prescriptions = Array.isArray(data.prescriptions) ? data.prescriptions as Record<string, unknown>[] : [];
    const labRequests = Array.isArray(data.lab_requests) ? data.lab_requests as Record<string, unknown>[] : [];
    return <div className="timeline-expanded-content">
      <div className="timeline-details-grid"><TimelineField label="Symptoms" value={displayValue(data.symptoms)} wide /><TimelineField label="Assessment" value={displayValue(data.assessment)} wide /><TimelineField label="Diagnosis" value={displayValue(data.diagnosis)} /><TimelineField label="Notes" value={displayValue(data.notes)} wide /><TimelineField label="Finalized" value={data.finalized_at ? formatDate(String(data.finalized_at)) : "Not finalized"} /></div>
      {prescriptions.length > 0 && <div className="timeline-nested-orders"><strong>Prescriptions from this encounter</strong>{prescriptions.map((prescription, index) => <div key={String(prescription.id || index)}><span><b>{displayValue(prescription.medication_name)}</b><small>{displayValue(prescription.dosage)} · {displayValue(prescription.frequency)} · {displayValue(prescription.duration_days)} days</small></span><em>{displayValue(prescription.forward_status || prescription.status)}</em></div>)}</div>}
      {labRequests.length > 0 && <div className="timeline-nested-orders"><strong>Lab requests from this encounter</strong>{labRequests.map((labRequest, index) => <div key={String(labRequest.id || index)}><span><b>{displayValue(labRequest.test_name)}</b><small>{displayValue(labRequest.notes)}</small></span><em>{displayValue(labRequest.status)}</em></div>)}</div>}
    </div>;
  }

  if (item.type === "prescription") return <div className="timeline-details-grid">
    <TimelineField label="Medication" value={displayValue(data.medication_name)} />
    <TimelineField label="Dosage" value={displayValue(data.dosage)} />
    <TimelineField label="Frequency" value={displayValue(data.frequency)} />
    <TimelineField label="Duration" value={`${displayValue(data.duration_days)} days`} />
    <TimelineField label="Instructions" value={displayValue(data.instructions)} wide />
    <TimelineField label="Forward status" value={displayValue(data.forward_status)} />
  </div>;

  if (item.type === "lab_request") return <div className="timeline-details-grid">
    <TimelineField label="Test or investigation" value={displayValue(data.test_name)} wide />
    <TimelineField label="Laboratory notes" value={displayValue(data.notes)} wide />
    <TimelineField label="Status" value={displayValue(data.status)} />
    <TimelineField label="Forwarded" value={data.forwarded_to_facility_id ? "Yes" : "Not yet"} />
  </div>;

  return <div className="timeline-details-grid">{Object.entries(data).filter(([, value]) => typeof value !== "object").slice(0, 8).map(([label, value]) => <TimelineField key={label} label={titleCase(label)} value={displayValue(value)} />)}</div>;
}

function AiSymptomField({ patientId, inputId, symptoms, onChange, onApplyDiagnosis, rows, placeholder }: { patientId: string; inputId: string; symptoms: string; onChange: (value: string) => void; onApplyDiagnosis: (value: string) => void; rows: number; placeholder: string }) {
  const [suggestion, setSuggestion] = useState<AiDiagnosisSuggestion>();
  const [requestedSymptoms, setRequestedSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stale = !!suggestion && requestedSymptoms !== symptoms.trim();

  async function requestSuggestion() {
    const currentSymptoms = symptoms.trim();
    if (currentSymptoms.length < 3) return;
    setLoading(true); setError(""); setSuggestion(undefined); setRequestedSymptoms(currentSymptoms);
    try { setSuggestion(await meditrustApi.getAiDiagnosisSuggestion(patientId, currentSymptoms)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to generate the AI suggestion."); }
    finally { setLoading(false); }
  }

  return <div className="symptom-ai-field">
    <div className="symptom-ai-heading"><label htmlFor={inputId}>Presenting symptoms</label><button type="button" onClick={() => void requestSuggestion()} disabled={loading || symptoms.trim().length < 3}><Icon name="sparkles" size={16} />{loading ? "Getting AI help…" : suggestion ? "Regenerate AI suggestion" : "Get AI suggestion"}</button></div>
    <textarea id={inputId} name="symptoms" rows={rows} value={symptoms} onChange={(event) => onChange(event.target.value)} required placeholder={placeholder} />
    {(loading || error || suggestion) && <AiDiagnosisPanel suggestion={suggestion} loading={loading} error={error} stale={stale} onApplyDiagnosis={onApplyDiagnosis} />}
  </div>;
}

function AiDiagnosisPanel({ suggestion, loading, error, stale, onApplyDiagnosis }: { suggestion?: AiDiagnosisSuggestion; loading: boolean; error: string; stale: boolean; onApplyDiagnosis: (diagnosis: string) => void }) {
  return <section className="ai-diagnosis-section">
    <header className="ai-diagnosis-heading">
      <span className="ai-diagnosis-icon"><Icon name="sparkles" size={17} /></span>
      <div><strong>AI diagnosis suggestion</strong><small>Based on the symptoms entered and the latest patient data</small></div>
    </header>
    {stale && <p className="encounter-ai-stale" role="status">The symptoms have changed. Regenerate the suggestion before using it.</p>}
    {loading && <div className="ai-diagnosis-loading" role="status" aria-live="polite">
      <div className="ai-loading-status"><span className="ai-loading-pulse"><Icon name="sparkles" size={15} /></span><p><strong>Generating clinical insights</strong><span>Reviewing symptoms and the latest patient data. This may take a moment.</span></p></div>
      <div className="ai-shimmer-summary"><span className="ai-shimmer-line short" /><span className="ai-shimmer-line" /><span className="ai-shimmer-line" /><span className="ai-shimmer-line medium" /></div>
      <div className="ai-shimmer-grid"><div><span className="ai-shimmer-line short" /><span className="ai-shimmer-line" /><span className="ai-shimmer-line medium" /></div><div><span className="ai-shimmer-line short" /><span className="ai-shimmer-line" /><span className="ai-shimmer-line medium" /></div></div>
      <span className="sr-only">AI diagnosis suggestion is loading.</span>
    </div>}
    {error && <div className="ai-diagnosis-error"><strong>Suggestion unavailable</strong><span>{error}</span></div>}
    {suggestion && !loading && <div className="ai-diagnosis-result">
      <div className="ai-diagnosis-meta"><span>Generated by {suggestion.model}</span><span>{formatDate(suggestion.generated_at)}</span></div>
      {suggestion.diagnosis && <div className="ai-diagnosis-summary ai-diagnosis-working"><strong>Working diagnosis</strong><p>{suggestion.diagnosis}</p><button type="button" className="secondary-button" disabled={stale} onClick={() => onApplyDiagnosis(suggestion.diagnosis)}>Use this diagnosis</button></div>}
      <div className="ai-diagnosis-summary"><strong>Clinical summary</strong><p>{suggestion.summary}</p></div>
      <div className="ai-diagnosis-block"><strong>Differential diagnoses</strong><div className="ai-differentials">{suggestion.differential_diagnoses.map((item, index) => <article key={`${item.condition}-${index}`}><div><b>{item.condition}</b><em className={`ai-likelihood ${item.likelihood.toLowerCase()}`}>{titleCase(item.likelihood)}</em></div><p>{item.reasoning}</p></article>)}</div></div>
      <div className="ai-diagnosis-columns">
        <div className="ai-diagnosis-block ai-red-flags"><strong>Red flags</strong><ul>{suggestion.red_flags.map((flag, index) => <li key={`${flag}-${index}`}>{flag}</li>)}</ul></div>
        <div className="ai-diagnosis-block ai-next-steps"><strong>Recommended next steps</strong><ol>{suggestion.recommended_next_steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol></div>
      </div>
      <div className="ai-disclaimer"><Icon name="help" size={16} /><p><strong>Clinician review required</strong><span>{suggestion.disclaimer}</span></p></div>
    </div>}
  </section>;
}

function TimelineField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "wide" : ""}><span>{label}</span><strong>{value}</strong></div>;
}

function timelineTitle(type: string) {
  return type === "lab_request" ? "Laboratory request" : type === "prescription" ? "Prescription" : type === "encounter" ? "Clinical encounter" : type === "vitals" ? "Vital signs" : titleCase(type);
}

function timelineSummary(type: string, data: Record<string, unknown>) {
  if (type === "lab_request") return `${displayValue(data.test_name)}${data.notes ? ` · ${displayValue(data.notes)}` : ""}`;
  if (type === "prescription") return `${displayValue(data.medication_name)} · ${displayValue(data.dosage)} · ${displayValue(data.frequency)}`;
  if (type === "encounter") return displayValue(data.diagnosis || data.assessment || "Clinical encounter");
  if (type === "vitals") return `BP ${displayValue(data.blood_pressure_systolic)}/${displayValue(data.blood_pressure_diastolic)} · ${displayValue(data.temperature)} °C · SpO₂ ${displayValue(data.spo2)}%`;
  return "Clinical record";
}

function timelineIcon(type: string): IconName {
  return type === "vitals" ? "trend" : type === "lab_request" ? "hospital" : "file";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value).replace(/_/g, " ");
}

function VisitRow({ visit, position, selected, onClick }: { visit: Visit; position: number; selected?: boolean; onClick: () => void }) { return <button className={`visit-row ${selected ? "selected" : ""}`} onClick={onClick}><span className="queue-number">{position}</span><PatientAvatar patient={visit.patient} /><span><strong>{visit.patient.name}</strong><small>{visit.patient.digital_health_id} · {ageFromDob(visit.patient.dob)} yrs · {visit.patient.sex} · {titleCase(visit.status)}</small></span><span className="wait-time"><strong>{formatTime(visit.checked_in_at)}</strong><small>Checked in</small></span><Icon name="chevron" size={17} /></button>; }
function PatientAvatar({ patient, large = false }: { patient: PatientSummary; large?: boolean }) { return <div className={`avatar blue ${large ? "large" : ""}`}>{initialsOf(patient.name)}</div>; }
function initialsOf(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function WorkspaceHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <header className="workspace-header role-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function FullRecordButton({ onClick }: { onClick: () => void }) { return <button type="button" className="secondary-button pfr-open-record" onClick={onClick}><Icon name="file" size={16} />Full record</button>; }
function LoadingState() { return <div className="role-loading"><span className="spinner" />Loading current records…</div>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state role-empty"><Icon name="hospital" /><strong>{title}</strong><span>{body}</span></div>; }
function isLabRole(role: StaffRole) { return role === "lab" || role === "lab_tech"; }
function isPharmacyRole(role: StaffRole) { return role === "pharmacy" || role === "pharmacist"; }
function isFinanceRole(role: StaffRole) { return role === "finance"; }
function firstName(name: string) { return name.replace(/^Dr\.\s*/i, "").split(" ")[0]; }
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dayPeriod() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"; }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value)); }
