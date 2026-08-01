"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { appointments, messages, navItems, patients, prescriptions } from "./dummy-data";
import { Icon, type IconName } from "./icons";
import { WorkspaceView } from "./workspace-view";

type ModalType = "appointment" | "patient" | "prescription" | "message" | "notifications" | "settings" | "help" | "profile" | "visit" | null;

export function DashboardApp() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState("Overview");
  const [period, setPeriod] = useState("Today");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [readMessages, setReadMessages] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedName, setSelectedName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [patientRows, setPatientRows] = useState(patients);
  const [appointmentRows, setAppointmentRows] = useState(appointments);
  const [prescriptionRows, setPrescriptionRows] = useState(prescriptions);

  useEffect(() => {
    const session = localStorage.getItem("meditrust_session") || sessionStorage.getItem("meditrust_session");
    if (!session) router.replace("/login");
    const readyTimer = window.setTimeout(() => setAuthReady(Boolean(session)), 0);
    return () => window.clearTimeout(readyTimer);
  }, [router]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchRef.current?.focus(); setSearchOpen(true);
      }
      if (event.key === "Escape") { setModal(null); setSearchOpen(false); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const filteredAppointments = useMemo(() => appointmentRows.filter((item) =>
    `${item.name} ${item.detail} ${item.type}`.toLowerCase().includes(query.toLowerCase())
  ), [query, appointmentRows]);

  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return [];
    const needle = query.toLowerCase();
    return [
      ...patientRows.filter((item) => `${item.name} ${item.id} ${item.condition}`.toLowerCase().includes(needle)).map((item) => ({ type: "Patient", title: item.name, meta: `${item.id} · ${item.condition}` })),
      ...appointmentRows.filter((item) => `${item.name} ${item.detail}`.toLowerCase().includes(needle)).map((item) => ({ type: "Appointment", title: item.name, meta: `${item.time} · ${item.detail}` })),
    ].slice(0, 6);
  }, [query, patientRows, appointmentRows]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function navigate(label: string) {
    setActive(label);
    setMenuOpen(false);
    setQuery(""); setSearchOpen(false);
  }

  function openModal(type: ModalType, name = "") { setSelectedName(name); setModal(type); }

  function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get("name"));
    setPatientRows((rows) => [{ id: `MT-${1050 + rows.length}`, initials: name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase(), name, age: Number(data.get("age")), sex: String(data.get("sex")), phone: String(data.get("phone")), condition: String(data.get("condition")), lastVisit: "New", status: "New", tone: "green" }, ...rows]);
    setModal(null); setActive("Patients"); notify(`${name} was added successfully`);
  }

  function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get("patient")); const time = String(data.get("time"));
    setAppointmentRows((rows) => [...rows, { time, end: "—", initials: name.split(" ").map((part) => part[0]).join("").slice(0,2), name, detail: String(data.get("reason")), type: String(data.get("type")), tone: "blue", status: "Confirmed" }]);
    setModal(null); setActive("Appointments"); notify(`Appointment booked for ${name}`);
  }

  function savePrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const patient = String(data.get("patient"));
    setPrescriptionRows((rows) => [{ patient, medication: String(data.get("medication")), dosage: String(data.get("dosage")), date: "1 Aug 2026", status: "Active" }, ...rows]);
    setModal(null); setActive("Prescriptions"); notify(`Prescription sent securely to ${patient}`);
  }

  function logout() { localStorage.removeItem("meditrust_session"); sessionStorage.removeItem("meditrust_session"); router.replace("/login"); }

  if (!authReady) return <div className="auth-loader"><span className="spinner" />Loading secure workspace…</div>;

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Image src="/meditrust360-logo-transparent.png" alt="MediTrust360" width={168} height={52} priority />
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="x" /></button>
        </div>
        <nav className="nav-group" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => navigate(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Messages" && <b>3</b>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => openModal("help")}><Icon name="help" /><span>Help centre</span></button>
          <button className="nav-item" onClick={() => openModal("settings")}><Icon name="settings" /><span>Settings</span></button>
          <button className="doctor-card" onClick={() => openModal("profile")}>
            <div className="avatar avatar-dark">CO</div>
            <div><strong>Dr. Chika Okafor</strong><span>Family Physician</span></div>
            <Icon name="more" size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-wrap"><div className="search-box"><Icon name="search" size={19} /><input ref={searchRef} value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }} placeholder="Search patients, appointments..." aria-label="Search patients and appointments" /><kbd>⌘ K</kbd></div>{searchOpen && query && <div className="search-results">{searchResults.length ? searchResults.map((result, index) => <button key={`${result.type}-${result.title}-${index}`} onClick={() => { setSearchOpen(false); setSelectedName(result.title); setActive(result.type === "Patient" ? "Patients" : "Appointments"); notify(`${result.title} opened`); }}><span className="stat-icon blue"><Icon name={result.type === "Patient" ? "users" : "calendar"} size={17} /></span><span><strong>{result.title}</strong><small>{result.meta}</small></span><em>{result.type}</em></button>) : <div className="search-empty">No patients or appointments found</div>}</div>}</div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => openModal("notifications")} aria-label="Notifications"><Icon name="bell" /><i /></button>
            <span className="top-divider" />
            <button className="profile-button" onClick={() => openModal("profile")}><span className="avatar avatar-small">CO</span><span><strong>Dr. Chika</strong><small>Family Physician</small></span><Icon name="chevron" size={15} /></button>
          </div>
        </header>

        <div className="dashboard">
          {active === "Overview" ? <>
          <section className="welcome-row">
            <div><p className="eyebrow">Saturday, 1 August</p><h1>Good morning, Dr. Chika</h1><p className="subtext">Here’s what’s happening with your practice today.</p></div>
            <div className="welcome-actions"><button className="secondary-button" onClick={() => navigate("My schedule")}><Icon name="clock" size={18} /> Manage schedule</button><button className="primary-button" onClick={() => openModal("appointment")}><Icon name="calendar" size={18} /> New appointment</button></div>
          </section>

          <section className="stats-grid" aria-label="Practice summary">
            <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="calendar" /></span><span className="positive"><Icon name="trend" size={13} /> 12%</span></div><strong>8</strong><p>Appointments today</p><span className="stat-note">2 remaining this morning</span></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="users" /></span><span className="positive">+3 new</span></div><strong>246</strong><p>Total patients</p><span className="stat-note">18 seen this month</span></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon purple"><Icon name="message" /></span><span className="unread-chip">3 unread</span></div><strong>12</strong><p>Patient messages</p><span className="stat-note">Average reply · 18 min</span></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-icon orange"><Icon name="wallet" /></span><span className="positive"><Icon name="trend" size={13} /> 8.4%</span></div><strong>₦284k</strong><p>Earnings this month</p><span className="stat-note">₦42,500 pending</span></article>
          </section>

          <section className="content-grid">
            <article className="panel schedule-panel">
              <div className="panel-heading"><div><h2>Today’s schedule</h2><p>{filteredAppointments.length} appointments · 3h 30m consulting time</p></div><button className="text-button" onClick={() => navigate("Appointments")}>View calendar <Icon name="arrow" size={16} /></button></div>
              <div className="schedule-tabs" role="tablist">
                {["Today", "Tomorrow", "This week"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}{item === "Today" && <span>8</span>}</button>)}
              </div>
              <div className="appointment-list">
                {filteredAppointments.length ? filteredAppointments.map((item) => <div className={`appointment ${item.status === "Next" ? "appointment-next" : ""}`} key={item.time}>
                  <div className="appointment-time"><strong>{item.time}</strong><span>{item.end}</span></div><div className="time-line"><i /></div>
                  <div className={`avatar ${item.tone}`}>{item.initials}</div>
                  <div className="patient-info"><strong>{item.name}</strong><span>{item.detail}</span></div>
                  <div className="visit-type"><Icon name={item.type === "Video visit" ? "video" : "hospital"} size={17} /><span>{item.type}</span></div>
                  <span className={`status ${item.status.toLowerCase()}`}>{item.status === "Completed" && <Icon name="check" size={13} />}{item.status}</span>
                  {item.status === "Next" ? <button className="join-button" onClick={() => openModal("visit", item.name)}><Icon name="video" size={16} /> Join call</button> : <button className="more-button" onClick={() => { setSelectedName(item.name); navigate("Appointments"); }} aria-label={`More options for ${item.name}`}><Icon name="more" /></button>}
                </div>) : <div className="empty-state"><Icon name="search" /><strong>No matching appointments</strong><span>Try a patient name or visit type.</span></div>}
              </div>
            </article>

            <aside className="right-column">
              <article className="panel next-card">
                <div className="next-head"><span>Up next</span><span className="live-dot">Starts in 18 min</span></div><div className="next-patient"><div className="avatar green large">TO</div><div><h3>Tunde Ojo</h3><p>Hypertension review</p></div></div>
                <div className="next-meta"><span><Icon name="clock" size={17} />10:30 – 11:00 AM</span><span><Icon name="video" size={17} />Video visit</span></div>
                <div className="patient-note"><span><Icon name="sparkles" size={16} /> Clinical note</span><p>Review 7-day BP readings and current Amlodipine dosage.</p></div>
                <button className="call-button" onClick={() => openModal("visit", "Tunde Ojo")}><Icon name="video" size={18} /> Open waiting room</button>
              </article>

              <article className="panel messages-panel">
                <div className="panel-heading compact"><div><h2>Recent messages</h2><p>Stay connected with your patients</p></div><button className="text-button" onClick={() => navigate("Messages")}>View all</button></div>
                <div className="message-list">{messages.map((message) => <button key={message.name} className={`message-row ${readMessages.includes(message.name) ? "read" : ""}`} onClick={() => { setReadMessages((current) => [...current, message.name]); setSelectedName(message.name); navigate("Messages"); }}><div className={`avatar ${message.tone}`}>{message.initials}</div><div><span><strong>{message.name}</strong><small>{message.time}</small></span><p>{message.text}</p></div>{message.unread && !readMessages.includes(message.name) && <i />}</button>)}</div>
                <button className="message-button" onClick={() => openModal("message")}><Icon name="message" size={17} /> New message</button>
              </article>
            </aside>
          </section>

          <section className="quick-section"><div className="section-title"><h2>Quick actions</h2><p>Common tasks, one click away</p></div><div className="quick-grid">
            <button onClick={() => openModal("patient")}><span className="stat-icon blue"><Icon name="userPlus" /></span><span><strong>Add new patient</strong><small>Create a health record</small></span><Icon name="chevron" size={17} /></button>
            <button onClick={() => openModal("prescription")}><span className="stat-icon green"><Icon name="file" /></span><span><strong>Write prescription</strong><small>Send securely to a patient</small></span><Icon name="chevron" size={17} /></button>
            <button onClick={() => { setSelectedName("Draft clinical notes"); navigate("Patients"); }}><span className="stat-icon purple"><Icon name="sparkles" /></span><span><strong>Clinical notes</strong><small>Complete 2 draft notes</small></span><Icon name="chevron" size={17} /></button>
          </div></section>
          </> : <WorkspaceView active={active} query={query} patients={patientRows} appointments={appointmentRows} prescriptions={prescriptionRows} selectedName={selectedName} onAdd={() => openModal(active === "Patients" ? "patient" : active === "Prescriptions" ? "prescription" : active === "Messages" ? "message" : "appointment")} onOpen={(name) => { setSelectedName(name); if (active === "Messages") setReadMessages((current) => [...current, name]); else notify(`${name} opened`); }} />}
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          { label: "Overview", icon: "grid" as IconName },
          { label: "Appointments", icon: "calendar" as IconName },
          { label: "AI Assistant", icon: "sparkles" as IconName },
          { label: "Messages", icon: "message" as IconName },
          { label: "More", icon: "more" as IconName },
        ].map((item) => (
          <button
            key={item.label}
            className={active === item.label || (item.label === "More" && menuOpen) ? "active" : ""}
            onClick={() => item.label === "More" ? setMenuOpen(true) : navigate(item.label)}
          >
            <span><Icon name={item.icon} size={20} />{item.label === "Messages" && <i />}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}><section className={`app-modal ${modal === "visit" ? "visit-modal" : ""}`} role="dialog" aria-modal="true" aria-label={`${modal} dialog`} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><Icon name="x" /></button>
        {modal === "patient" && <ActionForm title="Add a new patient" subtitle="Create a secure MediTrust health record." onSubmit={savePatient} submit="Create patient"><label>Full name<input name="name" required placeholder="Patient’s legal name" /></label><div className="form-grid"><label>Age<input name="age" type="number" min="0" max="120" required /></label><label>Sex<select name="sex" required><option>Female</option><option>Male</option><option>Other</option></select></label></div><label>Phone number<input name="phone" type="tel" required placeholder="0800 000 0000" /></label><label>Primary concern<input name="condition" required placeholder="Reason for care" /></label></ActionForm>}
        {modal === "appointment" && <ActionForm title="Book an appointment" subtitle="Add a visit to your clinical schedule." onSubmit={saveAppointment} submit="Confirm appointment"><label>Patient<select name="patient">{patientRows.map((patient) => <option key={patient.id}>{patient.name}</option>)}</select></label><div className="form-grid"><label>Date<input name="date" type="date" defaultValue="2026-08-01" required /></label><label>Time<input name="time" type="time" defaultValue="15:00" required /></label></div><label>Visit type<select name="type"><option>Video visit</option><option>Clinic visit</option></select></label><label>Reason for visit<input name="reason" required placeholder="e.g. Medication review" /></label></ActionForm>}
        {modal === "prescription" && <ActionForm title="Write a prescription" subtitle="Send medication instructions securely." onSubmit={savePrescription} submit="Sign & send"><label>Patient<select name="patient">{patientRows.map((patient) => <option key={patient.id}>{patient.name}</option>)}</select></label><label>Medication<input name="medication" required placeholder="Medication and strength" /></label><label>Dosage instructions<input name="dosage" required placeholder="e.g. Once daily after food" /></label><label>Clinical note<textarea name="note" rows={3} placeholder="Optional note for the patient" /></label></ActionForm>}
        {modal === "message" && <ActionForm title="New secure message" subtitle="Start a private conversation with a patient." onSubmit={(event) => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("patient")); setModal(null); setActive("Messages"); setSelectedName(name); notify(`Message sent to ${name}`); }} submit="Send message"><label>Patient<select name="patient">{patientRows.map((patient) => <option key={patient.id}>{patient.name}</option>)}</select></label><label>Message<textarea name="message" rows={5} required placeholder="Write a clear clinical message…" /></label></ActionForm>}
        {modal === "notifications" && <InfoModal title="Notifications" subtitle="Three updates need your attention."><button className="notification-item" onClick={() => { setModal(null); navigate("Messages"); }}><span className="stat-icon blue"><Icon name="message" /></span><span><strong>2 unread patient messages</strong><small>Most recent · 8 minutes ago</small></span></button><button className="notification-item" onClick={() => { setModal(null); navigate("Appointments"); }}><span className="stat-icon green"><Icon name="calendar" /></span><span><strong>Appointment confirmed</strong><small>Ifeoma Nwosu · 11:30 AM</small></span></button><button className="notification-item" onClick={() => { setModal(null); navigate("Patients"); }}><span className="stat-icon purple"><Icon name="file" /></span><span><strong>Lab result available</strong><small>Musa Okafor · Lipid panel</small></span></button></InfoModal>}
        {modal === "settings" && <InfoModal title="Workspace settings" subtitle="Choose how your clinical workspace behaves."><label className="setting-row"><span><strong>Appointment reminders</strong><small>Notify me 15 minutes before each visit</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Patient message alerts</strong><small>Show secure-message notifications</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Compact patient lists</strong><small>Show more records on each screen</small></span><input type="checkbox" /></label><button className="modal-primary" onClick={() => { setModal(null); notify("Settings saved"); }}>Save preferences</button></InfoModal>}
        {modal === "help" && <InfoModal title="Help centre" subtitle="Get support without leaving your workspace."><button className="help-option" onClick={() => notify("Getting started guide opened")}><Icon name="file" /><span><strong>Getting started</strong><small>Learn the clinician workspace</small></span><Icon name="chevron" /></button><button className="help-option" onClick={() => notify("Support conversation started")}><Icon name="message" /><span><strong>Contact support</strong><small>Typical response in under 10 minutes</small></span><Icon name="chevron" /></button><button className="help-option" onClick={() => notify("Service status: all systems operational")}><Icon name="check" /><span><strong>System status</strong><small>All systems operational</small></span><Icon name="chevron" /></button></InfoModal>}
        {modal === "profile" && <InfoModal title="Clinician profile" subtitle="Dr. Chika Okafor · Family Physician"><div className="profile-summary"><div className="avatar avatar-dark large">CO</div><div><strong>Dr. Chika Okafor</strong><span>MDCN 78421 · Verified clinician</span></div></div><button className="help-option" onClick={() => { setModal(null); notify("Profile editor opened"); }}><Icon name="users" /><span><strong>Edit professional profile</strong><small>Specialty, bio and availability</small></span><Icon name="chevron" /></button><button className="logout-button" onClick={logout}>Sign out securely</button></InfoModal>}
        {modal === "visit" && <InfoModal title={`Video visit · ${selectedName}`} subtitle="Secure consultation room"><div className="video-preview"><div className="avatar avatar-dark large">{selectedName.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><strong>{selectedName}</strong><span>Waiting room connected</span></div><div className="video-actions"><button onClick={() => notify("Microphone toggled")}><Icon name="message" />Microphone</button><button onClick={() => notify("Camera toggled")}><Icon name="video" />Camera</button></div><button className="modal-primary" onClick={() => { setModal(null); notify(`Visit with ${selectedName} started`); }}>Start secure consultation</button></InfoModal>}
      </section></div>}
      {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
    </div>
  );
}

function ActionForm({ title, subtitle, onSubmit, submit, children }: { title: string; subtitle: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submit: string; children: ReactNode }) { return <form className="action-form" onSubmit={onSubmit}><div className="modal-heading"><span>Clinical workflow</span><h2>{title}</h2><p>{subtitle}</p></div>{children}<button className="modal-primary">{submit} <Icon name="arrow" size={17} /></button></form>; }
function InfoModal({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <div className="info-modal"><div className="modal-heading"><span>MediTrust360</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</div>; }
