import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/state/session";

export const metadata: Metadata = {
  title: "SSC Customer Portal | GMR Group",
  description:
    "Shared Service Centre customer portal — services, usage, billing, performance and insights in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003974",
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
