"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playEmergencySiren } from "./adminSiren";

const frequencySeconds = 12;
const savedVolumeKey = "cakegalaxy.admin.emergency-volume";

export default function AdminOrderAlerts({ request, refresh, role, setTab }) {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(85);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const sound = useRef(null);
  const stopCurrent = useRef(null);
  const lastSignature = useRef("");

  const stopSiren = useCallback(() => {
    stopCurrent.current?.();
    stopCurrent.current = null;
  }, []);

  const siren = useCallback(() => {
    const audio = sound.current;
    if (!audio || audio.state !== "running") return;
    stopSiren();
    stopCurrent.current = playEmergencySiren(audio, volume / 100);
  }, [stopSiren, volume]);

  async function prepareAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("Your browser does not support alert audio.");
    if (!sound.current || sound.current.state === "closed") sound.current = new Context();
    await sound.current.resume();
    if (sound.current.state !== "running") throw new Error("Browser blocked sound. Tap again or allow site audio.");
    return sound.current;
  }

  async function enableAudio() {
    try {
      await prepareAudio();
      setEnabled(true);
      setWarning("");
    } catch (e) {
      setWarning(e.message || "Enable sound after interacting with the page.");
    }
  }

  async function previewSiren() {
    try {
      const audio = await prepareAudio();
      stopSiren();
      stopCurrent.current = playEmergencySiren(audio, volume / 100);
      setWarning("");
    } catch (e) {
      setWarning(e.message || "Could not play the emergency siren.");
    }
  }

  function mute() {
    setEnabled(false);
    stopSiren();
  }

  function adjustVolume(value) {
    const next = Math.min(100, Math.max(25, Number(value) || 85));
    setVolume(next);
    try { localStorage.setItem(savedVolumeKey, String(next)); } catch { /* Private browsing. */ }
  }

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(savedVolumeKey));
      if (saved >= 25 && saved <= 100) setVolume(saved);
    } catch { /* Storage is optional. */ }
  }, []);

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
      catch { if (alive) setError("Order alerts cannot connect. Check your admin session or network."); }
      finally { running = false; }
    }
    poll();
    const interval = setInterval(poll, 6000);
    return () => { alive = false; clearInterval(interval); };
  }, [refreshAttention]);

  useEffect(() => {
    if (!enabled || count <= 0) {
      stopSiren();
      return;
    }
    siren();
    const interval = setInterval(siren, frequencySeconds * 1000);
    return () => { clearInterval(interval); stopSiren(); };
  }, [enabled, count > 0, siren, stopSiren]);

  useEffect(() => () => {
    stopSiren();
    sound.current?.close().catch(() => {});
  }, [stopSiren]);

  return <div className={"admin-order-alerts" + (count > 0 ? " has-pending" : "")} role="region" aria-label="New orders awaiting acceptance">
    <div className="admin-order-alert-main">
      <div>
        <strong>{count > 0 ? "🚨 "+count+" new order"+(count===1?"":"s")+" awaiting acceptance" : "Order alerts are monitoring"}</strong>
        <p>{count > 0 ? "Emergency-style siren repeats every 12 seconds until orders are accepted. Only paid/test orders trigger alerts." : "No new paid orders are waiting for acceptance."}</p>
        {count > 0 && <p className="admin-alert-refs">{orders.slice(0,4).map(x=>"#"+x.reference).join(" · ")}{count > 4?" · and more":""}</p>}
        {warning && <p className="admin-alert-warning" role="alert">{warning}</p>}
        {error && <p className="admin-alert-warning" role="alert">{error}</p>}
      </div>
      <div className="admin-order-alert-actions">
        {!enabled ? <button type="button" className="admin-primary" onClick={enableAudio}>Enable siren alerts</button>
          : <button type="button" className="admin-ghost" onClick={mute}>Mute siren</button>}
        <button type="button" className="admin-ghost" onClick={previewSiren}>▶ Test siren</button>
        {count > 0 && <button type="button" className="admin-primary" onClick={()=>setTab("Orders")}>Review &amp; accept</button>}
      </div>
    </div>
    <div className="admin-siren-volume">
      <label htmlFor="cake-siren-volume">Siren volume <strong>{volume}%</strong></label>
      <input id="cake-siren-volume" type="range" min="25" max="100" step="5" value={volume}
        onChange={e=>adjustVolume(e.target.value)} aria-label="Emergency siren volume"/>
      <span>Test at a comfortable volume before using 100%.</span>
    </div>
    <small>Keep Admin open for audible alerts. Your device/browser volume also affects loudness; background tabs may be throttled, and closing the page stops sound.</small>
  </div>;
}
