import test from "node:test";
import assert from "node:assert/strict";
import { parseCancellation, visibleCancellation, verifyRefund, reasons } from "../src/cancellations.js";
import { products, egglessSurcharge, regularUnitPrice, discountAmount, unitPrice } from "@cake-galaxy/catalog";

test("Customer must choose a valid category and detailed cancellation reason", () => {
  assert.deepEqual(Object.keys(reasons), ["changed_mind", "ordered_by_mistake", "wrong_order", "delivery_issue", "other"]);
  const request = parseCancellation({category:"wrong_order",reason:"I selected the wrong cake flavour"});
  assert.equal(request.status, "requested");
  assert.equal(request.category, "wrong_order");
  assert.match(request.reason, /wrong cake/);
  for (const body of [{category:"invalid",reason:"The cake was ordered in error"},
    {category:"other",reason:"short"}, {category:"delivery_issue",reason:""}]) {
    assert.throws(() => parseCancellation(body),e=>e.status===400);
  }
});

test("Customer cancellation state never exposes refund idempotency keys or private reviewers", () => {
  const c=visibleCancellation({status:"approved",reason:"Changed plans completely",reviewedBy:"private-admin",refund:{
    idempotencyKey:"secret-key",status:"pending",amount:50000,id:"rfnd_ABC123"}});
  assert.equal(c.refund.id,"rfnd_ABC123");
  assert.equal(JSON.stringify(c).includes("private-admin"),false);
  assert.equal(JSON.stringify(c).includes("secret-key"),false);
});

test("Validate Razorpay refund ID, payment ID, amount and status before recording it", () => {
  const valid={id:"rfnd_ABC123",payment_id:"pay_ABC",amount:45000,currency:"INR",status:"pending"};
  assert.equal(verifyRefund(valid,"pay_ABC",45000),"pending");
  for (const invalid of [{...valid,amount:45001},{...valid,payment_id:"pay_OTHER"},
    {...valid,status:"random"},{...valid,id:"not-refund"}]) {
    assert.throws(()=>verifyRefund(invalid,"pay_ABC",45000),e=>e.status===502);
  }
});

test("Eggless scales by ₹50 for each 500g and never receives cake-only percentage discount", () => {
  for (const p of products.filter(item=>item.unit==="kg" && item.eggless)) {
    for (const weight of p.weights) {
      const plain={size:weight,eggless:false,addons:[]};
      const eggless={size:weight,eggless:true,addons:[]};
      const fee=Math.round(weight/0.5)*5000;
      assert.equal(egglessSurcharge(eggless,p),fee,p.id+" "+weight);
      assert.equal(unitPrice(eggless,p)-unitPrice(plain,p),fee,p.id+" "+weight);
      assert.equal(regularUnitPrice(eggless,p)-regularUnitPrice(plain,p),fee,p.id+" "+weight);
      assert.equal(discountAmount(eggless,p),discountAmount(plain,p));
    }
  }
});
