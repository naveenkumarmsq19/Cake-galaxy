import { getProduct, addons } from "./catalog.js";

const basketKey = "cakegalaxy.basket.v1";

function readBasket() {
  try {
    const saved = JSON.parse(localStorage.getItem(basketKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => {
      const product = getProduct(item.productId);
      return product && product.weights.includes(Number(item.size)) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20 && !product.photo;
    }).slice(0, 30).map((item) => ({
      id: /^[a-f0-9-]{36}$/i.test(item.id || "") ? item.id : crypto.randomUUID(),
      productId: item.productId,
      size: Number(item.size),
      quantity: item.quantity,
      flavour: String(item.flavour || getProduct(item.productId).flavour).slice(0, 60),
      eggless: item.eggless === true,
      message: String(item.message || "").slice(0, 30),
      addons: Array.isArray(item.addons) ? addons.filter((addon) => item.addons.includes(addon.id)).map((addon) => addon.id) : []
    }));
  } catch {
    return [];
  }
}

export const state = {
  cart: readBasket(),
  pincode: "",
  quote: null,
  address: null,
  deliveryDate: "",
  slot: "",
  phone: "",
  requestId: null,
  authenticated: false,
  csrfToken: "",
  afterLogin: "address",
  paymentMethod: "upi",
  receipt: null,
  orderDetail: null,
  customFile: null,
  customSample: "",
  photoFile: null,
  paymentAttempt: null,
  busy: false
};

export function saveBasket() {
  try {
    const portable = state.cart.filter((item) => !item.file);
    localStorage.setItem(basketKey, JSON.stringify(portable));
  } catch {
    // Shopping remains available when device storage is disabled.
  }
}

export function addItem(item) {
  state.cart.push({ ...item, id: crypto.randomUUID() });
  saveBasket();
}

export function updateQuantity(id, delta) {
  const item = state.cart.find((entry) => entry.id === id);
  if (item) item.quantity = Math.max(1, Math.min(20, item.quantity + delta));
  saveBasket();
}

export function removeItem(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  saveBasket();
}
