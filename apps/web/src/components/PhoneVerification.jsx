"use client";

import { useId, useState } from "react";
import { useStore } from "./Storefront";
import { ButtonContent } from "./CakeLoader";

export default function PhoneVerification({ phone, onPhoneChange, onVerified }) {
  const { api, session, refreshSession } = useStore();
  const id = useId();
  const [requestId, setRequestId] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const verified = session.authenticated && session.phone === phone;

  function changePhone(value) {
    onPhoneChange(value.replace(/\D/g, "").slice(0, 10));
    setRequestId("");
    setRequestPhone("");
    setCode("");
    setFeedback("");
  }

  async function sendCode() {
    if (busy) return;
    if (!/^[6-9][0-9]{9}$/.test(phone)) { setFeedback("Enter a valid 10-digit mobile number."); return; }
    setBusy("send"); setFeedback("");
    try {
      const result = await api("/auth/otp", { method: "POST", body: { phone: "+91" + phone } });
      if (!result.sent || !result.requestId) throw new Error("We couldn't send the code. Please try again.");
      setRequestPhone(phone);
      setRequestId(result.requestId);
      setFeedback(result.testMode
        ? "Enter your configured test code. No WhatsApp message was sent."
        : result.channel === "development"
          ? "Enter the development code shown in the API terminal."
          : result.channel === "sms"
            ? "Enter the 6-digit SMS code sent to +91 " + phone + "."
            : "WhatsApp verification requested for +91 " + phone + ". If the message arrives, enter the 6-digit code within 5 minutes.");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(""); }
  }

  async function verifyCode() {
    if (busy) return;
    if (!requestId || requestPhone !== phone) { setFeedback("Request a new code for this number."); return; }
    if (!/^[0-9]{6}$/.test(code)) { setFeedback("Enter the 6-digit verification code."); return; }
    setBusy("verify"); setFeedback("");
    try {
      const result = await api("/auth/verify", { method: "POST", body: { requestId, otp: code } });
      if (!result.authenticated || result.phone !== phone) throw new Error("The code couldn't be verified.");
      const current = await refreshSession();
      if (!current.authenticated || current.phone !== phone) throw new Error("Your verification could not be saved. Please check that this site allows cookies and try again.");
      setRequestId(""); setCode("");
      setFeedback("");
      onVerified?.(phone);
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(""); }
  }

  return <div className="phone-verification">
    <label htmlFor={id}>Your mobile number</label>
    <div className="phone-verify-row"><div className="phone-field"><span>+91</span><input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} disabled={Boolean(busy)} value={phone} onChange={(event) => changePhone(event.target.value)} required/></div>{verified ? <span className="verified-badge" role="status">Verified</span> : <button className="button outline" type="button" onClick={sendCode} aria-busy={busy === "send"} disabled={busy || !/^[6-9][0-9]{9}$/.test(phone)}><ButtonContent busy={busy === "send"} pendingLabel="Sending code…">{requestId ? "Resend code" : "Send code"}</ButtonContent></button>}</div>
    {requestId && !verified && <div className="otp-verify-row"><label htmlFor={id + "-code"}>Verification code<input id={id + "-code"} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={Boolean(busy)} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); verifyCode(); } }} placeholder="6-digit code"/></label><button className="button" type="button" disabled={busy || code.length !== 6} aria-busy={busy === "verify"} onClick={verifyCode}><ButtonContent busy={busy === "verify"} pendingLabel="Verifying…">Verify number</ButtonContent></button></div>}
    {feedback && <p className={requestId && feedback.startsWith("Enter ") ? "subtle" : "form-message"} role="status">{feedback}</p>}
  </div>;
}
