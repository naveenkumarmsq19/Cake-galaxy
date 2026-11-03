import { notFound } from "next/navigation";
import catalog from "../../../src/seo/snapshot";
import { Product } from "../../../src/screens/Browse";
import { StructuredData } from "../../../src/components/SearchContent";
import { breadcrumbs, productMetadata } from "../../../src/seo/site.mjs";

export const dynamicParams = false;
export function generateStaticParams() { return catalog.products.map(({ id }) => ({ id })); }
export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = catalog.products.find((item) => item.id === id);
  if (!product) notFound();
  return productMetadata(product);
}
export default async function Page({ params }) {
  const { id } = await params;
  const product = catalog.products.find((item) => item.id === id);
  if (!product) notFound();
  return <><StructuredData data={breadcrumbs([{ name: "Cakes", path: "/shop/" }, { name: product.name, path: product.seoPath }])}/><Product productId={id}/></>;
}
