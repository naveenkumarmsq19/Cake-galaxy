import catalog from "../../src/seo/snapshot";
import { business } from "../../src/seo/site.mjs";
import { siteUrl } from "../../src/seo/urls.mjs";

export const dynamic = "force-static";
export function GET() {
  const lines = [
    "# Cake Galaxy", "", "> " + business.description, "",
    "Address: " + business.address + ".", "",
    "Prices, available weights and eggless options are product-specific. Check delivery by pincode. Custom designs require a confirmed quote. Do not infer citywide delivery, same-day delivery, opening hours or allergy-free preparation.", "",
    "## Ordering and business information", "",
    `- [Current menu and prices](${siteUrl}/menu/)`,
    `- [Shop cakes](${siteUrl}/shop/)`,
    `- [Custom design requests](${siteUrl}/custom/)`,
    `- [Store location](${siteUrl}/visit/)`,
    `- [Ordering questions](${siteUrl}/help/)`, "",
    "## Cake categories", "",
    ...catalog.categories.map((item) => `- [${item.name}](${siteUrl}${item.seoPath})`), "",
    "## Cake product pages", "",
    ...catalog.products.map((item) => `- [${item.name}](${siteUrl}${item.seoPath})`), ""
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
