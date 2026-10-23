"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const frequencySeconds = 12;

export default function AdminOrderAlerts({ request, refresh, role, setTab }) {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const sound = useRef(null);
  const lastSignature = useRef("");

  const beep = useCallback(() => {
    const audio = sound.current;
    if (!audio || audio.state !== "running") return;
    for (const [index, pitch] of [880, 1100, 880].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.22;
      osc.type = "sine";
      osc.frequency.value = pitch;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.20, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.19);
    }
  }, []);

  async function enableAudio() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Browser audio isn't supported.");
      if (!sound.current) sound.current = new Context();
      await sound.current.resume();
      if (sound.current.state !== "running") throw new Error("Browser blocked sound. Tap again or allow audio.");
      setEnabled(true);
      setWarning("");
      if (count > 0) beep();
    } catch (e) {
      setWarning(e.message || "Enable sound after interacting with the page.");
    }
  }
  const refreshAttention = useCallback(async () => {
    const data = await request("orders/attention");
    const list = data.orders || [];
    setOrders(list);
    setCount(data.count || 0);
    setError("");
    const signature = list.map(o => o.reference).join(",");
    if (lastSignature.current && signature !== lastSignature.current) await refresh(role);
    lastSignature.current = signature;
  }, [request, refresh, role]);

  useEffect(() => {
    let alive = true;
    let running = false;
    async function poll() {
      if (running || !alive) return;
      running = true;
      try { await refreshAttention(); }
      catch (e) { if (alive) setError("Order alerts cannot connect. Check your admin session or network."); }
      finally { running = false; }
    }
    poll();
    const interval = setInterval(poll, 6000);
    return () => { alive = false; clearInterval(interval); };
  }, [refreshAttention]);

  useEffect(() => {
    if (!enabled || count <= 0) return;
    beep();
    const interval = setInterval(beep, frequencySeconds * 1000);
    return () => clearInterval(interval);
  }, [enabled, count, beep]);

  useEffect(() => () => { sound.current?.close().catch(() => {}); }, []);

  return <div className={"admin-order-alerts" + (count > 0 ? " has-pending" : "")} role="region" aria-label="New orders awaiting acceptance">
    <div className="admin-order-alert-main">
      <div>
        <strong>{count > 0 ? "🔔 "+count+" new order"+(count===1?"":"s")+" awaiting acceptance" : "Order alerts are monitoring"}</strong>
        <p>{count > 0 ? "Sound repeats every 12 seconds until the orders are accepted. Only paid/test orders trigger alerts." : "No new paid orders are waiting for acceptance."}</p>
        {count > 0 && <p className="admin-alert-refs">{orders.slice(0,4).map(x=>"#"+x.reference).join(" · ")}{count > 4?" · and more":""}</p>}
        {warning && <p className="admin-alert-warning">{warning}</p>}
        {error && <p className="admin-alert-warning" role="alert">{error}</p>}
      </div>
      <div className="admin-order-alert-actions">
        {!enabled && <button type="button" className="admin-primary" onClick={enableAudio}>Enable repeating sound</button>}
        {enabled && <button type="button" className="admin-ghost" onClick={()=>setEnabled(false)}>Mute alerts</button>}
        {count > 0 && <button type="button" className="admin-primary" onClick={()=>setTab("Orders")}>Review &amp; accept</button>}
      </div>
    </div>
    <small>Keep the Admin page open for sound alerts. Background browsers may throttle sound or polling; this is not a push notification when the page is closed.</small>
  </div>;
}
