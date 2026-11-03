import { cakePath, collectionPath } from "./urls.mjs";
import { approvedWeightsKg, unitPrice } from "@cake-galaxy/catalog";

// Accept only the public, currently enabled API catalogue. Never fall back to demo inventory.
export function searchCatalog(data) {
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories)) {
    throw new Error("The public catalogue response must contain products and categories arrays.");
  }
  const ids = new Set();
  const products = data.products.map((product) => {
    if (!product || typeof product.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(product.id)
      || ids.has(product.id) || typeof product.name !== "string" || !product.name.trim()
      || !Number.isSafeInteger(product.price) || product.price <= 0
      || !Array.isArray(product.weights) || !product.weights.length
      || !product.weights.every((weight) => Number.isFinite(weight) && weight > 0 && (product.unit !== "kg" || approvedWeightsKg.includes(weight)))
      || !Number.isSafeInteger(unitPrice({ size: product.weights[0], eggless: false, addons: [] }, product))
      || unitPrice({ size: product.weights[0], eggless: false, addons: [] }, product) <= 0
      || product.active === false || product.deletedAt) {
      throw new Error("An invalid, duplicate or inactive product was returned by the public catalogue.");
    }
    ids.add(product.id);
    // Allowlist public fields so future API additions cannot publish private data into HTML.
    return Object.fromEntries([
      "id", "name", "description", "badge", "category", "menuCategory", "flavour", "image", "images",
      "price", "unit", "weights", "eggless", "photo", "leadDays", "variantLabels", "variantPrices", "updatedAt"
    ].filter((key) => product[key] !== undefined).map((key) => [key, product[key]]).concat([["seoPath", cakePath(product.id)]]));
  });
  const slugs = new Set();
  const categories = data.categories.filter((category) => category.active && products.some((product) => product.category?.includes(category.name))).map((category) => {
    if (typeof category.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || slugs.has(category.slug)) {
      throw new Error("A category has an invalid or duplicate URL slug.");
    }
    slugs.add(category.slug);
    return { name: category.name, slug: category.slug, active: true, image: category.image, seoPath: collectionPath(category.slug) };
  });
  return { products, categories };
}
