export const dynamic = "force-static";
import catalog from "../src/seo/snapshot";

const origin = "https://cakegalaxy.in";

export default function sitemap() {
  return [
    { url: origin + "/", changeFrequency: "weekly", priority: 1 },
    { url: origin + "/shop/", changeFrequency: "weekly", priority: 0.9 },
    { url: origin + "/menu/", changeFrequency: "weekly", priority: 0.8 },
    { url: origin + "/custom/", changeFrequency: "monthly", priority: 0.8 },
    { url: origin + "/help/", changeFrequency: "monthly", priority: 0.5 },
    { url: origin + "/visit/", changeFrequency: "monthly", priority: 0.8 },
    ...catalog.categories.map((category) => ({ url: origin + category.seoPath, changeFrequency: "weekly", priority: 0.7 })),
    ...catalog.products.map((product) => ({ url: origin + product.seoPath, changeFrequency: "weekly", priority: 0.8,
      ...(product.updatedAt && Number.isFinite(Date.parse(product.updatedAt)) ? { lastModified: product.updatedAt } : {}) }))
  ];
}
