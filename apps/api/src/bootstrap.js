import { hashPassword } from "./admin.js";

export async function bootstrapSuperAdmin(store, emailValue, password) {
  if (await store.exists({ role: "super_admin" })) return "existing";
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  if (!email || !password) return "missing";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== "string" || password.trim().length < 12 || password.length > 128) return "invalid";
  try { await store.create({ email, name: "Super Admin", passwordHash: await hashPassword(password), role: "super_admin", active: true }); }
  catch (error) { if (error.code === 11000) return "conflict"; throw error; }
  return "created";
}
