import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { extractGalleryZip } from "../src/galleryZip.js";
import { uploadableProductIds } from "../src/gallery.js";

const fixture = "UEsDBBQAAAAIAPN2Vl1gwk9xQwAAAEQAAAAfAAAAbWVudS1ibGFjay1mb3Jlc3QvaW1hZ2UtMDEud2VicAvydHOzYWBgCHd1CggLsFAwALIvMDLMZdRiYgBBE9UFTCW7GH8wMG9g+PfhCPd/hZ2JpSeu/1ewf8L+p+H/j09A9QBQSwMEFAAAAAgA83ZWXWDCT3FDAAAARAAAACYAAABuZWVkcy1yZXZpZXctY2hvY28tcGlzdGEvaW1hZ2UtMDEud2VicAvydHOzYWBgCHd1CggLsFAwALIvMDLMZdRiYgBBE9UFTCW7GH8wMG9g+PfhCPd/hZ2JpSeu/1ewf8L+p+H/j09A9QBQSwMEFAAAAAgA83ZWXQx+f9gGAAAABAAAAAoAAABSRUFETUUudHh0K0ktLgEAUEsBAhQDFAAAAAgA83ZWXWDCT3FDAAAARAAAAB8AAAAAAAAAAAAAAIABAAAAAG1lbnUtYmxhY2stZm9yZXN0L2ltYWdlLTAxLndlYnBQSwECFAMUAAAACADzdlZdYMJPcUMAAABEAAAAJgAAAAAAAAAAAAAAgAGAAAAAbmVlZHMtcmV2aWV3LWNob2NvLXBpc3RhL2ltYWdlLTAxLndlYnBQSwECFAMUAAAACADzdlZdDH5/2AYAAAAEAAAACgAAAAAAAAAAAAAAgAEHAQAAUkVBRE1FLnR4dFBLBQYAAAAAAwADANkAAAA1AQAAAAA=";

test("Gallery ZIP importer extracts only approved cake folders and rejects other entries", async () => {
  const compressed = Buffer.from(fixture, "base64");
  const result = extractGalleryZip(compressed, uploadableProductIds);
  assert.deepEqual([...result.keys()], ["menu-black-forest"]);
  assert.equal(result.get("menu-black-forest").length, 1);
  const photo = result.get("menu-black-forest")[0].buffer;
  assert.equal((await sharp(photo).metadata()).format, "webp");
  assert.ok(photo.length < 2_000_000);
  assert.throws(() => extractGalleryZip(compressed, new Set(["menu-other-cake"])), /No known/);
  assert.throws(() => extractGalleryZip(Buffer.from("not a zip"), uploadableProductIds), /Invalid/);
});
