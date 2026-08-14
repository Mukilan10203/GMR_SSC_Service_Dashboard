import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * The public landing page is the GMR Transformation Engine marketing site,
   * served verbatim from `public/landing.html` rather than rebuilt in React —
   * it is a static brochure page, and keeping it byte-identical to the
   * supplied `index.html` is the point. `beforeFiles` runs ahead of the app
   * router, so this wins over any `app/page.tsx`.
   *
   * Its "Customer Login" / "Enter Customer Workspace" buttons navigate to
   * `/login`, which is where the React portal takes over.
   */
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
