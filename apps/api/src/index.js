import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { products } from "@cake-galaxy/catalog";
import { createApp } from "./app.js";
import { Product, Branch, ServiceArea, AdminUser } from "./models.js";
import { hashPassword } from "./admin.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy apps/api/.env.example to apps/api/.env and set a reachable MongoDB connection string.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const catalogueSeed = await Product.bulkWrite(products.map((product) => ({
    updateOne: {
      filter: { id: product.id },
      update: { $setOnInsert: { ...product, active: true } },
      upsert: true
    }
  })));
  if (catalogueSeed.upsertedCount) process.stdout.write("Initial sample catalogue added. Confirm product details and prices before enabling payments.\n");

  const initialBranches = [
    { code: "BR01", name: "Peenya", address: "Laggere Main Rd, Preethi Nagar, MEI Colony, Phase 3, Peenya, Bengaluru, Karnataka 560058", basePincode: "560058" },
    { code: "BR02", name: "Nagasandra", address: "1st Main Road, Chikkabidrikallu, Nagasandra, near Government School, Bengaluru, Karnataka 560073", basePincode: "560073" }
  ];
  await Branch.bulkWrite(initialBranches.map((branch) => ({
    updateOne: {
      filter: { code: branch.code },
      update: { $setOnInsert: { ...branch, radiusKm: 5, active: false } },
      upsert: true
    }
  })));
  const deliveryFee = Number(process.env.DELIVERY_FEE_PAISE || "4900");
  if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) throw new Error("DELIVERY_FEE_PAISE must be a non-negative whole number.");
  for (const branch of initialBranches) {
    const saved = await Branch.findOne({ code: branch.code });
    await ServiceArea.updateOne({ pincode: branch.basePincode }, { $setOnInsert: { pincode: branch.basePincode, branchId: saved._id, deliveryFee, active: true } }, { upsert: true });
  }
  if (!await AdminUser.exists({ role: "super_admin" })) {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (email && password) {
      await AdminUser.create({ email, name: "Super Admin", passwordHash: await hashPassword(password), role: "super_admin", active: true });
      process.stdout.write("Initial Super Admin created. Remove bootstrap secrets from the environment and restart.\n");
    } else process.stdout.write("Admin setup pending: set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD once, then restart.\n");
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
