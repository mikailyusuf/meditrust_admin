"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  formatDate, meditrustApi,
  type AllergyRecord, type ClinicalSnapshot, type PatientFullRecord as FullRecord, type RecordEncounter, type RecordSource, type Vitals,
} from "../lib/meditrust";
import { Icon, type IconName } from "./icons";

type Tab = "overview" | "encounters" | "medications" | "labs" | "vitals" | "visits" | "care" | "history";
type Tone = "green" | "amber" | "red" | "blue" | "neutral";

const PAGE_SIZE = 20;

export function PatientFullRecord({ patientId, onBack, backLabel = "Back" }: { patientId: string; onBack: () => void; backLabel?: string }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; record?: FullRecord; error?: string } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const key = `${patientId}:${limit}:${attempt}`;
  const loading = result?.key !== key;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    meditrustApi.getPatientFullRecord(patientId, limit)
      .then((record) => { if (!cancelled) setResult({ key, record }); })
      .catch((reason: unknown) => { if (!cancelled) setResult((current) => ({ key, record: current?.record, error: reason instanceof Error ? reason.message : "The patient record could not be loaded." })); });
    return () => { cancelled = true; };
  }, [patientId, limit, key]);

  const record = result?.record?.patient.id === patientId ? result.record : undefined;

  if (!record) {
    return <section className="pfr">
      <button className="pfr-back" onClick={onBack}><span>‹</span> {backLabel}</button>
      {loading ? <div className="pfr-state"><span className="spinner" />Loading patient record…</div> : <div className="pfr-state pfr-state-error"><Icon name="help" /><strong>Record unavailable</strong><span>{result?.error}</span><button className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
    </section>;
  }

  const { patient, snapshot, counts } = record;
  const sections: Partial<Record<Tab, (keyof typeof counts)[]>> = { encounters: ["encounters"], medications: ["prescriptions"], labs: ["lab_requests"], visits: ["visits"], care: ["appointments", "referrals"] };
  const hasMore = (sections[tab] ?? []).some((name) => counts[name] > record[name].length);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "encounters", label: "Encounters", count: counts.encounters },
    { id: "medications", label: "Medications", count: counts.prescriptions },
    { id: "labs", label: "Labs", count: counts.lab_requests },
    { id: "vitals", label: "Vitals", count: record.vitals.length },
    { id: "visits", label: "Visits", count: counts.visits },
    { id: "care", label: "Appointments & referrals", count: counts.appointments + counts.referrals },
    { id: "history", label: "Health history" },
  ];

  return <section className="pfr">
    <button className="pfr-back" onClick={onBack}><span>‹</span> {backLabel}</button>

    <header className="pfr-header">
      <div className="pfr-avatar">{patient.photo_url ? <Image src={patient.photo_url} alt="" width={72} height={72} /> : initialsOf(patient.name)}</div>
      <div className="pfr-identity">
        <div className="pfr-name-row"><h1>{patient.name}</h1><span className="pfr-dhid">{patient.digital_health_id}</span></div>
        <p className="pfr-meta">
          <span>{snapshot.patient.age} yrs</span><span>{titleCase(patient.sex)}</span><span>Born {formatDay(patient.dob)}</span>
          {patient.phone && <span>{patient.phone}</span>}{patient.address && <span>{patient.address}</span>}
        </p>
        <dl className="pfr-biometrics">
          <Biometric label="Blood group" value={snapshot.blood_group ?? patient.blood_group} />
          <Biometric label="Genotype" value={snapshot.genotype ?? patient.genotype} />
          <Biometric label="Height" value={patient.height_cm ? `${patient.height_cm} cm` : null} />
          <Biometric label="Weight" value={patient.weight_kg ? `${patient.weight_kg} kg` : null} />
          <Biometric label="BMI" value={patient.bmi ? String(patient.bmi) : null} />
        </dl>
      </div>
      <div className="pfr-contacts">
        <ContactLine label="Emergency contact" name={patient.emergency_contact_name} phone={patient.emergency_contact_phone} />
        {record.guardian && <ContactLine label="Guardian" name={`${record.guardian.name} · ${record.guardian.digital_health_id}`} phone={record.guardian.phone} />}
      </div>
    </header>

    <AllergyBanner allergies={snapshot.allergies} />

    <nav className="pfr-tabs" aria-label="Patient record sections">
      {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>
        {item.label}{item.count ? <b>{item.count}</b> : null}
      </button>)}
    </nav>

    {tab === "overview" && <Overview record={record} onOpen={setTab} />}
    {tab === "encounters" && <EncountersTab encounters={record.encounters} />}
    {tab === "medications" && <MedicationsTab record={record} />}
    {tab === "labs" && <LabsTab record={record} />}
    {tab === "vitals" && <VitalsTab vitals={record.vitals} />}
    {tab === "visits" && <VisitsTab record={record} />}
    {tab === "care" && <CareTab record={record} />}
    {tab === "history" && <HistoryTab record={record} />}

    {hasMore && <div className="pfr-more">
      <span>Showing the latest {record.limit} entries per section.</span>
      <button className="secondary-button" disabled={loading} onClick={() => setLimit((value) => value + PAGE_SIZE)}>{loading ? "Loading…" : "Load older records"}</button>
    </div>}
  </section>;
}

/* ---------- Compact snapshot (visit queue) ---------- */

export function PatientSnapshot({ patientId, onOpenRecord }: { patientId: string; onOpenRecord: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; record?: FullRecord; error?: string } | null>(null);
  const key = `${patientId}:${attempt}`;

  useEffect(() => {
    let cancelled = false;
    meditrustApi.getPatientFullRecord(patientId, 5)
      .then((record) => { if (!cancelled) setResult({ key, record }); })
      .catch((reason: unknown) => { if (!cancelled) setResult({ key, error: reason instanceof Error ? reason.message : "Patient information could not be loaded." }); });
    return () => { cancelled = true; };
  }, [patientId, key]);

  if (result?.key !== key) return <div className="pfr-snapshot pfr-snapshot-state"><span className="spinner" />Loading patient information…</div>;
  if (!result.record) return <div className="pfr-snapshot pfr-snapshot-state"><span>{result.error}</span><button className="pfr-link" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>;

  const { patient, snapshot, encounters, lab_requests: labs } = result.record;
  const lastEncounter = encounters[0];
  const pendingLabs = labs.filter((item) => item.status !== "completed" && item.status !== "cancelled");

  return <section className="pfr-snapshot" aria-label="Patient clinical summary">
    <AllergyBanner allergies={snapshot.allergies} />
    <dl className="pfr-biometrics">
      <Biometric label="Blood group" value={snapshot.blood_group ?? patient.blood_group} />
      <Biometric label="Genotype" value={snapshot.genotype ?? patient.genotype} />
      <Biometric label="Weight" value={patient.weight_kg ? `${patient.weight_kg} kg` : null} />
      <Biometric label="BMI" value={patient.bmi ? String(patient.bmi) : null} />
    </dl>
    <div className="pfr-snapshot-grid">
      <div>
        <h3>Active conditions</h3>
        {snapshot.chronic_conditions.length ? <ul>{snapshot.chronic_conditions.map((item) => <li key={item.id}><strong>{item.name}</strong><SourceTag source={item.source} /></li>)}</ul> : <p>None recorded</p>}
      </div>
      <div>
        <h3>Current medications</h3>
        {snapshot.current_medications.length ? <ul>{snapshot.current_medications.map((item) => <li key={`${item.source_kind}-${item.id}`}><span><strong>{item.name}</strong><small>{join(item.dosage, item.frequency)}</small></span><SourceTag source={item.source} /></li>)}</ul> : <p>None recorded</p>}
      </div>
      <div>
        <h3>Last encounter</h3>
        {lastEncounter ? <p><strong>{lastEncounter.diagnosis || "Undiagnosed"}</strong><small>{join(formatDay(lastEncounter.finalized_at || lastEncounter.created_at), lastEncounter.doctor?.name, lastEncounter.facility?.name)}</small></p> : <p>First encounter on MediTrust</p>}
      </div>
      <div>
        <h3>Pending labs</h3>
        {pendingLabs.length ? <ul>{pendingLabs.map((item) => <li key={item.id}><strong>{item.test_name}</strong><Chip status={item.status} /></li>)}</ul> : <p>No pending results</p>}
      </div>
    </div>
    <footer>
      <span>{join(patient.emergency_contact_name ? `Emergency contact: ${patient.emergency_contact_name}` : null, patient.emergency_contact_phone)}</span>
      <LinkButton onClick={onOpenRecord}>View full record</LinkButton>
    </footer>
  </section>;
}

/* ---------- Overview ---------- */

function Overview({ record, onOpen }: { record: FullRecord; onOpen: (tab: Tab) => void }) {
  const { snapshot } = record;
  const nextAppointment = record.appointments
    .filter((item) => new Date(item.scheduled_at) > new Date() && item.status !== "cancelled")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const pendingLabs = record.lab_requests.filter((item) => item.status !== "completed" && item.status !== "cancelled").length;
  const openReferrals = record.referrals.filter((item) => item.status === "pending").length;

  return <div className="pfr-overview">
    <div className="pfr-column">
      <LatestVitals vitals={snapshot.vitals} onOpen={() => onOpen("vitals")} />

      <div className="pfr-split">
        <Panel title="Active conditions" meta={`${snapshot.chronic_conditions.length}`}>
          {snapshot.chronic_conditions.length ? <ul className="pfr-list">{snapshot.chronic_conditions.map((item) => <li key={item.id}>
            <span><strong>{item.name}</strong>{item.diagnosed_on && <small>Since {formatDay(item.diagnosed_on)}</small>}</span><SourceTag source={item.source} />
          </li>)}</ul> : <Empty text="No active conditions recorded" />}
        </Panel>

        <Panel title="Current medications" meta={`${snapshot.current_medications.length}`} action={<LinkButton onClick={() => onOpen("medications")}>All</LinkButton>}>
          {snapshot.current_medications.length ? <ul className="pfr-list">{snapshot.current_medications.map((item) => <li key={`${item.source_kind}-${item.id}`}>
            <span><strong>{item.name}</strong><small>{join(item.dosage, item.frequency, item.duration_days ? `${item.duration_days} days` : null)}</small></span><SourceTag source={item.source} />
          </li>)}</ul> : <Empty text="No current medications" />}
        </Panel>
      </div>

      <Panel title="Recent encounters" subtitle="Latest consultations across facilities" action={record.encounters.length > 3 ? <LinkButton onClick={() => onOpen("encounters")}>View all</LinkButton> : undefined}>
        {record.encounters.length ? <div className="pfr-rows">{record.encounters.slice(0, 3).map((item) => <button key={item.id} className="pfr-row" onClick={() => onOpen("encounters")}>
          <span className="pfr-row-icon"><Icon name="file" size={17} /></span>
          <span className="pfr-row-main"><strong>{item.diagnosis || "Undiagnosed"}</strong><small>{join(formatDay(item.finalized_at || item.created_at), item.doctor?.name, item.facility?.name)}</small></span>
          <Chip status={item.status} />
        </button>)}</div> : <Empty text="No encounters yet" />}
      </Panel>
    </div>

    <aside className="pfr-column">
      <section className="pfr-next">
        <span>Next appointment</span>
        {nextAppointment ? <>
          <strong>{formatDate(nextAppointment.scheduled_at)}</strong>
          <p>{join(titleCase(nextAppointment.type), nextAppointment.doctor?.name)}</p>
          <small><Icon name="hospital" size={14} />{nextAppointment.facility?.name}</small>
        </> : <p>No upcoming appointment scheduled.</p>}
      </section>

      <Panel title="Needs attention">
        <ul className="pfr-list pfr-attention">
          <AttentionItem icon="activity" label="Pending lab results" value={pendingLabs} onClick={() => onOpen("labs")} />
          <AttentionItem icon="arrow" label="Open referrals" value={openReferrals} onClick={() => onOpen("care")} />
          <AttentionItem icon="help" label="Allergies on file" value={snapshot.allergies.length} onClick={() => onOpen("history")} />
        </ul>
      </Panel>

      <Panel title="Care summary">
        <dl className="pfr-facts">
          <Fact label="Primary facility" value={snapshot.primary_facility?.name} />
          <Fact label="Last encounter" value={snapshot.last_encounter_at ? formatDay(snapshot.last_encounter_at) : null} />
          <Fact label="Total visits" value={String(record.counts.visits)} />
          <Fact label="Registered" value={formatDay(record.patient.created_at)} />
        </dl>
      </Panel>
    </aside>
  </div>;
}

function LatestVitals({ vitals, onOpen }: { vitals: ClinicalSnapshot["vitals"]; onOpen: () => void }) {
  const [systolic, diastolic] = (vitals?.blood_pressure ?? "").split("/").map(Number);
  const tiles: { label: string; value: string | number | null | undefined; unit: string; flag?: boolean }[] = [
    { label: "Blood pressure", value: vitals?.blood_pressure, unit: "mmHg", flag: systolic >= 140 || diastolic >= 90 },
    { label: "Pulse", value: vitals?.pulse, unit: "bpm", flag: !!vitals?.pulse && (vitals.pulse > 100 || vitals.pulse < 50) },
    { label: "Temperature", value: vitals?.temperature, unit: "°C", flag: !!vitals?.temperature && (vitals.temperature >= 37.5 || vitals.temperature < 35.5) },
    { label: "SpO₂", value: vitals?.spo2, unit: "%", flag: !!vitals?.spo2 && vitals.spo2 < 95 },
    { label: "Resp. rate", value: vitals?.respiratory_rate, unit: "/min", flag: !!vitals?.respiratory_rate && (vitals.respiratory_rate > 20 || vitals.respiratory_rate < 12) },
    { label: "BMI", value: vitals?.bmi, unit: "", flag: !!vitals?.bmi && (vitals.bmi >= 30 || vitals.bmi < 18.5) },
  ];
  return <Panel title="Latest vitals" subtitle={vitals ? `Recorded ${formatDate(vitals.recorded_at)}` : "No vitals recorded yet"} action={<LinkButton onClick={onOpen}>History</LinkButton>}>
    <div className="pfr-vitals">{tiles.map((tile) => <div key={tile.label} className={tile.flag ? "flagged" : ""}>
      <small>{tile.label}</small>
      <strong>{tile.value ?? "—"}{tile.value != null && tile.unit && <em>{tile.unit}</em>}</strong>
      {tile.flag && <span>Out of range</span>}
    </div>)}</div>
  </Panel>;
}

/* ---------- Tabs ---------- */

function EncountersTab({ encounters }: { encounters: RecordEncounter[] }) {
  const [open, setOpen] = useState<string | null>(encounters[0]?.id ?? null);
  if (!encounters.length) return <Panel title="Encounters"><Empty text="No encounters recorded" /></Panel>;
  return <div className="pfr-stack">{encounters.map((item) => {
    const expanded = open === item.id;
    return <article key={item.id} className={`pfr-card ${expanded ? "open" : ""}`}>
      <button className="pfr-card-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.id)}>
        <span className="pfr-row-icon"><Icon name="file" size={17} /></span>
        <span className="pfr-row-main"><strong>{item.diagnosis || "Undiagnosed"}</strong><small>{join(formatDate(item.finalized_at || item.created_at), item.doctor?.name, item.facility?.name)}</small></span>
        {item.superseded_by_id && <Chip tone="neutral" label="Amended" />}
        <Chip status={item.status} />
        <span className="pfr-chevron"><Icon name="chevron" size={16} /></span>
      </button>
      {expanded && <div className="pfr-card-body">
        <dl className="pfr-facts pfr-facts-wide">
          <Fact label="Symptoms" value={item.symptoms} wide />
          <Fact label="Assessment" value={item.assessment} wide />
          <Fact label="Notes" value={item.notes} wide />
        </dl>
        {!!item.prescriptions?.length && <div className="pfr-nested">
          <strong>Prescribed</strong>
          {item.prescriptions.map((rx) => <div key={rx.id}><span>{rx.medication_name}</span><small>{join(rx.dosage, rx.frequency, `${rx.duration_days} days`)}</small></div>)}
        </div>}
      </div>}
    </article>;
  })}</div>;
}

function MedicationsTab({ record }: { record: FullRecord }) {
  const reported = record.health_profile.medications;
  return <div className="pfr-stack">
    <Panel title="Prescriptions" subtitle="Issued by clinicians on MediTrust" meta={`${record.counts.prescriptions}`}>
      {record.prescriptions.length ? <div className="pfr-table-wrap"><table className="pfr-table">
        <thead><tr><th>Medication</th><th>Regimen</th><th>Prescriber</th><th>Issued</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>{record.prescriptions.map((rx) => <tr key={rx.id}>
          <td><strong>{rx.medication_name}</strong>{rx.instructions && <small>{rx.instructions}</small>}</td>
          <td>{join(rx.dosage, rx.frequency, `${rx.duration_days} days`)}</td>
          <td>{rx.doctor?.name ?? "—"}<small>{rx.facility?.name}</small></td>
          <td>{formatDay(rx.issued_at)}</td>
          <td>{money(rx.amount)}<small>{titleCase(rx.payment_status)}</small></td>
          <td><Chip status={rx.forward_status || rx.status} /></td>
        </tr>)}</tbody>
      </table></div> : <Empty text="No prescriptions issued" />}
    </Panel>

    <Panel title="Patient-reported medications" subtitle="Supplements and medicines the patient says they take" meta={`${reported.length}`}>
      {reported.length ? <ul className="pfr-list">{reported.map((item) => <li key={item.id}>
        <span><strong>{item.name}</strong><small>{join(item.dosage, item.frequency, item.route, item.started_on ? `since ${formatDay(item.started_on)}` : null, item.stopped_on ? `stopped ${formatDay(item.stopped_on)}` : null)}</small></span>
        <Chip tone={item.is_current ? "green" : "neutral"} label={item.is_current ? "Current" : "Stopped"} />
      </li>)}</ul> : <Empty text="Nothing reported by the patient" />}
    </Panel>
  </div>;
}

function LabsTab({ record }: { record: FullRecord }) {
  if (!record.lab_requests.length) return <Panel title="Lab requests"><Empty text="No lab requests yet" /></Panel>;
  return <div className="pfr-stack">{record.lab_requests.map((lab) => <article key={lab.id} className="pfr-card open">
    <div className="pfr-card-head">
      <span className="pfr-row-icon purple"><Icon name="activity" size={17} /></span>
      <span className="pfr-row-main"><strong>{lab.test_name}</strong><small>{join(`Ordered ${formatDate(lab.ordered_at)}`, lab.doctor?.name, (lab.forwarded_to_facility ?? lab.facility)?.name)}</small></span>
      <Chip status={lab.status} />
    </div>
    {(lab.result || lab.notes) && <div className="pfr-card-body">
      {lab.notes && <p className="pfr-note">{lab.notes}</p>}
      {lab.result && <>
        {lab.result.result_text && <p className="pfr-result-text">{lab.result.result_text}</p>}
        {lab.result.values && Object.keys(lab.result.values).length > 0 && <dl className="pfr-lab-values">{Object.entries(lab.result.values).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
        <div className="pfr-result-foot">
          {lab.result.resulted_at && <small>Resulted {formatDate(lab.result.resulted_at)}</small>}
          {lab.result.file_urls?.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer"><Icon name="file" size={14} />Attachment {index + 1}</a>)}
        </div>
      </>}
    </div>}
  </article>)}</div>;
}

function VitalsTab({ vitals }: { vitals: Vitals[] }) {
  return <Panel title="Vital signs history" meta={`${vitals.length} readings`}>
    {vitals.length ? <div className="pfr-table-wrap"><table className="pfr-table pfr-table-numeric">
      <thead><tr><th>Recorded</th><th>BP</th><th>Pulse</th><th>Temp</th><th>SpO₂</th><th>Resp.</th><th>Weight</th><th>Height</th></tr></thead>
      <tbody>{vitals.map((item) => <tr key={item.id}>
        <td>{formatDate(item.recorded_at)}</td>
        <td>{item.blood_pressure_systolic ?? "—"}/{item.blood_pressure_diastolic ?? "—"}</td>
        <td>{item.pulse ?? "—"}</td><td>{item.temperature ?? "—"}</td><td>{item.spo2 != null ? `${item.spo2}%` : "—"}</td>
        <td>{item.respiratory_rate ?? "—"}</td><td>{item.weight ?? "—"}</td><td>{item.height ?? "—"}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text="No vitals recorded" />}
  </Panel>;
}

function VisitsTab({ record }: { record: FullRecord }) {
  return <Panel title="Facility visits" meta={`${record.counts.visits}`}>
    {record.visits.length ? <div className="pfr-rows">{record.visits.map((visit) => <div key={visit.id} className="pfr-row">
      <span className="pfr-row-icon"><Icon name="hospital" size={17} /></span>
      <span className="pfr-row-main"><strong>{visit.facility?.name ?? "Facility visit"}</strong><small>{join(`Checked in ${formatDate(visit.checked_in_at)}`, visit.completed_at ? `completed ${formatDate(visit.completed_at)}` : null)}</small></span>
      <Chip status={visit.status} />
    </div>)}</div> : <Empty text="No visits recorded" />}
  </Panel>;
}

function CareTab({ record }: { record: FullRecord }) {
  return <div className="pfr-stack">
    <Panel title="Appointments" meta={`${record.counts.appointments}`}>
      {record.appointments.length ? <div className="pfr-rows">{record.appointments.map((item) => <div key={item.id} className="pfr-row">
        <span className="pfr-row-icon"><Icon name="calendar" size={17} /></span>
        <span className="pfr-row-main"><strong>{formatDate(item.scheduled_at)} · {titleCase(item.type)}</strong><small>{join(item.doctor?.name, item.doctor?.specialty, item.facility?.name, item.fee ? money(item.fee) : null)}</small></span>
        <Chip status={item.status} />
      </div>)}</div> : <Empty text="No appointments" />}
    </Panel>
    <Panel title="Referrals" meta={`${record.counts.referrals}`}>
      {record.referrals.length ? <div className="pfr-rows">{record.referrals.map((item) => <div key={item.id} className="pfr-row">
        <span className="pfr-row-icon"><Icon name="arrow" size={17} /></span>
        <span className="pfr-row-main"><strong>{item.reason || "Referral"}</strong><small>{join(item.to_facility?.name ? `To ${item.to_facility.name}` : null, formatDay(item.created_at))}</small></span>
        <Chip status={item.status} />
      </div>)}</div> : <Empty text="No referrals" />}
    </Panel>
  </div>;
}

function HistoryTab({ record }: { record: FullRecord }) {
  const { allergies, conditions, medical_history: history } = record.health_profile;
  return <div className="pfr-stack">
    <div className="pfr-split">
      <Panel title="Allergies" meta={`${allergies.length}`}>
        {allergies.length ? <ul className="pfr-list">{allergies.map((item) => <li key={item.id}>
          <span><strong>{item.allergen}</strong><small>{join(item.severity ? `${titleCase(item.severity)} reaction` : null, item.reaction)}</small></span><SourceTag source={item.source} />
        </li>)}</ul> : <Empty text="No known allergies" />}
      </Panel>
      <Panel title="Conditions" subtitle="Active and resolved" meta={`${conditions.length}`}>
        {conditions.length ? <ul className="pfr-list">{conditions.map((item) => <li key={item.id}>
          <span><strong>{item.name}</strong><small>{join(titleCase(item.status), item.diagnosed_on ? `since ${formatDay(item.diagnosed_on)}` : null)}</small></span><SourceTag source={item.source} />
        </li>)}</ul> : <Empty text="No conditions recorded" />}
      </Panel>
    </div>
    <Panel title="Medical history" subtitle="Surgeries, hospitalizations and other past events" meta={`${history.length}`}>
      {history.length ? <div className="pfr-rows">{history.map((item) => <div key={item.id} className="pfr-row">
        <span className="pfr-row-icon"><Icon name="clock" size={17} /></span>
        <span className="pfr-row-main"><strong>{item.title}</strong><small>{join(titleCase(item.type), item.occurred_on ? formatDay(item.occurred_on) : null, item.facility_name)}</small></span>
        <SourceTag source={item.source} />
      </div>)}</div> : <Empty text="No past medical events recorded" />}
    </Panel>
  </div>;
}

/* ---------- Building blocks ---------- */

function AllergyBanner({ allergies }: { allergies: AllergyRecord[] }) {
  if (!allergies.length) return <div className="pfr-allergy none"><Icon name="check" size={16} /><span><strong>No known allergies</strong> on file</span></div>;
  const severe = allergies.some((item) => item.severity === "severe");
  return <div className={`pfr-allergy ${severe ? "severe" : ""}`} role="note">
    <Icon name="help" size={16} />
    <strong>Allergies</strong>
    <span className="pfr-allergy-list">{allergies.map((item) => <em key={item.id}>{item.allergen}{item.severity && <small>{item.severity}</small>}</em>)}</span>
  </div>;
}

function Panel({ title, subtitle, meta, action, children }: { title: string; subtitle?: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="pfr-panel">
    <header><div><h2>{title}{meta && <span>{meta}</span>}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
    {children}
  </section>;
}

function Chip({ status, tone, label }: { status?: string | null; tone?: Tone; label?: string }) {
  const value = label ?? titleCase(status || "unknown");
  return <em className={`pfr-chip ${tone ?? toneFor(status)}`}>{value}</em>;
}

function SourceTag({ source }: { source: RecordSource }) {
  const verified = source === "clinician_verified";
  return <span className={`pfr-source ${verified ? "verified" : ""}`} title={verified ? "Verified by a clinician" : "Reported by the patient"}>
    {verified && <Icon name="check" size={12} />}{verified ? "Verified" : "Self-reported"}
  </span>;
}

function Biometric({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function ContactLine({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  return <div><small>{label}</small><strong>{name || "Not provided"}</strong>{phone && <a href={`tel:${phone}`}>{phone}</a>}</div>;
}

function Fact({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <div className={wide ? "wide" : ""}><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function AttentionItem({ icon, label, value, onClick }: { icon: IconName; label: string; value: number; onClick: () => void }) {
  return <li><button onClick={onClick}><Icon name={icon} size={16} /><span>{label}</span><b className={value ? "active" : ""}>{value}</b></button></li>;
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className="pfr-link" onClick={onClick}>{children}<Icon name="arrow" size={14} /></button>;
}

function Empty({ text }: { text: string }) {
  return <p className="pfr-empty">{text}</p>;
}

/* ---------- Helpers ---------- */

function toneFor(status?: string | null): Tone {
  switch (status) {
    case "completed": case "finalized": case "confirmed": case "active": case "paid": case "dispensed": case "resulted": return "green";
    case "pending": case "draft": case "waiting": case "unpaid": case "in_progress": case "forwarded": case "with_doctor": return "amber";
    case "cancelled": case "expired": case "declined": case "rejected": return "red";
    default: return "blue";
  }
}

function join(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" · ");
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initialsOf(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

function money(value: string | null) {
  return value ? `₦${Number(value).toLocaleString()}` : "—";
}
