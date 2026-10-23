import test from "node:test";
import assert from "node:assert/strict";
import { defaultCategories, suggestCategory, categorySlug } from "../src/categoryService.js";

test("maps approved cake names to new shop categories", () => {
  for (const [name, expected] of [
    ["Blueberry Cheesecake", "Cheesecakes"],
    ["German Black Forest Cake", "Forest Cakes"],
    ["Red Velvet Cake", "Velvet Cakes"],
    ["Choco Pista Cake", "Nut & Dry Fruit Cakes"],
    ["Black Currant Cake", "Fruit Cakes"],
    ["Rainbow Cake", "Special Cakes"],
    ["Ferrero Rocher Cake", "Chocolate Cakes"],
    ["Brand New Flavour", "Signature Cakes"]
  ]) assert.equal(suggestCategory({ name }, defaultCategories), expected);
});

test("disabled categories are skipped and new keyword rules can be added", () => {
  const configured = [{ name: "Matcha Cakes", active: true, keywords: ["matcha"], sortOrder: 1 }, ...defaultCategories];
  assert.equal(suggestCategory({ name: "Matcha Strawberry Cake" }, configured), "Matcha Cakes");
  configured[0].active = false;
  assert.equal(suggestCategory({ name: "Matcha Strawberry Cake" }, configured), "Fruit Cakes");
  assert.equal(categorySlug("Nut & Dry Fruit Cakes"), "nut-and-dry-fruit-cakes");
});
