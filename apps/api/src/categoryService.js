import { menuSections } from "@cake-galaxy/catalog";
import { Category, Product } from "./models.js";

// Customer-facing categories. Legacy occasion/menu categories are retained as disabled records.
export const defaultCategories = [
  { name: "Cheesecakes", keywords: ["cheesecake", "cheese cake"], sortOrder: 10, image: "/images/berry.jpg" },
  { name: "Forest Cakes", keywords: ["forest"], sortOrder: 20, image: "/images/chocolate.jpg" },
  { name: "Velvet Cakes", keywords: ["velvet"], sortOrder: 30, image: "/images/berry.jpg" },
  { name: "Nut & Dry Fruit Cakes", keywords: ["almond", "badam", "pista", "hazelnut", "nuts", "nut cake", "dry fruit", "dates"], sortOrder: 40, image: "/images/chocolate.jpg" },
  { name: "Fruit Cakes", keywords: ["currant", "blueberry", "strawberry", "pineapple", "mango", "cherry", "fruit", "lemon"], sortOrder: 50, image: "/images/berry.jpg" },
  { name: "Special Cakes", keywords: ["rainbow", "triple queen", "rocky road", "rasmalai"], sortOrder: 60, image: "/images/celebration.jpg" },
  { name: "Chocolate Cakes", keywords: ["chocolate", "choco", "nutella", "ferrero", "ferraro", "cocoa", "mocha"], sortOrder: 70, image: "/images/chocolate.jpg" },
  { name: "Signature Cakes", keywords: [], sortOrder: 1000, image: "/images/celebration.jpg" }
];
export const categorySlug = name => name.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalize = value => " " + String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") + " ";

export function suggestCategory(product, categories) {
  const text = normalize((product.name || "") + " " + (product.flavour || ""));
  const active = categories.filter(c => c.active !== false).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  for (const category of active) {
    if (category.name === "Signature Cakes") continue;
    if ((category.keywords || []).some(word => word && text.includes(normalize(word)))) return category.name;
  }
  return active.find(c => c.name === "Signature Cakes")?.name || active.at(-1)?.name || "";
}

export async function syncAutoCategories() {
  const categories = await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const products = await Product.find({ deletedAt: null, categoryMode: { $ne: "manual" } }, { _id: 1, name: 1, flavour: 1, category: 1 }).lean();
  const updates = products.flatMap(product => {
    const name = suggestCategory(product, categories);
    return name && (product.category?.length !== 1 || product.category[0] !== name)
      ? [{ updateOne: { filter: { _id: product._id, categoryMode: { $ne: "manual" } }, update: { $set: { category: [name], categoryMode: "auto" } } } }]
      : [];
  });
  if (updates.length) await Product.bulkWrite(updates);
  return updates.length;
}

export async function bootstrapCategories() {
  const legacy = [...new Set(["Birthday", "Anniversary", "Chocolate", "Kids", "Photo", "Designer", "Cupcakes", "Menu", ...menuSections.map(section => section.title)])];
  await Category.bulkWrite([
    ...defaultCategories.map(c => ({
      updateOne: { filter: { name: c.name }, upsert: true, update: { $setOnInsert: { ...c, slug: categorySlug(c.name), active: true } } }
    })),
    ...legacy.filter(name => !defaultCategories.some(c => c.name === name)).map(name => ({
      updateOne: { filter: { name }, upsert: true, update: { $setOnInsert: { name, slug: categorySlug(name), keywords: [], image: "", active: false, sortOrder: 900 } } }
    }))
  ]);
  return syncAutoCategories();
}
