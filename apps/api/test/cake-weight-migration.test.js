import test from "node:test";
import assert from "node:assert/strict";
import { approvedCakeIds, approvedWeightsKg } from "@cake-galaxy/catalog";
import { Product, CatalogueRelease } from "../src/models.js";
import { applyCakeWeightLimit, weightLimitReleaseKey } from "../src/cakeWeightMigration.js";

test("production migration sets approved cakes to six options and restricts legacy kg products",async()=>{
 const original={exists:CatalogueRelease.exists,releaseUpdate:CatalogueRelease.updateOne,bulk:Product.updateMany,find:Product.find,productUpdate:Product.updateOne};
 const calls=[];
 CatalogueRelease.exists=async()=>false;
 CatalogueRelease.updateOne=async(filter,update,options)=>{calls.push({kind:"release",filter,update,options});};
 Product.updateMany=async(filter,update)=>{calls.push({kind:"approved",filter,update});};
 Product.find=()=>({lean:async()=>[
   {_id:"old",weights:[0.5,1,1.5,2.5,4,10],active:true},
   {_id:"unsupported",weights:[10,20],active:true}
 ]});
 Product.updateOne=async(filter,update)=>{calls.push({kind:"other",filter,update});};
 try{
   const output=await applyCakeWeightLimit();
   assert.equal(output.updated,true);
   assert.deepEqual(calls[0].update.$set.weights,[0.5,1,2,3,4,5]);
   assert.deepEqual(calls[0].filter.id.$in,approvedCakeIds);
   assert.deepEqual(calls[1].update.$set.weights,[0.5,1,4]);
   assert.deepEqual(calls[2].update.$set.weights,[]);
   assert.equal(calls[2].update.$set.active,false);
   assert.equal(calls[3].filter.key,weightLimitReleaseKey);
   assert.equal(calls[3].options.upsert,true);
 }finally{
   CatalogueRelease.exists=original.exists;CatalogueRelease.updateOne=original.releaseUpdate;
   Product.updateMany=original.bulk;Product.find=original.find;Product.updateOne=original.productUpdate;
 }
});
test("migration is idempotent and skips writes after release key exists",async()=>{
 const oldExists=CatalogueRelease.exists;
 CatalogueRelease.exists=async()=>true;
 try{assert.deepEqual(await applyCakeWeightLimit(),{alreadyApplied:true});}
 finally{CatalogueRelease.exists=oldExists;}
});
