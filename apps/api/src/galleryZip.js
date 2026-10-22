import { inflateRawSync } from "node:zlib";
import { HttpError } from "./validation.js";

// Strict subset of standard (non-ZIP64) ZIP: only numbered WebP files inside approved cake folders.
// Never write archive filenames to disk. All size checks precede decompression.
export function extractGalleryZip(input, approvedIds) {
  if (!Buffer.isBuffer(input) || input.length > 32_000_000) throw new HttpError(413, "Gallery bundle must be below 32 MB.");
  let end = -1;
  for (let i = input.length - 22; i >= Math.max(0, input.length - 65557); i--) {
    if (input.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || input.readUInt16LE(end + 4) !== 0 || input.readUInt16LE(end + 6) !== 0)
    throw new HttpError(400, "Invalid or multi-volume ZIP bundle.");
  const count = input.readUInt16LE(end + 10);
  const directoryLength = input.readUInt32LE(end + 12);
  const directoryOffset = input.readUInt32LE(end + 16);
  if (count > 160 || directoryOffset + directoryLength > end) throw new HttpError(400, "ZIP has too many entries or is damaged.");
  const groups = new Map();
  let offset = directoryOffset;
  let unpackedTotal = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || input.readUInt32LE(offset) !== 0x02014b50) throw new HttpError(400, "Invalid ZIP directory.");
    const flags = input.readUInt16LE(offset + 8);
    const method = input.readUInt16LE(offset + 10);
    const packedSize = input.readUInt32LE(offset + 20);
    const outputSize = input.readUInt32LE(offset + 24);
    const filenameLength = input.readUInt16LE(offset + 28);
    const extraLength = input.readUInt16LE(offset + 30);
    const commentLength = input.readUInt16LE(offset + 32);
    const localOffset = input.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + filenameLength + extraLength + commentLength;
    if (nextOffset > end) throw new HttpError(400, "Corrupt ZIP filename.");
    const filename = input.toString("utf8", offset + 46, offset + 46 + filenameLength);
    offset = nextOffset;
    const match = /^(menu-[a-z0-9-]+)\/image-[0-9]{2}\.webp$/.exec(filename);
    if (!match || !approvedIds.has(match[1])) continue; // manifest, directories, unapproved categories
    if (flags & 1 || ![0, 8].includes(method) || outputSize < 1 || outputSize >= 2_000_000 || packedSize > 2_000_000)
      throw new HttpError(400, "Unsupported or oversized gallery image in ZIP.");
    unpackedTotal += outputSize;
    if (unpackedTotal > 25_000_000) throw new HttpError(400, "Uncompressed images exceed the safe archive size.");
    if (localOffset + 30 > input.length || input.readUInt32LE(localOffset) !== 0x04034b50)
      throw new HttpError(400, "ZIP local entry is invalid.");
    const imageStart = localOffset + 30 + input.readUInt16LE(localOffset + 26) + input.readUInt16LE(localOffset + 28);
    if (imageStart + packedSize > input.length) throw new HttpError(400, "ZIP entry exceeds its file.");
    const compressed = input.subarray(imageStart, imageStart + packedSize);
    let photo;
    try { photo = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: 2_000_000 }); }
    catch { throw new HttpError(400, "Invalid compressed cake image."); }
    if (photo.length !== outputSize) throw new HttpError(400, "ZIP image size check failed.");
    const list = groups.get(match[1]) || [];
    if (list.length >= 16) throw new HttpError(400, "Maximum 16 photos per product.");
    list.push({ buffer: photo, mimetype: "image/webp", originalname: filename });
    groups.set(match[1], list);
  }
  if (!groups.size) throw new HttpError(400, "No known Cake Galaxy product folders found. Upload the prepared gallery bundle.");
  return groups;
}
