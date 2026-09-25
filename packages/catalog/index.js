export const images = {
  banner: "/images/celebration-banner.webp",
  chocolate: "/images/chocolate.jpg",
  celebration: "/images/celebration.jpg",
  floral: "/images/berry.jpg",
  rainbow: "/images/pastel.jpg",
  custom: "/images/custom.jpg",
  cupcakes: "/images/cupcakes.jpg"
};

export const products = [
  { id: "chocolate-truffle", name: "Chocolate Truffle Cake", price: 74900, category: ["Birthday", "Chocolate"], flavour: "Chocolate", image: images.chocolate, badge: "Chocolate", description: "Chocolate sponge, smooth chocolate cream and a glossy ganache finish.", weights: [0.5, 1, 1.5, 2], unit: "kg", eggless: true },
  { id: "pink-celebration", name: "Pink Celebration Cake", price: 89900, category: ["Birthday", "Kids"], flavour: "Vanilla", image: images.celebration, badge: "Birthday", description: "Vanilla sponge with pastel pink drips, cream swirls and a sprinkle finish.", weights: [0.5, 1, 1.5, 2], unit: "kg", eggless: true },
  { id: "floral-dream", name: "Pastel Floral Cake", price: 119900, category: ["Anniversary", "Designer"], flavour: "Vanilla", image: images.floral, badge: "Designer", description: "Soft pastel buttercream with hand-finished floral details for a special celebration.", weights: [1, 1.5, 2], unit: "kg", eggless: true },
  { id: "rainbow-celebration", name: "Rainbow Celebration Cake", price: 94900, category: ["Kids", "Birthday"], flavour: "Vanilla", image: images.rainbow, badge: "Colourful layers", description: "Colourful sponge layers finished with cream, sprinkles and playful stars.", weights: [0.5, 1, 1.5, 2], unit: "kg", eggless: true },
  { id: "berry-celebration", name: "Berry Celebration Cake", price: 249900, category: ["Anniversary", "Designer"], flavour: "Vanilla", image: images.custom, badge: "Two-tier design", description: "A tiered vanilla celebration cake with cream and seasonal berries.", weights: [2, 3, 4], unit: "kg", eggless: true },
  { id: "chocolate-mint-cupcakes", name: "Chocolate Mint Cupcake Box", price: 64900, category: ["Cupcakes", "Chocolate"], flavour: "Chocolate Mint", image: images.cupcakes, badge: "Box of 6", description: "Six chocolate cupcakes with mint-coloured frosting and a chocolate finish.", weights: [6, 12], unit: "pieces", eggless: true },
  { id: "personal-photo-cake", name: "Personalised Photo Cake", price: 99900, category: ["Photo", "Birthday"], flavour: "Vanilla", image: images.celebration, badge: "Add your photo", description: "Choose a flavour and upload a favourite photograph for your edible photo topper. Image shows the base style.", weights: [0.5, 1, 1.5, 2], unit: "kg", eggless: true, photo: true },
  { id: "dark-chocolate", name: "Dark Chocolate Celebration", price: 84900, category: ["Chocolate", "Anniversary"], flavour: "Dark Chocolate", image: images.chocolate, badge: "Dark chocolate", description: "Chocolate layers with a rich, dark chocolate finish and piped cream swirls.", weights: [0.5, 1, 1.5, 2], unit: "kg", eggless: true }
];

export const categories = [
  { name: "Birthday", image: images.celebration, query: "Birthday" },
  { name: "Anniversary", image: images.custom, query: "Anniversary" },
  { name: "Chocolate", image: images.chocolate, query: "Chocolate" },
  { name: "Kids' cakes", image: images.rainbow, query: "Kids" },
  { name: "Designer cakes", image: images.floral, query: "Designer" },
  { name: "Cupcakes", image: images.cupcakes, query: "Cupcakes" }
];

export const addons = [
  { id: "candles", name: "Celebration candles", price: 3900 },
  { id: "card", name: "Greeting card", price: 7900 },
  { id: "topper", name: "Birthday topper", price: 5900 }
];

export const getProduct = (id, list = products) => list.find((product) => product.id === id);
export const money = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
export const sizeLabel = (product, size = product.weights[0]) => size + (product.unit === "pieces" ? " pieces" : " kg");

export function unitPrice(item, product = getProduct(item.productId)) {
  if (!product || !product.weights.includes(Number(item.size))) return 0;
  const base = Math.round(product.price * Number(item.size) / product.weights[0]);
  const extras = addons.filter((addon) => (item.addons || []).includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0);
  return base + (item.eggless ? 5000 : 0) + extras;
}

export function totals(items, quote = null) {
  const subtotal = items.reduce((sum, item) => sum + unitPrice(item) * item.quantity, 0);
  const delivery = quote?.available === true && Number.isSafeInteger(quote.deliveryFee) ? quote.deliveryFee : null;
  return { subtotal, delivery, total: subtotal + (delivery || 0), count: items.reduce((sum, item) => sum + item.quantity, 0) };
}
