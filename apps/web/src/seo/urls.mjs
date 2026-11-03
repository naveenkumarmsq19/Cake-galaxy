export const siteUrl = "https://cakegalaxy.in";
export const cakePath = (id) => "/cakes/" + encodeURIComponent(id) + "/";
export const collectionPath = (slug) => "/collections/" + encodeURIComponent(slug) + "/";
// New products retain a working purchase page until the next static deployment.
export const productHref = (product) => product.seoPath || "/product?id=" + encodeURIComponent(product.id);
export const categoryHref = (category) => category.seoPath || "/shop?category=" + encodeURIComponent(category.name);

export function publicImage(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, siteUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
