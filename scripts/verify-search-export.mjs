import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unitPrice, money } from "@cake-galaxy/catalog";
import { siteUrl } from "../apps/web/src/seo/urls.mjs";

const directory = new URL("../apps/web/out/", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("../apps/web/src/generated/search-catalog.json", import.meta.url), "utf8"));
const xml = await readFile(new URL("sitemap.xml", directory), "utf8");
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(urls).size, urls.length, "duplicate sitemap URL");
assert.equal(urls.length, 6 + catalog.products.length + catalog.categories.length, "missing sitemap pages");
const schema = (html) => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

for (const url of urls) {
  assert.ok(url.startsWith(siteUrl + "/") && !url.includes("?"), "noncanonical sitemap URL: " + url);
  const path = new URL(url).pathname;
  const html = await readFile(new URL(path.slice(1) + "index.html", directory), "utf8");
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(canonicals.length, 1, "expected one canonical: " + path);
  assert.equal(canonicals[0][1], url, "canonical mismatch: " + path);
  assert.ok(!/<meta[^>]*name="(?:robots|googlebot)"[^>]*content="[^"]*noindex/.test(html), "public page is noindex: " + path);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, "expected one rendered H1: " + path);
  assert.ok(html.includes(`property="og:url" content="${url}"`), "wrong social URL: " + path);
  assert.ok(schema(html).some((data) => data["@graph"]?.some((item) => item["@type"] === "Bakery")), "missing business entity: " + path);

  const product = catalog.products.find((item) => item.seoPath === path);
  if (product) {
    const graphs = schema(html).filter((data) => data["@type"] === "Product");
    assert.equal(graphs.length, 1, "expected one product graph: " + path);
    const expectedPrice = unitPrice({ productId: product.id, size: product.weights[0], eggless: false, addons: [] }, product);
    assert.equal(graphs[0].offers.price, (expectedPrice / 100).toFixed(2), "schema price mismatch: " + path);
    assert.ok(html.includes(`class="detail-price">${money(expectedPrice)}</span>`), "price not rendered in initial HTML: " + path);
    assert.ok(html.includes(escapeHtml(product.name)), "name not rendered: " + path);
  }
}
for (const path of ["admin", "orders", "cart", "checkout", "address", "confirmation", "login", "product"]) {
  const html = await readFile(new URL(path + "/index.html", directory), "utf8");
  assert.ok(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), "private or duplicate route lost noindex: " + path);
  assert.ok(!urls.includes(siteUrl + "/" + path + "/"), "private route in sitemap");
}
const menu = await readFile(new URL("menu/index.html", directory), "utf8");
const shop = await readFile(new URL("shop/index.html", directory), "utf8");
for (const product of catalog.products) {
  assert.ok(menu.includes(`href="${product.seoPath}"`), "menu lacks crawlable product link");
  assert.ok(shop.includes(`href="${product.seoPath}"`), "shop fallback lacks crawlable product link");
}
const robots = await readFile(new URL("robots.txt", directory), "utf8");
assert.ok(robots.includes("Allow: /api/product-images/"));
assert.ok(robots.includes("Disallow: /api/"));
const llms = await readFile(new URL("llms.txt", directory), "utf8");
assert.ok(llms.includes(siteUrl + "/visit/"));
console.log(`Verified ${urls.length} canonical public pages, ${catalog.products.length} rendered products, readable menu/shop HTML, structured prices, sitemap and private-page exclusions.`);
