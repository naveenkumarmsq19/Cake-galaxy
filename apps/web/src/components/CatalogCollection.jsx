"use client";

import Link from "next/link";
import { useStore } from "./Storefront";
import { ProductCard } from "./Products";
import { LoadingPage } from "./LoadingSkeleton";
import { collectionPath, siteUrl } from "../seo/urls.mjs";
import { jsonLd } from "../seo/site.mjs";

export default function CatalogCollection({ slug }) {
  const { catalog, categories, catalogLoaded } = useStore();
  const category = categories.find((item) => item.slug === slug);
  if (!catalogLoaded) return <LoadingPage title="Cake collection" label="Loading cake category…" count={8}/>;
  const products = category ? catalog.filter((product) => product.category?.includes(category.name)) : [];
  if (!category || !products.length) return <div className="wrap page empty-state"><h1>This category is currently unavailable</h1><Link href="/shop/">Explore available cakes</Link></div>;
  const graph = { "@context": "https://schema.org", "@type": "CollectionPage", name: category.name + " in Bengaluru", url: siteUrl + collectionPath(slug),
    mainEntity: { "@type": "ItemList", itemListElement: products.filter((product) => product.seoPath).map((product, index) => ({ "@type": "ListItem", position: index + 1, name: product.name, url: siteUrl + product.seoPath })) } };
  return <div className="wrap page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }}/>
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop/">Cakes</Link><span>/</span>{category.name}</div>
    <div className="page-heading"><div><h1>{category.name} in Bengaluru</h1><p>Explore {category.name.toLowerCase()} from Cake Galaxy in Nagarbhavi. Open a cake to view available weights, current pricing and personalisation options.</p></div></div>
    <p className="subtle">Check your delivery pincode before ordering. Add-ons and delivery charges are separate.</p>
    <div className="products">{products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
    <p><Link href="/menu/" className="text-link">Full cake menu &amp; prices</Link>{" · "}<Link href="/custom/" className="text-link">Request a custom design</Link>{" · "}<Link href="/visit/" className="text-link">Visit Cake Galaxy</Link></p>
  </div>;
}
