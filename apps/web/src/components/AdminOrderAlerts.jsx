"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playEmergencySiren } from "./adminSiren";
import { readSirenPreference, writeSirenPreference } from "./adminAlertPreferences";

const frequencySeconds = 12;
const savedVolumeKey = "cakegalaxy.admin.emergency-volume";

export default function AdminOrderAlerts({ request, refresh, role, setTab }) {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(85);
  const volumeRef = useRef(85);
  const enabledRef = useRef(false);
  const pendingRef = useRef(false);
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
    stopCurrent.current = playEmergencySiren(audio, volumeRef.current / 100);
  }, [stopSiren]);

  // Always invoke AudioContext.resume() synchronously within a user gesture when needed.
  // Browsers may refuse to unlock a refreshed document without interaction.
  const prepareAudio = useCallback(() => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return Promise.reject(new Error("Your browser does not support alert audio."));
    if (!sound.current || sound.current.state === "closed") sound.current = new Context();
    if (sound.current.state === "running") return Promise.resolve(sound.current);
    const context = sound.current;
    return context.resume().then(() => {
      if (context.state !== "running") throw new Error("Your browser blocked audio. Click anywhere on the Admin page to allow the siren.");
      return context;
    });
  }, []);

  const unlockAudio = useCallback(() => {
    if (!enabledRef.current || sound.current?.state === "running") return;
    // This function is invoked directly by pointer/key events, not from an async effect.
    void prepareAudio().then(() => {
      if (enabledRef.current && pendingRef.current) siren();
      setWarning("");
    }).catch(() => {
      setWarning("Alerts are saved. Allow sound in your browser and click the Admin page once to activate audio.");
    });
  }, [prepareAudio, siren]);

  function enableAudio() {
    enabledRef.current = true;
    writeSirenPreference(window.localStorage, true);
    setEnabled(true);
    // The original button click provides the required user gesture.
    void prepareAudio().then(() => {
      setWarning("");
      if (pendingRef.current) siren();
    }).catch(error => {
      setWarning(error.message || "Allow site sound and interact with the Admin page to activate siren audio.");
    });
  }

  function mute() {
    enabledRef.current = false;
    writeSirenPreference(window.localStorage, false);
    setEnabled(false);
    setWarning("");
    stopSiren();
  }

  function adjustVolume(value) {
    const next = Math.min(100, Math.max(25, Number(value) || 85));
    volumeRef.current = next;
    setVolume(next);
    try { localStorage.setItem(savedVolumeKey, String(next)); } catch { /* Private browsing. */ }
  }

  useEffect(() => {
    const remembered = readSirenPreference(window.localStorage);
    enabledRef.current = remembered;
    setEnabled(remembered);
    if (remembered) {
      // Best effort: browsers allowing autoplay resume without another click.
      // If blocked, the next ordinary click/key press will unlock it silently.
      void prepareAudio().then(() => {
        if (enabledRef.current && pendingRef.current) siren();
      }).catch(() => {});
    }
    try {
      const saved = Number(localStorage.getItem(savedVolumeKey));
      if (saved >= 25 && saved <= 100) { volumeRef.current = saved; setVolume(saved); }
    } catch { /* Storage is optional. */ }
  }, [prepareAudio, siren]);

  useEffect(() => {
    // Previously enabled preference is restored automatically. Listening for a natural
    // page interaction handles browsers that forbid sound immediately after refresh.
    window.addEventListener("pointerdown", unlockAudio, true);
    window.addEventListener("keydown", unlockAudio, true);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, [unlockAudio]);

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

  const hasPendingOrders = count > 0;
  pendingRef.current = hasPendingOrders;
  useEffect(() => {
    if (!enabled || !hasPendingOrders) {
      stopSiren();
      return;
    }
    siren();
    const interval = setInterval(siren, frequencySeconds * 1000);
    return () => { clearInterval(interval); stopSiren(); };
  }, [enabled, hasPendingOrders, siren, stopSiren]);

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
        {count > 0 && <button type="button" className="admin-primary" onClick={()=>setTab("Orders")}>Review &amp; accept</button>}
      </div>
    </div>
    <div className="admin-siren-volume">
      <label htmlFor="cake-siren-volume">Siren volume <strong>{volume}%</strong></label>
      <input id="cake-siren-volume" type="range" min="25" max="100" step="5" value={volume}
        onChange={e=>adjustVolume(e.target.value)} aria-label="Emergency siren volume"/>
      <span>Adjust to a comfortable volume. The siren plays only for unaccepted orders.</span>
    </div>
    <small>{enabled ? "Alert preference saved on this browser. After a refresh, some browsers unlock sound on your first normal click or key press. " : "Alert sounds are muted on this browser. " }Keep Admin open for audible alerts. Closing the page stops sound; device volume and background-tab restrictions still apply.</small>
  </div>;
}
