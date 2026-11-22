"use client";

// Runs a tiny script while the page loads (before the first paint). On the server the tag is real JavaScript;
// in the browser React renders it as plain text, so React doesn't warn and nothing runs twice.
// (Pattern from the Next.js guide "Preventing flash before hydration".)
export default function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
