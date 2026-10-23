import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp } from "../src/app.js";
import { Session, AdminSession, AdminUser, Order } from "../src/models.js";

// No database or real network/provider requests are used in this test.
const digest = v => createHash("sha256").update(v).digest("hex");
const getPath = (object, path) => path.split(".").reduce((a,k)=>a?.[k],object);
const matches = (object, query) => Object.entries(query).every(([key, value]) => {
  const actual = getPath(object,key);
  if (value && typeof value === "object" && !Array.isArray(value) && !("getTime" in value)) {
    if ("$in" in value) return value.$in.includes(actual);
    if ("$nin" in value) return !value.$nin.includes(actual);
    if ("$ne" in value) return actual !== value.$ne;
    if ("$exists" in value) return (actual !== undefined) === value.$exists;
  }
  return actual === value;
});
const patch = (object, update) => {
  for (const [path, value] of Object.entries(update.$set || {})) {
    const fields=path.split(".");let v=object;
    for (const field of fields.slice(0,-1)) v=v[field] ||= {};
    v[fields.at(-1)]=value;
  }
};
test("customer cancellation → super admin approval → one idempotent full refund → webhook confirmation", async () => {
  const old = {
    customer: Session.findOne, session: AdminSession.findOne, admin: AdminUser.findById,
    find: Order.findOne, update: Order.findOneAndUpdate, one: Order.updateOne,
    fetch: globalThis.fetch, key:process.env.RAZORPAY_KEY_ID, secret:process.env.RAZORPAY_KEY_SECRET
  };
  process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
  process.env.RAZORPAY_KEY_SECRET = "mock_secret";
  const cToken="c".repeat(64),aToken="a".repeat(64),csrf="f".repeat(48);
  const order={
    _id:"some-order-id",reference:"CGREFUND01",customerPhone:"9876543210",
    paymentStatus:"paid", status:"confirmed", amount:44900, razorpayPaymentId:"pay_MOCK1",
    delivery:{date:"2026-11-04",slot:"1 PM – 4 PM"},updatedAt:new Date(),
    address:{name:"Customer",line1:"Road",city:"Bengaluru",pincode:"560072"}
  };
  let refundCalls=0;
  Session.findOne=()=>({lean:async()=>({phone:order.customerPhone,csrfToken:csrf})});
  AdminSession.findOne=()=>({lean:async()=>({userId:"admin",csrfToken:csrf,expiresAt:new Date(Date.now()+86400000)})});
  AdminUser.findById=()=>({lean:async()=>({_id:"admin",role:"super_admin",active:true,name:"Cake Admin"})});
  Order.findOne=(query)=>({lean:async()=>matches(order,query)?structuredClone(order):null});
  Order.findOneAndUpdate=async(query,update)=>{if(!matches(order,query))return null;patch(order,update);return structuredClone(order)};
  Order.updateOne=async(query,update)=>{if(!matches(order,query))return {matchedCount:0};patch(order,update);return {matchedCount:1}};
  globalThis.fetch=async(url,opts)=>{
    if (String(url).startsWith("https://api.razorpay.com/v1/payments/pay_MOCK1/refund")) {
      refundCalls++;
      assert.equal(opts.headers["X-Refund-Idempotency"]?.length >=10,true);
      assert.equal(JSON.parse(opts.body).amount,44900);
      return new Response(JSON.stringify({id:"rfnd_MOCK1",payment_id:"pay_MOCK1",amount:44900,currency:"INR",status:"pending"}),{status:200});
    }
    return old.fetch(url,opts);
  };
  const server=createApp().listen(0);await new Promise(done=>server.once("listening",done));
  const base="http://127.0.0.1:"+server.address().port;
  async function req(path,admin=false,body) {
    const response=await old.fetch(base+path,{
      method:body===undefined?"GET":"POST",
      headers:{Cookie:(admin?"cg_admin_session="+aToken:"cg_session="+cToken),
        "X-CSRF-Token":csrf,"Content-Type":"application/json"},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    return {status:response.status,data:await response.json()};
  }
  try {
    const bad=await req("/api/orders/CGREFUND01/cancellation",false,{category:"other",reason:"short"});
    assert.equal(bad.status,400);
    const created=await req("/api/orders/CGREFUND01/cancellation",false,{category:"wrong_order",reason:"I need a different flavour of cake"});
    assert.equal(created.status,201);
    assert.equal(order.cancellation.status,"requested");
    const repeated=await req("/api/orders/CGREFUND01/cancellation",false,{category:"other",reason:"Trying to cancel my order again"});
    assert.equal(repeated.status,409);
    const review=await req("/api/admin/orders/CGREFUND01/cancellation-approval",true,{});
    assert.equal(review.status,200,JSON.stringify(review.data));
    assert.equal(order.status,"cancelled");
    assert.equal(order.cancellation.refund.status,"ready");
    assert.equal(refundCalls,0,"Approval must not move money");
    const approveAgain=await req("/api/admin/orders/CGREFUND01/cancellation-approval",true,{});
    assert.equal(approveAgain.status,409);
    const returned=await req("/api/admin/orders/CGREFUND01/cancellation-refund",true,{});
    assert.equal(returned.status,200,JSON.stringify(returned.data));
    assert.equal(order.cancellation.refund.status,"pending");
    assert.equal(order.paymentStatus,"paid","Pending bank refund is not fully refunded yet");
    assert.equal(refundCalls,1);
    const repeatedRefund=await req("/api/admin/orders/CGREFUND01/cancellation-refund",true,{});
    assert.equal(repeatedRefund.status,409);
    assert.equal(refundCalls,1,"A second refund must never be dispatched");
    const visible=await req("/api/orders/CGREFUND01");
    assert.equal(visible.status,200);
    assert.equal(visible.data.order.cancellation.refund.status,"pending");
    assert.equal(JSON.stringify(visible.data).includes("idempotencyKey"),false);
    // Provider's signed webhook updates final status. Simulate the verified
    // handler's persistence filter with the same matching fields.
    await Order.updateOne({razorpayPaymentId:"pay_MOCK1","cancellation.refund.id":"rfnd_MOCK1",
      "cancellation.refund.amount":44900,"cancellation.refund.status":{$nin:["processed","failed"]},
      "cancellation.status":"approved",paymentStatus:"paid"},
      {$set:{"cancellation.refund.status":"processed",paymentStatus:"refunded"}});
    assert.equal(order.paymentStatus,"refunded");
  } finally {
    await new Promise(done=>server.close(done));
    Session.findOne=old.customer;AdminSession.findOne=old.session;AdminUser.findById=old.admin;
    Order.findOne=old.find;Order.findOneAndUpdate=old.update;Order.updateOne=old.one;
    globalThis.fetch=old.fetch;
    for (const [key,value] of [["RAZORPAY_KEY_ID",old.key],["RAZORPAY_KEY_SECRET",old.secret]]) {
      if (value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
