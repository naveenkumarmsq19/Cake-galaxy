const origin = "https://cakegalaxy.in";

export default function sitemap() {
  return [
    { url: origin + "/", changeFrequency: "weekly", priority: 1 },
    { url: origin + "/shop/", changeFrequency: "weekly", priority: 0.9 },
    { url: origin + "/menu/", changeFrequency: "weekly", priority: 0.8 },
    { url: origin + "/custom/", changeFrequency: "monthly", priority: 0.8 },
    { url: origin + "/help/", changeFrequency: "yearly", priority: 0.4 }
  ];
}
