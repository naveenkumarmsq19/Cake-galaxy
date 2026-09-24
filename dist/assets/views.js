import { products, categories, images, addons, getProduct, money, sizeLabel, totals, unitPrice } from "./catalog.js";
import { state } from "./state.js";

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
export const nextDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));
const image = (src, alt, extra = "") => '<img src="' + src + '" alt="' + escapeHtml(alt) + '" ' + extra + '>';
const page = (body, extra = "") => '<div class="wrap page ' + extra + '">' + body + "</div>";
const crumb = (label) => '<div class="breadcrumb"><a href="#home">Home</a><span>/</span>' + label + "</div>";
const heading = (title, subtitle = "") => '<div class="page-heading"><div><h1>' + title + "</h1>" + (subtitle ? "<p>" + subtitle + "</p>" : "") + "</div></div>";
const field = (name, label, type = "text", value = "", extra = "") => '<div class="field"><label for="' + name + '">' + label + '</label><input id="' + name + '" name="' + name + '" type="' + type + '" value="' + escapeHtml(value) + '" ' + extra + "></div>";
const link = (label, route, style = "") => '<a class="button ' + style + '" href="#' + route + '">' + label + "</a>";

export function productCard(product) {
  const route = "#product?id=" + product.id;
  return '<article class="product-card"><a class="product-card-image" href="' + route + '">' + image(product.image, product.name, 'loading="lazy" width="400" height="400"') + '<span class="product-tag">' + product.badge + '</span></a><div class="product-card-info"><h3><a href="' + route + '">' + product.name + '</a></h3><div class="price-line"><span class="price">' + money(product.price) + '</span><small>' + sizeLabel(product) + '</small></div><p class="meta">' + (product.photo ? "Your photo. Your celebration." : "Personalise with a message") + "</p></div></article>";
}

export function home() {
  return page(
    '<section class="hero" aria-labelledby="hero-title">' + image(images.banner, "Ivory celebration cake with delicate sage details", 'class="hero-art" fetchpriority="high" width="1600" height="900"') + '<div class="hero-copy"><span class="overline">THE CELEBRATION EDIT</span><h1 id="hero-title">Made for<br><em>your moments.</em></h1><p>A beautiful cake. A memory to keep.</p>' + link("Shop cakes " + icon("arrow"), "shop") + '</div></section>' +
    '<section class="section occasions"><div class="section-heading"><div><h2>Every occasion, a cake.</h2></div><a class="text-link" href="#shop">View all ' + icon("arrow") + '</a></div><div class="category-grid">' + categories.map((category) => '<a class="category-tile" href="#shop?category=' + category.query + '"><span class="category-image">' + image(category.image, category.name, 'loading="lazy" width="200" height="200"') + "</span>" + category.name + "</a>").join("") + "</div></section>" +
    '<section class="section"><div class="section-heading"><div><h2>Find your favourite.</h2><p>Chocolate classics, floral finishes and more.</p></div><a class="text-link" href="#shop">View all ' + icon("arrow") + '</a></div><div class="products">' + products.slice(0, 4).map(productCard).join("") + "</div></section>" +
    '<section class="section custom-banner"><div class="custom-banner-copy"><span class="overline">MADE JUST FOR YOU</span><h2>Your idea.<br><em>Our finishing touch.</em></h2><p>Share a design you love. We’ll make it your own.</p>' + link("Create your cake " + icon("arrow"), "custom", "outline") + "</div>" + image(images.custom, "Two-tier celebration cake with seasonal berries", 'loading="lazy" width="700" height="430"') + "</section>" +
    '<section class="section"><div class="section-heading"><div><h2>More to love.</h2><p>A few more ways to make their day.</p></div><a class="text-link" href="#shop">View all ' + icon("arrow") + '</a></div><div class="products">' + products.slice(4, 8).map(productCard).join("") + "</div></section>",
    "home-page"
  );
}

export function shop(params) {
  const category = params.get("category") || "All";
  const query = (params.get("q") || "").trim();
  const sort = params.get("sort") || "recommended";
  let matches = products.filter((product) => (category === "All" || product.category.includes(category) || product.flavour === category) && (product.name + " " + product.flavour + " " + product.category.join(" ")).toLowerCase().includes(query.toLowerCase()));
  if (sort === "low") matches.sort((a, b) => a.price - b.price);
  if (sort === "high") matches.sort((a, b) => b.price - a.price);
  const options = ["All", "Birthday", "Anniversary", "Chocolate", "Kids", "Photo", "Designer", "Cupcakes"];
  const filterLink = (name) => '<a href="#shop?category=' + encodeURIComponent(name) + "&q=" + encodeURIComponent(query) + '" class="' + (category === name ? "active" : "") + '">' + (name === "All" ? "All cakes" : name) + "</a>";
  return page(
    crumb("Cakes") + heading(query ? 'Results for “' + escapeHtml(query) + '”' : category === "All" ? "Find your favourite cake" : escapeHtml(category) + " cakes", "A little personal touch makes all the difference.") +
    '<div class="catalog-toolbar"><span>' + matches.length + ' cakes to explore</span><select id="mobile-filter" class="mobile-filter" aria-label="Filter cakes">' + options.map((name) => '<option value="' + name + '"' + (name === category ? " selected" : "") + ">" + name + "</option>").join("") + '</select><select id="sort-cakes" aria-label="Sort cakes">' + [["recommended", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]].map(([value, title]) => '<option value="' + value + '"' + (sort === value ? " selected" : "") + ">" + title + "</option>").join("") + "</select></div>" +
    '<div class="catalog"><aside class="filters"><div class="filter-group"><h2>Shop by occasion</h2>' + options.map(filterLink).join("") + '</div><div class="filter-group"><h2>Shop by flavour</h2>' + ["Vanilla", "Dark Chocolate", "Chocolate Mint"].map(filterLink).join("") + '</div><a class="text-link" href="#shop">Clear filters</a></aside><div class="products">' + (matches.length ? matches.map(productCard).join("") : '<div class="empty-state">' + icon("search") + "<h2>No cakes found</h2><p>Try another flavour or clear the selected filters.</p>" + link("View all cakes", "shop") + "</div>") + "</div></div>"
  );
}

export function product(params) {
  const item = getProduct(params.get("id") || products[0].id);
  if (!item) return empty("That cake wasn't found", "Explore the collection to find another favourite.", "shop", "Explore cakes");
  return page(
    crumb('<a href="#shop">Cakes</a><span>/</span>' + item.name) +
    '<div class="detail-grid"><div class="detail-photo">' + image(item.image, item.name, 'width="650" height="650"') + '<p class="photo-footnote">' + icon("leaf") + "Every cake is finished by hand. Colours and details may vary.</p></div><div class=\"detail-panel\"><span class=\"overline\">" + item.badge + "</span><h1>" + item.name + '</h1><span class="detail-price" id="product-price">' + money(item.price) + '</span><p class="subtle">Starting price · ' + sizeLabel(item) + '</p><p class="detail-description">' + item.description + '</p><form id="product-form" data-product="' + item.id + '">' +
    '<div class="field-group"><span class="field-label">Choose ' + (item.unit === "pieces" ? "box size" : "weight") + '</span><div class="option-row">' + item.weights.map((weight, i) => '<label class="choice"><input type="radio" name="size" value="' + weight + '"' + (i === 0 ? " checked" : "") + "><span>" + sizeLabel(item, weight) + "</span></label>").join("") + '</div><label class="check-label"><input name="eggless" type="checkbox">Make it eggless <span class="subtle">+' + money(5000) + '</span></label></div><div class="field-group"><label for="flavour">Flavour</label><select id="flavour" name="flavour">' + [...new Set([item.flavour, ...(item.photo ? ["Chocolate", "Butterscotch"] : [])])].map((name) => "<option>" + name + "</option>").join("") + "</select></div>" +
    '<div class="field-group">' + field("message", 'Message on cake <small>(optional)</small>', "text", "", 'maxlength="30" placeholder="Happy Birthday, Anu!"') + "</div>" +
    (item.photo ? '<div class="field-group"><label class="upload-zone">' + icon("upload") + 'Add your photograph<input id="photo-file" type="file" accept="image/jpeg,image/png" required><small>JPG or PNG, up to 10 MB</small><img class="upload-preview" id="photo-file-preview" alt="Your selected photograph" hidden></label></div>' : "") +
    '<div class="field-group"><span class="field-label">Make it a little more special</span>' + addons.map((addon) => '<label class="check-label"><input type="checkbox" name="addon" value="' + addon.id + '">' + addon.name + ' <span class="subtle">+' + money(addon.price) + "</span></label>").join("") + '</div><div class="field-group"><button class="text-link" type="button" data-action="delivery">Check delivery to your pincode</button><p class="subtle">Choose your date and time in the bag.</p></div><div class="purchase-bar"><div class="quantity"><button type="button" data-action="product-minus" aria-label="Decrease quantity">−</button><output id="product-quantity">1</output><button type="button" data-action="product-plus" aria-label="Increase quantity">+</button></div><button class="button" type="submit">' + icon("bag") + ' Add to bag</button></div><p class="form-message" id="product-feedback" role="status"></p></form></div></div>' +
    '<section class="section"><div class="section-heading"><h2>You may also love</h2></div><div class="products">' + products.filter((entry) => entry.id !== item.id).slice(0, 4).map(productCard).join("") + "</div></section>"
  );
}

export function steps(current) {
  return '<nav class="flow-steps" aria-label="Checkout progress">' + [["cart", "Bag"], ["address", "Delivery"], ["checkout", "Payment"]].map(([route, title], index) => '<a class="' + (current === route ? "active" : "") + '" href="#' + route + '"' + (current === route ? ' aria-current="step"' : "") + "><b>" + (index + 1) + "</b>" + title + "</a>").join("") + "</nav>";
}

function summary(action = "") {
  const total = totals(state.cart, state.quote);
  return '<aside class="panel summary"><h2>Order summary</h2>' + state.cart.map((item) => {
    const product = getProduct(item.productId);
    return '<div class="compact-item">' + image(product.image, product.name) + "<span>" + product.name + "<small>" + sizeLabel(product, item.size) + " · Qty " + item.quantity + "</small></span></div>";
  }).join("") + '<div class="summary-row"><span>Subtotal</span><span>' + money(total.subtotal) + '</span></div><div class="summary-row"><span>Delivery</span><span>' + (total.delivery === null ? "Calculated at payment" : money(total.delivery)) + '</span></div><div class="summary-row total"><span>' + (total.delivery === null ? "Subtotal" : "Total") + "</span><span>" + money(total.total) + "</span></div>" + action + '<p class="small-print">Final charges are confirmed before you pay.</p></aside>';
}

export function cart() {
  if (!state.cart.length) return empty("Your bag is waiting", "Find a cake, add a personal touch and make someone's day.", "shop", "Find your cake");
  return page(steps("cart") + '<div class="checkout-layout"><div>' + heading("Your celebration bag") +
    '<div class="panel">' + state.cart.map((item) => {
      const product = getProduct(item.productId);
      return '<article class="cart-item">' + image(product.image, product.name) + '<div><h3><a href="#product?id=' + product.id + '">' + product.name + "</a></h3><p>" + sizeLabel(product, item.size) + " · " + escapeHtml(item.flavour) + (item.eggless ? " · Eggless" : "") + "</p>" + (item.message ? "<p>“" + escapeHtml(item.message) + "”</p>" : "") + (item.addons.length ? "<p>" + addons.filter((addon) => item.addons.includes(addon.id)).map((addon) => addon.name).join(", ") + "</p>" : "") + '<div class="quantity"><button data-action="cart-minus" data-id="' + item.id + '" aria-label="Decrease quantity">−</button><output>' + item.quantity + '</output><button data-action="cart-plus" data-id="' + item.id + '" aria-label="Increase quantity">+</button></div></div><div class="cart-price"><span>' + money(unitPrice(item) * item.quantity) + '</span><button class="icon-button" data-action="remove" data-id="' + item.id + '" aria-label="Remove ' + product.name + '">' + icon("trash") + "</button></div></article>";
    }).join("") + '</div><div class="panel"><h2>When is the celebration?</h2><div class="field-row">' + field("bag-date", "Preferred date", "date", state.deliveryDate, 'min="' + nextDate() + '"') + '<div class="field"><label for="bag-slot">Preferred time</label><select id="bag-slot"><option value="">Select a time</option>' + ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"].map((slot) => "<option" + (state.slot === slot ? " selected" : "") + ">" + slot + "</option>").join("") + '</select></div></div><p class="subtle">Availability and delivery charges are confirmed before payment.</p></div><p><a class="text-link" href="#shop">Continue shopping</a></p></div>' + summary(link("Add delivery details " + icon("arrow"), "address", "full")) + "</div>");
}

export function address() {
  if (!state.cart.length) return cart();
  const saved = state.address || {};
  return page(steps("address") + '<div class="checkout-layout"><div>' + heading("Where's the celebration?") +
    '<form class="panel" id="address-form"><div class="field-row">' + field("name", "Recipient name", "text", saved.name, 'autocomplete="name" maxlength="80" required') + field("phone", "Mobile number", "tel", saved.phone || state.phone, 'autocomplete="tel-national" inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" required') + "</div>" + field("line1", "House / flat and street", "text", saved.line1, 'autocomplete="address-line1" maxlength="160" required') + field("line2", "Area / landmark (optional)", "text", saved.line2, 'autocomplete="address-line2" maxlength="160"') + '<div class="field-row">' + field("pincode", "Pincode", "text", saved.pincode || state.pincode, 'autocomplete="postal-code" inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6" required') + field("city", "City", "text", saved.city || "Bengaluru", 'autocomplete="address-level2" maxlength="60" required') + '</div><div class="field-row">' + field("date", "Preferred delivery date", "date", state.deliveryDate, 'min="' + nextDate() + '" required') + '<div class="field"><label for="slot">Preferred time</label><select id="slot" name="slot" required><option value="">Select a time</option>' + ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"].map((slot) => '<option value="' + slot + '"' + (state.slot === slot ? " selected" : "") + ">" + slot + "</option>").join("") + '</select></div></div><label class="check-label"><input name="whatsapp" type="checkbox"' + (saved.whatsapp ? " checked" : "") + '>Send order updates to this number on WhatsApp.</label><p class="subtle">Mobile verification is required before paying.</p><button class="button full">Review your order ' + icon("arrow") + '</button></form></div>' + summary() + "</div>");
}

export function checkout() {
  if (!state.cart.length) return cart();
  if (!state.address) return address();
  const saved = state.address;
  return page(steps("checkout") + '<div class="checkout-layout"><div>' + heading("One last look") +
    '<div class="panel checkout-address"><div><h2>Delivering to</h2><p><strong>' + escapeHtml(saved.name) + "</strong><br>" + escapeHtml(saved.line1) + "<br>" + (saved.line2 ? escapeHtml(saved.line2) + "<br>" : "") + escapeHtml(saved.city) + " " + escapeHtml(saved.pincode) + "<br>+91 " + escapeHtml(saved.phone) + '</p><p class="subtle">' + escapeHtml(state.deliveryDate) + " · " + escapeHtml(state.slot) + '</p></div><a class="text-link" href="#address">Edit</a></div>' +
    '<form id="checkout-form"><div class="panel"><h2>How would you like to pay?</h2>' + [["upi", "UPI", "Google Pay, PhonePe and other UPI apps"], ["card", "Credit or debit card", "Choose your card in the secure payment window"], ["netbanking", "Netbanking", "Select your bank in the payment window"]].map(([id, title, description]) => '<label class="payment-option"><input type="radio" name="payment" value="' + id + '"' + (id === state.paymentMethod ? " checked" : "") + "><span><strong>" + title + "</strong><small>" + description + "</small></span></label>").join("") + '<p class="subtle">Available payment methods are confirmed by Razorpay.</p></div><div class="panel"><h2>Billing details</h2><label class="check-label"><input id="gst-toggle" type="checkbox" name="gst">Add GST details for a business invoice</label><div id="gst-fields" hidden>' + field("gstin", "GSTIN", "text", "", 'maxlength="15" pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"') + field("business", "Registered business name", "text", "", 'maxlength="120"') + field("billingAddress", "Business billing address", "text", "", 'maxlength="250"') + '</div><p class="subtle">An invoice will be available after the order is confirmed.</p></div><div class="panel"><label class="check-label"><input name="terms" type="checkbox" required>I agree to the terms and cancellation policy.</label><p class="subtle"><a class="text-link" href="#policy?type=terms">Terms</a> · <a class="text-link" href="#policy?type=refund">Cancellation & refunds</a></p><p class="form-message" id="payment-feedback" role="status"></p>' + (!state.authenticated ? '<p class="subtle">Phone verification is required. <button type="button" class="text-link" data-action="checkout-login">Verify your number</button></p>' : '<p class="subtle">Phone number verified.</p>') + '</div></form></div>' + summary('<button class="button full" form="checkout-form" type="submit" id="pay-button">Continue to Razorpay ' + icon("arrow") + '</button><p class="payment-trust">' + icon("lock") + "Payment details stay with Razorpay</p>") + "</div>");
}

export function custom() {
  return page(crumb("Custom cakes") + heading("A cake that's entirely you", "Share a reference or start with a sample style.") +
    '<div class="custom-layout"><div class="custom-images">' + image(images.floral, "Floral cake design") + [["Pastel flowers", images.floral], ["Berry tiers", images.custom], ["Rainbow layers", images.rainbow]].map(([name, src]) => '<button class="sample-button" data-action="sample" data-sample="' + name + '">' + image(src, name) + name + "</button>").join("") + '</div><form class="panel" id="custom-form"><h2>Tell us what you have in mind</h2><label class="upload-zone">' + icon("upload") + 'Upload a design reference<input id="custom-file" name="reference" type="file" accept="image/jpeg,image/png"><small>A photo, a sketch or a cake you love. JPG / PNG, up to 10 MB.</small><img class="upload-preview" id="custom-file-preview" alt="Your design reference" hidden></label><p class="subtle" id="sample-selection"></p><div class="field-group"><div class="field-row"><div class="field"><label for="occasion">Occasion</label><select id="occasion" name="occasion"><option>Birthday</option><option>Anniversary</option><option>Wedding</option><option>Baby shower</option><option>Other</option></select></div><div class="field"><label for="weight">Weight</label><select id="weight" name="weight"><option>1 kg</option><option>1.5 kg</option><option>2 kg</option><option>3 kg or more</option></select></div></div><div class="field-row"><div class="field"><label for="flavour">Flavour</label><select id="flavour" name="flavour"><option>Chocolate</option><option>Vanilla</option><option>Butterscotch</option><option>Red velvet</option></select></div>' + field("budget", "Budget (optional)", "number", "", 'min="0" placeholder="₹"') + '</div><div class="field"><label for="notes">Design notes</label><textarea id="notes" name="notes" maxlength="2000" placeholder="Colours, theme, name, age and any details you would like us to include."></textarea></div><div class="field-row">' + field("requiredDate", "Required date", "date", "", 'min="' + nextDate() + '" required') + field("customPincode", "Delivery pincode", "text", state.pincode, 'inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6" required') + "</div>" + field("customPhone", "Your mobile number", "tel", state.phone, 'inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" required') + '<p class="form-message" id="custom-feedback" role="status"></p><button class="button full">Request a design & quote</button><p class="subtle">We confirm the design, availability and final price before payment.</p></div></form></div>'
  );
}

export function login(otp = false) {
  return page('<section class="auth-layout"><div class="auth-photo">' + image(images.floral, "Pastel floral celebration cake") + '</div><div class="auth-content"><span class="overline">WELCOME TO CAKE GALAXY</span><h1>' + (otp ? "Just one more step." : "Good things start here.") + "</h1><p>" + (otp ? "Enter the code sent to +91 " + escapeHtml(state.phone) + "." : "Sign in with your mobile number to save your orders and check out securely.") + "</p>" +
    (otp ? '<form id="otp-form"><label for="otp">Verification code</label><input class="otp-input" id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required><button class="button full">Verify & continue</button><p class="form-message" id="auth-feedback" role="status"></p><button type="button" class="text-link" id="resend-otp" data-action="resend">Resend code</button></form>' :
      '<form id="login-form"><label for="login-phone">Mobile number</label><div class="phone-field"><span>+91</span><input id="login-phone" name="phone" inputmode="numeric" autocomplete="tel-national" pattern="[6-9][0-9]{9}" maxlength="10" value="' + escapeHtml(state.phone) + '" placeholder="10-digit mobile number" required></div><button class="button full">Send verification code</button><p class="form-message" id="auth-feedback" role="status"></p></form>') +
    '<p class="subtle">By continuing, you agree to our <a href="#policy?type=terms" class="text-link">Terms</a> and <a href="#policy?type=privacy" class="text-link">Privacy policy</a>.</p></div></section>');
}

export function empty(title, description, route, button) {
  return page('<div class="empty-state">' + icon("bag") + "<h1>" + title + "</h1><p>" + description + "</p>" + link(button, route) + "</div>");
}

export function orders() {
  if (!state.authenticated) return empty("Your celebrations, in one place", "Sign in to see your orders, delivery updates and invoices.", "login", "Sign in");
  return page(heading("My orders") + '<div id="orders-list" aria-live="polite"><p class="subtle">Loading your orders…</p></div>');
}

export function orderDetail() {
  const order = state.orderDetail || state.receipt;
  if (!order) return empty("Select an order", "Open My orders to view its details and payment status.", "orders", "My orders");
  const activeStep = ["confirmed", "preparing", "dispatched", "delivered"].indexOf(order.status);
  return page(crumb('<a href="#orders">My orders</a><span>/</span>' + escapeHtml(order.reference)) + heading("Order " + escapeHtml(order.reference)) +
    '<div class="checkout-layout"><div><div class="panel"><h2>' + escapeHtml(order.statusLabel || order.status) + '</h2><div class="status-steps">' + ["Confirmed", "Preparing", "Out for delivery", "Delivered"].map((label, index) => '<span class="' + (index <= activeStep ? "done" : "") + '">' + label + "</span>").join("") + '</div><p class="subtle">' + escapeHtml(order.deliveryLabel || "") + '</p></div><div class="panel"><h2>Need to change something?</h2><p class="subtle">Cancellation eligibility and any refund depend on your order and its preparation status.</p><button class="button outline" data-action="cancel-order">Request cancellation</button><p class="form-message" id="order-feedback" role="status"></p></div></div><aside class="panel summary"><h2>Payment details</h2><div class="summary-row total"><span>Total</span><span>' + money(order.amount || 0) + '</span></div><p class="subtle">' + escapeHtml(order.paymentStatus || "") + '</p><button class="button outline full" data-action="invoice">Download invoice</button></aside></div>');
}

export function confirmation() {
  const order = state.receipt;
  if (!order) return empty("No confirmed payment yet", "Your order will appear here after the payment is verified.", "cart", "View bag");
  return page('<div class="empty-state">' + icon("check") + '<span class="overline">ORDER ' + escapeHtml(order.reference) + '</span><h1>Let the celebrations begin.</h1><p>Your payment of ' + money(order.amount) + " is confirmed.</p>" + (order.whatsappSent ? '<p class="subtle">Your order confirmation has been sent on WhatsApp.</p>' : "") + link("View your order", "order-detail") + "</div>");
}

export function help() {
  return page(crumb("Help") + heading("A little help, when you need it") + '<div class="help-layout"><div>' +
    [["Can you deliver to my address?", "Enter your pincode using the delivery selector. Available dates, slots and charges are confirmed before payment."],
      ["Can I share my own cake design?", "Yes. Upload a clear reference image on the custom cake page. Include the size, flavour, date and the details you would like us to change."],
      ["Where can I get an invoice?", "After your order is confirmed, open My orders and select Download invoice. Add business billing details during checkout if you need them on the invoice."],
      ["Can I cancel or request a refund?", "Open your order to request cancellation. Eligibility, any charges and refund timing must be confirmed for that order before cancellation."]].map(([question, answer]) => '<details class="faq"><summary>' + question + "</summary><p>" + answer + "</p></details>").join("") +
    '</div><aside class="help-note"><span class="overline">CAKE GALAXY SUPPORT</span><h2>Let’s make it<br>a happy celebration.</h2><p>Get quick answers about your cake, delivery, custom designs and order support.</p><button class="button" data-action="chat">Start a conversation ' + icon("chat") + "</button></aside></div>");
}

export function policy(params) {
  const type = params.get("type") || "terms";
  const content = {
    refund: ["Cancellation & refunds", "Cancellation availability", "Cancellation and refund eligibility depend on the type of cake and the order's preparation status. Use the cancellation request inside My orders. A request is not a confirmed cancellation.", "Refund confirmation", "Any eligible amount, deductions and processing time must be confirmed by support for the specific order. Contact support before purchasing if you need clarification."],
    delivery: ["Delivery information", "Delivery availability", "Enter the recipient's pincode before ordering. Available delivery dates, time slots and charges are confirmed before payment.", "Custom cakes", "Custom designs need a separate availability and feasibility check. Do not consider a custom design confirmed until you receive an order confirmation."],
    privacy: ["Privacy information", "Your information", "Checkout requests the contact and delivery information needed for an order. Card and banking details are entered in the payment provider's secure checkout, not in a Cake Galaxy form.", "Policy availability", "The merchant's complete privacy notice and data-retention details must be available before online ordering is activated. Contact support with any privacy questions."],
    terms: ["Terms & conditions", "Order confirmation", "A cake in your bag is not a confirmed order. Availability, final pricing and delivery charges must be accepted before payment, and an order is confirmed only after payment verification.", "Before you order", "The merchant's full terms and cancellation rules must be finalised before online ordering is activated. Product images illustrate a style; handmade details can vary. Please confirm allergies and special dietary requirements with support."]
  }[type] || ["Terms", "Questions?", "Contact support before ordering.", "", ""];
  return page('<article class="policy-content">' + crumb(content[0]) + heading(content[0]) + "<h2>" + content[1] + "</h2><p>" + content[2] + "</p><h2>" + content[3] + "</h2><p>" + content[4] + '</p><a class="text-link" href="#help">Contact support</a></article>');
}
