// User-approved 0.5 kg cake prices, October 23, 2026. Amounts are INR, not paise.
// The 32 IDs are kept stable to preserve uploaded galleries and existing order references.
export const approvedCakePrices = [
  {
    "id": "menu-almond-alphonso-truffle",
    "name": "Almond Alphonso Cake",
    "halfKg": 449,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-black-current-truffle",
    "name": "Black Currant Cake",
    "halfKg": 379,
    "category": "Fruit Flavours"
  },
  {
    "id": "menu-black-forest",
    "name": "Black Forest Cake",
    "halfKg": 399,
    "category": "Regular Flavours"
  },
  {
    "id": "menu-blueberry-truffle",
    "name": "Blueberry Cake",
    "halfKg": 399,
    "category": "Fruit Flavours"
  },
  {
    "id": "menu-blueberry-cheese-cake",
    "name": "Blueberry Cheesecake",
    "halfKg": 649,
    "category": "Cheese Cakes"
  },
  {
    "id": "menu-choco-nuts",
    "name": "Choco Nut Cake",
    "halfKg": 449,
    "category": "Nuts Cake"
  },
  {
    "id": "menu-chocolate-chip",
    "name": "Chocolate Chip Cake",
    "halfKg": 479,
    "category": "Chocolate Flavours"
  },
  {
    "id": "menu-choco-pista",
    "name": "Choco Pista Cake",
    "halfKg": 599,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-choco-almond",
    "name": "Choco Almond Cake",
    "halfKg": 549,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-choco-dates",
    "name": "Choco Dates Cake",
    "halfKg": 499,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-chocolate-delight-cake",
    "name": "Chocolate Delight Cake",
    "halfKg": 549,
    "category": "Chocolate Flavours"
  },
  {
    "id": "menu-chocolate-and-oreo",
    "name": "Choco Oreo Cake",
    "halfKg": 499,
    "category": "Dual/Multi Flavours"
  },
  {
    "id": "menu-classic-chocolate-truffle",
    "name": "Chocolate Truffle Cake",
    "halfKg": 449,
    "category": "Chocolate Flavours"
  },
  {
    "id": "menu-death-by-chocolate",
    "name": "Death by Chocolate Cake",
    "halfKg": 549,
    "category": "Chocolate Flavours"
  },
  {
    "id": "menu-dry-fruit",
    "name": "Dry Fruit Cake",
    "halfKg": 599,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-ferraro-cake",
    "name": "Ferrero Rocher Cake",
    "halfKg": 699,
    "category": "Special Chocolate Cakes"
  },
  {
    "id": "menu-fruit-almond",
    "name": "Fruit Almond Cake",
    "halfKg": 699,
    "category": "Fresh Fruit Flavours"
  },
  {
    "id": "menu-german-black-forest",
    "name": "German Black Forest Cake",
    "halfKg": 449,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-hazelnut",
    "name": "Hazelnut Cake",
    "halfKg": 699,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-honey-almond-truffle",
    "name": "Honey Almond Cake",
    "halfKg": 449,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-keshar-badam-truffle",
    "name": "Kesar Badam Cake",
    "halfKg": 549,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-nutella-cake",
    "name": "Nutella Cake",
    "halfKg": 599,
    "category": "Special Chocolate Cakes"
  },
  {
    "id": "menu-oreo-forest",
    "name": "Oreo Forest Cake",
    "halfKg": 449,
    "category": "Regular Flavours"
  },
  {
    "id": "menu-pista-truffle",
    "name": "Pista Truffle Cake",
    "halfKg": 549,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-rainbow-6-wonders",
    "name": "Rainbow Cake",
    "halfKg": 699,
    "category": "Dual/Multi Flavours"
  },
  {
    "id": "menu-rasmalai-truffle",
    "name": "Rasmalai Cake",
    "halfKg": 699,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-red-velvet-cake",
    "name": "Red Velvet Cake",
    "halfKg": 599,
    "category": "Velvet Flavours"
  },
  {
    "id": "menu-regular-pineapple",
    "name": "Regular Pineapple Cake",
    "halfKg": 379,
    "category": "Regular Flavours"
  },
  {
    "id": "menu-regular-strawberry",
    "name": "Regular Strawberry Cake",
    "halfKg": 379,
    "category": "Regular Flavours"
  },
  {
    "id": "menu-rocky-road",
    "name": "Rocky Road Cake",
    "halfKg": 699,
    "category": "Dry Fruit Flavours"
  },
  {
    "id": "menu-triple-queen",
    "name": "Triple Queen Cake",
    "halfKg": 599,
    "category": "Dual/Multi Flavours"
  },
  {
    "id": "menu-white-forest-truffle",
    "name": "White Forest Cake",
    "halfKg": 399,
    "category": "Regular Flavours"
  }
];
export const approvedCakeIds = approvedCakePrices.map(cake => cake.id);
export const approvedWeightsKg = Object.freeze([0.5, 1, 2, 3, 4, 5]); // Approved cake sizes, maximum 5 kg
