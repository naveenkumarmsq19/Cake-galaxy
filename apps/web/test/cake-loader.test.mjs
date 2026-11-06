import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

// Render the production JSX with the same compiler as the application. CSS names
// are stubbed; accessibility, content and HTML structure remain real React output.
function component(path) {
  const { code } = transformSync(read(path), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" }
  });
  const module = { exports: {} };
  const load = name => name.endsWith(".module.css")
    ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : require(name);
  new Function("require", "module", "exports", code)(load, module, module.exports);
  return module.exports;
}
const { default: CakeLoader, ButtonContent } = component("../src/components/CakeLoader.jsx");
const { default: LoadingSkeleton } = component("../src/components/LoadingSkeleton.jsx");
const { default: LoadingImage } = component("../src/components/LoadingImage.jsx");
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

test("each loader announces the actual pending operation without readable decorative content", () => {
  for (const variant of ["cake", "logo", "spinner", "dots", "pulse"]) {
    const html = render(CakeLoader, { variant, label: "Checking delivery…" });
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /aria-label="Checking delivery…"/);
    assert.match(html, new RegExp(`data-loader-variant="${variant}"`));
    assert.doesNotMatch(html, /<button|<a\b|tabindex=/);
  }
});

test("upload progress is indeterminate until a server response, with no invented percentage", () => {
  const html = render(CakeLoader, { variant: "progress", label: "Uploading your design image…" });
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-label="Uploading your design image…"/);
  assert.doesNotMatch(html, /aria-valuenow|aria-valuetext|\d+%/);
});

test("button content keeps valid inline HTML and switches its accessible text when busy", () => {
  const busy = renderToStaticMarkup(createElement("button", { disabled: true, "aria-busy": true },
    createElement(ButtonContent, { busy: true, pendingLabel: "Sending code…" }, "Send code")));
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /Sending code…/);
  assert.match(busy, /aria-hidden="true"/);
  assert.doesNotMatch(busy, /<div|role="status"|>Send code</);
  const ready = render(ButtonContent, { busy: false, children: "Send code" });
  assert.match(ready, />Send code</);
  assert.doesNotMatch(ready, /spinnerArt|Sending code/);
});

test("inline loaders render a span and each responsive size is retained", () => {
  for (const size of ["small", "medium", "large"]) {
    const html = render(CakeLoader, { size, variant: "spinner", inline: true });
    assert.match(html, /^<span/);
    assert.match(html, new RegExp(`data-cake-loader="${size}"`));
    assert.doesNotMatch(html, /<div/);
  }
});

test("skeleton content is hidden from assistive technology and contains no fake products", () => {
  for (const layout of ["products", "categories", "rows", "detail"]) {
    const html = render(LoadingSkeleton, { layout, label: "Loading your orders…" });
    assert.match(html, /role="status"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /Loading your orders…/);
    assert.doesNotMatch(html, /<button|<a\b|<img|₹/);
  }
});

test("image shimmer preserves the image, alt text, responsive sources and native lazy loading in SSR", () => {
  const html = render(LoadingImage, { src: "/cake.webp", srcSet: "/cake.webp 320w, /cake-large.webp 640w", alt: "Chocolate cake", loading: "lazy" });
  assert.match(html, /^<img/);
  assert.match(html, /data-image-state="loading"/);
  assert.match(html, /alt="Chocolate cake"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /src="\/cake.webp"/);
  assert.match(html, /srcSet="\/cake.webp 320w, \/cake-large.webp 640w"/);
  assert.doesNotMatch(html, /opacity|hidden|<div/);
});

test("animated styles and the cake artwork honour reduced motion", () => {
  for (const path of ["../src/components/CakeLoader.module.css", "../src/components/LoadingImage.module.css", "../public/images/loaders/cake-galaxy-outline-loader.svg"]) {
    assert.match(read(path), /prefers-reduced-motion:\s*reduce/);
    assert.match(read(path), /animation:\s*none/);
  }
});
