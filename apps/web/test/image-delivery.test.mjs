import test from "node:test";
import assert from "node:assert/strict";
import { imageDelivery } from "../src/components/imageDelivery.mjs";

const source = "https://ik.imagekit.io/yh2bfhc93/cake-galaxy/products/menu-white-forest-truffle/image-01.webp";
test("ImageKit image delivery selects bounded responsive images without changing the underlying asset", () => {
  const result = imageDelivery(source, "(max-width: 600px) 50vw, 260px");
  assert.equal(new URL(result.src).searchParams.get("tr"), "w-480,q-75");
  assert.match(result.srcSet, /w-160%2Cq-75 160w/);
  assert.match(result.srcSet, /w-960%2Cq-75 960w/);
  assert.equal(result.sizes, "(max-width: 600px) 50vw, 260px");
});
test("private, other-host and pre-transformed images are never modified", () => {
  for (const src of ["/api/product-images/private.jpg", "https://example.com/cake.jpg",
    source + "?tr=w-300", "javascript:alert(1)"]) {
    const result = imageDelivery(src);
    assert.equal(result.src, src);
    assert.equal(result.srcSet, undefined);
  }
});
