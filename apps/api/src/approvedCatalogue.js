import { approvedCakePrices, approvedWeightsKg, menuProducts } from "@cake-galaxy/catalog";
import { Product, CatalogueRelease } from "./models.js";

export const launchReleaseKey = "approved-32-halfkg-prices-2026-10-23-v1";

const promotionCopyReleaseKey = "approved-32-discount-from-1kg-2026-10-25-v1";

function cakeDescription(cake, offerThreshold) {
  return "Cake Galaxy " + cake.name + ". Half kilogram price: ₹" + cake.halfKg + ". Larger cakes are priced by weight, with 10% off cake prices " + offerThreshold + ". Images may be illustrative until product-specific photos are uploaded.";
}

// Only repair the original generated copy. Preserve any descriptions edited in Admin.
async function refreshLegacyOfferCopy() {
  if (await CatalogueRelease.exists({ key: promotionCopyReleaseKey })) return;
  const writes = approvedCakePrices.map(cake => ({ updateOne: {
    filter: { id: cake.id, description: cakeDescription(cake, "above 1 kg") },
    update: { $set: { description: cakeDescription(cake, "at 1 kg and above") } }
  } }));
  await Product.bulkWrite(writes, { ordered: true });
  await CatalogueRelease.updateOne({ key: promotionCopyReleaseKey }, { $setOnInsert: { key: promotionCopyReleaseKey, appliedAt: new Date() } }, { upsert: true });
}

export async function applyApprovedLaunchCatalogue() {
  if (await CatalogueRelease.exists({ key: launchReleaseKey })) {
    await refreshLegacyOfferCopy();
    return { alreadyApplied: true };
  }
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
          description: cakeDescription(cake, "at 1 kg and above"),
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
