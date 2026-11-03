import test from "node:test";
import assert from "node:assert/strict";
import { searchCatalog } from "../src/seo/catalog.mjs";
import { bakeryGraph, faqGraph, jsonLd, pageMetadata, productGraph } from "../src/seo/site.mjs";
import { cakeFaqs } from "../src/content/faqs.mjs";
import { cakePath, productHref, publicImage } from "../src/seo/urls.mjs";
import robots from "../app/robots.js";

const cake = { id: "approved-cake", name: "Chocolate Cake", description: "Chocolate celebration cake.", price: 44900, unit: "kg", weights: [0.5, 1, 2], category: ["Chocolate Cakes"], image: "/api/product-images/approved-photo" };
const data = (products = [cake]) => ({ products, categories: [{ name: "Chocolate Cakes", slug: "chocolate-cakes", active: true }] });

test("search catalogue includes public products only and strips extra API fields", () => {
  const result = searchCatalog(data([{ ...cake, internalNote: "private", supplierCost: 123, contact: "private" }]));
  assert.equal(result.products[0].seoPath, "/cakes/approved-cake/");
  assert.equal(result.products[0].internalNote, undefined);
  assert.equal(result.products[0].supplierCost, undefined);
  assert.equal(result.products[0].contact, undefined);
  assert.equal(result.categories[0].seoPath, "/collections/chocolate-cakes/");
  assert.deepEqual(searchCatalog(data([])), { products: [], categories: [] });
});

test("invalid catalogue data stops the build instead of publishing demo inventory", () => {
  for (const value of [null, {}, { products: [], categories: null }]) assert.throws(() => searchCatalog(value));
  for (const change of [{ id: "../private" }, { active: false }, { deletedAt: "2026-11-01" }, { price: 0 }, { price: 1.1 }, { weights: [] }, { weights: [-1] }]) {
    assert.throws(() => searchCatalog(data([{ ...cake, ...change }])));
  }
  assert.throws(() => searchCatalog(data([cake, cake])));
});

test("schema uses INR and the same weight discount as the checkout pricing engine", () => {
  const product = searchCatalog(data()).products[0];
  assert.equal(productGraph(product).offers.price, "449.00");
  assert.equal(productGraph({ ...product, weights: [1, 2], price: 89800 }).offers.price, "808.20");
  const schema = productGraph(product);
  assert.equal(schema.offers.priceCurrency, "INR");
  assert.equal(schema.offers.url, "https://cakegalaxy.in/cakes/approved-cake/");
  assert.deepEqual(schema.image, ["https://cakegalaxy.in/api/product-images/approved-photo"]);
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.offers.availability, undefined);
  const bakery = bakeryGraph()["@graph"][0];
  assert.equal(bakery.telephone, undefined);
  assert.equal(bakery.openingHoursSpecification, undefined);
});

test("each page gets matching canonical and social URLs rather than inherited homepage metadata", () => {
  const meta = pageMetadata({ title: "Chocolate cakes", description: "Available cakes.", path: "/collections/chocolate-cakes/" });
  assert.equal(meta.alternates.canonical, "/collections/chocolate-cakes/");
  assert.equal(meta.openGraph.url, "https://cakegalaxy.in/collections/chocolate-cakes/");
  assert.equal(meta.openGraph.title, meta.twitter.title);
  assert.equal(meta.openGraph.description, meta.description);
});

test("new products retain purchase links until their static page is built", () => {
  assert.equal(productHref(cake), "/product?id=approved-cake");
  assert.equal(productHref({ ...cake, seoPath: cakePath(cake.id) }), "/cakes/approved-cake/");
});

test("structured data safely escapes script termination and rejects non-HTTPS images", () => {
  const encoded = jsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!encoded.includes("</script>"));
  assert.equal(JSON.parse(encoded).name, "</script><script>alert(1)</script>");
  for (const value of ["javascript:alert(1)", "data:image/png,test", "http://example.com/cake.jpg", "https://user:pass@example.com/photo"]) assert.equal(publicImage(value), undefined);
});

test("answer schema uses exactly the shared visible question and answer content", () => {
  const graph = faqGraph(cakeFaqs);
  assert.deepEqual(graph.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]), cakeFaqs.map((item) => [item.question, item.answer]));
});

test("robots permits public cake images while preserving the API and admin exclusions", () => {
  const result = robots();
  assert.ok(result.rules.allow.includes("/api/product-images/"));
  assert.ok(result.rules.disallow.includes("/api/"));
  assert.ok(result.rules.disallow.includes("/admin"));
  assert.equal(result.rules.userAgent, "*");
});
