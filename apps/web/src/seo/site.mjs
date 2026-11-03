import { money, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { productHref, publicImage, siteUrl } from "./urls.mjs";

export const business = {
  name: "Cake Galaxy",
  address: "No. 1, Nagarabhavi Main Road, opposite Bank of Baroda, Mudalapalya, Bengaluru, Karnataka 560072",
  description: "Birthday cakes, photo cakes and personalised celebration cakes from Cake Galaxy in Nagarbhavi, Bengaluru. Check your pincode for delivery availability.",
  image: "/images/celebration-banner.webp"
};

export function pageMetadata({ title, description, path, image = business.image }) {
  const fullTitle = title.includes("Cake Galaxy") ? title : title + " | Cake Galaxy";
  return {
    title: { absolute: fullTitle }, description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "en_IN", siteName: business.name, url: siteUrl + path, title: fullTitle, description,
      images: [{ url: publicImage(image) || siteUrl + business.image, alt: title }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [publicImage(image) || siteUrl + business.image] }
  };
}

export function bakeryGraph() {
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Bakery", "@id": siteUrl + "/#bakery", name: business.name, url: siteUrl + "/",
      description: business.description, image: siteUrl + business.image, logo: siteUrl + "/images/cake-galaxy-sage-logo.webp",
      address: { "@type": "PostalAddress", streetAddress: "No. 1, Nagarabhavi Main Road, opposite Bank of Baroda, Mudalapalya, Govindaraja Nagar Ward",
        addressLocality: "Bengaluru", addressRegion: "Karnataka", postalCode: "560072", addressCountry: "IN" } },
    { "@type": "WebSite", "@id": siteUrl + "/#website", name: business.name, url: siteUrl + "/",
      publisher: { "@id": siteUrl + "/#bakery" }, inLanguage: "en-IN" }
  ] };
}

export function breadcrumbs(items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl + item.path })) };
}

export function productGraph(product) {
  const url = siteUrl + productHref(product);
  const price = unitPrice({ productId: product.id, size: product.weights[0], eggless: false, addons: [] }, product);
  const images = (product.images?.length ? product.images : [product.image]).map(publicImage).filter(Boolean);
  return { "@context": "https://schema.org", "@type": "Product", "@id": url + "#product", url,
    name: product.name, description: product.description, sku: product.id, image: images,
    brand: { "@type": "Brand", name: business.name },
    offers: { "@type": "Offer", url, name: product.name + " · " + sizeLabel(product), price: (price / 100).toFixed(2), priceCurrency: "INR",
      seller: { "@id": siteUrl + "/#bakery" } }
  };
}

export function productMetadata(product) {
  const price = unitPrice({ productId: product.id, size: product.weights[0], eggless: false, addons: [] }, product);
  return pageMetadata({ title: product.name + " in Bengaluru", path: productHref(product), image: product.images?.[0] || product.image,
    description: `${product.name} from ${money(price)} for ${sizeLabel(product)} at Cake Galaxy, Nagarbhavi. View available weights and personalisation. Check your delivery pincode.` });
}

export function faqGraph(items) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(({ question, answer }) => ({
    "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer }
  })) };
}

export const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
