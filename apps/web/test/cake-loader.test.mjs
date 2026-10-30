import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const loader = read("../src/components/CakeLoader.jsx");
const css = read("../src/components/CakeLoader.module.css");
const art = read("../public/images/loaders/cake-galaxy-outline-loader.svg");
const screens = read("../src/screens/Checkout.jsx");
const catalog = read("../src/screens/Browse.jsx");
const chat = read("../src/components/SmartChat.jsx");
const chatOrder = read("../src/components/ChatOrderFlow.jsx");
const admin = read("../src/screens/AdminPanel.jsx");
const phone = read("../src/components/PhoneVerification.jsx");
const map = read("../src/components/MapPinPicker.jsx");

test("cake loader uses a transparent animated asset, no external network or JS timer", () => {
  assert.match(art, /<svg[^>]*viewBox="0 0 320 320"/);
  assert.match(art, /@keyframes trace/);
  assert.match(art, /@keyframes glow/);
  assert.match(art, /prefers-reduced-motion:reduce/);
  assert.match(loader, /cake-galaxy-outline-loader\.svg/);
  assert.doesNotMatch(loader, /setTimeout|setInterval|onLoad|https?:\/\//);
});

test("loader is a reusable accessible status with all three responsive sizes", () => {
  assert.match(loader, /role="status"/);
  assert.match(loader, /aria-live="polite"/);
  assert.match(loader, /fullScreen/);
  assert.match(loader, /size = "large"/);
  for (const cls of [".root", ".small", ".medium", ".large", ".fullScreen"]) assert.ok(css.includes(cls), cls);
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /@media \(max-width: 380px\)/);
});

test("route-level loading and suspense fallbacks use branded page loader", () => {
  assert.match(read("../app/loading.jsx"), /<CakeLoader fullScreen size="large"/);
  for (const path of ["shop", "product", "confirmation", "login"]) {
    assert.match(read("../app/" + path + "/page.jsx"), /fallback=\{<CakeLoader size="large" fullScreen/);
  }
});

test("catalog views wait for catalogue instead of falsely showing empty data", () => {
  assert.match(catalog, /if \(!catalogLoaded\) return <CakeLoader fullScreen size="large" label="Loading Cake Galaxy cakes/);
  assert.match(catalog, /if \(!catalogLoaded\) return <CakeLoader fullScreen size="large" label="Preparing your cake/);
  assert.match(catalog, /Loading cake categories/);
  assert.match(catalog, /Loading available flavours/);
  assert.match(catalog, /Checking delivery and preparing your bag/);
  assert.match(catalog, /Submitting your design/);
});

test("chat loader remains small and does not block the chat ordering flow", () => {
  assert.match(chat, /chatLoading}><CakeLoader size="small" label="Finding your cake options/);
  assert.match(chat, /CakeLoader size="small" label="Loading cake catalogue/);
  assert.match(chatOrder, /busy&&<CakeLoader size="small"/);
  assert.match(chatOrder, /!hydrated&&<CakeLoader size="small"/);
  assert.match(phone, /busy && <CakeLoader size="small" label=/);
});

test("checkout and admin show progress without removing forms while posting", () => {
  for (const label of ["Opening your bag", "Loading delivery details", "Preparing checkout", "Loading your orders"]) {
    assert.ok(screens.includes(label), label);
  }
  assert.match(screens, /Checking delivery availability/);
  assert.match(screens, /Securely processing your order/);
  assert.match(screens, /Loading payment options/);
  assert.match(screens, /Verifying your order/);
  assert.match(admin, /if \(checking\) return <div className="admin-loading"><CakeLoader size="large" fullScreen/);
  assert.match(admin, /busy && <div className="admin-action-loader"><CakeLoader size="small"/);
  assert.match(map, /cake-map-loading-overlay/);
  assert.match(map, /cake-map-location-overlay/);
});
