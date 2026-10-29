import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays,indiaNow } from "../src/components/deliverySchedule.js";
import { phoneValid,pinValid,methodsAvailable,validateChatCart,validateChatDetails,calculateChatTotal,makeChatOrderPayload } from "../src/components/chatCheckout.mjs";

const product={id:"truffle",name:"Chocolate Truffle Cake",price:44900,weights:[0.5,1,1.5],unit:"kg",flavour:"Chocolate",eggless:true,photo:false,active:true};
const item={id:"basket-1",productId:"truffle",size:1,quantity:1,flavour:"Chocolate",eggless:true,addons:[]};
const catalog=[product],cart=[item];
const day=addCalendarDays(indiaNow().date,1);
const sender={name:"John Doe",phone:"9876543210"};
const address={name:"Jane Doe",phone:"9876543211",line1:"12 MG Road",line2:"Near Park",pincode:"560072",city:"Bengaluru",whatsapp:false};
const delivery={date:day,slot:"4 PM – 7 PM"};

test("chat checkout validates phone, pincode and available payment methods",()=>{
 assert.ok(phoneValid("9876543210"));assert.equal(phoneValid("1234567890"),false);
 assert.ok(pinValid("560072"));assert.equal(pinValid("000000"),false);
 assert.deepEqual(methodsAvailable({codEnabled:true,paymentsEnabled:false,testCodEnabled:false}).map(x=>x.id),["cod"]);
 assert.deepEqual(methodsAvailable({codEnabled:false,paymentsEnabled:false}),[]);
});

test("pricing uses catalogue discount, eggless surcharge and delivery plus tax",()=>{
 assert.equal(validateChatCart(cart,catalog),true);
 assert.deepEqual(calculateChatTotal({cart,catalog,deliveryFee:5000,taxRate:0}),{subtotal:90820,deliveryFee:5000,tax:0,total:95820});
});

test("empty cart and unsupported eggless request are not allowed",()=>{
 assert.throws(()=>validateChatCart([],catalog),/at least one cake/);
 assert.throws(()=>validateChatCart(cart,[{...product,eggless:false}]),/not available eggless/);
});

test("invalid delivery date and recipient details block order preview",()=>{
 assert.equal(validateChatDetails({sender,address,delivery,pincode:address.pincode}),true);
 assert.throws(()=>validateChatDetails({sender,address:{...address,phone:"123"},delivery,pincode:address.pincode}),/recipient/);
 assert.throws(()=>validateChatDetails({sender,address,delivery:{date:"2020-01-01",slot:"4 PM – 7 PM"},pincode:address.pincode}),/future delivery/);
 assert.throws(()=>validateChatDetails({sender,address,delivery,pincode:"560073"}),/pincode/);
});

test("checkout payload uses API shape and stable UUID idempotency key",()=>{
 const idempotencyKey="f17ca915-dcda-462b-af1a-a67348390d22";
 const body=makeChatOrderPayload({cart,sender,address,delivery,method:"cod",idempotencyKey});
 assert.equal(body.items.length,1);
 assert.equal(body.items[0].productId,"truffle");
 assert.equal(body.items[0].eggless,true);
 assert.equal(body.preferredMethod,"cod");
 assert.equal(body.idempotencyKey,idempotencyKey);
 assert.equal(body.sender.phone,"9876543210");
 assert.equal(body.gst,null);
});

test("order payload rejects invalid payment methods and invalid attempt IDs",()=>{
 assert.throws(()=>makeChatOrderPayload({cart,sender,address,delivery,method:"admin",idempotencyKey:"f17ca915-dcda-462b-af1a-a67348390d22"}),/payment method/);
 assert.throws(()=>makeChatOrderPayload({cart,sender,address,delivery,method:"cod",idempotencyKey:"no-id"}),/Invalid order attempt/);
});
