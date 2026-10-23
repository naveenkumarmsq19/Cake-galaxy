import { approvedCakePrices, approvedWeightsKg, menuProducts } from "@cake-galaxy/catalog";
import { Product, CatalogueRelease } from "./models.js";

export const launchReleaseKey = "approved-32-halfkg-prices-2026-10-23-v1";

export async function applyApprovedLaunchCatalogue() {
  if (await CatalogueRelease.exists({ key: launchReleaseKey })) return { alreadyApplied: true };
  const ids = approvedCakePrices.map(c => c.id);
  if (new Set(ids).size !== 32) throw new Error("Approved catalogue IDs are not unique.");

  // Executed after MongoDB connects and before HTTP starts; safe to retry if deployment restarts.
  // Never remove records or photo galleries. Never reapply on every restart after success.
  await Product.updateMany({ id: { $nin: ids }, active: true }, { $set: { active: false } });
  const writes = approvedCakePrices.map(cake => {
    const existingMenu = menuProducts.find(item => item.id === cake.id);
    return { updateOne: { filter: { id: cake.id }, upsert: true,
      update: {
        $set: {
          name: cake.name, price: cake.halfKg * 100, weights: approvedWeightsKg,
          unit: "kg", variantPrices: {}, variantLabels: {},
          active: true, deletedAt: null, eggless: false,
          menuCategory: cake.category, category: [cake.category, "Birthday"],
          flavour: cake.name.replace(/ Cake$| Cheesecake$/i, ""),
          description: "Cake Galaxy " + cake.name + ". Half kilogram price: ₹" + cake.halfKg + ". Larger cakes are priced by weight, with 10% off cake prices above 1 kg. Images may be illustrative until product-specific photos are uploaded.",
          menuImported: true
        },
        $setOnInsert: {
          image: existingMenu?.image || "/images/celebration.jpg", images: [],
          badge: "New on Cake Galaxy",
          leadDays: cake.id === "menu-blueberry-cheese-cake" ? 1 : 0
        }
      }
    } };
  });
  await Product.bulkWrite(writes, { ordered: true });
  await CatalogueRelease.updateOne({ key: launchReleaseKey }, { $setOnInsert: { key: launchReleaseKey, appliedAt: new Date() } }, { upsert: true });
  return { enabled: ids.length, disabledOthers: true };
}
