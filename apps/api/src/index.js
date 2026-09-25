import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { products } from "@cake-galaxy/catalog";
import { createApp } from "./app.js";
import { Product, ServiceArea } from "./models.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy apps/api/.env.example to apps/api/.env and set a reachable MongoDB connection string.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  if (!await Product.exists({})) {
    await Product.insertMany(products.map((product) => ({ ...product, active: true })));
    process.stdout.write("Initial sample catalogue added. Confirm product details and prices before enabling payments.\n");
  }
  if (!await ServiceArea.exists({})) {
    const pincodes = (process.env.SERVICEABLE_PINCODES || "").split(",").map((value) => value.trim()).filter(Boolean);
    if (pincodes.some((value) => !/^[1-9][0-9]{5}$/.test(value))) throw new Error("SERVICEABLE_PINCODES must contain valid six-digit Indian pincodes.");
    const deliveryFee = Number(process.env.DELIVERY_FEE_PAISE || "0");
    if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) throw new Error("DELIVERY_FEE_PAISE must be a non-negative whole number.");
    if (pincodes.length) await ServiceArea.insertMany([...new Set(pincodes)].map((pincode) => ({ pincode, deliveryFee, active: true })));
  }

  const port = Number(process.env.PORT || 4000);
  const server = createApp().listen(port, () => process.stdout.write("Cake Galaxy API listening on port " + port + "\n"));
  const shutdown = async () => { server.close(); await mongoose.disconnect(); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

start().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
