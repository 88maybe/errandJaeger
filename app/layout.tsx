import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import StimSync from "@/components/StimSync";
import "./globals.css";

// One typeface everywhere: designed to be very easy to tell letters apart. Headings use its bold weight.
const body = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "errandJaeger", template: "%s · errandJaeger" },
  description: "Turn Boston errands into a calmer bingo walk.",
  applicationName: "errandJaeger",
  appleWebApp: { capable: true, title: "errandJaeger", statusBarStyle: "black-translucent" },
};

// Makes the page fit phone screens properly, and colours the phone's browser bar to match.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b120f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable} data-stim="off">
      <body>
        <StimSync />
        <div className="shell">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
