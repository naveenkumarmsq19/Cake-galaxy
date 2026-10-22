import test from "node:test";
import assert from "node:assert/strict";
import { menuSections, menuProducts, menuExtras, catalogueBasePrice, sizeLabel, unitPrice, weightKey } from "@cake-galaxy/catalog";

test("printed menu imports all 74 flavours into 14 categories with unique IDs", () => {
  assert.equal(menuSections.length, 14);
  assert.equal(menuProducts.length, 74);
  assert.equal(new Set(menuProducts.map(p => p.id)).size, 74);
  assert.ok(menuProducts.every(p => !p.active && p.menuImported && p.unit === "menu"));
  assert.ok(menuProducts.every(p => p.weights.every(code => p.variantPrices[weightKey(code)] > 0 && p.variantLabels[weightKey(code)])));
  assert.equal(menuExtras.length, 6);
});
test("Pastry / Small / Medium prices are exact and do not imply kilogram weights", () => {
  const vanilla = menuProducts.find(p => p.id === "menu-vanilla-cake");
  assert.ok(vanilla);
  assert.deepEqual(vanilla.weights,[1,2,3]);
  assert.deepEqual([1,2,3].map(size => catalogueBasePrice({ size },vanilla)),[4000,24900,39900]);
  assert.equal(sizeLabel(vanilla,2),"Small");
  assert.equal(unitPrice({ size:3,eggless:false,addons:[] },vanilla),39900);
  assert.equal(catalogueBasePrice({size:5},vanilla),0);
  const noPastry=menuProducts.find(p=>p.id==="menu-fruit-chocolate-truffle");
  assert.deepEqual(noPastry.weights,[2,3]);
  assert.equal(sizeLabel(noPastry,2),"Small");
  assert.equal(catalogueBasePrice({size:2},noPastry),64900);
  assert.equal(catalogueBasePrice({size:3},noPastry),119900);
});
