import { notFound } from "next/navigation";
import catalog from "../../../src/seo/snapshot";
import CatalogCollection from "../../../src/components/CatalogCollection";
import { StructuredData } from "../../../src/components/SearchContent";
import { breadcrumbs, pageMetadata } from "../../../src/seo/site.mjs";

export const dynamicParams = false;
export function generateStaticParams() { return catalog.categories.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = catalog.categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return pageMetadata({ title: category.name + " in Bengaluru", path: category.seoPath, description: `Explore ${category.name.toLowerCase()} at Cake Galaxy, Nagarbhavi, Bengaluru. View current cake prices, available weights and personalisation. Check delivery by pincode.` });
}
export default async function Page({ params }) {
  const { slug } = await params;
  const category = catalog.categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return <><StructuredData data={breadcrumbs([{ name: "Cakes", path: "/shop/" }, { name: category.name, path: category.seoPath }])}/><CatalogCollection slug={slug}/></>;
}
