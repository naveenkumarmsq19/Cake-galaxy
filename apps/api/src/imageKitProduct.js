// Exact mapping from the 30 product ZIP archives uploaded by the store owner.
// Choco Oreo and Classic Chocolate Truffle did not have matching uploaded ZIPs;
// preserve those products' existing images rather than using incorrect photos.
export const imagekitEndpoint = "https://ik.imagekit.io/yh2bfhc93";
export const imagekitPhotoCounts = Object.freeze({
  "menu-almond-alphonso-truffle": 6,
  "menu-black-current-truffle": 6,
  "menu-black-forest": 7,
  "menu-blueberry-truffle": 7,
  "menu-blueberry-cheese-cake": 5,
  "menu-choco-nuts": 7,
  "menu-chocolate-chip": 8,
  "menu-choco-pista": 6,
  "menu-choco-almond": 7,
  "menu-choco-dates": 7,
  "menu-chocolate-delight-cake": 7,
  "menu-death-by-chocolate": 6,
  "menu-dry-fruit": 6,
  "menu-ferraro-cake": 8,
  "menu-fruit-almond": 8,
  "menu-german-black-forest": 6,
  "menu-hazelnut": 5,
  "menu-honey-almond-truffle": 7,
  "menu-keshar-badam-truffle": 6,
  "menu-nutella-cake": 6,
  "menu-oreo-forest": 6,
  "menu-pista-truffle": 8,
  "menu-rainbow-6-wonders": 7,
  "menu-rasmalai-truffle": 6,
  "menu-red-velvet-cake": 9,
  "menu-regular-pineapple": 6,
  "menu-regular-strawberry": 6,
  "menu-rocky-road": 6,
  "menu-triple-queen": 7,
  "menu-white-forest-truffle": 6
});

export function imageKitProduct(product) {
  if (!product || process.env.IMAGEKIT_GALLERIES_ENABLED !== "true") return product;
  const count = imagekitPhotoCounts[product.id];
  if (!count) return product;
  const images = Array.from({ length: count }, (_, i) =>
    imagekitEndpoint + "/cake-galaxy/products/" + product.id + "/image-" + String(i + 1).padStart(2, "0") + ".webp"
  );
  return { ...product, image: images[0], images };
}
