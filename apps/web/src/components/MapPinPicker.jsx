"use client";

import { useEffect, useRef, useState } from "react";
import CakeLoader from "./CakeLoader";

// Leaflet 1.9.4 is loaded only on the address page, with the official SRI hashes.
const leafletCss = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const leafletJs = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const leafletStyleIntegrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const leafletScriptIntegrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
let leafletPromise;
const defaultCentre = [13.01, 77.55]; // Bengaluru overview, NOT the customer's location
const compact = ({ lat, lng }) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Map is not available."));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  if (!document.querySelector('link[data-cake-leaflet="yes"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = leafletCss;
    link.integrity = leafletStyleIntegrity;
    link.crossOrigin = "anonymous";
    link.dataset.cakeLeaflet = "yes";
    document.head.append(link);
  }
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = leafletJs;
    script.integrity = leafletScriptIntegrity;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Map library did not load."));
    script.onerror = () => { script.remove(); reject(new Error("The map couldn't load on this connection.")); };
    document.head.append(script);
  }).catch(error => { leafletPromise = null; throw error; });
  return leafletPromise;
}

export default function MapPinPicker({ value, onChange, onMapReady }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onMapReady);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  onChangeRef.current = onChange;
  onReadyRef.current = onMapReady;

  function setPoint(latlng, centre = false) {
    const position = compact(latlng);
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    if (!map.current || !window.L) return;
    if (!marker.current) {
      marker.current = window.L.marker([position.lat, position.lng], {
        draggable: true,
        icon: window.L.divIcon({
          className: "cake-map-icon", html: '<span aria-hidden="true">📍</span>',
          iconSize: [32, 38], iconAnchor: [16, 36]
        })
      }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = compact(marker.current.getLatLng());
        onChangeRef.current(p);
      });
    } else marker.current.setLatLng([position.lat,position.lng]);
    if (centre) map.current.setView([position.lat,position.lng],16);
    onChangeRef.current(position);
  }

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !container.current) return;
      const initial = Number.isFinite(value?.lat) && Number.isFinite(value?.lng) ? [value.lat,value.lng] : defaultCentre;
      map.current = L.map(container.current, { scrollWheelZoom: false, zoomControl: true }).setView(initial, value ? 16 : 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
      }).addTo(map.current);
      map.current.on("click", event => setPoint(event.latlng));
      if (value) setPoint({lat:value.lat,lng:value.lng});
      setLoading(false);
      onReadyRef.current?.(true);
      // Layout might change after the dynamic stylesheet is downloaded.
      window.setTimeout(() => map.current?.invalidateSize(), 250);
    }).catch(e => {
      if (!cancelled) { setError(e.message || "Map unavailable."); setLoading(false); onReadyRef.current?.(false); }
    });
    return () => {
      cancelled = true;
      onReadyRef.current?.(false);
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Keep map initialized only once; React parent controls are delivered through refs.
  }, []);

  useEffect(() => {
    if (!map.current || !value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return;
    const selected = marker.current?.getLatLng();
    if (!selected || Math.abs(selected.lat-value.lat) > 0.000001 || Math.abs(selected.lng-value.lng) > 0.000001) {
      setPoint(value);
    }
  }, [value?.lat, value?.lng]);

  function useMyLocation() {
    if (!navigator.geolocation) { setError("This device does not support location. Tap the map instead."); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        setPoint({lat:position.coords.latitude,lng:position.coords.longitude},true);
      },
      () => { setLocating(false); setError("Location permission is unavailable. Please tap the delivery point on the map instead."); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return <section className="cake-map-picker" aria-label="Delivery map pin">
    <div className="cake-map-title">
      <div><h3>Pin your delivery location</h3><p>Tap the exact building on the map or drag the red marker. You can also use your current location.</p></div>
      <button type="button" className="button outline" onClick={useMyLocation} disabled={locating || loading || !!error}>
        {locating ? "Finding location…" : "📍 Use my location"}
      </button>
    </div>
    <div className="cake-map-loading-wrap"><div className="cake-map-surface" ref={container} aria-label="Interactive delivery pin map" role="application"/>
      {loading && <div className="cake-map-loading-overlay"><CakeLoader size="medium" label="Loading delivery map…" /></div>}
      {locating && <div className="cake-map-location-overlay"><CakeLoader size="small" label="Finding your location…" /></div>}
    </div>
    {value ? <p className="cake-map-picked" role="status">📍 Pin selected: {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}. Double-check that this matches the written address and pincode.</p>
      : !loading && !error && <p className="subtle">No pin selected yet. Tap the map to mark the delivery point.</p>}
    {error && <p className="cake-map-error" role="status">{error} Manual address entry remains available if maps cannot load.</p>}
    <p className="cake-map-credit">Map © OpenStreetMap contributors. Street, landmark, city and pincode must still be entered correctly.</p>
  </section>;
}
