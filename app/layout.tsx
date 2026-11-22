import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

// Body text: designed to be very easy to tell letters apart.
const body = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });
// Headings: a warm, friendly serif.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "errandJaeger",
  description: "Turn Boston errands into a calmer bingo walk.",
};

// Makes the page fit phone screens properly.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <div className="shell">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
