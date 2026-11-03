import { mkdir, writeFile } from "node:fs/promises";
import { searchCatalog } from "../apps/web/src/seo/catalog.mjs";

const endpoint = new URL(process.env.SEO_CATALOG_URL || "https://cakegalaxy.in/api/catalog");
if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
  throw new Error("SEO_CATALOG_URL must be a public HTTPS catalogue endpoint without credentials.");
}
const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
  throw new Error("Could not read the public catalogue. Keep the last successful deployment; do not publish sample products.");
}
const catalog = searchCatalog(await response.json());
const directory = new URL("../apps/web/src/generated/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("search-catalog.json", directory), JSON.stringify(catalog));
console.log(`Prepared search pages for ${catalog.products.length} public cakes and ${catalog.categories.length} categories.`);
