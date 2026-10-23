import test from "node:test";
import assert from "node:assert/strict";
import { imageKitProduct, imagekitPhotoCounts, imagekitEndpoint } from "../src/imageKitProduct.js";

test("ImageKit gallery integration only switches on after explicit upload-complete enablement", () => {
  const original = process.env.IMAGEKIT_GALLERIES_ENABLED;
  const product = { id: "menu-black-forest", image: "/images/celebration.jpg", images: ["/api/product-images/old"] };
  try {
    delete process.env.IMAGEKIT_GALLERIES_ENABLED;
    assert.deepEqual(imageKitProduct(product), product);
    process.env.IMAGEKIT_GALLERIES_ENABLED = "true";
    const updated = imageKitProduct(product);
    assert.equal(updated.images.length, 7);
    assert.equal(updated.image, imagekitEndpoint + "/cake-galaxy/products/menu-black-forest/image-01.webp");
    assert.equal(updated.images.at(-1), imagekitEndpoint + "/cake-galaxy/products/menu-black-forest/image-07.webp");
    assert.deepEqual(imageKitProduct({id:"menu-classic-chocolate-truffle",image:"legacy.png"}),{id:"menu-classic-chocolate-truffle",image:"legacy.png"});
    assert.equal(Object.keys(imagekitPhotoCounts).length,30);
    assert.equal(Object.values(imagekitPhotoCounts).reduce((a,b)=>a+b,0),202);
  } finally {
    if (original===undefined)delete process.env.IMAGEKIT_GALLERIES_ENABLED;
    else process.env.IMAGEKIT_GALLERIES_ENABLED=original;
  }
});
