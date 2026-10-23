// Read-only browser audit of Cake Galaxy production. No OTP, order, payment, refund,
// product/admin write, or authentication action is performed.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const BASE = process.env.CAKE_GALAXY_URL || "https://cakegalaxy.in";
const report = { site: BASE, testedAt: new Date().toISOString(), publicPages: [], api: [], images: [], errors: [] };
const points = [];
const record = (kind, name, state, detail = "") => {
  const item = { kind, name, state, detail };
  points.push(item);
  console.log(JSON.stringify(item));
};
await mkdir("qa-artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ignoreHTTPSErrors: false });
  const publicEndpoints = ["/api/health", "/api/ready", "/api/catalog", "/api/checkout/config", "/api/delivery?pincode=560072"];
  let catalog = [];
  for (const endpoint of publicEndpoints) {
    try {
      const response = await context.request.get(BASE + endpoint, { timeout: 22000 });
      let body = null;
      try { body = await response.json(); } catch {}
      const status = response.status();
      const summary = endpoint === "/api/catalog" ? "products=" + (body?.products?.length ?? "unreadable") + "; categories=" + (body?.categories?.length ?? "unreadable") : (body?.error || "");
      record("api", endpoint, response.ok() ? "PASS" : "FAIL", "HTTP " + status + (summary ? "; " + summary : ""));
      report.api.push({ endpoint, status, ok: response.ok(), summary });
      if (endpoint === "/api/catalog" && Array.isArray(body?.products)) catalog = body.products;
    } catch (e) {
      const detail = String(e?.message || e).slice(0,350);
      record("api", endpoint, "BLOCKED", detail);
      report.api.push({ endpoint, ok: false, detail });
    }
  }
  const first = catalog.find(p=>p.id && (p.images?.length || p.image));
  const urls = [
    "/", "/shop/", "/menu/", "/custom/", "/cart/", "/address/",
    "/checkout/", "/orders/", "/help/", "/policy/?type=refund", "/admin/",
    ...(first ? ["/product/?id=" + encodeURIComponent(first.id)] : [])
  ];
  for (const width of [390, 1440]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    for (const url of urls) {
      const name = width + "px " + url;
      try {
        const response = await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1400);
        const values = await page.evaluate(() => ({
          title: document.title,
          bodyText: document.body.innerText.slice(0, 800),
          overflows: document.documentElement.scrollWidth > window.innerWidth + 3,
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          visibleImages: [...document.images].filter(i=>i.getBoundingClientRect().width>0).length,
          brokenImages: [...document.images].filter(i=>i.getBoundingClientRect().width>0 && i.complete && i.naturalWidth===0).map(i=>i.src).slice(0,6)
        }));
        const status = response?.status() ?? 0;
        const htmlOk = status >= 200 && status < 400 && values.bodyText.length > 20;
        const pass = htmlOk && !values.overflows && values.brokenImages.length === 0;
        const detail = "HTTP " + status + "; page=" + values.title + "; width=" + values.scrollWidth + "/" + values.viewport +
          "; brokenImages=" + values.brokenImages.length + (values.overflows ? "; HORIZONTAL OVERFLOW" : "");
        record("browser", name, pass ? "PASS" : "FAIL", detail);
        report.publicPages.push({ url, width, pass, status, ...values });
        if (!pass) await page.screenshot({ path: "qa-artifacts/" + width + "_" + url.replace(/[^a-z0-9]/gi, "-").slice(0,40) + ".png", fullPage: true }).catch(()=>{});
      } catch(e) {
        record("browser", name, "BLOCKED", String(e?.message||e).slice(0,300));
        report.publicPages.push({url,width,pass:false,blocked:true,message:String(e?.message||e).slice(0,300)});
      }
    }
    await page.close();
  }
  if (first) {
    // Read-only: validate first gallery image for every public product.
    for (const product of catalog) {
      const src = product.images?.[0] || product.image;
      if (!src) { record("image", product.id, "FAIL", "Missing image URL");continue; }
      const url = new URL(src, BASE).href;
      try {
        const response = await context.request.get(url, { timeout: 15000, headers: { Range: "bytes=0-1023" } });
        const type = response.headers()["content-type"] || "";
        const ok = response.ok() && type.startsWith("image/");
        record("image", product.id, ok ? "PASS" : "FAIL", "HTTP " + response.status() + "; content-type=" + type);
        report.images.push({productId:product.id,status:response.status(),ok,type,url});
      } catch(e) {
        record("image", product.id, "BLOCKED", String(e?.message || e).slice(0,200));
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
}
report.summary = {
  passed: points.filter(p=>p.state==="PASS").length,
  failed: points.filter(p=>p.state==="FAIL").length,
  blocked: points.filter(p=>p.state==="BLOCKED").length,
  total: points.length
};
await writeFile("qa-artifacts/report.json", JSON.stringify(report,null,2));
console.log("QA_SUMMARY " + JSON.stringify(report.summary));
// Non-zero on actual application failure. A fully blocked environment still reports its own blocker.
if(report.summary.failed > 0 || report.summary.blocked > 0) process.exitCode = 1;
