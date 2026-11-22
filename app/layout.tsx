import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Pixelify_Sans } from "next/font/google";
import AppBar from "@/components/AppBar";
import BottomNav from "@/components/BottomNav";
import InlineScript from "@/components/InlineScript";
import StimSync from "@/components/StimSync";
import { ToastProvider } from "@/components/Toast";
import { BEFORE_PAINT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// One typeface everywhere: designed to be very easy to tell letters apart. Headings use its bold weight.
const body = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });
// Only the wordmark is pixel style.
const pixel = Pixelify_Sans({ weight: ["700"], subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: { default: "Errand Jaeger", template: "%s · Errand Jaeger" },
  description: "Turn Boston errands into a calmer bingo walk.",
  applicationName: "Errand Jaeger",
  appleWebApp: { capable: true, title: "errandJaeger", statusBarStyle: "black-translucent" },
};

// Makes the page fit phone screens properly, and colours the phone's browser bar to match.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf6ee",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme and Stim attributes are set before the first paint by the script below, so React keeps them.
    <html lang="en" className={`${body.variable} ${pixel.variable}`} data-theme="light" data-stim="off" suppressHydrationWarning>
      <head>
        <InlineScript html={BEFORE_PAINT_SCRIPT} />
      </head>
      <body>
        <StimSync />
        <ToastProvider>
          <div className="shell">
            <AppBar />
            {children}
          </div>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
