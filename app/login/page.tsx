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
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [changeComplete, setChangeComplete] = useState(false);
  const [notice, setNotice] = useState("");

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
      if (payload.data.user.must_change_password) {
        setError("");
        setNotice("");
        setNewPassword("");
        setPasswordConfirmation("");
        setChangeComplete(false);
        setMustChange(true);
        setLoading(false);
        return;
      }
      const supportedRoles = ["reception", "nurse", "doctor", "pharmacy", "pharmacist", "lab", "lab_tech", "finance"];
      if (!payload.data.user.facility_staff || !supportedRoles.includes(payload.data.user.facility_staff.role)) throw new Error("This account is not linked to a supported facility staff workspace.");
      saveSession({ user: payload.data.user }, remember);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
      setLoading(false);
    }
  }

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to send a reset code.");
      setEmail(email.trim().toLowerCase());
      setNotice(payload.message || "If an account exists for that email, a password reset code has been sent.");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send a reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) { setError("Enter the six-digit reset code sent to your email."); return; }
    if (newPassword.length < 8) { setError("Your new password must contain at least 8 characters."); return; }
    if (newPassword !== passwordConfirmation) { setError("The new passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password: newPassword, password_confirmation: passwordConfirmation }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to reset your password.");
      setNotice(payload.message || "Password reset successful.");
      setResetComplete(true);
      setNewPassword("");
      setPasswordConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!password) { setError("Enter your current password."); return; }
    if (newPassword.length < 8) { setError("Your new password must contain at least 8 characters."); return; }
    if (newPassword !== passwordConfirmation) { setError("The new passwords do not match."); return; }
    if (newPassword === password) { setError("Your new password must be different from your current password."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ current_password: password, password: newPassword, password_confirmation: passwordConfirmation }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to change your password.");
      setNotice(payload.message || "Your password has been changed.");
      setChangeComplete(true);
      setPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change your password.");
    } finally {
      setLoading(false);
    }
  }

  function backToSignIn() {
    setMustChange(false);
    setChangeComplete(false);
    setPassword("");
    setNewPassword("");
    setPasswordConfirmation("");
    setError("");
    setNotice("");
  }

  function closeRecovery() {
    setForgot(false);
    setSent(false);
    setResetComplete(false);
    setOtp("");
    setNewPassword("");
    setPasswordConfirmation("");
    setError("");
    setNotice("");
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
          {mustChange ? <>
            <div className="login-heading"><span>Password update required</span><h2>Create a new password</h2><p>Your account needs a new password before you can continue.</p></div>
            {changeComplete ? <div className="reset-success"><i>✓</i><h3>Password changed</h3><p>{notice} Sign in with your new password to continue.</p><button onClick={backToSignIn}>Return to sign in</button></div> : <>
              {notice && <div className="reset-notice" role="status">{notice}</div>}
              <form className="login-form" onSubmit={changePassword}>
                <label>Current password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label>
                <label>New password<div className="password-field"><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={loading} /><button type="button" onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? "Hide" : "Show"}</button></div></label>
                <label>Confirm new password<input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required disabled={loading} /></label>
                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-submit" disabled={loading}>{loading ? <><span className="spinner" /> Updating password…</> : <>Update password <span>→</span></>}</button>
                <button className="reset-text-button" type="button" disabled={loading} onClick={backToSignIn}>Cancel and return to sign in</button>
              </form>
            </>}
          </> : !forgot ? <>
            <div className="login-heading"><span>Welcome back</span><h2>Sign in to your workspace</h2><p>Your workspace adapts to your facility role.</p></div>
            <form onSubmit={signIn} className="login-form">
              <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@clinic.com" required /></label>
              <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label>
              <div className="login-options"><label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me signed in</label><button type="button" onClick={() => { setForgot(true); setSent(false); setResetComplete(false); setError(""); }}>Forgot password?</button></div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-submit" disabled={loading}>{loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <span>→</span></>}</button>
            </form>
            <div className="demo-account"><strong>Facility staff</strong><p>Reception, nursing and doctor accounts use the same secure sign-in.</p></div>
          </> : <>
            <button className="login-back" onClick={closeRecovery}>← Back to sign in</button>
            {!sent ? <>
              <div className="login-heading"><span>Account recovery</span><h2>Reset your password</h2><p>We’ll send a six-digit reset code to your registered email.</p></div>
              <form className="login-form" onSubmit={sendReset}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} /></label>{error && <div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={loading}>{loading ? <><span className="spinner" /> Sending code…</> : <>Send reset code <span>→</span></>}</button></form>
            </> : resetComplete ? <div className="reset-success"><i>✓</i><h3>Password reset successful</h3><p>{notice} You can now sign in with your new password.</p><button onClick={closeRecovery}>Return to sign in</button></div> : <>
              <div className="login-heading"><span>Verify reset code</span><h2>Create a new password</h2><p>Enter the code sent to <strong>{email}</strong>.</p></div>
              {notice && <div className="reset-notice" role="status">{notice}</div>}
              <form className="login-form" onSubmit={resetPassword}>
                <label>Six-digit code<input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required disabled={loading} /></label>
                <label>New password<div className="password-field"><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={loading} /><button type="button" onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? "Hide" : "Show"}</button></div></label>
                <label>Confirm new password<input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required disabled={loading} /></label>
                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-submit" disabled={loading}>{loading ? <><span className="spinner" /> Resetting password…</> : <>Reset password <span>→</span></>}</button>
                <button className="reset-text-button" type="button" disabled={loading} onClick={() => { setSent(false); setOtp(""); setError(""); setNotice(""); }}>Use a different email</button>
              </form>
            </>}
          </>}
          <p className="login-support">Need help? <a href="mailto:support@meditrust360.com">Contact support</a></p>
        </div>
      </section>
    </main>
  );
}
