import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const globalCss=file("../../app/globals.css");
const adminCss=file("../../app/admin/style.css");
const chatCss=file("../src/components/ChatOrderFlow.module.css");
const checkout=file("../src/screens/Checkout.jsx");
const product=file("../src/screens/Browse.jsx");
const adminProduct=file("../src/components/AdminProducts.jsx");

test("sitewide text input dimensions exclude checkbox and radio inputs",()=>{
  assert.match(globalCss,/input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),select,textarea\s*\{/);
  assert.doesNotMatch(globalCss,/(?:^|\n)input,select,textarea\s*\{/);
  assert.match(globalCss,/:where\(input\[type="checkbox"\],input\[type="radio"\]\)/);
  assert.match(globalCss,/width:\s*19px/);
  assert.match(globalCss,/height:\s*19px/);
  assert.match(globalCss,/flex:\s*0 0 19px/);
});

test("normal checkout renders enabled payment options as fixed-size radio cards",()=>{
  assert.equal((checkout.match(/className="payment-option"/g)||[]).length,3);
  assert.match(checkout,/name="paymentMethod" value="online"/);
  assert.match(checkout,/name="paymentMethod" value="cod"/);
  assert.match(checkout,/name="paymentMethod" value="test_cod"/);
  assert.match(globalCss,/\.payment-option\s*>\s*input\[type="radio"\]/);
  assert.match(globalCss,/\.payment-option:has\(input:checked\)/);
  assert.match(globalCss,/\.payment-option:focus-within/);
  assert.doesNotMatch(checkout,/className="check-label"><input type="radio"/);
});

test("checkout terms remain mandatory while policies are separate working links",()=>{
  assert.match(checkout,/name="acceptTerms" required/);
  assert.match(checkout,/className="checkout-terms"/);
  assert.match(checkout,/className="checkout-policy-links"/);
  assert.match(checkout,/href="\/policy\?type=terms"/);
  assert.match(checkout,/href="\/policy\?type=refund"/);
  assert.match(globalCss,/\.checkout-terms/);
});

test("product size and flavour radios retain keyboard accessible pill state",()=>{
  assert.match(product,/name="size" checked=/);
  assert.match(product,/name="flavourTier"/);
  assert.match(globalCss,/\.choice input:checked \+ span/);
  assert.match(globalCss,/\.choice input:focus-visible \+ span/);
  assert.match(globalCss,/\.choice input \{[^}]*min-width: 1px/);
});

test("product eggless and addons use grouped text beside fixed-size checkbox",()=>{
  assert.match(product,/check-label-copy">Make it eggless/);
  assert.match(product,/check-label-copy">\{addon\.name\}/);
  assert.match(globalCss,/\.check-label > input:is\(\[type="checkbox"\],\[type="radio"\]\)/);
  assert.match(globalCss,/\.check-label-copy/);
});

test("admin product toggles and chat checkout controls remain compact",()=>{
  assert.equal((adminProduct.match(/type="checkbox"/g)||[]).length,3);
  assert.match(adminCss,/\.admin-checks input\[type="checkbox"\]/);
  assert.match(adminCss,/\.admin-checks label:has\(input:disabled\)/);
  assert.match(adminCss,/\.admin-fields input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(chatCss,/\.paymentRadio\s*\{/);
  assert.match(chatCss,/\.paymentRadio:checked/);
  assert.match(chatCss,/\.termsCheckbox\s*\{/);
  assert.match(chatCss,/\.orderButton:disabled/);
});
