import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { approvedCakePrices, approvedWeightsKg, discountAmount, catalogueBasePrice, unitPrice } from "@cake-galaxy/catalog";
import { priceItem } from "../src/validation.js";
import { AdminSession, AdminUser, Order } from "../src/models.js";

test("exactly 32 approved cakes have the requested unique IDs and rupee half-kg prices", () => {
  assert.equal(approvedCakePrices.length, 32);
  assert.equal(new Set(approvedCakePrices.map(p => p.id)).size, 32);
  assert.equal(approvedCakePrices.find(p => p.id === "menu-black-forest").halfKg, 399);
  assert.equal(approvedCakePrices.find(p => p.id === "menu-choco-pista").halfKg, 599);
  assert.equal(approvedCakePrices.find(p => p.id === "menu-choco-dates").halfKg, 499);
  assert.equal(approvedCakePrices.find(p => p.id === "menu-blueberry-cheese-cake").halfKg, 649);
  assert.deepEqual(approvedWeightsKg.slice(0,5), [0.5,1,1.5,2,2.5]);
  assert.equal(approvedWeightsKg.at(-1), 20);
});

test("0.5kg stays full price; 1kg and all higher weights take 10% cake-only discount", () => {
  for (const p of approvedCakePrices) {
    const product = { id:p.id, name:p.name, price:p.halfKg*100, active:true,
      weights:approvedWeightsKg, unit:"kg", variantPrices:{}, flavour:p.name,
      eggless:false };
    const i = s => ({productId:p.id,size:s,addons:[],eggless:false});
    assert.equal(unitPrice(i(0.5),product),p.halfKg*100);
    assert.equal(discountAmount(i(0.5),product),0);
    assert.equal(catalogueBasePrice(i(1),product),p.halfKg*200);
    assert.equal(unitPrice(i(1),product),p.halfKg*180);
    assert.equal(discountAmount(i(1),product),Math.round(p.halfKg*200*0.1));
    const oneKgQuote = priceItem({ ...i(1), flavour:p.name, quantity:1 }, product);
    assert.equal(oneKgQuote.discountPercent,10);
    assert.equal(oneKgQuote.unitPrice,p.halfKg*180);
    for (const size of [1.5,2,2.5,3,10,20]) {
      const full = Math.round(p.halfKg*100*size/0.5);
      assert.equal(catalogueBasePrice(i(size),product),full);
      assert.equal(discountAmount(i(size),product),Math.round(full*0.1));
      assert.equal(unitPrice(i(size),product),full-Math.round(full*0.1));
    }
    const quote = priceItem({ ...i(1.5), flavour:p.name, quantity:1 },product);
    assert.equal(quote.unitPrice,Math.round(p.halfKg*300)-Math.round(p.halfKg*300*0.1));
  }
});

test("branch manager's attention endpoint only reports paid, unaccepted and branch-scoped orders", async () => {
  const branchId=new mongoose.Types.ObjectId(),userId=new mongoose.Types.ObjectId(),raw="f".repeat(64),csrf="d".repeat(48);
  const prior={session:AdminSession.findOne,user:AdminUser.findById,count:Order.countDocuments,find:Order.find};
  let countFilter,findFilter;
  AdminSession.findOne=()=>({lean:async()=>({_id:new mongoose.Types.ObjectId(),userId,csrfToken:csrf,tokenHash:createHash("sha256").update(raw).digest("hex")})});
  AdminUser.findById=()=>({lean:async()=>({_id:userId,role:"branch_manager",branchId,active:true,name:"Manager",email:"manager@example.com"})});
  Order.countDocuments=async filter=>{countFilter=filter;return 2;};
  Order.find=filter=>{findFilter=filter;return{sort:()=>({limit:()=>({lean:async()=>[{reference:"CG-TEST",branchId,createdAt:new Date(),testOrder:true}]})})};};
  const server=createApp().listen(0);await new Promise(resolve=>server.once("listening",resolve));
  try{
    const result=await fetch("http://127.0.0.1:"+server.address().port+"/api/admin/orders/attention",{headers:{Cookie:"cg_admin_session="+raw}});
    assert.equal(result.status,200);
    const data=await result.json();
    assert.equal(data.count,2);
    assert.deepEqual(data.orders.map(o=>o.reference),["CG-TEST"]);
    assert.equal(String(countFilter.branchId),String(branchId));
    assert.equal(String(findFilter.branchId),String(branchId));
    assert.equal(countFilter.status,"confirmed");
    assert.deepEqual(countFilter.paymentStatus,{$in:["paid","test_cod","cod_pending"]});
    assert.deepEqual(countFilter["cancellation.status"],{$nin:["requested","approved"]});
  }finally{
    await new Promise(resolve=>server.close(resolve));
    AdminSession.findOne=prior.session;AdminUser.findById=prior.user;
    Order.countDocuments=prior.count;Order.find=prior.find;
  }
});
