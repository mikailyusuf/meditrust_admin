"use client";

import { useState } from "react";
import type { Patient, Prescription } from "./dummy-data";
import { Icon } from "./icons";

const tabs = ["Overview", "Encounters", "Conditions", "Medications", "Labs", "Imaging", "Vital signs", "Documents", "Referrals", "Timeline"];

type Props = {
  patient: Patient;
  prescriptions: Prescription[];
  onBack: () => void;
  onAskAi: () => void;
  onWritePrescription: () => void;
};

export function PatientRecord({ patient, prescriptions, onBack, onAskAi, onWritePrescription }: Props) {
  const [activeTab, setActiveTab] = useState("Overview");
  const patientPrescriptions = prescriptions.filter((item) => item.patient === patient.name);
  return (
    <section className="patient-record">
      <button className="record-back" onClick={onBack}><span>‹</span> All patients</button>

      <header className="patient-record-header">
        <div className={`avatar ${patient.tone} patient-record-avatar`}>{patient.initials}</div>
        <div className="patient-record-identity">
          <div><p className="eyebrow">Patient clinical workspace</p><h1>{patient.name}</h1></div>
          <div className="patient-demographics"><span>{patient.id}</span><i /> <span>{patient.age} years</span><i /> <span>{patient.sex}</span><i /> <span>{patient.phone}</span></div>
          <div className="patient-badges"><em><Icon name="check" size={12} /> Identity verified</em><em className="consent"><Icon name="check" size={12} /> Consent active</em><em className="allergy">Allergies: none recorded</em></div>
        </div>
        <div className="patient-record-actions">
          <button className="secondary-button" onClick={onWritePrescription}><Icon name="file" size={17} /> Write prescription</button>
          <button className="primary-button" onClick={onAskAi}><Icon name="sparkles" size={17} /> Ask MediTrust AI</button>
        </div>
      </header>

      <nav className="record-tabs" aria-label="Patient record sections">
        {tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {activeTab === "Overview" ? <Overview patient={patient} prescriptions={patientPrescriptions} onAskAi={onAskAi} /> : <RecordSection tab={activeTab} patient={patient} prescriptions={patientPrescriptions} />}
    </section>
  );
}

function Overview({ patient, prescriptions, onAskAi }: { patient: Patient; prescriptions: Prescription[]; onAskAi: () => void }) {
  const medication = prescriptions[0];
  return <div className="patient-overview-grid">
    <div className="patient-record-main">
      <section className="clinical-alert">
        <span className="stat-icon orange"><Icon name="help" size={18} /></span>
        <div><strong>Clinical attention</strong><p>Review recent observations and reconcile current medicines at the next visit.</p></div>
        <button onClick={onAskAi}>Prepare for visit <Icon name="arrow" size={15} /></button>
      </section>

      <section className="record-panel">
        <div className="record-panel-heading"><div><h2>Current clinical picture</h2><p>Latest information across connected care sources</p></div><span>Updated today</span></div>
        <div className="clinical-summary-grid">
          <article><small>Primary concern</small><strong>{patient.condition}</strong><span>Under active review</span></article>
          <article><small>Last encounter</small><strong>{patient.lastVisit} 2026</strong><span>Clinic consultation</span></article>
          <article><small>Active medicines</small><strong>{medication ? "1 medication" : "None recorded"}</strong><span>{medication?.medication || "Reconcile at next visit"}</span></article>
          <article><small>Open care items</small><strong>2 actions</strong><span>Labs · Follow-up</span></article>
        </div>
      </section>

      <section className="record-panel">
        <div className="record-panel-heading"><div><h2>Recent results</h2><p>Results shared with the care team</p></div><button>View all labs</button></div>
        <div className="results-list">
          <div><span className="result-mark normal">✓</span><span><strong>Full blood count</strong><small>30 Jul 2026 · MediTrust Diagnostics</small></span><em>Within range</em></div>
          <div><span className="result-mark review">!</span><span><strong>{patient.condition.includes("Hypertension") ? "Blood pressure average" : "Metabolic panel"}</strong><small>29 Jul 2026 · Home readings</small></span><em className="needs-review">Review</em></div>
          <div><span className="result-mark normal">✓</span><span><strong>Kidney function</strong><small>28 Jul 2026 · City General Hospital</small></span><em>Within range</em></div>
        </div>
      </section>
    </div>

    <aside className="patient-record-side">
      <section className="record-panel next-care-card">
        <span className="eyebrow">Next appointment</span><strong>8 Aug · 10:30 AM</strong><p>Medication and progress review</p><div><Icon name="video" size={16} /> Video consultation</div><button>View appointment</button>
      </section>
      <section className="record-panel">
        <div className="record-panel-heading"><div><h2>Care team</h2><p>Authorized access</p></div></div>
        <div className="care-team"><div className="avatar avatar-dark">CO</div><span><strong>Dr. Chika Okafor</strong><small>Primary clinician</small></span></div>
        <div className="care-team"><div className="avatar green">AN</div><span><strong>Ada Nwankwo</strong><small>Care coordinator</small></span></div>
      </section>
      <section className="record-panel ai-record-card">
        <span className="ai-mark"><Icon name="sparkles" size={19} /></span><div><strong>Patient-aware assistance</strong><p>Summarize this record or prepare a structured visit checklist.</p></div><button onClick={onAskAi}>Ask MediTrust AI <Icon name="arrow" size={15} /></button>
      </section>
    </aside>
  </div>;
}

function RecordSection({ tab, patient, prescriptions }: { tab: string; patient: Patient; prescriptions: Prescription[] }) {
  const content: Record<string, { title: string; meta: string; status: string }[]> = {
    Encounters: [{ title: `${patient.condition} review`, meta: `${patient.lastVisit} 2026 · Dr. Chika Okafor`, status: "Completed" }, { title: "Initial clinical assessment", meta: "14 Jun 2026 · City General Hospital", status: "Completed" }],
    Conditions: [{ title: patient.condition, meta: "Active condition · Confirmed clinically", status: "Active" }],
    Medications: prescriptions.length ? prescriptions.map((item) => ({ title: item.medication, meta: `${item.dosage} · Prescribed ${item.date}`, status: item.status })) : [{ title: "No current medication recorded", meta: "Complete medication reconciliation at the next encounter", status: "Review" }],
    Labs: [{ title: "Full blood count", meta: "30 Jul 2026 · MediTrust Diagnostics", status: "Within range" }, { title: "Metabolic panel", meta: "29 Jul 2026 · City General Hospital", status: "Review" }],
    Imaging: [{ title: "No imaging studies available", meta: "Connected facilities have not shared an imaging report", status: "No records" }],
    "Vital signs": [{ title: "Blood pressure · 138/86 mmHg", meta: "29 Jul 2026 · Patient home reading", status: "Review" }, { title: "Heart rate · 76 bpm", meta: "29 Jul 2026 · Patient home reading", status: "Normal" }],
    Documents: [{ title: "Consultation summary", meta: `${patient.lastVisit} 2026 · PDF · Dr. Chika Okafor`, status: "Signed" }],
    Referrals: [{ title: "No open referrals", meta: "Create a referral when specialist care is required", status: "Up to date" }],
    Timeline: [{ title: "Lab results received", meta: "30 Jul 2026 · MediTrust Diagnostics", status: "New" }, { title: "Clinical consultation completed", meta: `${patient.lastVisit} 2026 · Doctor workspace`, status: "Completed" }, { title: "Patient consent renewed", meta: "1 Jul 2026 · Patient application", status: "Verified" }],
  };
  return <section className="record-panel record-section"><div className="record-panel-heading"><div><h2>{tab}</h2><p>Authorized longitudinal information for {patient.name}</p></div><span>{content[tab].length} records</span></div><div className="record-section-list">{content[tab].map((item, index) => <article key={`${item.title}-${index}`}><span className="stat-icon blue"><Icon name={tab === "Labs" ? "trend" : tab === "Vital signs" ? "clock" : "file"} size={18} /></span><div><strong>{item.title}</strong><small>{item.meta}</small></div><em>{item.status}</em><Icon name="chevron" size={17} /></article>)}</div></section>;
}
