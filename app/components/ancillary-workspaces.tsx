"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ApiError,
  formatDate,
  meditrustApi,
  type FacilityPrescription,
  type FinanceStats,
  type FinanceStatsSection,
  type LabRequest,
  type PaginationMeta,
  type PaymentStatus,
  type StaffRole,
} from "../lib/meditrust";
import { Icon, type IconName } from "./icons";

type WorkspaceProps = {
  facilityId: string;
  role: StaffRole;
  onError: (reason: unknown) => void;
  notify: (message: string) => void;
};

const paymentStatusLabels: Record<PaymentStatus, string> = { unpaid: "Unpaid", paid: "Paid", waived: "Waived" };

function formatAmount(amount: string | null) {
  if (amount == null || amount === "") return "Not priced";
  const value = Number(amount);
  return Number.isNaN(value) ? amount : `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ResultValue = { id: number; key: string; value: string };

export function LabTechWorkspace({ facilityId, role, onError, notify }: WorkspaceProps) {
  const canBill = role === "lab_tech";
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LabRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [values, setValues] = useState<ResultValue[]>([{ id: 1, key: "", value: "" }]);
  const [nextValueId, setNextValueId] = useState(2);
  const [files, setFiles] = useState<File[]>([]);
  const [resubmitAllowedFor, setResubmitAllowedFor] = useState<string | null>(null);
  const [confirmingResubmit, setConfirmingResubmit] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setResubmitAllowedFor(null);
    setConfirmingResubmit(false);
    try {
      const result = await meditrustApi.listFacilityLabRequests(facilityId, page);
      setRequests(result.data);
      setMeta(result.meta);
      setSelected((current) => current ? result.data.find((item) => item.id === current.id) || result.data[0] || null : result.data[0] || null);
    } catch (reason) { onError(reason); }
    finally { setLoading(false); }
  }, [facilityId, onError, page]);

  useEffect(() => { void Promise.resolve().then(loadRequests); }, [loadRequests]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
  }

  function updateValue(id: number, field: "key" | "value", value: string) {
    setValues((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addValue() {
    setValues((current) => [...current, { id: nextValueId, key: "", value: "" }]);
    setNextValueId((value) => value + 1);
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setFormError("");
    const data = new FormData(event.currentTarget);
    const resultValues = Object.fromEntries(values.filter((item) => item.key.trim()).map((item) => [item.key.trim(), item.value.trim()]));
    try {
      const uploaded = await Promise.all(files.map((file) => meditrustApi.uploadFile(file, "lab-results")));
      await meditrustApi.submitLabResult(selected.id, {
        result_text: String(data.get("result_text") || "").trim(),
        values: resultValues,
        file_urls: uploaded.map((file) => file.url),
      });
      notify("Laboratory result submitted successfully");
      setFiles([]);
      setResubmitAllowedFor(null);
      setValues([{ id: nextValueId, key: "", value: "" }]);
      setNextValueId((value) => value + 1);
      await loadRequests();
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : "The laboratory result could not be submitted.");
    } finally { setSubmitting(false); }
  }

  async function setPayment(payload: { amount: number; payment_status: PaymentStatus }) {
    if (!selected) return;
    const updated = await meditrustApi.setLabRequestPayment(selected.id, payload);
    setSelected((current) => current && current.id === updated.id ? { ...current, ...updated } : current);
    setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    notify("Payment updated");
  }

  return <section className="ancillary-workspace">
    <WorkspaceIntro eyebrow="Diagnostics operations" title="Laboratory requests" description="Review referred investigations, record structured values, and attach completed reports." count={meta?.total} loading={loading} onRefresh={() => void loadRequests()} />
    <div className="ancillary-layout">
      <section className="ancillary-list-panel">
        <div className="ancillary-list-heading"><div><strong>Incoming requests</strong><span>{meta ? `${meta.from || 0}–${meta.to || 0} of ${meta.total}` : "Current facility"}</span></div><span className="live-indicator"><i />Live</span></div>
        <div className="ancillary-list">{loading ? <AncillaryLoading /> : requests.length ? requests.map((request) => <button key={request.id} className={selected?.id === request.id ? "selected" : ""} onClick={() => { setSelected(request); setFormError(""); setResubmitAllowedFor(null); setConfirmingResubmit(false); }}><span className="ancillary-row-icon"><Icon name="hospital" /></span><span><strong>{request.test_name}</strong><small>{request.facility?.name || "Referring facility"} · {request.doctor?.name || "Ordering doctor"}</small><em>{formatDate(request.ordered_at)}</em></span><Status value={request.status} /></button>) : <AncillaryEmpty title="No laboratory requests" body="New referred tests will appear here." />}</div>
        <Pagination meta={meta} page={page} loading={loading} onPage={setPage} />
      </section>
      <section className="ancillary-detail-panel">{selected ? <>
        <header className="ancillary-detail-heading"><span><Icon name="hospital" size={21} /></span><div><small>Laboratory request</small><h2>{selected.test_name}</h2><p>{selected.facility?.name || "Referring facility"}</p></div><Status value={selected.status} /></header>
        <dl className="ancillary-facts"><div><dt>Ordering doctor</dt><dd>{selected.doctor?.name || "Not provided"}</dd></div><div><dt>Ordered</dt><dd>{formatDate(selected.ordered_at)}</dd></div><div className="wide"><dt>Clinical notes</dt><dd>{selected.notes || "No notes provided"}</dd></div><div><dt>Price</dt><dd>{formatAmount(selected.amount)}</dd></div><div><dt>Payment</dt><dd>{paymentStatusLabels[selected.payment_status]}</dd></div></dl>
        <PaymentPanel key={selected.id} record={selected} canBill={canBill} locked={selected.status === "resulted"} kind="test" onSubmit={setPayment} />
        {selected.status === "resulted" && resubmitAllowedFor !== selected.id ? <div className="result-locked-panel"><span><Icon name="check" size={21} /></span><div><strong>Result already submitted</strong><p>This laboratory request already has a result. Confirm before entering a corrected or replacement result.</p></div><button onClick={() => setConfirmingResubmit(true)}>Enter another result</button></div> : selected.payment_status === "unpaid" ? <div className="result-locked-panel"><span><Icon name="help" size={21} /></span><div><strong>Payment outstanding</strong><p>Settle or waive the payment above before releasing results for this investigation.</p></div></div> : <form className="lab-result-form" onSubmit={submitResult}>
          <div className="ancillary-section-title"><span>Result entry</span><h3>Record laboratory findings</h3><p>Add a written interpretation and any structured result values.</p></div>
          <label>Result summary<textarea name="result_text" rows={4} required placeholder="e.g. Malaria RDT: Positive" disabled={submitting} /></label>
          <div className="result-values-heading"><div><strong>Structured values</strong><small>Optional key/value measurements</small></div><button type="button" onClick={addValue} disabled={submitting}><Icon name="userPlus" size={14} />Add value</button></div>
          <div className="result-values">{values.map((item, index) => <div key={item.id}><input value={item.key} onChange={(event) => updateValue(item.id, "key", event.target.value)} placeholder={index === 0 ? "e.g. wbc" : "Value name"} aria-label={`Result value ${index + 1} name`} disabled={submitting} /><input value={item.value} onChange={(event) => updateValue(item.id, "value", event.target.value)} placeholder={index === 0 ? "e.g. 7800" : "Result"} aria-label={`Result value ${index + 1}`} disabled={submitting} /><button type="button" aria-label={`Remove result value ${index + 1}`} disabled={submitting || values.length === 1} onClick={() => setValues((current) => current.filter((value) => value.id !== item.id))}><Icon name="x" size={14} /></button></div>)}</div>
          <label className="result-upload"><span>Reports and images</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFiles} disabled={submitting} /><div><Icon name="file" /><span><strong>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Attach reports"}</strong><small>PDF, JPG or PNG. You can select multiple files.</small></span></div></label>
          {files.length > 0 && <div className="selected-result-files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Icon name="file" size={13} />{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="x" size={12} /></button></span>)}</div>}
          {formError && <div className="workspace-error" role="alert"><span>{formError}</span></div>}
          <button className="submit-result-button" disabled={submitting}>{submitting ? <><span className="spinner" />Uploading and submitting…</> : <>Submit laboratory result <Icon name="arrow" size={16} /></>}</button>
        </form>}
      </> : <AncillaryEmpty title="Select a request" body="Request details and result entry will appear here." />}</section>
    </div>
    {confirmingResubmit && selected && <div className="result-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingResubmit(false); }}><section className="result-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="result-confirm-title" aria-describedby="result-confirm-description"><span className="result-confirm-icon"><Icon name="help" size={22} /></span><div><p>Existing laboratory result</p><h2 id="result-confirm-title">Submit another result?</h2><span id="result-confirm-description">A result has already been submitted for <strong>{selected.test_name}</strong>. Continue only if you need to provide a corrected or replacement result.</span></div><div className="result-confirm-actions"><button onClick={() => setConfirmingResubmit(false)}>Keep existing result</button><button onClick={() => { setResubmitAllowedFor(selected.id); setConfirmingResubmit(false); setFormError(""); }}>Yes, enter another result</button></div></section></div>}
  </section>;
}

export function PharmacyWorkspace({ facilityId, role, onError, notify }: WorkspaceProps) {
  const canBill = role === "pharmacist";
  const [prescriptions, setPrescriptions] = useState<FacilityPrescription[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FacilityPrescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await meditrustApi.listFacilityPrescriptions(facilityId, page);
      setPrescriptions(result.data);
      setMeta(result.meta);
      setSelected((current) => current ? result.data.find((item) => item.id === current.id) || result.data[0] || null : result.data[0] || null);
    } catch (reason) { onError(reason); }
    finally { setLoading(false); }
  }, [facilityId, onError, page]);

  useEffect(() => { void Promise.resolve().then(loadPrescriptions); }, [loadPrescriptions]);

  function applyUpdate(id: string, updated: Partial<FacilityPrescription>) {
    setSelected((current) => current && current.id === id ? { ...current, ...updated } : current);
    setPrescriptions((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
  }

  async function dispense() {
    if (!selected) return;
    setDispensing(true);
    try {
      const updated = await meditrustApi.dispensePrescription(selected.id);
      applyUpdate(selected.id, { ...updated, forward_status: updated.forward_status || "dispensed" });
      notify("Prescription marked as dispensed");
    } catch (reason) { onError(reason); }
    finally { setDispensing(false); }
  }

  async function setPayment(payload: { amount: number; payment_status: PaymentStatus }) {
    if (!selected) return;
    const updated = await meditrustApi.setPrescriptionPayment(selected.id, payload);
    applyUpdate(selected.id, updated);
    notify("Payment updated");
  }

  return <section className="ancillary-workspace pharmacy-workspace">
    <WorkspaceIntro eyebrow="Medication operations" title="Prescription inbox" description="Review prescriptions referred to this pharmacy and confirm dispensing." count={meta?.total} loading={loading} onRefresh={() => void loadPrescriptions()} />
    <div className="ancillary-layout">
      <section className="ancillary-list-panel"><div className="ancillary-list-heading"><div><strong>Incoming prescriptions</strong><span>{meta ? `${meta.from || 0}–${meta.to || 0} of ${meta.total}` : "Current facility"}</span></div><span className="live-indicator"><i />Live</span></div>
        <div className="ancillary-list">{loading ? <AncillaryLoading /> : prescriptions.length ? prescriptions.map((prescription) => <button key={prescription.id} className={selected?.id === prescription.id ? "selected" : ""} onClick={() => setSelected(prescription)}><span className="ancillary-row-icon pharmacy"><Icon name="file" /></span><span><strong>{prescription.medication_name}</strong><small>{prescription.dosage} · {prescription.frequency} · {prescription.duration_days} days</small><em>{prescription.facility?.name || prescription.doctor?.name || "Referring facility"}</em></span><Status value={prescription.forward_status || prescription.status} /></button>) : <AncillaryEmpty title="No prescriptions" body="Referred prescriptions will appear here." />}</div>
        <Pagination meta={meta} page={page} loading={loading} onPage={setPage} />
      </section>
      <section className="ancillary-detail-panel">{selected ? <><header className="ancillary-detail-heading"><span className="pharmacy"><Icon name="file" size={21} /></span><div><small>Prescription</small><h2>{selected.medication_name}</h2><p>{selected.facility?.name || "Referring facility"}</p></div><Status value={selected.forward_status || selected.status} /></header>
        <dl className="ancillary-facts prescription-facts"><div><dt>Dosage</dt><dd>{selected.dosage}</dd></div><div><dt>Frequency</dt><dd>{selected.frequency}</dd></div><div><dt>Duration</dt><dd>{selected.duration_days} days</dd></div><div><dt>Prescribing doctor</dt><dd>{selected.doctor?.name || "Not provided"}</dd></div><div className="wide"><dt>Instructions</dt><dd>{selected.instructions || "No special instructions"}</dd></div><div><dt>Issued</dt><dd>{formatDate(selected.issued_at)}</dd></div><div><dt>Price</dt><dd>{formatAmount(selected.amount)}</dd></div><div><dt>Payment</dt><dd>{paymentStatusLabels[selected.payment_status]}</dd></div></dl>
        <PaymentPanel key={selected.id} record={selected} canBill={canBill} locked={selected.forward_status === "dispensed"} kind="drug" onSubmit={setPayment} />
        <div className="dispense-panel"><span><Icon name="check" /></span><div><strong>{selected.forward_status === "dispensed" ? "Dispensing complete" : selected.payment_status === "unpaid" ? "Payment outstanding" : "Ready to dispense"}</strong><p>{selected.forward_status === "dispensed" ? "This prescription has been marked as dispensed." : selected.payment_status === "unpaid" ? "Settle or waive the payment above before dispensing." : "Confirm only after the medication has been prepared and handed to the patient."}</p></div><button disabled={dispensing || selected.forward_status === "dispensed" || selected.payment_status === "unpaid"} onClick={() => void dispense()}>{dispensing ? "Updating…" : selected.forward_status === "dispensed" ? "Dispensed" : "Mark as dispensed"}</button></div>
      </> : <AncillaryEmpty title="Select a prescription" body="Medication details and dispensing actions will appear here." />}</section>
    </div>
  </section>;
}

export function FinanceOverviewWorkspace({ onError }: { onError: (reason: unknown) => void }) {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await meditrustApi.getFinanceStats({ from: from || undefined, to: to || undefined, paymentStatus: paymentStatus || undefined }));
    } catch (reason) { onError(reason); }
    finally { setLoading(false); }
  }, [from, to, paymentStatus, onError]);

  useEffect(() => { void Promise.resolve().then(loadStats); }, [loadStats]);

  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void loadStats(); }
  function clearFilters() { setFrom(""); setTo(""); setPaymentStatus(""); }

  return <section className="ancillary-workspace finance-overview">
    <WorkspaceIntro eyebrow="Finance operations" title="Billing overview" description="Collected, outstanding and waived amounts for prescriptions and laboratory requests forwarded to your facility." count={stats ? stats.prescriptions.total + stats.lab_requests.total : undefined} loading={loading} onRefresh={() => void loadStats()} />
    <form className="finance-filters" onSubmit={applyFilters}>
      <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={loading} /></label>
      <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={loading} /></label>
      <label>Payment status<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | "")} disabled={loading}><option value="">All</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label>
      <div className="finance-filter-actions"><button className="secondary-button" type="submit" disabled={loading}>Apply filters</button>{(from || to || paymentStatus) && <button type="button" className="text-button" onClick={clearFilters} disabled={loading}>Clear</button>}</div>
    </form>
    {loading && !stats ? <AncillaryLoading /> : stats ? <>
      <section className="stats-grid role-stats">
        <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><Icon name="wallet" /></span></div><strong>{formatAmount(String(stats.combined.total_collected))}</strong><p>Total collected</p><span className="stat-note">Paid across prescriptions &amp; labs</span></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-icon orange"><Icon name="clock" /></span></div><strong>{formatAmount(String(stats.combined.total_outstanding))}</strong><p>Total outstanding</p><span className="stat-note">Still unpaid</span></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-icon purple"><Icon name="check" /></span></div><strong>{formatAmount(String(stats.combined.total_waived))}</strong><p>Total waived</p><span className="stat-note">Charges waived</span></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="file" /></span></div><strong>{stats.prescriptions.total + stats.lab_requests.total}</strong><p>Billed records</p><span className="stat-note">{stats.prescriptions.total} prescriptions · {stats.lab_requests.total} lab requests</span></article>
      </section>
      <div className="finance-breakdown-grid">
        <FinanceBreakdownCard title="Prescriptions" icon="file" stat={stats.prescriptions} />
        <FinanceBreakdownCard title="Laboratory requests" icon="hospital" stat={stats.lab_requests} />
      </div>
    </> : <AncillaryEmpty title="No billing data" body="Billing figures will appear here once records are forwarded to your facility." />}
  </section>;
}

function FinanceBreakdownCard({ title, icon, stat }: { title: string; icon: IconName; stat: FinanceStatsSection }) {
  return <div className="panel finance-breakdown-card">
    <div className="finance-breakdown-heading"><span className="finance-breakdown-icon"><Icon name={icon} size={18} /></span><h3>{title}</h3><span className="finance-breakdown-total">{stat.total} total</span></div>
    <div className="finance-breakdown-rows">
      <div><Status value="paid" /><strong>{stat.paid.count}</strong><small>{formatAmount(String(stat.paid.amount))}</small></div>
      <div><Status value="unpaid" /><strong>{stat.unpaid.count}</strong><small>{formatAmount(String(stat.unpaid.amount))}</small></div>
      <div><Status value="waived" /><strong>{stat.waived.count}</strong><small>{formatAmount(String(stat.waived.amount))}</small></div>
    </div>
  </div>;
}

export function FinancePrescriptionsWorkspace({ onError, notify }: { onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [prescriptions, setPrescriptions] = useState<FacilityPrescription[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FacilityPrescription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await meditrustApi.listFinancePrescriptions(page);
      setPrescriptions(result.data);
      setMeta(result.meta);
      setSelected((current) => current ? result.data.find((item) => item.id === current.id) || result.data[0] || null : result.data[0] || null);
    } catch (reason) { onError(reason); }
    finally { setLoading(false); }
  }, [onError, page]);

  useEffect(() => { void Promise.resolve().then(loadPrescriptions); }, [loadPrescriptions]);

  async function setPayment(payload: { amount: number; payment_status: PaymentStatus }) {
    if (!selected) return;
    const updated = await meditrustApi.setPrescriptionPayment(selected.id, payload);
    setSelected((current) => current && current.id === updated.id ? { ...current, ...updated } : current);
    setPrescriptions((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    notify("Payment updated");
  }

  return <section className="ancillary-workspace pharmacy-workspace">
    <WorkspaceIntro eyebrow="Finance operations" title="Prescription billing" description="Set the price and record payment for prescriptions forwarded to your facility." count={meta?.total} loading={loading} onRefresh={() => void loadPrescriptions()} />
    <div className="ancillary-layout">
      <section className="ancillary-list-panel"><div className="ancillary-list-heading"><div><strong>Prescriptions</strong><span>{meta ? `${meta.from || 0}–${meta.to || 0} of ${meta.total}` : "Current facility"}</span></div><span className="live-indicator"><i />Live</span></div>
        <div className="ancillary-list">{loading ? <AncillaryLoading /> : prescriptions.length ? prescriptions.map((prescription) => <button key={prescription.id} className={selected?.id === prescription.id ? "selected" : ""} onClick={() => setSelected(prescription)}><span className="ancillary-row-icon pharmacy"><Icon name="file" /></span><span><strong>{prescription.medication_name}</strong><small>{prescription.dosage} · {prescription.frequency} · {prescription.duration_days} days</small><em>{prescription.doctor?.name || "Prescribing doctor"}</em></span><Status value={prescription.payment_status} /></button>) : <AncillaryEmpty title="No prescriptions" body="Prescriptions forwarded to your facility will appear here." />}</div>
        <Pagination meta={meta} page={page} loading={loading} onPage={setPage} />
      </section>
      <section className="ancillary-detail-panel">{selected ? <><header className="ancillary-detail-heading"><span className="pharmacy"><Icon name="file" size={21} /></span><div><small>Prescription</small><h2>{selected.medication_name}</h2><p>{selected.facility?.name || "Referring facility"}</p></div><Status value={selected.forward_status || selected.status} /></header>
        <dl className="ancillary-facts prescription-facts"><div><dt>Dosage</dt><dd>{selected.dosage}</dd></div><div><dt>Frequency</dt><dd>{selected.frequency}</dd></div><div><dt>Duration</dt><dd>{selected.duration_days} days</dd></div><div><dt>Prescribing doctor</dt><dd>{selected.doctor?.name || "Not provided"}</dd></div><div className="wide"><dt>Instructions</dt><dd>{selected.instructions || "No special instructions"}</dd></div><div><dt>Issued</dt><dd>{formatDate(selected.issued_at)}</dd></div><div><dt>Price</dt><dd>{formatAmount(selected.amount)}</dd></div><div><dt>Payment</dt><dd>{paymentStatusLabels[selected.payment_status]}</dd></div></dl>
        <PaymentPanel key={selected.id} record={selected} canBill locked={selected.forward_status === "dispensed"} kind="drug" onSubmit={setPayment} />
      </> : <AncillaryEmpty title="Select a prescription" body="Billing details will appear here." />}</section>
    </div>
  </section>;
}

export function FinanceLabRequestsWorkspace({ onError, notify }: { onError: (reason: unknown) => void; notify: (message: string) => void }) {
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LabRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await meditrustApi.listFinanceLabRequests(page);
      setRequests(result.data);
      setMeta(result.meta);
      setSelected((current) => current ? result.data.find((item) => item.id === current.id) || result.data[0] || null : result.data[0] || null);
    } catch (reason) { onError(reason); }
    finally { setLoading(false); }
  }, [onError, page]);

  useEffect(() => { void Promise.resolve().then(loadRequests); }, [loadRequests]);

  async function setPayment(payload: { amount: number; payment_status: PaymentStatus }) {
    if (!selected) return;
    const updated = await meditrustApi.setLabRequestPayment(selected.id, payload);
    setSelected((current) => current && current.id === updated.id ? { ...current, ...updated } : current);
    setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    notify("Payment updated");
  }

  return <section className="ancillary-workspace">
    <WorkspaceIntro eyebrow="Finance operations" title="Laboratory billing" description="Set the price and record payment for laboratory requests forwarded to your facility." count={meta?.total} loading={loading} onRefresh={() => void loadRequests()} />
    <div className="ancillary-layout">
      <section className="ancillary-list-panel">
        <div className="ancillary-list-heading"><div><strong>Laboratory requests</strong><span>{meta ? `${meta.from || 0}–${meta.to || 0} of ${meta.total}` : "Current facility"}</span></div><span className="live-indicator"><i />Live</span></div>
        <div className="ancillary-list">{loading ? <AncillaryLoading /> : requests.length ? requests.map((request) => <button key={request.id} className={selected?.id === request.id ? "selected" : ""} onClick={() => setSelected(request)}><span className="ancillary-row-icon"><Icon name="hospital" /></span><span><strong>{request.test_name}</strong><small>{request.doctor?.name || "Ordering doctor"} · {request.forwarded_to_facility?.name || "Not forwarded"}</small><em>{formatDate(request.ordered_at)}</em></span><Status value={request.payment_status} /></button>) : <AncillaryEmpty title="No laboratory requests" body="Requests forwarded to your facility will appear here." />}</div>
        <Pagination meta={meta} page={page} loading={loading} onPage={setPage} />
      </section>
      <section className="ancillary-detail-panel">{selected ? <>
        <header className="ancillary-detail-heading"><span><Icon name="hospital" size={21} /></span><div><small>Laboratory request</small><h2>{selected.test_name}</h2><p>{selected.facility?.name || "Referring facility"}</p></div><Status value={selected.status} /></header>
        <dl className="ancillary-facts"><div><dt>Ordering doctor</dt><dd>{selected.doctor?.name || "Not provided"}</dd></div><div><dt>Ordered</dt><dd>{formatDate(selected.ordered_at)}</dd></div><div className="wide"><dt>Clinical notes</dt><dd>{selected.notes || "No notes provided"}</dd></div><div><dt>Result</dt><dd>{selected.result?.resulted_at ? `Resulted · ${formatDate(selected.result.resulted_at)}` : "Not yet resulted"}</dd></div><div><dt>Price</dt><dd>{formatAmount(selected.amount)}</dd></div><div><dt>Payment</dt><dd>{paymentStatusLabels[selected.payment_status]}</dd></div></dl>
        <PaymentPanel key={selected.id} record={selected} canBill locked={selected.status === "resulted"} kind="test" onSubmit={setPayment} />
      </> : <AncillaryEmpty title="Select a request" body="Billing details will appear here." />}</section>
    </div>
  </section>;
}

type PaymentRecord = { id: string; amount: string | null; payment_status: PaymentStatus; paid_at: string | null };

function PaymentPanel({ record, canBill, locked, kind, onSubmit }: { record: PaymentRecord; canBill: boolean; locked: boolean; kind: "drug" | "test"; onSubmit: (payload: { amount: number; payment_status: PaymentStatus }) => Promise<void> }) {
  const [amount, setAmount] = useState(record.amount ?? "");
  const [status, setStatus] = useState<PaymentStatus>(record.payment_status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({ amount: Number(amount || 0), payment_status: status });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "The price could not be saved.");
    } finally { setSaving(false); }
  }

  return <div className="payment-panel">
    <div className="ancillary-section-title"><span>Billing</span><h3>Price &amp; payment</h3><p>Set the amount the patient owes for this {kind === "drug" ? "medication" : "investigation"} and record how it was settled.</p></div>
    <div className="payment-summary"><div><small>Current price</small><strong>{formatAmount(record.amount)}</strong></div><div><small>Status</small><span className={`ancillary-status ${record.payment_status}`}>{paymentStatusLabels[record.payment_status]}</span></div>{record.paid_at && <div><small>Paid</small><strong>{formatDate(record.paid_at)}</strong></div>}</div>
    {locked ? <p className="payment-hint">{kind === "drug" ? "This medication has been dispensed — the price and payment can no longer be changed." : "This investigation has been resulted — the price and payment can no longer be changed."}</p> : canBill ? <form className="payment-form" onSubmit={submit}>
      <div className="payment-fields">
        <label>Amount (₦)<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" disabled={saving} /></label>
        <label>Payment status<select value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)} disabled={saving}><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label>
      </div>
      {status === "waived" && <p className="payment-hint">A waived charge is still recorded — enter 0 if there is nothing to bill.</p>}
      {error && <div className="workspace-error" role="alert"><span>{error}</span></div>}
      <button className="submit-result-button" disabled={saving}>{saving ? <><span className="spinner" />Saving…</> : "Save price & payment"}</button>
    </form> : <p className="payment-hint">Only billing and {kind === "drug" ? "pharmacist" : "lab technician"} staff can change the price or payment status.</p>}
  </div>;
}

function WorkspaceIntro({ eyebrow, title, description, count, loading, onRefresh }: { eyebrow: string; title: string; description: string; count?: number; loading: boolean; onRefresh: () => void }) {
  return <header className="workspace-header ancillary-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><div><span><strong>{loading ? "—" : count ?? 0}</strong><small>Total records</small></span><button className="secondary-button" onClick={onRefresh} disabled={loading}><Icon name="trend" size={16} />Refresh</button></div></header>;
}

function Pagination({ meta, page, loading, onPage }: { meta: PaginationMeta | null; page: number; loading: boolean; onPage: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  return <nav className="ancillary-pagination" aria-label="Pagination"><button disabled={loading || page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevron" size={14} />Previous</button><span>Page <strong>{meta.current_page}</strong> of {meta.last_page}</span><button disabled={loading || page >= meta.last_page} onClick={() => onPage(page + 1)}>Next<Icon name="chevron" size={14} /></button></nav>;
}

function Status({ value }: { value: string }) {
  return <em className={`ancillary-status ${value}`}>{value.replace(/_/g, " ")}</em>;
}

function AncillaryLoading() { return <div className="ancillary-loading"><span className="spinner" />Loading records…</div>; }
function AncillaryEmpty({ title, body }: { title: string; body: string }) { return <div className="ancillary-empty"><Icon name="hospital" size={25} /><strong>{title}</strong><span>{body}</span></div>; }
