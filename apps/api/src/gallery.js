import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import { Product, ProductImage } from "./models.js";
import { HttpError, text } from "./validation.js";
import { extractGalleryZip } from "./galleryZip.js";

const maxUploadBytes = 2_000_000;
export const uploadableProductIds = new Set([
  "menu-almond-alphonso-truffle", "menu-black-current-truffle", "menu-black-forest",
  "menu-blueberry-truffle", "menu-blueberry-cheese-cake", "menu-choco-nuts",
  "menu-chocolate-chip", "menu-choco-almond", "menu-chocolate-delight-cake",
  "menu-death-by-chocolate"
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 12, fileSize: maxUploadBytes, fields: 2, parts: 14 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});
const imageUrl = id => "/api/product-images/" + id;
const idPattern = /^[a-f0-9-]{36}$/i;
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "cakeProductImages" });

async function compressedWebp(input) {
  let pixels;
  try {
    pixels = sharp(input, { limitInputPixels: 25_000_000, failOn: "error" }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
    for (const quality of [84, 74, 64, 54, 42]) {
      const bytes = await pixels.clone().webp({ quality, effort: 4 }).toBuffer();
      if (bytes.length < maxUploadBytes) return bytes;
    }
  } catch { throw new HttpError(400, "Please select a valid JPG, PNG or WebP photo."); }
  throw new HttpError(413, "This photo cannot be compressed below 2 MB. Try a smaller image.");
}

async function respondImage(req, res, canViewInactive) {
  if (!idPattern.test(req.params.imageId)) throw new HttpError(404, "Image not found.");
  const record = await ProductImage.findOne({ id: req.params.imageId }).lean();
  if (!record) throw new HttpError(404, "Image not found.");
  const product = await Product.exists({
    id: record.productId, deletedAt: null, images: imageUrl(record.id),
    ...(!canViewInactive ? { active: true } : {})
  });
  if (!product) throw new HttpError(404, "Image not available.");
  res.type("image/webp");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", canViewInactive ? "private, no-store" : "public, max-age=31536000, immutable");
  bucket().openDownloadStream(record.fileId).on("error", () => {
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  }).pipe(res);
}

async function storeProductPhotos(id, files) {
  const product = await Product.findOne({ id, deletedAt: null }).lean();
  if (!product) throw new HttpError(404, "Product not found.");
  if ((product.images || []).length + files.length > 16) throw new HttpError(400, "Maximum 16 images per product.");
  const results = [];
  for (const file of req.files) {
    const bytes = await compressedWebp(file.buffer);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const already = await ProductImage.findOne({ productId: id, hash }).lean();
    if (already) { results.push(imageUrl(already.id)); continue; }
    const imageId = randomUUID();
    const stream = bucket().openUploadStream(imageId + ".webp", { metadata: { productId: id } });
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
      stream.end(bytes);
    });
    try { await ProductImage.create({ id: imageId, productId: id, fileId: stream.id, hash, length: bytes.length }); }
    catch (error) { await bucket().delete(stream.id).catch(() => {}); throw error; }
    results.push(imageUrl(imageId));
  }
  const current = await Product.findOne({ id, deletedAt: null }).lean();
  if (!current) throw new HttpError(409, "Product was changed while uploading.");
  const images = [...new Set([...(current.images || []), ...results])];
  if (images.length > 16) throw new HttpError(400, "Maximum 16 images per product.");
  // Upload never automatically publishes a cake. Only merchant-reviewed product selection does.
  const saved = await Product.findOneAndUpdate({ id, deletedAt: null },
    { $set: { images, image: images[0] } }, { new: true, runValidators: true });
  return { images: saved.images, sizes: results.length };
}

export function createProductGalleryRouter() {
  const router = Router();
  router.get("/:imageId", async (req, res) => respondImage(req, res, false));
  return router;
}

export function registerAdminGalleryRoutes(router, requireSuper) {
  // These routes MUST be registered after the existing admin authentication + CSRF middleware.
  router.get("/product-images/:imageId", async (req, res) => respondImage(req, res, true));

  router.post("/products/:id/images", requireSuper, upload.array("images", 12), async (req, res) => {
    const id = text(req.params.id, 80);
    const product = await Product.findOne({ id, deletedAt: null }).lean();
    if (!product) throw new HttpError(404, "Product not found.");
    if (!req.files?.length) throw new HttpError(400, "Choose JPG, PNG or WebP photos (2 MB maximum per image).");
    if ((product.images || []).length + req.files.length > 16) throw new HttpError(400, "Maximum 16 images per product.");
    const saved = await storeProductPhotos(id, req.files);
    res.status(201).json(saved);
  });

  router.put("/products/:id/images/order", requireSuper, async (req, res) => {
    const id = text(req.params.id, 80);
    const product = await Product.findOne({ id, deletedAt: null }).lean();
    if (!product) throw new HttpError(404, "Product not found.");
    const current = product.images || [];
    const next = req.body?.images;
    if (!Array.isArray(next) || next.length !== current.length || new Set(next).size !== next.length || next.some(url => !current.includes(url)))
      throw new HttpError(400, "Provide the exact existing images in your preferred order.");
    const updated = await Product.findOneAndUpdate({ id, deletedAt: null },
      { $set: { images: next, ...(next.length ? { image: next[0] } : {}) } }, { new: true });
    res.json({ images: updated.images });
  });

  router.delete("/products/:id/images/:imageId", requireSuper, async (req, res) => {
    const id = text(req.params.id, 80);
    const imageId = text(req.params.imageId, 60);
    if (!idPattern.test(imageId)) throw new HttpError(400, "Invalid image.");
    const photo = await ProductImage.findOne({ id: imageId, productId: id }).lean();
    const product = await Product.findOne({ id, deletedAt: null }).lean();
    if (!photo || !product?.images?.includes(imageUrl(imageId))) throw new HttpError(404, "Product photo not found.");
    const remaining = product.images.filter(url => url !== imageUrl(imageId));
    await Product.findOneAndUpdate({ id, deletedAt: null },
      { $set: { images: remaining, ...(remaining.length ? { image: remaining[0] } : { active: false }) } });
    await ProductImage.deleteOne({ id: imageId, productId: id });
    await bucket().delete(photo.fileId).catch(() => {});
    res.json({ images: remaining });
  });

  const archiveUpload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 32_000_000 } });
  router.post("/catalogue/import-gallery-bundle", requireSuper, archiveUpload.single("bundle"), async (req, res) => {
    if (!req.file?.buffer) throw new HttpError(400, "Choose the prepared Cake Galaxy gallery ZIP.");
    const groups = extractGalleryZip(req.file.buffer, uploadableProductIds);
    const imported = [];
    for (const [id, files] of groups) {
      const result = await storeProductPhotos(id, files);
      imported.push({ id, images: result.images.length });
    }
    // Only switch public visibility AFTER validated photos have been saved.
    const disabled = await Product.updateMany({ active: true }, { $set: { active: false } });
    const enabled = await Product.updateMany({ id: { $in: [...groups.keys()] }, menuImported: true,
      deletedAt: null, "images.0": { $exists: true } }, { $set: { active: true } });
    res.json({ imported, enabled: enabled.modifiedCount, disabled: disabled.modifiedCount, skippedUnmatched: true });
  });

  router.post("/catalogue/publish-uploaded-only", requireSuper, async (_req, res) => {
    // Publication must never expose old seeded placeholders or unmatched menu entries.
    const disabled = await Product.updateMany({ active: true }, { $set: { active: false } });
    const enabled = await Product.updateMany({
      id: { $in: [
        ...uploadableProductIds
      ] },
      menuImported: true, deletedAt: null, "images.0": { $exists: true }
    }, { $set: { active: true } });
    res.json({ disabled: disabled.modifiedCount, enabled: enabled.modifiedCount });
  });
}
