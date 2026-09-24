"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { meditrustApi, type Paginated, type SupportCategory, type SupportPriority, type SupportTicket } from "../lib/meditrust";
import { Icon } from "./icons";

const categories: SupportCategory[] = ["general", "account", "technical", "billing", "facility", "clinical"];
const priorities: SupportPriority[] = ["low", "normal", "high", "urgent"];

function label(value: string) { return value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase()); }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "The request could not be completed."; }

export function SupportWidget() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Paginated<SupportTicket> | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [revision, setRevision] = useState(0);

  const loadList = useCallback(async (search: string, currentPage: number, cancelled: () => boolean) => {
    setLoading(true); setError("");
    try {
      const result = await meditrustApi.listSupportTickets(search, currentPage);
      if (!cancelled()) setList(result);
    } catch (reason) { if (!cancelled()) setError(errorMessage(reason)); }
    finally { if (!cancelled()) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open || view !== "list") return;
    let cancelled = false;
    const timer = window.setTimeout(() => { void loadList(query, page, () => cancelled); }, query ? 300 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, view, query, page, revision, loadList]);

  function show() {
    dialogRef.current?.showModal();
    setOpen(true);
    setView("list");
    setRevision((value) => value + 1);
  }

  async function openTicket(id: string) {
    setView("detail"); setSelected(null); setLoading(true); setError(""); setConfirmClose(false);
    try { setSelected(await meditrustApi.getSupportTicket(id)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const values = {
      subject: String(fields.get("subject") || "").trim(),
      category: String(fields.get("category")) as SupportCategory,
      priority: String(fields.get("priority")) as SupportPriority,
      message: String(fields.get("message") || "").trim(),
    };
    if (!values.subject || !values.message) return;
    setBusy(true); setError("");
    try {
      const ticket = await meditrustApi.createSupportTicket(values);
      form.reset();
      setRevision((value) => value + 1);
      await openTicket(ticket.id);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError("");
    try {
      setSelected(await meditrustApi.replyToSupportTicket(selected.id, reply.trim()));
      setReply("");
      setRevision((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function closeTicket() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const result = await meditrustApi.closeSupportTicket(selected.id);
      setSelected({ ...selected, ...result });
      setConfirmClose(false);
      setRevision((value) => value + 1);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="support-fab" onClick={show} aria-label="Open support tickets" aria-haspopup="dialog"><Icon name="help" size={21} /><span>Support</span></button>
    <dialog ref={dialogRef} className="support-dialog" aria-label="Support tickets" onClose={() => { setOpen(false); setError(""); setConfirmClose(false); }}>
      <div className="support-head"><div><span>MEDITrust SUPPORT</span><h2>{view === "new" ? "New support ticket" : view === "detail" ? "Ticket details" : "How can we help?"}</h2></div><button type="button" aria-label="Close support" onClick={() => dialogRef.current?.close()}><Icon name="x" size={19} /></button></div>
      {view === "list" && <div className="support-content">
        <p className="support-intro">Contact our team and follow your requests here.</p>
        <button type="button" className="support-create" onClick={() => { setView("new"); setError(""); }}>+ Create a ticket</button>
        <label className="support-search"><Icon name="search" size={17} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search your tickets" aria-label="Search your tickets" /></label>
        <div className="support-list-heading"><strong>Your tickets</strong><button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}>Refresh</button></div>
        {loading ? <p className="support-state">Loading tickets…</p> : list?.data.length ? <div className="support-ticket-list">{list.data.map((ticket) => <button type="button" key={ticket.id} onClick={() => void openTicket(ticket.id)}><span><strong>{ticket.subject}</strong><small>{ticket.ticket_number} · {date(ticket.last_message_at || ticket.created_at)}</small></span><em className={`support-status ${ticket.status}`}>{label(ticket.status)}</em><Icon name="chevron" size={17} /></button>)}</div> : <p className="support-state">{query ? "No tickets match your search." : "You haven’t created any tickets yet."}</p>}
        {list && list.meta.last_page > 1 && <div className="support-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {list.meta.last_page}</span><button type="button" disabled={page >= list.meta.last_page || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
      </div>}
      {view === "new" && <div className="support-content"><button type="button" className="support-back" onClick={() => { setView("list"); setError(""); }}>← All tickets</button><form className="support-form" onSubmit={(event) => void create(event)}><label>Subject<input name="subject" required maxLength={200} placeholder="What do you need help with?" /></label><div className="support-form-grid"><label>Category<select name="category" defaultValue="general">{categories.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label><label>Priority<select name="priority" defaultValue="normal">{priorities.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label></div><label>Message<textarea name="message" required rows={6} placeholder="Tell us what happened and what you need…" /></label><button type="submit" className="support-submit" disabled={busy}>{busy ? "Sending…" : "Submit ticket"}</button></form></div>}
      {view === "detail" && <div className="support-content"><button type="button" className="support-back" onClick={() => { setView("list"); setSelected(null); setError(""); setConfirmClose(false); }}>← All tickets</button>{loading ? <p className="support-state">Loading ticket…</p> : selected && <><div className="support-detail-title"><span className="support-number">{selected.ticket_number}</span><h3>{selected.subject}</h3><div className="support-detail-meta"><em className={`support-status ${selected.status}`}>{label(selected.status)}</em><span>{label(selected.category)}</span><span>{label(selected.priority)} priority</span></div><small>Created {date(selected.created_at)}</small></div><div className="support-thread"><strong>Conversation</strong>{selected.messages?.length ? selected.messages.map((message) => <article className={message.is_admin_reply ? "support-message admin" : "support-message"} key={message.id}><div><strong>{message.is_admin_reply ? "Support team" : message.sender?.name || "You"}</strong><time>{date(message.created_at)}</time></div><p>{message.message}</p></article>) : <p className="support-state">No messages yet.</p>}</div>{selected.status !== "closed" ? <><form className="support-reply" onSubmit={(event) => void sendReply(event)}><label htmlFor="support-reply-input">Add a reply</label><textarea id="support-reply-input" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} required placeholder="Write your message…" /><button type="submit" className="support-submit" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</button></form><div className="support-close-area">{confirmClose ? <div><span>Close this ticket?</span><button type="button" onClick={() => setConfirmClose(false)} disabled={busy}>Cancel</button><button type="button" onClick={() => void closeTicket()} disabled={busy}>{busy ? "Closing…" : "Confirm close"}</button></div> : <button type="button" onClick={() => setConfirmClose(true)}>Close ticket</button>}</div></> : <p className="support-closed">This ticket is closed.</p>}</>}</div>}
      {error && <div className="support-error" role="alert">{error}</div>}
    </dialog>
  </>;
}
