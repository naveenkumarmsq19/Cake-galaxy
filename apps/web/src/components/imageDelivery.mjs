// Responsive delivery ONLY for public ImageKit assets. Keep private GridFS image URLs unchanged.
export function imageDelivery(source, sizes = "100vw", widths = [160, 320, 480, 640, 960]) {
  if (typeof source !== "string" || !source) return { src: source || "" };
  let url;
  try { url = new URL(source); } catch { return { src: source }; }
  if (url.protocol !== "https:" || url.hostname !== "ik.imagekit.io" || url.searchParams.has("tr")) {
    return { src: source };
  }
  const build = width => {
    const resized = new URL(url.href);
    resized.searchParams.set("tr", "w-" + width + ",q-75");
    return resized.toString();
  };
  const candidates = [...new Set(widths)].filter(w => Number.isInteger(w) && w > 0 && w <= 1920).sort((a, b) => a - b);
  if (!candidates.length) return { src: source };
  return {
    src: build(candidates[Math.min(2, candidates.length - 1)]),
    srcSet: candidates.map(width => build(width) + " " + width + "w").join(", "),
    sizes
  };
}
