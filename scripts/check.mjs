import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { products, addons, unitPrice, totals } from "../dist/assets/catalog.js";
import { state, addItem, updateQuantity, removeItem } from "../dist/assets/state.js";
import * as views from "../dist/assets/views.js";

for (const file of ["app.js", "api.js", "state.js", "catalog.js", "views.js"]) {
  execFileSync(process.execPath, ["--check", fileURLToPath(new URL("../dist/assets/" + file, import.meta.url))]);
}
for (const product of products) {
  assert.ok((await stat(new URL("../dist/" + product.image.replace("./", ""), import.meta.url))).size > 0);
  assert.ok(product.weights.length);
}
assert.equal(unitPrice({ productId: products[0].id, size: 0.5, quantity: 1, addons: [], eggless: false }), 74900);
assert.equal(unitPrice({ productId: products[0].id, size: 1, quantity: 1, addons: ["candles"], eggless: true }), 158700);
assert.equal(unitPrice({ productId: "missing", size: 1 }), 0);
assert.equal(addons[0].price, 3900);
assert.ok(views.escapeHtml('<img onerror="x">').includes("&lt;"));
assert.ok(!views.escapeHtml('<script>alert("x")</script>').includes("<script>"));

state.cart = [];
assert.ok(views.cart().includes("Your bag is waiting"));
assert.ok(views.confirmation().includes("No confirmed payment yet"));
addItem({ productId: products[0].id, size: 0.5, quantity: 1, flavour: "Chocolate", addons: ["candles"], eggless: true, message: "Happy Birthday" });
const id = state.cart[0].id;
assert.equal(totals(state.cart).subtotal, 83800);
assert.equal(totals(state.cart).delivery, null);
assert.equal(totals(state.cart, { available: true, deliveryFee: 4900 }).total, 88700);
updateQuantity(id, 1);
assert.equal(totals(state.cart).count, 2);
updateQuantity(id, -1);

state.address = { name: "Test Recipient", phone: "9000000000", line1: "Test address", line2: "", city: "Bengaluru", pincode: "560072" };
state.deliveryDate = views.nextDate();
state.slot = "4 PM – 7 PM";
state.phone = "9000000000";
const screens = [
  views.home(),
  views.shop(new URLSearchParams()),
  views.shop(new URLSearchParams("category=Birthday&sort=low")),
  views.shop(new URLSearchParams("q=does-not-exist")),
  views.product(new URLSearchParams("id=" + products[0].id)),
  views.product(new URLSearchParams("id=" + products[6].id)),
  views.custom(), views.cart(), views.address(), views.checkout(),
  views.login(), views.login(true), views.orders(), views.orderDetail(), views.help(),
  views.policy(new URLSearchParams("type=refund"))
];
for (const screen of screens) {
  assert.ok(screen.startsWith('<div class="wrap page'));
  assert.ok(!screen.includes("undefined"), "Rendered an undefined value");
  assert.ok(!screen.includes("NaN"), "Rendered a NaN value");
}
assert.ok(views.shop(new URLSearchParams("category=Cupcakes")).includes("Chocolate Mint Cupcake Box"));
assert.ok(!views.shop(new URLSearchParams("category=Cupcakes")).includes("Chocolate Truffle Cake"));
assert.ok(views.checkout().includes("Continue to Razorpay"));
removeItem(id);
assert.equal(state.cart.length, 0);

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
assert.ok(html.includes('name="viewport"'));
assert.ok(html.includes('type="module"'));
const css = await readFile(new URL("../dist/assets/styles.css", import.meta.url), "utf8");
assert.ok(css.includes("max-width: 580px"));
assert.ok(css.includes("prefers-reduced-motion"));
console.log("Passed: module syntax, local assets, pricing, cart updates, escaping and 16 screen renders.");
