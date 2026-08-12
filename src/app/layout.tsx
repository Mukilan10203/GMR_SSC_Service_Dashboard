import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/state/session";

export const metadata: Metadata = {
  title: "SSC Customer Portal",
  description:
    "Shared Service Centre customer portal — services, usage, billing, performance and insights in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d2740",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
