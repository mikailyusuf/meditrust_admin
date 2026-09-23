"use client";

import { useState } from "react";
import { AiAssistant } from "./ai-assistant";
import { messages, type Appointment, type Patient, type Prescription } from "./dummy-data";
import { Icon } from "./icons";
import { PatientRecord } from "./patient-record";

type Props = {
  active: string;
  query: string;
  patients: Patient[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  selectedName: string;
  onAdd: () => void;
  onOpen: (name: string) => void;
  onClearSelection: () => void;
  onAskAi: (name: string) => void;
  onWritePrescription: (name: string) => void;
};

export function WorkspaceView({ active, query, patients, appointments, prescriptions, selectedName, onAdd, onOpen, onClearSelection, onAskAi, onWritePrescription }: Props) {
  const [sentReplies, setSentReplies] = useState<string[]>([]);
  const needle = query.toLowerCase();
  const selectedPatient = active === "Patients" ? patients.find((patient) => patient.name === selectedName) : undefined;
  const descriptions: Record<string, string> = { Appointments: "Manage upcoming visits and review completed consultations.", Patients: "Secure patient records and longitudinal care history.", Messages: "Private conversations with patients and your care team.", "My schedule": "Set your availability and consulting hours.", Prescriptions: "Review and issue signed prescriptions.", Earnings: "Track consultation revenue and payouts." };

  if (active === "AI Assistant") return <AiAssistant patients={patients} selectedPatientName={selectedName} />;
  if (selectedPatient) return <PatientRecord patient={selectedPatient} prescriptions={prescriptions} onBack={onClearSelection} onAskAi={() => onAskAi(selectedPatient.name)} onWritePrescription={() => onWritePrescription(selectedPatient.name)} />;

  return <section className="workspace-view"><header className="workspace-header"><div><p className="eyebrow">Care Workspace </p><h1>{active}</h1><p>{descriptions[active]}</p></div>{active !== "Earnings" && active !== "My schedule" && <button className="primary-button" onClick={onAdd}>+ {active === "Patients" ? "Add patient" : active === "Messages" ? "New message" : active === "Prescriptions" ? "Write prescription" : "New appointment"}</button>}</header>
    {active === "Patients" && <div className="data-panel"><div className="data-toolbar"><strong>{patients.filter((p) => `${p.name} ${p.id} ${p.condition}`.toLowerCase().includes(needle)).length} patients</strong><span>Authorized clinical records</span></div><div className="data-table patient-table">{patients.filter((p) => `${p.name} ${p.id} ${p.condition}`.toLowerCase().includes(needle)).map((patient) => <button className="data-row" key={patient.id} onClick={() => onOpen(patient.name)}><div className={`avatar ${patient.tone}`}>{patient.initials}</div><span><strong>{patient.name}</strong><small>{patient.id}</small></span><span><strong>{patient.age} · {patient.sex}</strong><small>{patient.phone}</small></span><span><strong>{patient.condition}</strong><small>Last visit · {patient.lastVisit}</small></span><em className={`record-status ${patient.status.toLowerCase()}`}>{patient.status}</em><Icon name="chevron" /></button>)}</div></div>}
    {active === "Appointments" && <div className="data-panel"><div className="data-toolbar"><strong>{appointments.length} scheduled visits</strong><span>Saturday, 1 August</span></div><div className="data-table">{appointments.filter((a) => `${a.name} ${a.detail}`.toLowerCase().includes(needle)).map((item) => <button className={`data-row appointment-data-row ${selectedName === item.name ? "highlighted" : ""}`} key={`${item.name}-${item.time}`} onClick={() => onOpen(item.name)}><span className="data-time"><strong>{item.time}</strong><small>{item.end}</small></span><div className={`avatar ${item.tone}`}>{item.initials}</div><span><strong>{item.name}</strong><small>{item.detail}</small></span><span><strong>{item.type}</strong><small>30 minute session</small></span><em className={`record-status ${item.status.toLowerCase()}`}>{item.status}</em><Icon name="chevron" /></button>)}</div></div>}
    {active === "Messages" && <div className="conversation-layout"><div className="conversation-list">{messages.map((message) => <button className={selectedName === message.name ? "selected" : ""} key={message.name} onClick={() => onOpen(message.name)}><div className={`avatar ${message.tone}`}>{message.initials}</div><span><strong>{message.name}</strong><small>{message.text}</small></span><time>{message.time}</time></button>)}</div><div className="conversation"><div className="conversation-head"><div className="avatar blue">{(selectedName || "Amara Adeyemi").split(" ").map((p) => p[0]).join("").slice(0, 2)}</div><span><strong>{selectedName || "Amara Adeyemi"}</strong><small>Secure patient conversation</small></span></div><div className="chat-body"><span className="chat-date">Today</span><p className="chat-in">Hello doctor, I’ve uploaded the readings you requested.</p><p className="chat-out">Thank you. I’ll review them before our appointment.</p>{sentReplies.map((reply, index) => <p className="chat-out" key={`${reply}-${index}`}>{reply}</p>)}</div><form className="chat-compose" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("reply") as HTMLInputElement; setSentReplies((current) => [...current, input.value]); input.value = ""; onOpen(selectedName || "Amara Adeyemi"); }}><input name="reply" required placeholder="Write a secure message…" /><button>Send</button></form></div></div>}
    {active === "Prescriptions" && <div className="data-panel"><div className="data-toolbar"><strong>Recent prescriptions</strong><span>{prescriptions.length} records</span></div><div className="data-table">{prescriptions.filter((p) => `${p.patient} ${p.medication}`.toLowerCase().includes(needle)).map((item) => <button className="data-row prescription-row" key={`${item.patient}-${item.medication}`} onClick={() => onOpen(item.patient)}><span className="stat-icon green"><Icon name="file" /></span><span><strong>{item.medication}</strong><small>{item.dosage}</small></span><span><strong>{item.patient}</strong><small>{item.date}</small></span><em className="record-status active">{item.status}</em><Icon name="chevron" /></button>)}</div></div>}
    {active === "My schedule" && <div className="availability-grid">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <article key={day}><label><input type="checkbox" defaultChecked={index < 5} />{day}</label><div><input type="time" defaultValue="09:00" disabled={index === 5} /><span>to</span><input type="time" defaultValue="17:00" disabled={index === 5} /></div></article>)}<button className="primary-button" onClick={() => onOpen("Availability saved")}>Save availability</button></div>}
    {active === "Earnings" && <><div className="earnings-grid"><article><span>Available balance</span><strong>₦241,500</strong><small>Ready for payout</small></article><article><span>Pending</span><strong>₦42,500</strong><small>5 consultations</small></article><article><span>August revenue</span><strong>₦284,000</strong><small>+8.4% from July</small></article></div><div className="data-panel"><div className="data-toolbar"><strong>Recent transactions</strong><button onClick={() => onOpen("Statement downloaded")}>Download statement</button></div>{["Amara Adeyemi", "Tunde Ojo", "Ifeoma Nwosu", "Musa Okafor"].map((name, i) => <div className="transaction-row" key={name}><span className="stat-icon green"><Icon name="wallet" /></span><span><strong>Video consultation · {name}</strong><small>{30 - i} Jul 2026 · MTX-82{41 + i}</small></span><strong>+₦{i === 2 ? "12,000" : "8,500"}</strong><em>Paid</em></div>)}</div></>}
  </section>;
}
