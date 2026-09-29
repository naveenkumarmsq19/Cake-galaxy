"use client";

import { useId, useState } from "react";
import { useStore } from "./Storefront";

export default function PhoneVerification({ phone, onPhoneChange, onVerified }) {
  const { api, session, refreshSession } = useStore();
  const id = useId();
  const [requestId, setRequestId] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!/^[6-9][0-9]{9}$/.test(phone)) { setFeedback("Enter a valid 10-digit mobile number."); return; }
    setBusy(true); setFeedback("");
    try {
      const result = await api("/auth/otp", { method: "POST", body: { phone: "+91" + phone } });
      if (!result.sent || !result.requestId) throw new Error("We couldn't send the code. Please try again.");
      setRequestPhone(phone);
      setRequestId(result.requestId);
      setFeedback(result.testMode ? "Enter your configured test code. No SMS was sent." : "Enter the code sent to +91 " + phone + ".");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!requestId || requestPhone !== phone) { setFeedback("Request a new code for this number."); return; }
    if (!/^[0-9]{6}$/.test(code)) { setFeedback("Enter the 6-digit verification code."); return; }
    setBusy(true); setFeedback("");
    try {
      const result = await api("/auth/verify", { method: "POST", body: { requestId, otp: code } });
      if (!result.authenticated || result.phone !== phone) throw new Error("The code couldn't be verified.");
      const current = await refreshSession();
      if (!current.authenticated || current.phone !== phone) throw new Error("Your verification could not be saved. Please check that this site allows cookies and try again.");
      setRequestId(""); setCode("");
      setFeedback("");
      onVerified?.(phone);
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  return <div className="phone-verification">
    <label htmlFor={id}>Your mobile number</label>
    <div className="phone-verify-row"><div className="phone-field"><span>+91</span><input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={(event) => changePhone(event.target.value)} required/></div>{verified ? <span className="verified-badge" role="status">Verified</span> : <button className="button outline" type="button" onClick={sendCode} disabled={busy || !/^[6-9][0-9]{9}$/.test(phone)}>{requestId ? "Resend code" : "Send code"}</button>}</div>
    {requestId && !verified && <div className="otp-verify-row"><label htmlFor={id + "-code"}>Verification code<input id={id + "-code"} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); verifyCode(); } }} placeholder="6-digit code"/></label><button className="button" type="button" disabled={busy || code.length !== 6} onClick={verifyCode}>Verify number</button></div>}
    {feedback && <p className={requestId && feedback.startsWith("Enter ") ? "subtle" : "form-message"} role="status">{feedback}</p>}
  </div>;
}
