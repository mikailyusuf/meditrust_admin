"use client";

import { useState } from "react";
import type { Patient } from "./dummy-data";
import { Icon } from "./icons";

type AiMessage = { role: "assistant" | "doctor"; text: string };

export function AiAssistant({ patients, selectedPatientName }: { patients: Patient[]; selectedPatientName?: string }) {
  const initialPatient = patients.find((patient) => patient.name === selectedPatientName) || patients[1] || patients[0];
  const [patientId, setPatientId] = useState(initialPatient.id);
  const [messages, setMessages] = useState<AiMessage[]>([{ role: "assistant", text: "Good morning, Dr. Chika. I can help prepare for a visit, summarize the selected patient record, check medication considerations, or draft patient-friendly communication." }]);
  const [thinking, setThinking] = useState(false);
  const activePatient = patients.find((patient) => patient.id === patientId) || patients[0];
  const suggestions = ["Summarize this patient", "Prepare for the next visit", "Check medication considerations", "Draft a follow-up message"];

  function answer(prompt: string) {
    const lower = prompt.toLowerCase();
    if (lower.includes("summar")) return `${activePatient.name} is a ${activePatient.age}-year-old ${activePatient.sex.toLowerCase()} with ${activePatient.condition.toLowerCase()}. Their most recent recorded visit was ${activePatient.lastVisit}. Before acting, confirm current symptoms, medications, allergies, recent observations and any results not yet reconciled.`;
    if (lower.includes("visit") || lower.includes("prepare")) return `Suggested visit preparation for ${activePatient.name}:\n\n1. Confirm the main concern and interval changes.\n2. Review current medicines, adherence and adverse effects.\n3. Check recent observations and outstanding results.\n4. Agree on priorities, safety-net advice and follow-up timing.`;
    if (lower.includes("medication") || lower.includes("drug")) return `Medication support for ${activePatient.name}: verify the complete medication list, allergies, renal/hepatic considerations, pregnancy status where relevant, duplication, interactions and adherence. This demo has no connected formulary, so validate any prescribing decision with an approved clinical reference.`;
    if (lower.includes("message") || lower.includes("draft")) return `Draft:\n\nHello ${activePatient.name.split(" ")[0]}, I’ve reviewed the information you shared. Please continue your current care plan until our review, unless you develop new or worsening symptoms. At our next appointment we’ll go through your progress and agree on the next steps. If you feel severely unwell, please seek urgent care.`;
    if (lower.includes("differential") || lower.includes("diagnos")) return "I can help structure clinical reasoning, but I can’t establish a diagnosis from this record alone. Start with time-critical causes, then organize possibilities by system, medication effects and patient risk factors. Share the presenting symptoms, duration, vital signs and relevant examination findings for a more useful framework.";
    return `For ${activePatient.name}, I can help turn that into a structured clinical checklist. Please add the key symptoms, timeframe, relevant observations and what decision you need to make. I’ll keep the response concise and flag information that needs verification.`;
  }

  function submitPrompt(prompt: string) {
    if (!prompt.trim() || thinking) return;
    setMessages((current) => [...current, { role: "doctor", text: prompt.trim() }]); setThinking(true);
    window.setTimeout(() => { setMessages((current) => [...current, { role: "assistant", text: answer(prompt) }]); setThinking(false); }, 650);
  }

  return <section className="ai-workspace">
    <header className="ai-header"><div><span className="ai-mark"><Icon name="sparkles" size={22} /></span><div><p className="eyebrow">MediTrust clinical intelligence</p><h1>AI Assistant</h1><p>Think through clinical work with patient-aware support.</p></div></div><span className="ai-status"><i /> AI ready</span></header>
    <div className="ai-layout"><aside className="ai-context"><div className="ai-context-heading"><span>Patient context</span><small>Only shared for this conversation</small></div><label>Select patient<select value={patientId} onChange={(event) => { setPatientId(event.target.value); setMessages([{ role: "assistant", text: "Patient context updated. What would you like help with?" }]); }}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label><article className="context-patient"><div className={`avatar ${activePatient.tone}`}>{activePatient.initials}</div><div><strong>{activePatient.name}</strong><small>{activePatient.id}</small></div><em>{activePatient.status}</em></article><dl><div><dt>Age / sex</dt><dd>{activePatient.age} · {activePatient.sex}</dd></div><div><dt>Primary concern</dt><dd>{activePatient.condition}</dd></div><div><dt>Last visit</dt><dd>{activePatient.lastVisit}</dd></div></dl><div className="ai-safety"><Icon name="help" size={17} /><p><strong>Clinical decision support</strong><span>Verify AI output before using it in patient care.</span></p></div><button className="clear-chat" onClick={() => setMessages([{ role: "assistant", text: "Conversation cleared. How can I help?" }])}>Clear conversation</button></aside>
      <div className="ai-chat"><div className="ai-messages">{messages.map((message, index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Icon name="sparkles" size={17} /> : "CO"}</span><div><small>{message.role === "assistant" ? "MediTrust AI" : "You"}</small><p>{message.text}</p>{message.role === "assistant" && index > 0 && <div className="ai-feedback"><button aria-label="Helpful response">Helpful</button><button aria-label="Copy response" onClick={() => navigator.clipboard?.writeText(message.text)}>Copy</button></div>}</div></div>)}{thinking && <div className="ai-message assistant"><span><Icon name="sparkles" size={17} /></span><div><small>MediTrust AI</small><p className="thinking"><i /><i /><i /></p></div></div>}</div>
        {messages.length < 3 && <div className="ai-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => submitPrompt(suggestion)}><Icon name="sparkles" size={15} />{suggestion}</button>)}</div>}
        <form className="ai-compose" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("prompt") as HTMLTextAreaElement; submitPrompt(input.value); input.value = ""; }}><textarea name="prompt" required rows={2} placeholder={`Ask about ${activePatient.name}…`} /><div><span>AI can make mistakes. Verify clinical information.</span><button disabled={thinking} aria-label="Send prompt"><Icon name="arrow" size={18} /></button></div></form>
      </div></div>
  </section>;
}
