import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import TabBar from "@/components/TabBar";
import TopBar from "@/components/TopBar";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow" });
const cond = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow-cond" });

export const metadata: Metadata = {
  title: "Splits",
  description: "Log your lifting split fast and see yourself get stronger.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E6E8EB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${cond.variable}`}>
      <body className="min-h-screen antialiased">
        <TopBar />
        <div className="mx-auto max-w-md min-h-screen pb-28">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
