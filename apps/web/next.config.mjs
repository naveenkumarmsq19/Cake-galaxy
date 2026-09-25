const nextConfig = {
  output: process.env.CAKE_STATIC_EXPORT === "1" ? "export" : "standalone",
  trailingSlash: true,
  transpilePackages: ["@cake-galaxy/catalog"],
  images: { unoptimized: true }
};

export default nextConfig;
