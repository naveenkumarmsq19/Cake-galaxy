import test from "node:test";
import assert from "node:assert/strict";
import { policies } from "../../web/src/content/policies.js";

test("customer policy pages include meaningful coverage instead of placeholder sentences", () => {
  assert.deepEqual(Object.keys(policies).sort(), ["delivery", "privacy", "refund", "terms"]);
  for (const [name, policy] of Object.entries(policies)) {
    assert.ok(policy.title.length > 5, name);
    assert.ok(policy.intro.length > 40, name);
    assert.ok(policy.sections.length >= 4, name);
    assert.ok(policy.sections.every((section) => section.heading && ((section.paragraphs || []).length || (section.bullets || []).length)), name);
  }
  const allText = JSON.stringify(policies);
  assert.match(allText, /Razorpay/);
  assert.match(allText, /WhatsApp/);
  assert.match(allText, /My Orders/);
  assert.match(allText, /pincode/);
  assert.match(allText, /perishable/);
  assert.match(allText, /allergen/);
});
