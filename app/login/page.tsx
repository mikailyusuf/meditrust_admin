"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSession, type AuthUser } from "../lib/meditrust";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifier: email.trim(), password, remember }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string; data?: { user: AuthUser } } | null;
      if (!response.ok || !payload?.success || !payload.data?.user) throw new Error(payload?.message || "Unable to sign in.");
      const supportedRoles = ["reception", "nurse", "doctor", "pharmacy", "lab"];
      if (!payload.data.user.facility_staff || !supportedRoles.includes(payload.data.user.facility_staff.role)) throw new Error("This account is not linked to a supported facility staff workspace.");
      saveSession({ user: payload.data.user }, remember);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
      setLoading(false);
    }
  }

  function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <Image src="/meditrust360-logo-transparent.png" alt="MediTrust360" width={190} height={62} priority />
        <div className="login-brand-copy">
          <span className="login-kicker">Facility workspace</span>
          <h1>Better care starts with a clear view.</h1>
          <p>Appointments, patient records, messages and clinical work—securely connected in one calm workspace.</p>
          <div className="login-benefits">
            <span><i>✓</i> Secure health records</span><span><i>✓</i> Connected patient care</span><span><i>✓</i> Built for clinical teams</span>
          </div>
        </div>
        <p className="login-trust">Protected with enterprise-grade security · NDPR aligned</p>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-logo"><Image src="/meditrust360-logo-transparent.png" alt="MediTrust360" width={170} height={54} /></div>
        <div className="login-card">
          {!forgot ? <>
            <div className="login-heading"><span>Welcome back</span><h2>Sign in to your workspace</h2><p>Your workspace adapts to your facility role.</p></div>
            <form onSubmit={signIn} className="login-form">
              <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@clinic.com" required /></label>
              <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label>
              <div className="login-options"><label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me signed in</label><button type="button" onClick={() => { setForgot(true); setSent(false); }}>Forgot password?</button></div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-submit" disabled={loading}>{loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <span>→</span></>}</button>
            </form>
            <div className="demo-account"><strong>Facility staff</strong><p>Reception, nursing and doctor accounts use the same secure sign-in.</p></div>
          </> : <>
            <button className="login-back" onClick={() => setForgot(false)}>← Back to sign in</button>
            <div className="login-heading"><span>Account recovery</span><h2>Reset your password</h2><p>We’ll send a secure reset link to your registered email.</p></div>
            {!sent ? <form className="login-form" onSubmit={sendReset}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="login-submit">Send reset link <span>→</span></button></form> : <div className="reset-success"><i>✓</i><h3>Check your inbox</h3><p>A reset link was sent to <strong>{email}</strong>.</p><button onClick={() => setSent(false)}>Send again</button></div>}
          </>}
          <p className="login-support">Need help? <a href="mailto:support@meditrust360.com">Contact support</a></p>
        </div>
      </section>
    </main>
  );
}
