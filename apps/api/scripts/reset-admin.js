import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createInterface, emitKeypressEvents } from "node:readline";
import mongoose from "mongoose";
import { AdminSession, AdminUser } from "../src/models.js";
import { resetSuperAdminPassword } from "../src/bootstrap.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

function hiddenInput(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) throw new Error("Run this command in an interactive terminal.");
  emitKeypressEvents(process.stdin);
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onKey(character, key) {
      if (key?.ctrl && key.name === "c") return finish(new Error("Reset cancelled."));
      if (key?.name === "return" || key?.name === "enter") return finish();
      if (key?.name === "backspace") value = value.slice(0, -1);
      else if (character && !key?.ctrl && !key?.meta && !key?.sequence?.startsWith("\u001b") && value.length < 128) value += character;
    }
    process.stdin.on("keypress", onKey);
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in apps/api/.env first.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const admin = await AdminUser.findOne({ role: "super_admin" }).lean();
  if (!admin) throw new Error("No Super Admin exists. Use ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD to create one first.");
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await new Promise((resolve) => input.question("Type " + admin.email + " to confirm the account: ", resolve));
  input.close();
  if (confirmation.trim().toLowerCase() !== admin.email) throw new Error("Email did not match. Reset cancelled.");
  const password = await hiddenInput("New password (12–128 characters, hidden): ");
  const repeat = await hiddenInput("Confirm new password (hidden): ");
  if (password !== repeat) throw new Error("Passwords did not match. Reset cancelled.");
  await resetSuperAdminPassword(AdminUser, AdminSession, admin.email, password);
  process.stdout.write("Super Admin password updated. Existing admin sessions signed out.\n");
}

main().catch((error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
