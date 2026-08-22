"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ApiError, ageFromDob, clearSession, formatDate, loadSession, meditrustApi,
  type Encounter, type Facility, type LabRequest, type PatientSummary,
  type Prescription, type Session, type StaffRole, type TimelineItem,
  type Visit, type Vitals,
} from "../lib/meditrust";
import { Icon, type IconName } from "./icons";
import { LabTechWorkspace, PharmacyWorkspace } from "./ancillary-workspaces";

type NavItem = { label: string; icon: IconName };
type DoctorQueueFilter = "active" | "waiting" | "vitals_done" | "with_doctor" | "completed" | "cancelled";

const doctorQueueFilters: { value: DoctorQueueFilter; label: string }[] = [
  { value: "active", label: "Active queue" },
  { value: "waiting", label: "Waiting" },
  { value: "vitals_done", label: "Vitals done" },
  { value: "with_doctor", label: "With doctor" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const navigation: Record<StaffRole, NavItem[]> = {
  reception: [{ label: "Overview", icon: "grid" }, { label: "Patient check-in", icon: "userPlus" }, { label: "Visit queue", icon: "clock" }],
  nurse: [{ label: "Overview", icon: "grid" }, { label: "Visit queue", icon: "clock" }],
  doctor: [{ label: "Overview", icon: "grid" }, { label: "Visit queue", icon: "clock" }, { label: "Patient search", icon: "search" }],
  pharmacy: [{ label: "Overview", icon: "grid" }],
  pharmacist: [{ label: "Overview", icon: "grid" }],
  lab: [{ label: "Overview", icon: "grid" }],
  lab_tech: [{ label: "Overview", icon: "grid" }],
};

const roleLabels: Record<StaffRole, string> = { reception: "Reception", nurse: "Nursing", doctor: "Doctor", pharmacy: "Pharmacy", pharmacist: "Pharmacy", lab: "Laboratory", lab_tech: "Lab technician" };

export function DashboardApp() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [queue, setQueue] = useState<Visit[]>([]);
  const [doctorQueueFilter, setDoctorQueueFilter] = useState<DoctorQueueFilter>("active");
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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
    if (!facilityId || !role || isPharmacyRole(role) || isLabRole(role)) return;
    setQueueLoading(true); setError("");
    try {
      const statuses = role === "doctor"
        ? doctorQueueFilter === "active" ? ["waiting", "vitals_done"] : [doctorQueueFilter]
        : ["waiting"];
      const results = await Promise.all(statuses.map((status) => meditrustApi.listVisits(facilityId, status)));
      const visits = Array.from(new Map(results.flat().map((visit) => [visit.id, visit])).values())
        .sort((left, right) => new Date(left.checked_in_at).getTime() - new Date(right.checked_in_at).getTime());
      setQueue(visits);
      setSelectedVisit((current) => current ? visits.find((visit) => visit.id === current.id) || null : null);
    } catch (reason) { reportError(reason); }
    finally { setQueueLoading(false); }
  }, [doctorQueueFilter, facilityId, role, reportError]);

  useEffect(() => { void Promise.resolve().then(refreshQueue); }, [refreshQueue]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession(); router.replace("/login");
  }

  function navigate(label: string) { setActive(label); setSelectedVisit(null); setError(""); setMenuOpen(false); }

  if (!authReady || !session || !role || !facilityId) return <div className="auth-loader"><span className="spinner" />Loading secure workspace…</div>;

  const initials = session.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const navItems = navigation[role];

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
      <nav className="nav-group" aria-label="Main navigation"><p className="nav-label">Workspace</p>{navItems.map((item) => <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => navigate(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Visit queue" && queue.length > 0 && <b>{queue.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="doctor-card"><div className="avatar avatar-dark">{initials}</div><div><strong>{session.user.name}</strong><span>{roleLabels[role]} · {session.user.facility_staff.staff_code}</span></div></div><button className="logout-button sidebar-logout" onClick={logout}>Sign out securely</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar role-topbar"><div><span className="topbar-role">{facility?.name || `${roleLabels[role]} workspace`}</span><strong>{session.user.name} · {roleLabels[role]}</strong></div><div className="top-actions"><button className="icon-button" onClick={() => { void refreshFacility(); void refreshQueue(); }} aria-label="Refresh workspace"><Icon name="trend" /></button><span className="avatar avatar-small">{initials}</span></div></header>
      <div className="dashboard role-dashboard">
        {error && <div className="workspace-error" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {active === "Overview" && !isPharmacyRole(role) && !isLabRole(role) && <RoleOverview session={session} facility={facility} queue={queue} loading={queueLoading} onNavigate={navigate} onSelect={(visit) => { setSelectedVisit(visit); setActive("Visit queue"); }} />}
        {(active === "Patient check-in" || active === "Patient search") && <PatientSearch role={role} facilityId={facilityId} onCheckedIn={(visit) => { setQueue((current) => [visit, ...current.filter((item) => item.id !== visit.id)]); notify(`${visit.patient.name} checked in`); }} onError={reportError} />}
        {active === "Visit queue" && <VisitQueue role={role} statusFilter={doctorQueueFilter} onStatusFilterChange={setDoctorQueueFilter} visits={queue} loading={queueLoading} selected={selectedVisit} onSelect={setSelectedVisit} onRefresh={refreshQueue} onVisitChanged={(visit) => { const visibleStatuses = role === "doctor" ? doctorQueueFilter === "active" ? ["waiting", "vitals_done"] : [doctorQueueFilter] : ["waiting"]; const remainsVisible = visibleStatuses.includes(visit.status as DoctorQueueFilter); setQueue((current) => remainsVisible ? current.map((item) => item.id === visit.id ? visit : item) : current.filter((item) => item.id !== visit.id)); setSelectedVisit(remainsVisible ? visit : null); notify(`Visit marked ${visit.status}`); }} onError={reportError} notify={notify} />}
        {isLabRole(role) && active === "Overview" && <LabTechWorkspace facilityId={facilityId} onError={reportError} notify={notify} />}
        {isPharmacyRole(role) && active === "Overview" && <PharmacyWorkspace facilityId={facilityId} onError={reportError} notify={notify} />}
      </div>
    </main>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => navigate(item.label)}><span><Icon name={item.icon} size={20} />{item.label === "Visit queue" && queue.length > 0 && <i />}</span><small>{item.label.replace("Patient ", "")}</small></button>)}<button onClick={() => setMenuOpen(true)}><span><Icon name="more" size={20} /></span><small>More</small></button></nav>
    {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
  </div>;
}

function RoleOverview({ session, facility, queue, loading, onNavigate, onSelect }: { session: Session; facility: Facility | null; queue: Visit[]; loading: boolean; onNavigate: (label: string) => void; onSelect: (visit: Visit) => void }) {
  const role = session.user.facility_staff.role;
  if (isPharmacyRole(role) || isLabRole(role)) return null;
  const actionLabel = role === "reception" ? "Patient check-in" : "Visit queue";
  return <><section className="welcome-row"><div><p className="eyebrow">{new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1>Good {dayPeriod()}, {firstName(session.user.name)}</h1><p className="subtext">{facility ? `${facility.name}${facility.address ? ` · ${facility.address}` : ""}` : role === "reception" ? "Manage arrivals and keep today’s patient flow moving." : role === "nurse" ? "Review waiting patients and capture accurate triage observations." : "Review the clinical queue and continue patient care."}</p></div><button className="primary-button" onClick={() => onNavigate(actionLabel)}><Icon name={role === "reception" ? "userPlus" : "clock"} size={18} />{role === "reception" ? "Find & check in patient" : role === "nurse" ? "Open triage queue" : "Open consultation queue"}</button></section>
    <section className="stats-grid role-stats"><article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="clock" /></span><span className="unread-chip">Live</span></div><strong>{loading ? "—" : queue.length}</strong><p>Patients waiting</p><span className="stat-note">{facility?.name || "Current facility queue"}</span></article><article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="hospital" /></span></div><strong>{session.user.facility_staff.staff_code}</strong><p>Staff code</p><span className="stat-note">{roleLabels[role]} access</span></article><article className="stat-card"><div className="stat-top"><span className="stat-icon purple"><Icon name="check" /></span></div><strong>{facility?.status ? titleCase(facility.status) : "Active"}</strong><p>Facility status</p><span className="stat-note">{facility ? titleCase(facility.type) : "Facility-scoped access"}</span></article></section>
    <section className="panel queue-preview"><div className="panel-heading"><div><h2>Waiting queue</h2><p>Patients checked in and ready for the next step</p></div><button className="text-button" onClick={() => onNavigate("Visit queue")}>View all <Icon name="arrow" size={16} /></button></div><div className="visit-list">{loading ? <LoadingState /> : queue.length ? queue.slice(0, 5).map((visit, index) => <VisitRow key={visit.id} visit={visit} position={index + 1} onClick={() => onSelect(visit)} />) : <EmptyState title="No patients waiting" body="The queue is clear right now." />}</div></section></>;
}

function PatientSearch({ role, facilityId, onCheckedIn, onError }: { role: StaffRole; facilityId: string; onCheckedIn: (visit: Visit) => void; onError: (reason: unknown) => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<PatientSummary[]>([]); const [selected, setSelected] = useState<PatientSummary | null>(null); const [loading, setLoading] = useState(false); const [checkingIn, setCheckingIn] = useState(false); const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!query.trim()) return; setLoading(true); setSelected(null); setTimeline([]); try { setResults(await meditrustApi.searchPatients(query.trim())); } catch (reason) { onError(reason); } finally { setLoading(false); } }
  async function choose(patient: PatientSummary) { setSelected(patient); if (role === "doctor") { try { setTimeline(await meditrustApi.getTimeline(patient.id)); } catch (reason) { onError(reason); } } }
  async function checkIn() { if (!selected) return; setCheckingIn(true); try { onCheckedIn(await meditrustApi.checkIn(facilityId, selected.digital_health_id)); } catch (reason) { onError(reason); } finally { setCheckingIn(false); } }
  return <section className="role-workspace"><WorkspaceHeading eyebrow={role === "reception" ? "Front desk" : "Clinical records"} title={role === "reception" ? "Find and check in a patient" : "Patient search"} description={role === "reception" ? "Search by Digital Health ID or patient name, then confirm the patient before check-in." : "Find a patient and review their longitudinal clinical timeline."} />
    <form className="patient-search-form" onSubmit={search}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digital Health ID or patient name" aria-label="Patient search" /><button className="primary-button" disabled={loading}>{loading ? "Searching…" : "Search"}</button></form>
    <div className="search-workspace-grid"><div className="data-panel search-patient-list"><div className="data-toolbar"><strong>Search results</strong><span>{results.length} found</span></div>{loading ? <LoadingState /> : results.length ? results.map((patient) => <button key={patient.id} className={`patient-result ${selected?.id === patient.id ? "selected" : ""}`} onClick={() => void choose(patient)}><PatientAvatar patient={patient} /><span><strong>{patient.name}</strong><small>{patient.digital_health_id} · {ageFromDob(patient.dob)} years · {patient.sex}</small></span><Icon name="chevron" /></button>) : <EmptyState title="Search for a patient" body="Results will appear here." />}</div>
      <div className="panel patient-selection">{selected ? <><div className="selected-patient-head"><PatientAvatar patient={selected} large /><div><span>Patient confirmed</span><h2>{selected.name}</h2><p>{selected.digital_health_id}</p></div></div><dl className="patient-facts"><div><dt>Date of birth</dt><dd>{selected.dob}</dd></div><div><dt>Sex</dt><dd>{selected.sex}</dd></div><div><dt>Phone</dt><dd>{selected.phone || "Not provided"}</dd></div></dl>{role === "reception" ? <button className="modal-primary" disabled={checkingIn} onClick={checkIn}>{checkingIn ? "Checking in…" : "Confirm patient check-in"} <Icon name="arrow" size={17} /></button> : <Timeline items={timeline} />}</> : <EmptyState title="Select a patient" body="Confirm the correct record before continuing." />}</div></div>
  </section>;
}

function VisitQueue({ role, statusFilter, onStatusFilterChange, visits, loading, selected, onSelect, onRefresh, onVisitChanged, onError, notify }: { role: StaffRole; statusFilter: DoctorQueueFilter; onStatusFilterChange: (status: DoctorQueueFilter) => void; visits: Visit[]; loading: boolean; selected: Visit | null; onSelect: (visit: Visit | null) => void; onRefresh: () => Promise<void>; onVisitChanged: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const filterLabel = doctorQueueFilters.find((filter) => filter.value === statusFilter)?.label || "Queue";
  return <section className="role-workspace"><WorkspaceHeading eyebrow="Live patient flow" title="Visit queue" description={role === "reception" ? "Monitor checked-in patients and manage front-desk exceptions." : role === "nurse" ? "Select a waiting patient to record their vitals." : "Review active visits or filter the queue by clinical status."} action={<div className="queue-toolbar-actions">{role === "doctor" && <label><span>Visit status</span><select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as DoctorQueueFilter)} disabled={loading}>{doctorQueueFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>}<button className="secondary-button" onClick={() => void onRefresh()} disabled={loading}><Icon name="trend" size={17} />Refresh</button></div>} />
    <div className="queue-workspace-grid"><div className="data-panel queue-list"><div className="data-toolbar"><strong>{visits.length} {role === "doctor" ? filterLabel.toLowerCase() : "waiting"}</strong><span>Oldest first</span></div>{loading ? <LoadingState /> : visits.length ? visits.map((visit, index) => <VisitRow key={visit.id} visit={visit} position={index + 1} selected={selected?.id === visit.id} onClick={() => onSelect(visit)} />) : <EmptyState title={`No ${role === "doctor" ? filterLabel.toLowerCase() : "waiting"} visits`} body="No visits match the selected status." />}</div><div className="panel visit-detail-panel">{selected ? <VisitDetail key={selected.id} role={role} visit={selected} onVisitChanged={onVisitChanged} onError={onError} notify={notify} /> : <EmptyState title="Select a visit" body="Patient information and available actions will appear here." />}</div></div>
  </section>;
}

function VisitDetail({ role, visit, onVisitChanged, onError, notify }: { role: StaffRole; visit: Visit; onVisitChanged: (visit: Visit) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function changeStatus(status: "cancelled" | "completed") { setBusy(true); try { onVisitChanged(await meditrustApi.updateVisitStatus(visit.id, status)); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <><div className="visit-patient-head"><PatientAvatar patient={visit.patient} large /><div><span className={`record-status ${visit.status}`}>{titleCase(visit.status)}</span><h2>{visit.patient.name}</h2><p>{visit.patient.digital_health_id}</p></div></div><dl className="patient-facts"><div><dt>Age / sex</dt><dd>{ageFromDob(visit.patient.dob)} · {visit.patient.sex}</dd></div><div><dt>Checked in</dt><dd>{formatDate(visit.checked_in_at)}</dd></div><div><dt>Phone</dt><dd>{visit.patient.phone || "Not provided"}</dd></div></dl>
    {role === "reception" && <div className="visit-actions"><p>Front desk actions</p><button className="danger-outline" disabled={busy} onClick={() => void changeStatus("cancelled")}>Cancel visit</button></div>}
    {role === "nurse" && <VitalsForm visit={visit} onError={onError} notify={notify} />}
    {role === "doctor" && (visit.status === "completed" || visit.status === "cancelled" ? <div className="historical-visit-note"><Icon name={visit.status === "completed" ? "check" : "x"} /><strong>{titleCase(visit.status)} visit</strong><span>This visit is read-only and no longer accepts clinical actions.</span></div> : <DoctorWorkspace visit={visit} onComplete={() => void changeStatus("completed")} completing={busy} onError={onError} notify={notify} />)}
  </>;
}

function VitalsForm({ visit, onError, notify }: { visit: Visit; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [saving, setSaving] = useState(false); const [history, setHistory] = useState<Vitals[]>([]);
  useEffect(() => { meditrustApi.getVitals(visit.patient.id).then(setHistory).catch(onError); }, [visit.patient.id, onError]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = event.currentTarget; const data = new FormData(form); const value = (name: string) => Number(data.get(name)); try { const recorded = await meditrustApi.recordVitals(visit.id, { blood_pressure_systolic: value("systolic"), blood_pressure_diastolic: value("diastolic"), temperature: value("temperature"), pulse: value("pulse"), respiratory_rate: value("respiratory_rate"), spo2: value("spo2"), weight: value("weight"), height: value("height") }); setHistory((current) => [recorded, ...current]); notify("Vitals recorded successfully"); form.reset(); } catch (reason) { onError(reason); } finally { setSaving(false); } }
  const fields = [["systolic", "Systolic", "mmHg"], ["diastolic", "Diastolic", "mmHg"], ["temperature", "Temperature", "°C"], ["pulse", "Pulse", "bpm"], ["respiratory_rate", "Resp. rate", "/min"], ["spo2", "SpO₂", "%"], ["weight", "Weight", "kg"], ["height", "Height", "cm"]];
  return <div className="clinical-section"><div className="section-title compact"><h3>Record vitals</h3><p>All fields are required.</p></div><form className="vitals-form" onSubmit={submit}>{fields.map(([name, label, unit]) => <label key={name}>{label}<span><input name={name} type="number" step={["temperature", "weight", "height"].includes(name) ? "0.1" : "1"} min="0" required /><small>{unit}</small></span></label>)}<button className="modal-primary" disabled={saving}>{saving ? "Saving…" : "Record vitals"}</button></form>{history[0] && <div className="latest-vitals"><strong>Latest observations</strong><span>BP {history[0].blood_pressure_systolic}/{history[0].blood_pressure_diastolic}</span><span>{history[0].temperature} °C</span><span>SpO₂ {history[0].spo2}%</span><small>{formatDate(history[0].recorded_at)}</small></div>}</div>;
}

function DoctorWorkspace({ visit, onComplete, completing, onError, notify }: { visit: Visit; onComplete: () => void; completing: boolean; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [vitals, setVitals] = useState<Vitals[]>([]); const [timeline, setTimeline] = useState<TimelineItem[]>([]); const [encounter, setEncounter] = useState<Encounter | null>(null);
  useEffect(() => { Promise.all([meditrustApi.getVitals(visit.patient.id), meditrustApi.getTimeline(visit.patient.id)]).then(([v, t]) => { setVitals(v); setTimeline(t); const existing = t.find((item) => item.type === "encounter" && (item.data as Encounter).visit_id === visit.id && !(item.data as Encounter).superseded_by_id); if (existing) setEncounter(existing.data as Encounter); }).catch(onError); }, [visit.id, visit.patient.id, onError]);
  return <div className="doctor-clinical"><div className="latest-vitals doctor-vitals"><strong>Latest vitals</strong>{vitals[0] ? <><span>BP {vitals[0].blood_pressure_systolic}/{vitals[0].blood_pressure_diastolic}</span><span>{vitals[0].temperature} °C</span><span>Pulse {vitals[0].pulse}</span><span>SpO₂ {vitals[0].spo2}%</span></> : <small>No vitals recorded</small>}</div>{!encounter ? <EncounterCreate visitId={visit.id} onCreated={(value) => { setEncounter(value); notify("Encounter started"); }} onError={onError} /> : <EncounterEditor encounter={encounter} onChange={setEncounter} onError={onError} notify={notify} />}<details className="timeline-details"><summary>Patient timeline <span>{timeline.length} entries</span></summary><Timeline items={timeline} /></details>{encounter?.status === "finalized" && <button className="modal-primary complete-visit" disabled={completing} onClick={onComplete}>{completing ? "Completing…" : "Complete patient visit"} <Icon name="check" size={17} /></button>}</div>;
}

function EncounterCreate({ visitId, onCreated, onError }: { visitId: string; onCreated: (encounter: Encounter) => void; onError: (reason: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); try { onCreated(await meditrustApi.createEncounter(visitId, { symptoms: String(data.get("symptoms")), assessment: String(data.get("assessment")), diagnosis: String(data.get("diagnosis")) })); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <form className="clinical-form" onSubmit={submit}><div className="section-title compact"><h3>Start encounter</h3><p>Capture the initial clinical assessment.</p></div><label>Symptoms<textarea name="symptoms" rows={3} required placeholder="Presenting symptoms and duration" /></label><label>Assessment<textarea name="assessment" rows={3} required placeholder="Clinical assessment" /></label><label>Diagnosis<input name="diagnosis" required placeholder="Working diagnosis" /></label><button className="modal-primary" disabled={busy}>{busy ? "Starting…" : "Start encounter"}</button></form>;
}

function EncounterEditor({ encounter, onChange, onError, notify }: { encounter: Encounter; onChange: (encounter: Encounter) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false); const [prescription, setPrescription] = useState<Prescription | null>(null); const [labRequest, setLabRequest] = useState<LabRequest | null>(null);
  async function update(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); const values = { symptoms: String(data.get("symptoms")), assessment: String(data.get("assessment")), diagnosis: String(data.get("diagnosis")), notes: String(data.get("notes")) }; try { const updated = encounter.status === "draft" ? await meditrustApi.updateEncounter(encounter.id, values) : await meditrustApi.amendEncounter(encounter.id, values); onChange(updated); notify(encounter.status === "draft" ? "Draft saved" : "Amendment created"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  async function finalize() { setBusy(true); try { onChange(await meditrustApi.finalizeEncounter(encounter.id)); notify("Encounter finalized"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <div className="encounter-editor">
    <form className="clinical-form encounter-form" onSubmit={update}>
      <div className="encounter-form-heading"><span><Icon name="file" size={18} /></span><div><p>Clinical documentation</p><h3>{encounter.status === "draft" ? "Encounter draft" : "Finalized encounter"}</h3></div><span className={`record-status ${encounter.status}`}>{encounter.status}</span></div>
      <div className="encounter-field-grid"><label>Symptoms<textarea name="symptoms" rows={3} defaultValue={encounter.symptoms || ""} required /></label><label>Assessment<textarea name="assessment" rows={3} defaultValue={encounter.assessment || ""} required /></label></div>
      <label>Diagnosis<input name="diagnosis" defaultValue={encounter.diagnosis || ""} required /></label>
      <label>Clinical notes<textarea name="notes" rows={3} defaultValue={encounter.notes || ""} placeholder="Treatment plan, follow-up instructions and patient advice" /></label>
      <div className="form-actions"><button className="secondary-button" disabled={busy}>{encounter.status === "draft" ? "Save draft" : "Create amendment"}</button>{encounter.status === "draft" && <button type="button" className="primary-button" disabled={busy} onClick={() => void finalize()}>Finalize encounter</button>}</div>
    </form>
    <section className="clinical-orders-section">
      <div className="clinical-orders-heading"><span><Icon name="sparkles" size={18} /></span><div><p>Next steps</p><h3>Prescription & diagnostic orders</h3><small>Create the patient’s medication and laboratory plan after documenting the encounter.</small></div></div>
      <div className="orders-grid"><PrescriptionForm encounterId={encounter.id} value={prescription} onCreated={setPrescription} onError={onError} notify={notify} /><LabOrderForm encounterId={encounter.id} value={labRequest} onCreated={setLabRequest} onError={onError} notify={notify} /></div>
    </section>
  </div>;
}

function PrescriptionForm({ encounterId, value, onCreated, onError, notify }: { encounterId: string; value: Prescription | null; onCreated: (value: Prescription) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [facilities, setFacilities] = useState<Facility[]>([]); const [busy, setBusy] = useState(false); const [selectedFacility, setSelectedFacility] = useState("");
  useEffect(() => { meditrustApi.directory("pharmacy").then(setFacilities).catch(onError); }, [onError]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); try { onCreated(await meditrustApi.createPrescription(encounterId, { medication_name: String(data.get("medication_name")), dosage: String(data.get("dosage")), frequency: String(data.get("frequency")), duration_days: Number(data.get("duration_days")), instructions: String(data.get("instructions")) })); notify("Prescription issued"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  async function forward(id: string) { if (!selectedFacility) return; setBusy(true); try { onCreated(await meditrustApi.forwardPrescription(id, selectedFacility)); notify("Prescription forwarded to pharmacy"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <div className="order-card prescription-card"><div className="order-card-heading"><span><Icon name="file" size={17} /></span><div><h4>Prescription</h4><p>Medication and dispensing instructions</p></div></div>{!value ? <form onSubmit={submit}><label>Medication<input name="medication_name" required placeholder="e.g. Amoxicillin" /></label><div><label>Dosage<input name="dosage" required placeholder="e.g. 500 mg" /></label><label>Frequency<input name="frequency" required placeholder="e.g. Twice daily" /></label></div><label>Duration<input name="duration_days" type="number" min="1" required placeholder="Number of days" /></label><label>Instructions<input name="instructions" placeholder="Additional instructions (optional)" /></label><button disabled={busy}>Issue prescription</button></form> : <div className="created-order"><strong>{value.medication_name}</strong><span>{value.dosage} · {value.frequency} · {value.duration_days} days</span>{value.forward_status ? <em>Forwarded · {value.forward_status}</em> : <><select value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)}><option value="" disabled>Select pharmacy</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><button disabled={busy || !selectedFacility} onClick={() => void forward(value.id)}>Forward to pharmacy</button></>}</div>}</div>;
}

function LabOrderForm({ encounterId, value, onCreated, onError, notify }: { encounterId: string; value: LabRequest | null; onCreated: (value: LabRequest) => void; onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [facilities, setFacilities] = useState<Facility[]>([]); const [busy, setBusy] = useState(false); const [selectedFacility, setSelectedFacility] = useState("");
  useEffect(() => { meditrustApi.directory("lab").then(setFacilities).catch(onError); }, [onError]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget); try { onCreated(await meditrustApi.createLabRequest(encounterId, String(data.get("test_name")), String(data.get("notes")))); notify("Lab request created"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  async function forward(id: string) { if (!selectedFacility) return; setBusy(true); try { onCreated(await meditrustApi.forwardLabRequest(id, selectedFacility)); notify("Request forwarded to laboratory"); } catch (reason) { onError(reason); } finally { setBusy(false); } }
  return <div className="order-card laboratory-card"><div className="order-card-heading"><span><Icon name="hospital" size={17} /></span><div><h4>Laboratory request</h4><p>Diagnostic tests and investigations</p></div></div>{!value ? <form onSubmit={submit}><label>Test or investigation<input name="test_name" required placeholder="e.g. Malaria RDT" /></label><label>Notes<textarea name="notes" rows={3} required placeholder="Clinical context or instructions for the laboratory" /></label><button disabled={busy}>Create lab request</button></form> : <div className="created-order"><strong>{value.test_name}</strong><span>{value.notes || "No additional notes"}</span><span>Status · {titleCase(value.status)}</span>{value.forwarded_to_facility_id ? <em>Forwarded to laboratory</em> : <><select value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)}><option value="" disabled>Select laboratory</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><button disabled={busy || !selectedFacility} onClick={() => void forward(value.id)}>Forward to laboratory</button></>}</div>}</div>;
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
    return <div className="timeline-expanded-content">
      <div className="timeline-details-grid"><TimelineField label="Symptoms" value={displayValue(data.symptoms)} wide /><TimelineField label="Assessment" value={displayValue(data.assessment)} wide /><TimelineField label="Diagnosis" value={displayValue(data.diagnosis)} /><TimelineField label="Notes" value={displayValue(data.notes)} wide /><TimelineField label="Finalized" value={data.finalized_at ? formatDate(String(data.finalized_at)) : "Not finalized"} /></div>
      {prescriptions.length > 0 && <div className="timeline-nested-orders"><strong>Prescriptions from this encounter</strong>{prescriptions.map((prescription, index) => <div key={String(prescription.id || index)}><span><b>{displayValue(prescription.medication_name)}</b><small>{displayValue(prescription.dosage)} · {displayValue(prescription.frequency)} · {displayValue(prescription.duration_days)} days</small></span><em>{displayValue(prescription.forward_status || prescription.status)}</em></div>)}</div>}
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
function PatientAvatar({ patient, large = false }: { patient: PatientSummary; large?: boolean }) { return <div className={`avatar blue ${large ? "large" : ""}`}>{patient.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>; }
function WorkspaceHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <header className="workspace-header role-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function LoadingState() { return <div className="role-loading"><span className="spinner" />Loading current records…</div>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state role-empty"><Icon name="hospital" /><strong>{title}</strong><span>{body}</span></div>; }
function isLabRole(role: StaffRole) { return role === "lab" || role === "lab_tech"; }
function isPharmacyRole(role: StaffRole) { return role === "pharmacy" || role === "pharmacist"; }
function firstName(name: string) { return name.replace(/^Dr\.\s*/i, "").split(" ")[0]; }
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dayPeriod() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"; }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
