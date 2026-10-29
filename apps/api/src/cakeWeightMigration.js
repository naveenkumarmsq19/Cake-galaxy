import { approvedCakeIds, approvedWeightsKg } from "@cake-galaxy/catalog";
import { Product, CatalogueRelease } from "./models.js";

export const weightLimitReleaseKey="cake-weight-options-0_5-1-2-3-4-5-v1";

/** One-time, idempotent production data migration; never rewrite paid/order history. */
export async function applyCakeWeightLimit() {
 if (await CatalogueRelease.exists({key:weightLimitReleaseKey})) return {alreadyApplied:true};
 // Approved cake prices have 0.5 kg as the reference and support all six weights.
 await Product.updateMany(
   {unit:"kg",id:{$in:approvedCakeIds}},
   {$set:{weights:[...approvedWeightsKg]}}
 );
 // Any other kg-based products retain only previously offered, permitted sizes.
 const other=await Product.find({unit:"kg",id:{$nin:approvedCakeIds}},{_id:1,weights:1,active:1}).lean();
 for (const product of other) {
   const allowed=[...new Set((product.weights||[]).filter(weight=>approvedWeightsKg.includes(weight)))].sort((a,b)=>a-b);
   await Product.updateOne({_id:product._id},{$set:{
     weights:allowed,
     ...(!allowed.length&&product.active?{active:false}:{})
   }});
 }
 await CatalogueRelease.updateOne(
   {key:weightLimitReleaseKey},
   {$setOnInsert:{key:weightLimitReleaseKey,appliedAt:new Date()}},
   {upsert:true}
 );
 return {updated:true,restrictedCount:other.length};
}
