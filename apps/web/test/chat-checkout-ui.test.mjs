import test from "node:test";
import assert from "node:assert/strict";
import {checkoutPaymentDescriptions,checkoutSubmitState} from "../src/components/chatCheckoutUi.mjs";

const options=[{id:"cod",label:"Cash on Delivery"},{id:"online",label:"Online payment (UPI / card)"}];

test("CTA stays disabled with a helpful message until terms are accepted",()=>{
 assert.deepEqual(checkoutSubmitState({busy:false,accepted:false,methods:options,method:"online"}),{
   disabled:true,label:"Accept terms to continue"
 });
 assert.deepEqual(checkoutSubmitState({busy:false,accepted:true,methods:options,method:"online"}),{
   disabled:false,label:"Proceed to secure payment"
 });
});

test("COD and test COD CTA text correctly distinguish the payment methods",()=>{
 assert.deepEqual(checkoutSubmitState({busy:false,accepted:true,methods:options,method:"cod"}),{
   disabled:false,label:"Confirm & place COD order"
 });
 assert.deepEqual(checkoutSubmitState({
   busy:false,accepted:true,methods:[{id:"test_cod",label:"Test order"}],method:"test_cod"
 }),{disabled:false,label:"Place test order"});
});

test("disabled CTA handles unavailable methods, invalid method and processing safely",()=>{
 assert.deepEqual(checkoutSubmitState({busy:false,accepted:true,methods:[],method:"online"}),{
   disabled:true,label:"Payment options unavailable"
 });
 assert.deepEqual(checkoutSubmitState({busy:false,accepted:true,methods:options,method:"test_cod"}),{
   disabled:true,label:"Select a payment method"
 });
 assert.deepEqual(checkoutSubmitState({busy:true,accepted:true,methods:options,method:"online"}),{
   disabled:true,label:"Processing your order…"
 });
});

test("each payment method has customer-friendly explanatory copy",()=>{
 assert.match(checkoutPaymentDescriptions.cod,/delivered/);
 assert.match(checkoutPaymentDescriptions.online,/Razorpay/);
 assert.match(checkoutPaymentDescriptions.test_cod,/no payment/);
});
